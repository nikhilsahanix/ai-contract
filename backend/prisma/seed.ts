/// <reference types="node" />

import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.org.upsert({
    where: { slug: "demo-firm" },
    update: {},
    create: { name: "Demo Firm", slug: "demo-firm" }
  });
  await prisma.user.upsert({
    where: { email: "admin@demo.law" },
    update: {},
    create: {
      orgId: org.id,
      email: "admin@demo.law",
      passwordHash: await bcrypt.hash("DemoPass!123", 12),
      role: UserRole.ADMIN,
      emailVerified: true
    }
  });
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
