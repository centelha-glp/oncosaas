import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  scriptPrismaClient?: PrismaClient;
};

export function getScriptPrismaClient(
  options?: Prisma.PrismaClientOptions
): PrismaClient {
  // Use dedicated instances when custom adapters are provided.
  if (options?.adapter) {
    return new PrismaClient(options);
  }

  if (!globalForPrisma.scriptPrismaClient) {
    globalForPrisma.scriptPrismaClient = new PrismaClient(options);
  }

  return globalForPrisma.scriptPrismaClient;
}
