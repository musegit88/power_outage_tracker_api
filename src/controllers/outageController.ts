import rateLimitService from "../services/rateLimitService";
import { OutageStatus } from "../generated/prisma/enums";
import outageService from "../services/outageService";
import { CreateOutage, OutageWithDistance, RateLimitStatus } from "../types";
import { Request, Response } from "express";

export class OutageController {
  async createOutage(req: Request, res: Response) {
    try {
      const outage = await outageService.createOutage(
        req.body as unknown as CreateOutage,
      );
      return res.status(201).json({
        message: "Outage created successfully",
        outage,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Rate limit exceeded") {
        const rateLimitStatus = (error as any)
          .rateLimitStatus as RateLimitStatus;
        return res.status(429).json({
          error: "Rate limit exceeded",
          message: rateLimitStatus.message,
          resetAt: rateLimitStatus.resetAt,
          remaining: rateLimitStatus.remaining,
        });
      }
      if (
        error instanceof Error &&
        error.message === "Outage already exists nearby"
      ) {
        const nearbyOutages = (error as any)
          .nearbyOutages as OutageWithDistance[];
        return res.status(409).json({
          error: "An outage already exists in this area",
          message:
            "There are already active outage reports within 1km of this location. Please confirm the existing outage instead of creating a new one",
          nearbyOutages: nearbyOutages.map((outage) => ({
            id: outage.id,
            locationName: outage.locationName,
            description: outage.description,
            distanceKm: outage.distanceKm || 0,
            status: outage.status,
            severity: outage.severity,
            affectedHomesEstimated: outage.affectedHomesEstimated,
            createdAt: outage.createdAt,
          })),
        });
      }
      console.error("Error creating outage:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async getAllOutages(req: Request, res: Response) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const outages = await outageService.getAllOutages(
        Number(limit),
        Number(offset),
        status as OutageStatus,
      );
      return res.json({ outages, count: outages.length });
    } catch (error) {
      console.error("Error getting all outages:", error);
      return res.status(500).json({ error: "Faild to fetch outages" });
    }
  }

  async getOutageById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const outage = await outageService.getOutageById(id.toString());
      return res.json(outage);
    } catch (error) {
      console.error("Error getting outage by Id:", error);
      return res.status(500).json({ error: "Failed to fetch outage" });
    }
  }

  async getNearByOutages(req: Request, res: Response) {
    try {
      const {
        lat: latitude,
        lng: longitude,
        radius = 10,
        limit = 50,
      } = req.query;
      const outages = await outageService.getNearByOutages(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        parseFloat(radius as string),
        parseInt(limit as string),
      );
      return res.json({ outages, count: outages.length });
    } catch (error) {
      console.error("Error getting nearby outages:", error);
      return res.status(500).json({ error: "Failed to fetch nearby outages" });
    }
  }

  async getInMapBounds(req: Request, res: Response) {
    try {
      const { neLat, neLng, swLat, swLng } = req.query;
      const outages = await outageService.getInMapBounds(
        parseFloat(neLat as string),
        parseFloat(neLng as string),
        parseFloat(swLat as string),
        parseFloat(swLng as string),
      );
      return res.json({ outages });
    } catch (error) {
      console.error("Error getting outages in map bounds:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch outages in map bounds" });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const outage = await outageService.updateStatus(id.toString(), status);
      return res.json({ message: "Outage status updated", outage });
    } catch (error) {
      console.error("Update status error:", error);
      return res.status(500).json({ error: "Failed to update outage status" });
    }
  }

  async addConfirmation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const confirmation = await outageService.addConfirmation(
        id.toString(),
        userId.toString(),
      );
      return res.json({
        message: "Confirmation added successfully",
        confirmation,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Rate limit exceeded") {
        const rateLimitStatus = (error as any)
          .rateLImitStatus as RateLimitStatus;
        return res.status(429).json({
          error: "Rate limit exceeded",
          message: rateLimitStatus.message,
          resetAt: rateLimitStatus.resetAt,
          remaining: rateLimitStatus.remaining,
        });
      }
      if (
        error instanceof Error &&
        error.message === "Already confirmed this outage"
      ) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error adding confirmation:", error);
      return res.status(500).json({ error: "Failed to confirm outage" });
    }
  }
  async deleteOutage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await outageService.deleteOutage(id.toString());
      return res.json({ message: "Outage deleted successfully" });
    } catch (error) {
      console.error("Error deleting outage:", error);
      return res.status(500).json({ error: "Failed to delete outage" });
    }
  }

  // @ts-ignore
  async getStatistics(req: Request, res: Response) {
    try {
      const statistics = await outageService.getStatistics();
      return res.json({ statistics });
    } catch (error) {
      console.error("Error getting statistics:", error);
      return res.status(500).json({ error: "Failed to fetch statistics" });
    }
  }

  // Get rate limit status
  async getRateLimitStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const status = await rateLimitService.getRateLimitStatus(
        userId.toString(),
      );
      return res.json({
        outage: {
          remaining: status.outage.remaining,
          resetAt: status.outage.resetAt,
        },
        confirmation: {
          remaining: status.confirmation.remaining,
          resetAt: status.confirmation.resetAt,
        },
      });
    } catch (error) {
      console.error("Error getting rate limit status:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch rate limit status" });
    }
  }
}

export default new OutageController();
