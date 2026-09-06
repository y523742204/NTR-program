import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ntr?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function seed() {
  await prisma.user.upsert({
    where: { phone: '13800000000' },
    update: {
      name: '王教练',
      role: 'ADMIN',
      gender: 'MALE',
      avatarUrl: null,
      profileCompletedAt: new Date(),
    },
    create: {
      phone: '13800000000',
      name: '王教练',
      role: 'ADMIN',
      gender: 'MALE',
      profileCompletedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { phone: '13900000000' },
    update: { name: '李明', role: 'USER', gender: 'MALE' },
    create: { phone: '13900000000', name: '李明', role: 'USER', gender: 'MALE' },
  });

  console.log('Seed complete: admin(13800000000) + user(13900000000)');
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
