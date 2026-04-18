import bcrypt from "bcryptjs";
import { PrismaClient } from "../node_modules/.prisma/client";
import { DISTRICT_CITY_MAP } from "../lib/karnataka";

type DemoUser = {
    id: string;
    email: string;
    name: string;
    role: "PROSUMER" | "CONSUMER";
    district: string;
    city: string;
};

const prisma = new PrismaClient();

const DEMO_DISTRICTS = [
    "Bangalore Urban",
    "Mysuru",
    "Belgaum",
    "Dharwad",
    "Udupi",
    "Kalaburagi",
    "Tumkur",
    "Dakshina Kannada",
] as const;

function slugifyDistrict(input: string) {
    return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function cityForDistrict(district: string) {
    const cities = DISTRICT_CITY_MAP[district];
    if (!cities || cities.length === 0) {
        return "Bengaluru";
    }
    return cities[0];
}

function pincodeFromIndex(index: number) {
    return String(560001 + index).padStart(6, "0");
}

async function upsertDemoUsers(password: string): Promise<DemoUser[]> {
    const hashedPassword = await bcrypt.hash(password, 12);
    const users: DemoUser[] = [];

    for (let i = 0; i < DEMO_DISTRICTS.length; i += 1) {
        const district = DEMO_DISTRICTS[i];
        const city = cityForDistrict(district);
        const districtSlug = slugifyDistrict(district);

        const prosumer = await prisma.user.upsert({
            where: { email: `demo.prosumer.${districtSlug}@gridwise.in` },
            update: {
                name: `Demo Prosumer ${i + 1}`,
                role: "PROSUMER",
                district,
                city,
                pincode: pincodeFromIndex(i * 2),
                hashedPassword,
            },
            create: {
                name: `Demo Prosumer ${i + 1}`,
                email: `demo.prosumer.${districtSlug}@gridwise.in`,
                role: "PROSUMER",
                district,
                city,
                pincode: pincodeFromIndex(i * 2),
                hashedPassword,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                district: true,
                city: true,
            },
        });

        const consumer = await prisma.user.upsert({
            where: { email: `demo.consumer.${districtSlug}@gridwise.in` },
            update: {
                name: `Demo Consumer ${i + 1}`,
                role: "CONSUMER",
                district,
                city,
                pincode: pincodeFromIndex(i * 2 + 1),
                hashedPassword,
            },
            create: {
                name: `Demo Consumer ${i + 1}`,
                email: `demo.consumer.${districtSlug}@gridwise.in`,
                role: "CONSUMER",
                district,
                city,
                pincode: pincodeFromIndex(i * 2 + 1),
                hashedPassword,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                district: true,
                city: true,
            },
        });

        users.push(prosumer as DemoUser);
        users.push(consumer as DemoUser);
    }

    return users;
}

async function clearExistingDemoData(demoUserIds: string[]) {
    const demoOffers = await prisma.tradeOffer.findMany({
        where: {
            OR: [{ sellerId: { in: demoUserIds } }, { buyerId: { in: demoUserIds } }],
        },
        select: { id: true },
    });

    const demoOfferIds = demoOffers.map((offer) => offer.id);

    if (demoOfferIds.length > 0) {
        await prisma.tradeLedger.deleteMany({
            where: { tradeId: { in: demoOfferIds } },
        });
    }

    await prisma.tradeOffer.deleteMany({
        where: {
            OR: [{ sellerId: { in: demoUserIds } }, { buyerId: { in: demoUserIds } }],
        },
    });

    await prisma.energyForecast.deleteMany({
        where: { userId: { in: demoUserIds } },
    });

    await prisma.smartMeter.deleteMany({
        where: { userId: { in: demoUserIds } },
    });

    await prisma.gridAnomaly.deleteMany({
        where: { description: { startsWith: "Demo seed:" } },
    });
}

async function seedForecasts(prosumers: DemoUser[]) {
    const now = Date.now();

    for (let i = 0; i < prosumers.length; i += 1) {
        const user = prosumers[i];

        for (let slot = 0; slot < 8; slot += 1) {
            const demand = 165 + i * 9 + slot * 5;
            const solar = 52 + ((i + slot) % 6) * 7;
            const surplusBias = i % 3 === 0 ? -34 : i % 3 === 1 ? 18 : 7;
            const surplus = surplusBias + (slot - 3) * 3;

            await prisma.energyForecast.create({
                data: {
                    userId: user.id,
                    forecastedDemand_kWh: Number(demand.toFixed(2)),
                    forecastedSurplus_kWh: Number(surplus.toFixed(2)),
                    horizon_hours: 24,
                    modelVersion: "demo-seed-v1",
                    generatedAt: new Date(now - (slot * 3 + i) * 60 * 60 * 1000),
                },
            });

            await prisma.smartMeter.create({
                data: {
                    userId: user.id,
                    currentLoad_kW: Number((demand / 50).toFixed(2)),
                    solarGeneration_kW: Number((solar / 50).toFixed(2)),
                    batteryLevel_pct: Number((42 + ((slot + i) % 40)).toFixed(2)),
                    timestamp: new Date(now - (slot * 2 + i) * 60 * 60 * 1000),
                },
            });
        }
    }
}

async function seedAnomalies(prosumers: DemoUser[]) {
    const deficitUsers = prosumers.filter((_, idx) => idx % 3 === 0).slice(0, 4);

    for (let i = 0; i < deficitUsers.length; i += 1) {
        const user = deficitUsers[i];

        await prisma.gridAnomaly.create({
            data: {
                district: user.district,
                city: user.city,
                type: i % 2 === 0 ? "DEMAND_SPIKE" : "UNDERPERFORMING_SOURCE",
                severity: i % 2 === 0 ? "high" : "medium",
                description: `Demo seed: ${user.city} is showing abnormal load behavior in ${user.district}.`,
                suggestedAction:
                    i % 2 === 0
                        ? "Dispatch battery reserves and trigger demand-response notifications."
                        : "Increase rooftop generation dispatch and inspect feeder constraints.",
                createdAt: new Date(Date.now() - i * 3 * 60 * 60 * 1000),
            },
        });
    }
}

async function seedTradesAndLedger(prosumers: DemoUser[], consumers: DemoUser[]) {
    const now = Date.now();

    for (let day = 0; day < 30; day += 1) {
        const seller = prosumers[day % prosumers.length];
        const buyer = consumers[(day + 2) % consumers.length];

        const energyAmount = Number((20 + (day % 7) * 4.2).toFixed(2));
        const pricePerUnit = Number((6.5 + (day % 5) * 0.45).toFixed(2));
        const billSplit = Number((energyAmount * pricePerUnit).toFixed(2));

        const completedAt = new Date(now - day * 24 * 60 * 60 * 1000);
        const createdAt = new Date(completedAt.getTime() - 2 * 60 * 60 * 1000);

        const offer = await prisma.tradeOffer.create({
            data: {
                sellerId: seller.id,
                buyerId: buyer.id,
                district: seller.district,
                city: seller.city,
                energyAmount_kWh: energyAmount,
                pricePerUnit_INR: pricePerUnit,
                billSplit_INR: billSplit,
                status: "COMPLETED",
                createdAt,
                completedAt,
            },
            select: { id: true },
        });

        await prisma.tradeLedger.create({
            data: {
                tradeId: offer.id,
                sellerEarnings_INR: Number((billSplit * 0.86).toFixed(2)),
                buyerSavings_INR: Number((billSplit * 0.11).toFixed(2)),
                carbonCredits: Number((energyAmount * 0.075).toFixed(2)),
                timestamp: completedAt,
            },
        });
    }

    for (let i = 0; i < 8; i += 1) {
        const seller = prosumers[i % prosumers.length];

        await prisma.tradeOffer.create({
            data: {
                sellerId: seller.id,
                district: seller.district,
                city: seller.city,
                energyAmount_kWh: Number((18 + i * 1.6).toFixed(2)),
                pricePerUnit_INR: Number((7.1 + i * 0.2).toFixed(2)),
                billSplit_INR: Number((145 + i * 13.5).toFixed(2)),
                status: "OPEN",
            },
        });
    }
}

async function main() {
    const demoPassword = process.env.DEMO_PASSWORD ?? "Demo@12345";
    const users = await upsertDemoUsers(demoPassword);

    const demoUserIds = users.map((user) => user.id);
    await clearExistingDemoData(demoUserIds);

    const prosumers = users.filter((user) => user.role === "PROSUMER");
    const consumers = users.filter((user) => user.role === "CONSUMER");

    await seedForecasts(prosumers);
    await seedAnomalies(prosumers);
    await seedTradesAndLedger(prosumers, consumers);

    const [forecastCount, offerCount, ledgerCount, anomalyCount] = await Promise.all([
        prisma.energyForecast.count({ where: { userId: { in: demoUserIds } } }),
        prisma.tradeOffer.count({ where: { OR: [{ sellerId: { in: demoUserIds } }, { buyerId: { in: demoUserIds } }] } }),
        prisma.tradeLedger.count({ where: { trade: { sellerId: { in: demoUserIds } } } }),
        prisma.gridAnomaly.count({ where: { description: { startsWith: "Demo seed:" } } }),
    ]);

    console.log("Demo dashboard data seeded:");
    console.log({
        users: users.length,
        forecasts: forecastCount,
        offers: offerCount,
        ledgerEntries: ledgerCount,
        anomalies: anomalyCount,
    });
    console.log("Login with any demo user email + DEMO_PASSWORD (default Demo@12345) if needed.");
}

main()
    .catch((error) => {
        console.error("Failed to seed demo data", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
