import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const members = await prisma.member.findMany();
  const expenses = await prisma.expense.count();
  console.log('Expenses in DB:', expenses);
  console.log('Members in DB:', JSON.stringify(members, null, 2));
}

main().finally(() => prisma.$disconnect());
