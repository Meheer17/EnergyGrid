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

type Rng = () => number;

function createRng(seed: number): Rng {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(input: string) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function randomBetween(rng: Rng, min: number, max: number) {
    return min + (max - min) * rng();
}

function randomInt(rng: Rng, min: number, max: number) {
    return Math.floor(randomBetween(rng, min, max + 1));
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function pickRandom<T>(values: readonly T[], rng: Rng) {
    return values[randomInt(rng, 0, values.length - 1)];
}

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

async function seedForecasts(prosumers: DemoUser[], rng: Rng) {
    const now = Date.now();

    for (let i = 0; i < prosumers.length; i += 1) {
        const user = prosumers[i];
        const districtBias = randomBetween(rng, -18, 16);
        const baseDemand = randomBetween(rng, 145, 245);

        for (let slot = 0; slot < 12; slot += 1) {
            const hour = (slot * 2 + randomInt(rng, 0, 1)) % 24;
            const demandSwing = 20 * Math.sin((2 * Math.PI * (hour - 7)) / 24);
            const demandNoise = randomBetween(rng, -10, 10);
            const demand = clamp(baseDemand + demandSwing + demandNoise + (i % 4) * 2.5, 90, 325);

            const solarCurve = Math.max(0, Math.sin((Math.PI * (hour - 5)) / 14));
            const rawSolar = (34 + randomBetween(rng, 0, 72)) * solarCurve + randomBetween(rng, -5, 9);
            const solar = clamp(rawSolar, 0, 130);

            const surplus = clamp(
                solar * 0.86 - demand * 0.19 + districtBias + randomBetween(rng, -15, 15),
                -105,
                95
            );

            const generatedAt = new Date(
                now - (slot * 2 + randomInt(rng, 0, 2) + i) * 60 * 60 * 1000
            );

            await prisma.energyForecast.create({
                data: {
                    userId: user.id,
                    forecastedDemand_kWh: Number(demand.toFixed(2)),
                    forecastedSurplus_kWh: Number(surplus.toFixed(2)),
                    horizon_hours: 24,
                    modelVersion: "demo-seed-v2-random",
                    generatedAt,
                },
            });

            await prisma.smartMeter.create({
                data: {
                    userId: user.id,
                    currentLoad_kW: Number((demand / randomBetween(rng, 42, 58)).toFixed(2)),
                    solarGeneration_kW: Number((solar / randomBetween(rng, 38, 55)).toFixed(2)),
                    batteryLevel_pct: Number(
                        clamp(randomBetween(rng, 22, 92) + slot * 1.3 - randomBetween(rng, 0, 15), 8, 98).toFixed(2)
                    ),
                    timestamp: new Date(generatedAt.getTime() + randomInt(rng, 5, 55) * 60 * 1000),
                },
            });
        }
    }
}

async function seedAnomalies(prosumers: DemoUser[], rng: Rng) {
    const anomalyUsers = [...prosumers].sort(() => rng() - 0.5).slice(0, randomInt(rng, 3, 6));
    type AnomalyType = "DEMAND_SPIKE" | "UNDERPERFORMING_SOURCE" | "SURPLUS_OVERFLOW";
    type SeverityLevel = "low" | "medium" | "high";

    const types: readonly AnomalyType[] = [
        "DEMAND_SPIKE",
        "UNDERPERFORMING_SOURCE",
        "SURPLUS_OVERFLOW",
    ];
    const severities: readonly SeverityLevel[] = ["low", "medium", "high"];

    for (let i = 0; i < anomalyUsers.length; i += 1) {
        const user = anomalyUsers[i];
        const type = pickRandom(types, rng);
        const severity = pickRandom(severities, rng);
        const descriptionByType: Record<AnomalyType, string> = {
            DEMAND_SPIKE: `Demo seed: Sudden evening demand surge detected in ${user.city}, ${user.district}.`,
            UNDERPERFORMING_SOURCE: `Demo seed: Renewable generation underperforming in ${user.city}, ${user.district}.`,
            SURPLUS_OVERFLOW: `Demo seed: High localized surplus causing export congestion in ${user.city}, ${user.district}.`,
        };
        const actionByType: Record<AnomalyType, string> = {
            DEMAND_SPIKE: "Dispatch short-duration storage and trigger demand-response messages.",
            UNDERPERFORMING_SOURCE: "Inspect feeder constraints and rebalance dispatch from neighboring zones.",
            SURPLUS_OVERFLOW: "Increase peer-trade incentives and route surplus to deficit feeders.",
        };

        await prisma.gridAnomaly.create({
            data: {
                district: user.district,
                city: user.city,
                type,
                severity,
                description: descriptionByType[type],
                suggestedAction: actionByType[type],
                createdAt: new Date(Date.now() - randomInt(rng, 1, 20) * 60 * 60 * 1000),
            },
        });
    }
}

async function seedTradesAndLedger(prosumers: DemoUser[], consumers: DemoUser[], rng: Rng) {
    const now = Date.now();

    for (let day = 0; day < 32; day += 1) {
        const tradesToday = randomInt(rng, 1, 3);

        for (let n = 0; n < tradesToday; n += 1) {
            const seller = pickRandom(prosumers, rng);
            const buyer = pickRandom(consumers, rng);
            const pressureFactor = ["Bangalore Urban", "Dharwad", "Kalaburagi"].includes(seller.district) ? 1.08 : 1;
            const energyAmount = Number(
                clamp(randomBetween(rng, 12, 56) * pressureFactor + randomBetween(rng, -6, 6), 8, 72).toFixed(2)
            );
            const pricePerUnit = Number(clamp(randomBetween(rng, 5.8, 9.8), 5.2, 10.8).toFixed(2));
            const billSplit = Number((energyAmount * pricePerUnit).toFixed(2));

            const completedAt = new Date(now - day * 24 * 60 * 60 * 1000);
            completedAt.setHours(randomInt(rng, 7, 22), randomInt(rng, 0, 59), 0, 0);
            const createdAt = new Date(completedAt.getTime() - randomInt(rng, 35, 260) * 60 * 1000);

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
                    sellerEarnings_INR: Number((billSplit * randomBetween(rng, 0.8, 0.9)).toFixed(2)),
                    buyerSavings_INR: Number((billSplit * randomBetween(rng, 0.08, 0.18)).toFixed(2)),
                    carbonCredits: Number((energyAmount * randomBetween(rng, 0.055, 0.11)).toFixed(2)),
                    timestamp: completedAt,
                },
            });
        }
    }

    const openOffers = randomInt(rng, 10, 16);
    for (let i = 0; i < openOffers; i += 1) {
        const seller = pickRandom(prosumers, rng);
        const energy = Number(clamp(randomBetween(rng, 10, 60), 8, 70).toFixed(2));
        const price = Number(clamp(randomBetween(rng, 6.2, 10.2), 5.5, 11).toFixed(2));

        await prisma.tradeOffer.create({
            data: {
                sellerId: seller.id,
                district: seller.district,
                city: seller.city,
                energyAmount_kWh: energy,
                pricePerUnit_INR: price,
                billSplit_INR: Number((energy * price).toFixed(2)),
                status: "OPEN",
                createdAt: new Date(now - randomInt(rng, 2, 72) * 60 * 60 * 1000),
            },
        });
    }
}

