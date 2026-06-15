import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

async function main() {
  const dbUrl = `file:${path.join(process.cwd(), "dev.db")}`;
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  const prisma = new PrismaClient({ adapter });

  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@nodecommander.com" },
    update: { passwordHash, role: "ADMIN", name: "Administrador" },
    create: {
      email: "admin@nodecommander.com",
      name: "Administrador",
      passwordHash,
      role: "ADMIN"
    }
  });
  console.log("Admin user updated/created: ", admin.email);

  // Create default SMTP config setting if not exists
  const existingSmtp = await prisma.systemSetting.findUnique({
    where: { id: "smtp_config" }
  });

  if (!existingSmtp) {
    const defaultSmtp = {
      host: "smtp.example.com",
      port: 587,
      user: "",
      password: "",
      from: "noreply@nodecommander.com",
      secure: false
    };
    await prisma.systemSetting.create({
      data: {
        id: "smtp_config",
        key: "smtp_config",
        value: JSON.stringify(defaultSmtp)
      }
    });
    console.log("Default SMTP configuration seeded");
  }

  console.log("Seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
