/*
  Warnings:

  - You are about to drop the `_UserMatches` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[creatorId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `_UserMatches` DROP FOREIGN KEY `_UserMatches_A_fkey`;

-- DropForeignKey
ALTER TABLE `_UserMatches` DROP FOREIGN KEY `_UserMatches_B_fkey`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `matchId` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `_UserMatches`;

-- CreateIndex
CREATE UNIQUE INDEX `Match_creatorId_key` ON `Match`(`creatorId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
