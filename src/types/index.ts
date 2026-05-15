import { User } from "@/generated/prisma/client";
import {
  OutageSeverity,
  OutageStatus,
  OutageWhatHappened,
} from "@/generated/prisma/enums";
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
  whatHappened: OutageWhatHappened;
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
  whatHappened: OutageWhatHappened;
  createdAt: Date;
  distanceKm: number;
}

// rate limit type

export interface RateLimitConfig {
  outage: {
    maxPerHour: number;
    maxPerDay: number;
  };
  confirmation: {
    maxPerHour: number;
    maxPerDay: number;
  };
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}

export enum RateLimitType {
  OUTAGE = "outage",
  CONFIRMATION = "confirmation",
}
