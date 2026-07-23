import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto"
import prisma from "../config/database";


class TokenService {
    private get accessTokenSecret(): string {
        return process.env.JWT_SECRET!;
    }

    private get refreshTokenSecret(): string {
        return process.env.JWT_REFRESH_SECRET!;
    }
    private get accessTokenExpiresIn() {
        return process.env.JWT_EXPIRES_IN as JwtPayload["expiresin"];
    }
    private get refreshTokenExpiresIn() {
        return process.env.JWT_REFRESH_EXPIRES_IN as JwtPayload["expiresin"];
    }

    // generate access token
    generateAccessToken(userId: string): string {
        return jwt.sign({ userId }, this.accessTokenSecret, {
            expiresIn: this.accessTokenExpiresIn
        })
    }

    // generate refresh token, store its hash in DB, return the raw token
    async generateRefreshToken(userId: string): Promise<string> {
        const rawToken = jwt.sign({ userId, jti: crypto.randomUUID() }, this.refreshTokenSecret, {
            expiresIn: this.refreshTokenExpiresIn
        })
        const tokenHash = this.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + Number(this.refreshTokenExpiresIn));


        await prisma.refreshToken.create({
            data: {
                userId, tokenHash, expiresAt
            }
        })
        return rawToken
    }

    // hash a token for storage
    hashToken(token: string): string {
        return crypto.createHash("sha256").update(token).digest("hex")
    }

    // verify and rotate refresh token
    async rotateRefreshToken(rawToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }> {
        let decoded: {
            userId: string; jti: string
        }
        try {
            decoded = jwt.verify(rawToken, this.refreshTokenSecret) as {
                userId: string;
                jti: string
            }

        } catch (error) {
            throw new Error("invalid refresh token")
        }

        const tokenHash = this.hashToken(rawToken);
        const storedToken = await prisma.refreshToken.findUnique({
            where: { tokenHash }
        })
        // token not found in DB - either expired/cleaned, or never existed
        if (!storedToken) {
            throw new Error("invalid refresh token")
        }

        // token was already used once (rotation) and reused again = possible theft
        if (storedToken.revoked) {
            // SECURITY: revoke all tokens for this user — treat as compromised
            await this.revokeAllUserTokens(decoded.userId)
            throw new Error("refresh token reused")
        }

        if (storedToken.expiresAt < new Date()) {
            throw new Error("refresh token expired")
        }

        // Rotate: revoke the old one, issue a new one
        await prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { revoked: true }
        })

        // generate new tokens
        const newAccessToken = this.generateAccessToken(decoded.userId)
        const newRefreshToken = await this.generateRefreshToken(decoded.userId)

        return { accessToken: newAccessToken, refreshToken: newRefreshToken }
    }

    // revoke ALL refresh tokens for a user (logout everywhere / breach response)
    async revokeAllUserTokens(userId: string) {
        await prisma.refreshToken.updateMany({
            where: { userId, revoked: false },
            data: { revoked: true }
        })
    }

    // revoke a single refresh token (logout)
    async revokeToken(rawToken: string) {
        const tokenHash = this.hashToken(rawToken);
        await prisma.refreshToken.updateMany({
            where: { tokenHash, revoked: false },
            data: { revoked: true }
        })
    }

    // verify token
    verifyToken(token: string) {
        return jwt.verify(token, this.accessTokenSecret) as JwtPayload;
    }

    // Cleanup expired tokens (run via cron job)
    async cleanupExpiredTokens() {
        const result = await prisma.refreshToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { revoked: true, createdAt: { lt: new Date(Date.now() - Number(this.refreshTokenExpiresIn)) } }
                ]
            }
        })
        return result.count;
    }

}

export default new TokenService();
