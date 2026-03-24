import prisma from "../config/database";
import authServices from "../services/authServices";
import { Request, Response, NextFunction } from "express";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const token = authHeader.substring(7);
    const decodedToken = authServices.verifyToken(token);
    if (!decodedToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await prisma.user.findUnique({
      where: {
        id: decodedToken.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // send user to the next route
    (req as any).user = user;
    return next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Invalid token" });
      }
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired" });
      }
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};
