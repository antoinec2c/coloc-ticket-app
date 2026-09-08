import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reset() {
  await prisma.expenseItem.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.member.deleteMany({});
  console.log('✅ Base de données complètement réinitialisée : 0 dépenses, 0 membres, 0 règlements.');
}

reset()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
