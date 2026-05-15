import { Request, Response } from "express";
import authServices from "../services/authServices";
import prisma from "../config/database";
import { User } from "../generated/prisma/client";

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name, phoneNumber } = req.body;
      const response = await authServices.register({
        email,
        password,
        phoneNumber,
        name,
      });
      res
        .status(201)
        .json({ message: "User registered successfully", response });
      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "User already exists") {
          return res.status(409).json({ error: error.message });
        }
        if (error.message === "Invalid phone number") {
          return res.status(400).json({ error: error.message });
        }
      }
      return res.status(500).json({ error: "Registration failed" });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const response = await authServices.login({ email, password });
      return res.json({ message: "Login successful", response });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Invalid credentials") {
          return res.status(401).json({ error: error.message });
        }
      }
      return res.status(500).json({ error: "Login failed" });
    }
  }

  async getProfile(req: Request extends User ? User : any, res: Response) {
    try {
      //  get user id from auth middleware
      const userId = req.user.id;
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phoneNumber: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return res.json({
        message: "Profile fetched successfully",
        user,
      });
    } catch {
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
  }
}

export default new AuthController();
