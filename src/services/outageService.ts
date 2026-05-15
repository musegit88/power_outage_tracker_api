import prisma from "../config/database";
import { OutageStatus } from "../generated/prisma/enums";
import { CreateOutage, OutageWithDistance, RateLimitType } from "../types";
import rateLimitService from "./rateLimitService";
import socketService from "../socket";

export class OutageService {
  // Check if there are active outages within a given radius
  async hasNearbyActiveOutage(
    latitude: number,
    longitude: number,
    radiusKm = 1,
  ) {
    // Get all active outages within a given radius
    const nearbyOutages = await prisma.$queryRaw<OutageWithDistance[]>`
    SELECT
     o.id,
     o."locationName",
     o.description,
     o.latitude,
     o.longitude,
     o.status,
     o.severity,
     o."affectedHomesEstimated",
     o."createdAt",
     ST_Distance(
      o.coordinates,
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
     ) / 1000 as distanceKm
    FROM outages o
    WHERE o.status = ${OutageStatus.ACTIVE}
    AND ST_DWithin(
      o.coordinates,
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
      ${radiusKm * 1000}
    )
    `;
    return { exists: nearbyOutages.length > 0, nearbyOutages };
  }
  // create outage
  async createOutage(outageData: CreateOutage) {
    // check rate limit before creating outage
    const rateLimitStatus = await rateLimitService.checkRateLimit(
      outageData.userId,
      RateLimitType.OUTAGE,
    );

    if (!rateLimitStatus.allowed) {
      // Throw error with rate limit status
      const error = new Error("Rate limit exceeded");
      (error as any).rateLimitStatus = rateLimitStatus;
      throw error;
    }

    // check if there are active outages within a given radius before creating outage
    const { exists, nearbyOutages } = await this.hasNearbyActiveOutage(
      outageData.latitude,
      outageData.longitude,
    );
    if (exists) {
      //  Throw error with details about nearby outages
      const error = new Error("Outage already exists nearby");
      (error as any).nearbyOutages = nearbyOutages as OutageWithDistance[];
      throw error;
    }
    const outage = await prisma.outage.create({
      data: {
        userId: outageData.userId,
        locationName: outageData.locationName,
        description: outageData.description,
        latitude: parseFloat(outageData.latitude.toString()),
        longitude: parseFloat(outageData.longitude.toString()),
        affectedHomesEstimated: outageData.affectedHomesEstimated,
        whatHappened: outageData.whatHappened,
        status: outageData.status,
        severity: outageData.severity,
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            confirmations: true,
            comments: true,
          },
        },
      },
    });
    // Record the action for rate limiting
    await rateLimitService.recordAction(
      outageData.userId,
      RateLimitType.OUTAGE,
    );

    // Emit REAL-TIME EVENT
    await socketService.broadcastNewOutage(outage);
    return outage;
  }

  //   Get all outages
  async getAllOutages(
    limit: number = 50,
    offset: number = 0,
    status?: OutageStatus,
  ) {
    const outages = await prisma.outage.findMany({
      where: {
        status: status ? status : {},
      },
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            confirmations: true,
            comments: true,
          },
        },
      },
    });
    return outages;
  }

  //   Get single outage

  async getOutageById(outageId: string) {
    const outage = await prisma.outage.findUnique({
      where: {
        id: outageId,
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            confirmations: true,
            comments: true,
          },
        },
      },
    });
    return outage;
  }

  //   Find nearby outages

  async getNearByOutages(
    latitude: number,
    longitude: number,
    radiusKm = 10,
    limit: number = 50,
  ) {
    const outages = await prisma.$queryRaw<OutageWithDistance[]>`
    SELECT 
      o.id,
      o."locationName",
      o.description,
      o.latitude,
      o.longitude,
      o.status,
      o.severity,
      o."affectedHomesEstimated",
      o."createdAt",
      ST_Distance(
        o.coordinates,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      ) / 1000 as distanceKm
    FROM outages o
    LEFT JOIN confirmations c ON o.id = c."outageId"
    WHERE o.status = ${OutageStatus.ACTIVE}
    AND ST_DWithin(
      o.coordinates,
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}),4326)::geography,
      ${radiusKm * 1000}
    )
    GROUP BY o.id
    ORDER BY distanceKm
    LIMIT ${limit}
    `;

    return outages;
  }

  async getInMapBounds(
    neLat: number,
    neLng: number,
    swLat: number,
    swLng: number,
  ) {
    const outages: [] = await prisma.$queryRaw`
    SELECT 
      o.id,
      o."locationName",
      o.description,
      o.latitude,
      o.longitude,
      o.status,
      o.severity,
      COUNT(DISTINCT c.id)::int as "confirmationCount"
    FROM outages o
    LEFT JOIN confirmations c ON o.id = c."outageId"
    WHERE o.coordinates && ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326)::geography
    GROUP BY o.id
     `;

    return { count: outages.length, outages };
  }

  async updateStatus(id: string, status: OutageStatus) {
    const outage = await prisma.outage.update({
      where: {
        id,
      },
      data: {
        status,
        resolvedAt: status === OutageStatus.RESOLVED ? new Date() : null,
      },
      include: {
        _count: {
          select: {
            confirmations: true,
          },
        },
      },
    });

    // Emit REAL-TIME EVENT
    await socketService.broadcastOutageStatusChange(outage);
    return outage;
  }

  async addConfirmation(outageId: string, userId: string) {
    // check rate limit before confirming outage
    const rateLimitStatus = await rateLimitService.checkRateLimit(
      userId,
      RateLimitType.CONFIRMATION,
    );

    if (!rateLimitStatus.allowed) {
      const error = new Error("Rate limit exceeded");
      (error as any).rateLimitStatus = rateLimitStatus;
      throw error;
    }

    // check if user has already confirmed the outage
    const existingConfirmation = await prisma.confirmation.findUnique({
      where: {
        outageId_userId: {
          outageId,
          userId,
        },
      },
    });

    if (existingConfirmation) {
      throw new Error("Already confirmed this outage");
    }

    // create confirmation
    const confirmation = await prisma.confirmation.create({
      data: {
        outageId,
        userId: userId,
      },
      include: {
        outage: {
          include: {
            _count: {
              select: {
                confirmations: true,
              },
            },
          },
        },
      },
    });

    // Record the action for rate limiting
    await rateLimitService.recordAction(userId, RateLimitType.CONFIRMATION);

    // Emit REAL-TIME EVENT
    await socketService.broadcatOutageConfirmation(confirmation.outage);

    return confirmation;
  }

  async deleteOutage(id: string) {
    await prisma.outage.delete({
      where: {
        id,
      },
    });
  }

  async getStatistics() {
    const [activeCount, resolvedCount, resolvedTodayCount, totalCount] =
      await Promise.all([
        prisma.outage.count({ where: { status: OutageStatus.ACTIVE } }),
        prisma.outage.count({ where: { status: OutageStatus.RESOLVED } }),
        prisma.outage.count({
          where: {
            status: OutageStatus.RESOLVED,
            resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        prisma.outage.count(),
      ]);

    return {
      activeCount,
      resolvedCount,
      resolvedTodayCount,
      totalCount,
    };
  }
}

export default new OutageService();
