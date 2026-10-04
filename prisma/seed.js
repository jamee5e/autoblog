const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

async function seed() {
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!seedAdminEmail || !seedAdminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for seeding");
  }

  const existingCompany = await prisma.company.findFirst({
    where: { name: "KSD" }
  });

  const company =
    existingCompany ??
    (await prisma.company.create({
      data: {
        name: "KSD"
      }
    }));

  const passwordHash = await bcrypt.hash(seedAdminPassword, 12);
  const existingAdmin = await prisma.user.findUnique({
    where: { email: seedAdminEmail }
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        companyId: company.id,
        name: "KSD Admin",
        email: seedAdminEmail,
        passwordHash,
        role: "ADMIN"
      }
    });
    return;
  }

  await prisma.user.update({
    where: { id: existingAdmin.id },
    data: {
      companyId: company.id,
      name: existingAdmin.name || "KSD Admin",
      passwordHash,
      role: "ADMIN"
    }
  });
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seeding failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
