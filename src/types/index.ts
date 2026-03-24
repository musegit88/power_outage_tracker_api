import { User } from "@/generated/prisma/client";
import { OutageSeverity, OutageStatus } from "@/generated/prisma/enums";
import { Request } from "express";

export interface AuthRequest extends Request {
  user: User;
}

export interface CreateOutage {
  userId: string;
  locationName: string;
  description: string;
  latitude: number;
  longitude: number;
  affectedHomesEstimated?: number;
  status?: OutageStatus;
  severity?: OutageSeverity;
}

export interface OutageWithDistance {
  id: string;
  locationName: string;
  description: string;
  latitude: number;
  longitude: number;
  status: OutageStatus;
  severity: OutageSeverity;
  confirmationCount: number;
  affectedHomesEstimated: number | null;
  createdAt: Date;
  distanceKm: number;
}
