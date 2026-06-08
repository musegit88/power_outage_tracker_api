import { UserRateLimit } from "../generated/prisma/client";
import prisma from "../config/database";
import { RateLimitConfig, RateLimitStatus, RateLimitType } from "../types";

export class RateLimitService {
  private config: RateLimitConfig = {
    outage: {
      maxPerHour: 3,
      maxPerDay: 11,
    },
    confirmation: {
      maxPerHour: 20,
      maxPerDay: 100,
    },
  };

  // Check if user is unrestricted
  private isUnrestricted(role?: string) {
    return role === "SUPER_ADMIN";
  }

  // check if user can perform an action (create outage or confirm)
  async checkRateLimit(
    userId: string,
    type: RateLimitType,
    role?: string,
  ): Promise<RateLimitStatus> {
    // Check if user is unrestricted
    if (this.isUnrestricted(role)) {
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(0),
        message: "Unrestricted user - no rate limits apply",
      };
    }
    // Get or create rate limit record
    const rateLImit = await this.getOrCreateRateLimit(userId);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (type === RateLimitType.OUTAGE) {
      return this.checkOutageRateLimit(rateLImit, now, oneHourAgo, oneDayAgo);
    } else {
      return this.checkConfirmationRateLimit(
        rateLImit,
        now,
        oneHourAgo,
        oneDayAgo,
      );
    }
  }

  //   check outage creation rate limit
  private async checkOutageRateLimit(
    rateLimit: UserRateLimit,
    now: Date,
    oneHourAgo: Date,
    oneDayAgo: Date,
  ) {
    const { maxPerHour, maxPerDay } = this.config.outage;

    // Reset counter if last outage was more than 24 hours ago
    if (
      !rateLimit.lastOutageCreatedAt ||
      rateLimit.lastOutageCreatedAt < oneDayAgo
    ) {
      return {
        allowed: true,
        remaining: maxPerDay - 1,
        resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    // Count outage in last hour
    const outageLastHour = await prisma.outage.count({
      where: {
        userId: rateLimit.userId,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    // check hourly limit
    if (outageLastHour >= maxPerHour) {
      const resetAt = new Date(
        rateLimit.lastOutageCreatedAt.getTime() + 60 * 60 * 1000,
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: `Rate limit exceeded. You can create ${maxPerHour} outage reports per hour. Try again in ${this.getTimeUntil(resetAt)}`,
      };
    }

    // Count outages in last day
    const outagesLastDay = await prisma.outage.count({
      where: {
        userId: rateLimit.userId,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    // Check daily rate limit
    if (outagesLastDay >= maxPerDay) {
      const resetAt = new Date(
        rateLimit.lastOutageCreatedAt.getTime() + 24 * 60 * 60 * 1000,
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: `Daily rate limit exceeded. You can create ${maxPerDay} outage reports per day. Try again in ${this.getTimeUntil(resetAt)}`,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        maxPerHour - outageLastHour,
        maxPerDay - outagesLastDay,
      ),
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    };
  }

  // check confirmation rate limit
  private async checkConfirmationRateLimit(
    rateLimit: any,
    now: Date,
    oneHourAgo: Date,
    oneDayAgo: Date,
  ): Promise<RateLimitStatus> {
    const { maxPerHour, maxPerDay } = this.config.confirmation;

    // Reset counter if last confirmation was more than 24 hours ago
    if (
      !rateLimit.lastConfirmationCreatedAt ||
      rateLimit.lastConfirmationCreatedAt < oneDayAgo
    ) {
      return {
        allowed: true,
        remaining: maxPerDay - 1,
        resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    // count confirmations in last hour
    const confirmationLastHour = await prisma.confirmation.count({
      where: {
        userId: rateLimit.userId,
        createdAt: { gte: oneHourAgo },
      },
    });

    // check hourly limit
    if (confirmationLastHour >= maxPerHour) {
      const resetAt = new Date(
        rateLimit.lastConfirmationCreatedAt.getTime() + 60 * 60 * 1000,
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: `Rate limit exceeded. You can confirm ${maxPerHour} outages per hour. Try again in ${this.getTimeUntil(resetAt)}`,
      };
    }

    // count confirmations in last day
    const confirmationLastDay = await prisma.confirmation.count({
      where: {
        userId: rateLimit.userId,
        createdAt: { gte: oneDayAgo },
      },
    });

    // check daily limit
    if (confirmationLastDay >= maxPerDay) {
      const resetAt = new Date(
        rateLimit.lastConfirmationCreatedAt.getTime() + 24 * 60 * 60 * 1000,
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: `Daily rate limit exceeded. You can confirm ${maxPerDay} outages per day. Try again in ${this.getTimeUntil(resetAt)}`,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        maxPerHour - confirmationLastHour,
        maxPerDay - confirmationLastDay,
      ),
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    };
  }

  // Record user performed an action

  async recordAction(userId: string, type: RateLimitType) {
    // get current time
    const now = new Date();

    // if type is outage
    if (type === RateLimitType.OUTAGE) {
      await prisma.userRateLimit.upsert({
        where: { userId },
        update: {
          outageCount: { increment: 1 },
          lastOutageCreatedAt: now,
          updatedAt: now,
        },
        create: {
          userId,
          outageCount: 1,
          lastOutageCreatedAt: now,
          confirmationCount: 0,
        },
      });
    }
    // if type is confirmation
    else {
      await prisma.userRateLimit.upsert({
        where: { userId },
        update: {
          confirmationCount: { increment: 1 },
          lastConfirmationCreatedAt: now,
          updatedAt: now,
        },
        create: {
          userId,
          confirmationCount: 1,
          lastConfirmationCreatedAt: now,
          outageCount: 0,
        },
      });
    }
  }

  // Get or create rate limit record for user
  private async getOrCreateRateLimit(userId: string) {
    let rateLimit = await prisma.userRateLimit.findUnique({
      where: { userId },
    });

    if (!rateLimit) {
      rateLimit = await prisma.userRateLimit.create({
        data: {
          userId,
          outageCount: 0,
          confirmationCount: 0,
        },
      });
    }

    return rateLimit;
  }

  // Get human-readable time until reset
  private getTimeUntil(resetAt: Date) {
    const now = new Date();
    const diff = resetAt.getTime() - now.getTime();
    const minutes = Math.ceil(diff / (60 * 1000));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }

  // Get current rate limit status for user
  async getRateLimitStatus(userId: string) {
    const outageStatus = await this.checkRateLimit(
      userId,
      RateLimitType.OUTAGE,
    );
    const confirmationStatus = await this.checkRateLimit(
      userId,
      RateLimitType.CONFIRMATION,
    );
    return {
      outage: outageStatus,
      confirmation: confirmationStatus,
    };
  }

  // Reset rate limits for a user (admin function)
  async resetRateLimits(userId: string) {
    await prisma.userRateLimit.update({
      where: {
        userId,
      },
      data: {
        outageCount: 0,
        confirmationCount: 0,
        lastOutageCreatedAt: null,
        lastConfirmationCreatedAt: null,
      },
    });
  }
}

export default new RateLimitService();
