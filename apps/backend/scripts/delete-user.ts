import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv[2];

async function main() {
  if (!email) {
    console.error('Usage: npx tsx scripts/delete-user.ts <email>');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('No user found for', email);
    return;
  }
  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.userSettings.deleteMany({ where: { userId: user.id } });
  await prisma.usageLog.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('Deleted user:', email);
}

main().finally(() => prisma.$disconnect());
