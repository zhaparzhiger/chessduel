/**
 * Singleton Prisma-клиента.
 * В dev-режиме Next.js перезагружает модули — храним клиент в globalThis,
 * чтобы не плодить подключения к БД.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
