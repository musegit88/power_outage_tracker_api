-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "public";

-- CreateEnum
CREATE TYPE "OutageStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'INVESTIGATING');

-- CreateEnum
CREATE TYPE "OutageSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "OutageWhatHappened" AS ENUM ('NO_POWER', 'PARTIAL_POWER', 'LOW_VOLTAGE', 'FLICKERING', 'HAZARDOUS_SITUATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_AND_CONDITIONS', 'DATA_COLLECTION', 'LOCATION_SHARING', 'EMAIL_NOTIFICATIONS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "consentId" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whatHappened" "OutageWhatHappened" NOT NULL DEFAULT 'NO_POWER',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "affectedHomesEstimated" INTEGER,
    "status" "OutageStatus" NOT NULL DEFAULT 'ACTIVE',
    "severity" "OutageSeverity" NOT NULL DEFAULT 'MODERATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "coordinates" geography,

    CONSTRAINT "outages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmations" (
    "id" TEXT NOT NULL,
    "outageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "outageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_rate_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outageCount" INTEGER NOT NULL DEFAULT 0,
    "lastOutageCreatedAt" TIMESTAMP(3),
    "confirmationCount" INTEGER NOT NULL DEFAULT 0,
    "lastConfirmationCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_consents_userId_idx" ON "user_consents"("userId");

-- CreateIndex
CREATE INDEX "user_consents_consentId_idx" ON "user_consents"("consentId");

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_userId_consentId_key" ON "user_consents"("userId", "consentId");

-- CreateIndex
CREATE UNIQUE INDEX "consents_consentType_version_key" ON "consents"("consentType", "version");

-- CreateIndex
CREATE INDEX "outages_createdAt_idx" ON "outages"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "outages_latitude_longitude_idx" ON "outages"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "outages_status_idx" ON "outages"("status");

-- CreateIndex
CREATE INDEX "outages_userId_idx" ON "outages"("userId");

-- CreateIndex
CREATE INDEX "idx_outages_coordinates" ON "outages" USING GIST ("coordinates");

-- CreateIndex
CREATE INDEX "confirmations_outageId_idx" ON "confirmations"("outageId");

-- CreateIndex
CREATE INDEX "confirmations_userId_idx" ON "confirmations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "confirmations_outageId_userId_key" ON "confirmations"("outageId", "userId");

-- CreateIndex
CREATE INDEX "comments_outageId_idx" ON "comments"("outageId");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_rate_limits_userId_key" ON "user_rate_limits"("userId");

-- CreateIndex
CREATE INDEX "user_rate_limits_userId_idx" ON "user_rate_limits"("userId");

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outages" ADD CONSTRAINT "outages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_outageId_fkey" FOREIGN KEY ("outageId") REFERENCES "outages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_outageId_fkey" FOREIGN KEY ("outageId") REFERENCES "outages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rate_limits" ADD CONSTRAINT "user_rate_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
