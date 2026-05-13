import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifySocketToken } from "./middleware/socketAuth";
import outageService from "../services/outageService";

interface Outage {
  id: string;
  longitude: number;
  latitude: number;
  locationName: string;
  description: string;
  status: string;
  severity: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  userId: string;
  _count: {
    confirmations: number;
  };
  affectedHomesEstimated: number | null;
}

// interface for socket data
interface SocketData {
  userId?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface CustomSocket extends Socket {
  data: SocketData;
}

class SocketService {
  private io: Server | null = null;

  // initialize socket.io server
  init(httpServer: HttpServer): Server {
    this.io = new Server(httpServer, {
      cors: {
        // TODO: update this for production
        origin: "*",
        credentials: true,
      },
      // Connection options
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // log all Socket.io requests
    this.io?.engine.on("connection_error", (err) => {
      console.log("Socket connection error:", err);
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    console.log("Socket.io server initialized");
    console.log("Listening on path: /socket.io");
    return this.io;
  }

  // Setup authentication middleware
  private setupMiddleware() {
    if (!this.io) return;

    // Authentcate socket connections
    this.io.use(async (socket: CustomSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          // Allow anonymous connections but mark as unauthenticated
          socket.data.userId = undefined;
          return next();
          // return next(new Error("Authentication error: No token provided"));
        }

        // Verify JWT token
        const decodedToken = await verifySocketToken(token);
        socket.data.userId = decodedToken.userId;
        next();
      } catch (error) {
        console.error("Socket authentication error:", error);
        // Still allow connection but as anonymous
        next();
        return next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  //   Setup event handlers
  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on("connection", (socket: CustomSocket) => {
      console.log(`Client connected: ${socket.id}`);
      socket.emit("hello", "world");
      socket.on("test:client", (message) => {
        console.log(message);
      });

      // Handle user joining with location
      socket.on(
        "join:location",
        (location: { lat: number; lng: number; radius?: number }) => {
          this.handleJoinLocation(socket, location);
        },
      );

      // Handle leaving location updates
      socket.on("leave:location", () => {
        this.handleLeaveLocation(socket);
      });

      //   Handle disconnect
      socket.on("disconnect", (reason) => {
        console.log(`Client disconnected: ${socket.id} - ${reason}`);
        this.handleLeaveLocation(socket);
      });
      this.sendCurrentStats(socket);
    });
  }

  //   Join location-based room
  private handleJoinLocation(
    socket: CustomSocket,
    location: { lat: number; lng: number; radius?: number },
  ) {
    // Store user location in socket data
    socket.data.location = location;

    // Calculate geographic room (grid-based)
    const room = this.getGeographicRoom(location.lat, location.lng);

    // Join the room
    socket.join(room);

    console.log(`Socket ${socket.id} joined room: ${room}`);

    // Notify user they've joined
    socket.emit("location:joined", { room, location });
  }

  //   Leave location-based room
  private handleLeaveLocation(socket: CustomSocket) {
    if (socket.data.location) {
      const room = this.getGeographicRoom(
        socket.data.location.lat,
        socket.data.location.lng,
      );
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    }
  }

  // Calculate geographic room based on coordinates
  // Uses a grid system to group nearby users
  private getGeographicRoom(lat: number, lng: number): string {
    // Grid size: ~10km per cell
    const gridSize = 0.1; //degrees
    const latGrid = Math.floor(lat / gridSize);
    const lngGrid = Math.floor(lng / gridSize);

    return `geo:${latGrid}:${lngGrid}`;
  }

  // Get all rooms for a given location (including adjacent cells)
  private getAdjacentRooms(lat: number, lng: number): string[] {
    const gridSize = 0.1;
    const latGrid = Math.floor(lat / gridSize);
    const lngGrid = Math.floor(lng / gridSize);

    const rooms: string[] = [];

    // Current cell + 8 adjacent cells (3x3 grid)
    for (let latOffset = -1; latOffset <= 1; latOffset++) {
      for (let lngOffset = -1; lngOffset <= 1; lngOffset++) {
        rooms.push(`geo:${latGrid + latOffset}:${lngGrid + lngOffset}`);
      }
    }
    return rooms;
  }

  //   Send current statistics to newly connected socket
  private async sendCurrentStats(socket: Socket) {
    try {
      // Get current stats from database
      const stats = {
        activeOutages: (await outageService.getStatistics()).activeCount,
        onlineUsers: this.io?.engine.clientsCount,
        resolvedToday: (await outageService.getStatistics()).resolvedTodayCount,
      };
      socket.emit("stats:update", stats);
    } catch (error) {
      console.error("Error sending stats:", error);
    }
  }

  //   Broadcast new outage to relevant rooms
  async broadcastNewOutage(outage: Outage) {
    if (!this.io) return;

    // Get all rooms that should receive this outage
    const rooms = this.getAdjacentRooms(outage.latitude, outage.longitude);

    // Emit to all relevant rooms
    rooms.forEach((room) => {
      this.io!.to(room).emit("outage:new", {
        id: outage.id,
        locationName: outage.locationName,
        description: outage.description,
        latitude: outage.latitude,
        longitude: outage.longitude,
        status: outage.status,
        severity: outage.severity,
        affectedHomeEstimate: outage.affectedHomesEstimated,
        createdAt: outage.createdAt,
        _count: {
          confirmations: outage._count.confirmations,
        },
      });
    });
    console.log(`Broadcasted new outage ${outage.id} to ${rooms.length} rooms`);

    // Also update global stats
    this.braodcastStatsUpdate();
  }

  //   Broadcast outage confirmation
  async broadcatOutageConfirmation(outage: Outage) {
    if (!this.io) return;

    this.io.emit("outage:confirmed", {
      outage,
    });

    console.log(
      `Broadcast confirmationfor outage ${outage.id} & ${outage._count.confirmations}`,
    );
  }

  // Broadcast outage status change
  async broadcastOutageStatusChange(outage: Outage) {
    this.io?.emit("outage:status_change", {
      outage,
    });

    // console.log(`Broadcast status change for outage ${outageId} to ${status}`);
    console.log(
      `Broadcast status change for outage ${outage.id} to ${outage.status}`,
    );

    this.braodcastStatsUpdate();
  }

  //   Broadcast stats update to all connected clients
  async braodcastStatsUpdate() {
    if (!this.io) return;

    const stats = {
      activeOutages: (await outageService.getStatistics()).activeCount,
      onlineUsers: this.io.engine.clientsCount,
      resolvedToday: (await outageService.getStatistics()).resolvedTodayCount,
    };

    this.io.emit("stats:update", stats);
  }

  //  Get Socket.io instance
  getIo(): Server | null {
    return this.io;
  }
}

export default new SocketService();
