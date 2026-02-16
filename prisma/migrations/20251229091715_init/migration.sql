-- CreateTable
CREATE TABLE "Data" (
    "id" BIGINT NOT NULL,
    "jsonData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Data_pkey" PRIMARY KEY ("id")
);
