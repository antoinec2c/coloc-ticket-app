import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.member.deleteMany({
    where: { name: 'Moi' }
  });
  console.log(`Deleted ${deleted.count} member(s) named 'Moi'.`);
  const remaining = await prisma.member.findMany();
  console.log('Remaining members:', remaining);
}

main().finally(() => prisma.$disconnect());
