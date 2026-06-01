import {
  ConsentType,
  OutageSeverity,
  OutageStatus,
} from "../generated/prisma/enums";
import { z } from "zod";

export const regiterSchema = z.object({
  body: z.object({
    email: z.email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(24, "Password must be at most 24 characters"),
    phoneNumber: z.string(),
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(24, "Name must be at most 24 characters"),
    consents: z.array(
      z.object({
        consentType: z.enum(ConsentType),
        accepted: z.boolean(),
      }),
    ),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(24, "Password must be at most 24 characters"),
  }),
});

export const createOutageSchema = z.object({
  body: z.object({
    locationName: z
      .string()
      .min(4, "Location name must be at least 4 characters")
      .max(100, "Location name must be at most 100 characters"),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters")
      .max(500, "Description must be at most 500 characters"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    affectedHomeEstimated: z.int().positive().min(0).max(1000000).optional(),
    status: z.enum(OutageStatus).optional(),
    severity: z.enum(OutageSeverity).optional(),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(OutageStatus),
  }),
});

export const nearbyOutagesSchema = z.object({
  query: z.object({
    lat: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
    lng: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
    radius: z
      .string()
      .transform(Number)
      .pipe(z.number().positive().min(0.1).max(100))
      .optional(),
    limit: z
      .string()
      .transform(Number)
      .pipe(z.number().positive().min(1).max(100))
      .optional(),
  }),
});

export const inMapBoundsSchema = z.object({
  query: z.object({
    neLat: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
    neLng: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
    swLat: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
    swLng: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
  }),
});

export const outageIdSchema = z.object({
  params: z.object({
    id: z.cuid("Invalid outage ID"),
  }),
});
