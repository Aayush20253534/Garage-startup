/*
  Warnings:

  - You are about to drop the column `serviceId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `slotId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the `GarageSlot` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('CUSTOMER', 'GARAGE');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'RECHARGE', 'REFUND', 'CASHBACK', 'BOOKING_PAYMENT', 'BOOKING_REFUND', 'GARAGE_ACCEPT_FEE', 'SOS_DEDUCTION');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('NORMAL', 'SOS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'SEARCHING_GARAGE';
ALTER TYPE "BookingStatus" ADD VALUE 'GARAGE_ASSIGNED';
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_garageId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_slotId_fkey";

-- DropForeignKey
ALTER TABLE "GarageSlot" DROP CONSTRAINT "GarageSlot_garageId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "serviceId",
DROP COLUMN "slotId",
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "customerAddress" TEXT,
ADD COLUMN     "customerLatitude" DOUBLE PRECISION,
ADD COLUMN     "customerLongitude" DOUBLE PRECISION,
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "payableAmount" INTEGER NOT NULL DEFAULT 99,
ADD COLUMN     "requestType" "RequestType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "totalServiceAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "walletAmountUsed" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "garageId" DROP NOT NULL,
ALTER COLUMN "scheduledDate" DROP NOT NULL,
ALTER COLUMN "startTime" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Garage" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "upiAmountPaid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "walletAmountUsed" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "amount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "basePrice" INTEGER,
ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "maxPrice" INTEGER,
ADD COLUMN     "minPrice" INTEGER;

-- DropTable
DROP TABLE "GarageSlot";

-- CreateTable
CREATE TABLE "ServiceMedia" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isThumbnail" BOOLEAN NOT NULL DEFAULT false,
    "durationSeconds" INTEGER,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingService" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estimatedPrice" INTEGER,
    "finalPrice" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarageBroadcastRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "garageResponseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarageBroadcastRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletType" NOT NULL DEFAULT 'CUSTOMER',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'SUCCESS',
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "description" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarageWallet" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarageWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarageWalletTransaction" (
    "id" TEXT NOT NULL,
    "garageWalletId" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'SUCCESS',
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "description" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GarageWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceMedia_serviceId_idx" ON "ServiceMedia"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceMedia_mediaType_idx" ON "ServiceMedia"("mediaType");

-- CreateIndex
CREATE INDEX "ServiceMedia_isThumbnail_idx" ON "ServiceMedia"("isThumbnail");

-- CreateIndex
CREATE INDEX "BookingService_bookingId_idx" ON "BookingService"("bookingId");

-- CreateIndex
CREATE INDEX "BookingService_serviceId_idx" ON "BookingService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingService_bookingId_serviceId_key" ON "BookingService"("bookingId", "serviceId");

-- CreateIndex
CREATE INDEX "GarageBroadcastRequest_bookingId_idx" ON "GarageBroadcastRequest"("bookingId");

-- CreateIndex
CREATE INDEX "GarageBroadcastRequest_garageId_idx" ON "GarageBroadcastRequest"("garageId");

-- CreateIndex
CREATE INDEX "GarageBroadcastRequest_status_idx" ON "GarageBroadcastRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GarageBroadcastRequest_bookingId_garageId_key" ON "GarageBroadcastRequest"("bookingId", "garageId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GarageWallet_garageId_key" ON "GarageWallet"("garageId");

-- CreateIndex
CREATE INDEX "GarageWalletTransaction_garageWalletId_idx" ON "GarageWalletTransaction"("garageWalletId");

-- CreateIndex
CREATE INDEX "GarageWalletTransaction_garageId_idx" ON "GarageWalletTransaction"("garageId");

-- CreateIndex
CREATE INDEX "GarageWalletTransaction_type_idx" ON "GarageWalletTransaction"("type");

-- CreateIndex
CREATE INDEX "GarageWalletTransaction_status_idx" ON "GarageWalletTransaction"("status");

-- CreateIndex
CREATE INDEX "Booking_requestType_idx" ON "Booking"("requestType");

-- CreateIndex
CREATE INDEX "CustomerLocation_latitude_longitude_idx" ON "CustomerLocation"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Garage_ownerId_idx" ON "Garage"("ownerId");

-- CreateIndex
CREATE INDEX "GarageService_isActive_idx" ON "GarageService"("isActive");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

-- AddForeignKey
ALTER TABLE "Garage" ADD CONSTRAINT "Garage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMedia" ADD CONSTRAINT "ServiceMedia_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageBroadcastRequest" ADD CONSTRAINT "GarageBroadcastRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageBroadcastRequest" ADD CONSTRAINT "GarageBroadcastRequest_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageWallet" ADD CONSTRAINT "GarageWallet_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageWalletTransaction" ADD CONSTRAINT "GarageWalletTransaction_garageWalletId_fkey" FOREIGN KEY ("garageWalletId") REFERENCES "GarageWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageWalletTransaction" ADD CONSTRAINT "GarageWalletTransaction_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
