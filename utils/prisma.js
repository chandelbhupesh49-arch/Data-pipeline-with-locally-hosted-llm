import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const globalForPrisma = globalThis;

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create adapter
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter: adapter,
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function checkConnection() {
  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    console.error("Failed to connect to database:", error);
    return false;
  }
}

export async function disconnect() {
  await prisma.$disconnect();
  await pool.end();
}

export default prisma;