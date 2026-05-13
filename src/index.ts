import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import outageRoutes from "./routes/outage.routes";
import { limiter } from "./middleware/limiter.middleware";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "http";
import socketService from "./socket";

dotenv.config();

const app = express();
const port = process.env.PORT || 3004;

// Create HTTP server
const httpServer = createServer(app);

// Intialize Socket.io
const io = socketService.init(httpServer);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);
app.use(
  // TODO: update this for production
  cors({
    origin: "*",
    credentials: true,
  }),
);

// Rate limiting
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
if (process.env.NODE_ENV === "development") {
  // @ts-ignore
  app.use((req, res, next) => {
    fs.writeFile(
      path.join(__dirname, "../logs/requests.log"),
      `${req.method} ${req.path} ${req.ip} ${new Date().toISOString()}\n`,
      { flag: "a" },
      (err) => {
        if (err) {
          console.error(err);
        }
      },
    );
    console.log(
      `${req.method} ${req.path} ${req.ip} ${new Date().toISOString()}`,
    );
    next();
  });
}

// Make io accessible in routes
app.set("io", io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/outages", outageRoutes);

// @ts-ignore
app.get("/health", (req, res) => {
  res.json({
    message: "Power Outage Tracker API is running",
    status: "ok",
    timeStamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Socket.io health check
// @ts-ignore
app.get("/socket-health", (req, res) => {
  res.json({
    status: "ok",
    connections: io.engine.clientsCount,
    rooms: Array.from(io.sockets.adapter.rooms.keys()),
  });
});

// Route not found/404 handler
//@ts-ignore
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`WebSocket server ready`);
});