async function main() {
    const demoPassword = process.env.DEMO_PASSWORD ?? "Demo@12345";
    const seedInput = process.env.DEMO_RANDOM_SEED?.trim() || String(Date.now());
    const rng = createRng(hashString(seedInput));
    const users = await upsertDemoUsers(demoPassword);

    const demoUserIds = users.map((user) => user.id);
    await clearExistingDemoData(demoUserIds);

    const prosumers = users.filter((user) => user.role === "PROSUMER");
    const consumers = users.filter((user) => user.role === "CONSUMER");

    await seedForecasts(prosumers, rng);
    await seedAnomalies(prosumers, rng);
    await seedTradesAndLedger(prosumers, consumers, rng);

    const [forecastCount, offerCount, ledgerCount, anomalyCount] = await Promise.all([
        prisma.energyForecast.count({ where: { userId: { in: demoUserIds } } }),
        prisma.tradeOffer.count({ where: { OR: [{ sellerId: { in: demoUserIds } }, { buyerId: { in: demoUserIds } }] } }),
        prisma.tradeLedger.count({ where: { trade: { sellerId: { in: demoUserIds } } } }),
        prisma.gridAnomaly.count({ where: { description: { startsWith: "Demo seed:" } } }),
    ]);

    console.log("Demo dashboard data seeded:");
    console.log({
        randomSeed: seedInput,
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
