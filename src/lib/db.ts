import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export function getDbErrorMessage(err: any): string {
  const msg = err?.message || String(err);
  if (
    msg.includes('unable to open database file') ||
    msg.includes('readonly') ||
    msg.includes('P1003') ||
    msg.includes('P2021') ||
    msg.includes('does not exist in the current database') ||
    msg.includes('no such table')
  ) {
    return 'Base de données non connectée sur Vercel. Veuillez ajouter une base Postgres gratuite dans l\'onglet "Storage" de votre projet sur vercel.com.';
  }
  return msg;
}
