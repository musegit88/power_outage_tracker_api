import { UserRole } from "../generated/prisma/enums";
import prisma from "../config/database";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { isValidPhoneNumber } from "libphonenumber-js";

export class AuthServices {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_EXPIRES_IN = process.env
    .JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];

  // generate token
  generateToken(userId: string, role: UserRole) {
    const payload: JwtPayload = {
      userId,
      role,
    };
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
  }

  // verify token
  verifyToken(token: string) {
    return jwt.verify(token, this.JWT_SECRET) as JwtPayload;
  }

  // register
  async register({
    email,
    password,
    phoneNumber,
    name,
  }: {
    email: string;
    password: string;
    phoneNumber: string;
    name: string;
  }) {
    // check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // check phone number is valid
    const validPhoneNumber = isValidPhoneNumber(phoneNumber, "ET");
    if (!validPhoneNumber) {
      throw new Error("Invalid phone number");
    }
    //create user
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        phoneNumber,
        name,
        role: UserRole.USER,
      },
    });

    // generate token

    const token = this.generateToken(user.id, user.role);

    return {
      user,
      token,
    };
  }

  // login
  async login({ email, password }: { email: string; password: string }) {
    // Find user
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // verify password
    const isValdPassword = await bcrypt.compare(password, user.password);
    if (!isValdPassword) {
      throw new Error("Invalid credentials");
    }

    // Generate token
    const token = this.generateToken(user.id, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
      token,
    };
  }
}

export default new AuthServices();
