import { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";

export const verifySocketToken = async (token: string): Promise<JwtPayload> => {
  try {
    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET!,
    ) as JwtPayload;
    return decodedToken;
  } catch (error) {
    throw new Error("Invalid token");
  }
};
