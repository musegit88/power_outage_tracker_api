import rateLimit from "express-rate-limit";

// Request limiter for 15 minutes window and 100 requests per window
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
