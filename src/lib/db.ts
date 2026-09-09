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
  const lower = msg.toLowerCase();
  if (
    lower.includes('unable to open') ||
    lower.includes('readonly') ||
    lower.includes('p1003') ||
    lower.includes('p2021') ||
    lower.includes('does not exist') ||
    lower.includes('no such table') ||
    lower.includes('error code 14')
  ) {
    return 'Base de données non connectée sur Vercel. Veuillez activer Vercel Postgres dans l\'onglet "Storage" de votre projet sur vercel.com (1 clic, gratuit).';
  }
  return msg;
}
