import bcrypt from "bcryptjs";
import { PrismaClient } from "../node_modules/.prisma/client";

const prisma = new PrismaClient();

async function main() {
    const email = (process.env.ADMIN_EMAIL ?? "admin@gridwise.in").trim().toLowerCase();
    const name = (process.env.ADMIN_NAME ?? "GridWise Admin").trim();
    const password = process.env.ADMIN_PASSWORD ?? "Admin@12345";
    const district = (process.env.ADMIN_DISTRICT ?? "Bangalore Urban").trim();
    const city = (process.env.ADMIN_CITY ?? "Bengaluru").trim();
    const pincode = (process.env.ADMIN_PINCODE ?? "560001").trim();

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            name,
            role: "ADMIN",
            district,
            city,
            pincode,
            hashedPassword,
        },
        create: {
            name,
            email,
            role: "ADMIN",
            district,
            city,
            pincode,
            hashedPassword,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            district: true,
            city: true,
        },
    });

    console.log("Admin user seeded:", admin);
}

main()
    .catch((error) => {
        console.error("Failed to seed admin", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
