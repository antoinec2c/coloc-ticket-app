import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const colocs = await prisma.colocation.findMany({ include: { members: true } });
  const members = await prisma.member.findMany();
  const expenses = await prisma.expense.count();
  console.log('Colocs in DB:', JSON.stringify(colocs, null, 2));
  console.log('Members in DB:', JSON.stringify(members, null, 2));
  console.log('Expenses in DB:', expenses);
}

main().finally(() => prisma.$disconnect());
