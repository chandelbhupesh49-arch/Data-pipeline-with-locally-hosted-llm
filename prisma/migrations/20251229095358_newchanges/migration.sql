/*
  Warnings:

  - The primary key for the `Data` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `jsonData` on the `Data` table. All the data in the column will be lost.
  - Added the required column `materialData` to the `Data` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Data" DROP CONSTRAINT "Data_pkey",
DROP COLUMN "jsonData",
ADD COLUMN     "materialData" JSONB NOT NULL,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Data_pkey" PRIMARY KEY ("id");
