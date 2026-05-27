import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Users in DB:', users.length);
  for (const u of users) {
    console.log(`- ${u.email} | ${u.fullName || '(no name)'} | ${u.role} | active=${u.isActive}`);
  }
}

main()
  .finally(() => prisma.$disconnect());
