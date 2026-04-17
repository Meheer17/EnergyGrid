export type ZoneType = "urban" | "semi-urban" | "rural" | "coastal" | "hill";

export type CityGridConfig = {
    householdCount: number;
    baseDemandKWh: number;
    prosumerBasePct: number;
    zoneType: ZoneType;
};

export type DistrictGridConfig = {
    cities: Record<string, CityGridConfig>;
};

export const KARNATAKA_GRID: Record<string, DistrictGridConfig> = {
    "Bangalore Urban": {
        cities: {
            Bengaluru: { householdCount: 500, baseDemandKWh: 3.8, prosumerBasePct: 0.12, zoneType: "urban" },
            Whitefield: { householdCount: 300, baseDemandKWh: 3.2, prosumerBasePct: 0.18, zoneType: "urban" },
            "Electronic City": { householdCount: 250, baseDemandKWh: 2.9, prosumerBasePct: 0.15, zoneType: "urban" },
        },
    },
    "Bangalore Rural": {
        cities: {
            Devanahalli: { householdCount: 120, baseDemandKWh: 2.3, prosumerBasePct: 0.14, zoneType: "semi-urban" },
            Doddaballapur: { householdCount: 110, baseDemandKWh: 2.1, prosumerBasePct: 0.16, zoneType: "semi-urban" },
            Nelamangala: { householdCount: 100, baseDemandKWh: 2.0, prosumerBasePct: 0.13, zoneType: "semi-urban" },
        },
    },
    Mysuru: {
        cities: {
            Mysuru: { householdCount: 260, baseDemandKWh: 2.8, prosumerBasePct: 0.11, zoneType: "urban" },
            Nanjangud: { householdCount: 120, baseDemandKWh: 2.2, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Hunsur: { householdCount: 90, baseDemandKWh: 1.9, prosumerBasePct: 0.09, zoneType: "semi-urban" },
        },
    },
    Tumkur: {
        cities: {
            Tumkur: { householdCount: 180, baseDemandKWh: 2.5, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Tiptur: { householdCount: 90, baseDemandKWh: 2.0, prosumerBasePct: 0.11, zoneType: "rural" },
            Madhugiri: { householdCount: 80, baseDemandKWh: 1.8, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
    Mandya: {
        cities: {
            Mandya: { householdCount: 140, baseDemandKWh: 2.3, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Maddur: { householdCount: 85, baseDemandKWh: 1.9, prosumerBasePct: 0.11, zoneType: "rural" },
            Srirangapatna: { householdCount: 75, baseDemandKWh: 1.8, prosumerBasePct: 0.1, zoneType: "rural" },
        },
    },
    Hassan: {
        cities: {
            Hassan: { householdCount: 130, baseDemandKWh: 2.2, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Belur: { householdCount: 70, baseDemandKWh: 1.8, prosumerBasePct: 0.12, zoneType: "rural" },
            Sakleshpur: { householdCount: 65, baseDemandKWh: 1.7, prosumerBasePct: 0.13, zoneType: "hill" },
        },
    },
    Kodagu: {
        cities: {
            Madikeri: { householdCount: 60, baseDemandKWh: 1.8, prosumerBasePct: 0.05, zoneType: "hill" },
            Somwarpet: { householdCount: 50, baseDemandKWh: 1.6, prosumerBasePct: 0.06, zoneType: "hill" },
            Kushalnagar: { householdCount: 55, baseDemandKWh: 1.7, prosumerBasePct: 0.07, zoneType: "hill" },
        },
    },
    Chikkamagaluru: {
        cities: {
            Chikkamagaluru: { householdCount: 70, baseDemandKWh: 1.9, prosumerBasePct: 0.07, zoneType: "hill" },
            Mudigere: { householdCount: 45, baseDemandKWh: 1.6, prosumerBasePct: 0.08, zoneType: "hill" },
            Koppa: { householdCount: 40, baseDemandKWh: 1.5, prosumerBasePct: 0.08, zoneType: "hill" },
        },
    },
    Shivamogga: {
        cities: {
            Shivamogga: { householdCount: 150, baseDemandKWh: 2.4, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Sagar: { householdCount: 80, baseDemandKWh: 1.9, prosumerBasePct: 0.11, zoneType: "hill" },
            Bhadravathi: { householdCount: 95, baseDemandKWh: 2.0, prosumerBasePct: 0.1, zoneType: "semi-urban" },
        },
    },
    Davanagere: {
        cities: {
            Davanagere: { householdCount: 160, baseDemandKWh: 2.5, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Harihar: { householdCount: 90, baseDemandKWh: 2.0, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Jagaluru: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
    Chitradurga: {
        cities: {
            Chitradurga: { householdCount: 120, baseDemandKWh: 2.1, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Hosadurga: { householdCount: 70, baseDemandKWh: 1.8, prosumerBasePct: 0.12, zoneType: "rural" },
            Challakere: { householdCount: 75, baseDemandKWh: 1.8, prosumerBasePct: 0.13, zoneType: "rural" },
        },
    },
    Bellary: {
        cities: {
            Ballari: { householdCount: 170, baseDemandKWh: 2.6, prosumerBasePct: 0.12, zoneType: "semi-urban" },
            Hospet: { householdCount: 110, baseDemandKWh: 2.2, prosumerBasePct: 0.13, zoneType: "semi-urban" },
            Sandur: { householdCount: 65, baseDemandKWh: 1.9, prosumerBasePct: 0.14, zoneType: "rural" },
        },
    },
    Raichur: {
        cities: {
            Raichur: { householdCount: 140, baseDemandKWh: 2.5, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Sindhanur: { householdCount: 90, baseDemandKWh: 2.0, prosumerBasePct: 0.12, zoneType: "rural" },
            Manvi: { householdCount: 65, baseDemandKWh: 1.8, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
    Koppal: {
        cities: {
            Koppal: { householdCount: 110, baseDemandKWh: 2.2, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Gangavathi: { householdCount: 85, baseDemandKWh: 2.0, prosumerBasePct: 0.12, zoneType: "semi-urban" },
            Kushtagi: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.13, zoneType: "rural" },
        },
    },
    Gadag: {
        cities: {
            Gadag: { householdCount: 100, baseDemandKWh: 2.1, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Betageri: { householdCount: 75, baseDemandKWh: 1.9, prosumerBasePct: 0.12, zoneType: "semi-urban" },
            Ron: { householdCount: 55, baseDemandKWh: 1.7, prosumerBasePct: 0.13, zoneType: "rural" },
        },
    },
    Dharwad: {
        cities: {
            Dharwad: { householdCount: 140, baseDemandKWh: 2.4, prosumerBasePct: 0.12, zoneType: "semi-urban" },
            Hubballi: { householdCount: 220, baseDemandKWh: 2.8, prosumerBasePct: 0.13, zoneType: "urban" },
            Alnavar: { householdCount: 60, baseDemandKWh: 1.8, prosumerBasePct: 0.11, zoneType: "rural" },
        },
    },
    Belgaum: {
        cities: {
            Belagavi: { householdCount: 210, baseDemandKWh: 2.7, prosumerBasePct: 0.12, zoneType: "urban" },
            Gokak: { householdCount: 95, baseDemandKWh: 2.1, prosumerBasePct: 0.13, zoneType: "semi-urban" },
            Bailhongal: { householdCount: 65, baseDemandKWh: 1.8, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
    Haveri: {
        cities: {
            Haveri: { householdCount: 90, baseDemandKWh: 2.0, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Ranebennur: { householdCount: 95, baseDemandKWh: 2.1, prosumerBasePct: 0.12, zoneType: "semi-urban" },
            Byadagi: { householdCount: 50, baseDemandKWh: 1.6, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
    "Uttara Kannada": {
        cities: {
            Karwar: { householdCount: 85, baseDemandKWh: 2.0, prosumerBasePct: 0.14, zoneType: "coastal" },
            Sirsi: { householdCount: 65, baseDemandKWh: 1.8, prosumerBasePct: 0.13, zoneType: "hill" },
            Kumta: { householdCount: 55, baseDemandKWh: 1.7, prosumerBasePct: 0.14, zoneType: "coastal" },
        },
    },
    Udupi: {
        cities: {
            Udupi: { householdCount: 95, baseDemandKWh: 2.1, prosumerBasePct: 0.15, zoneType: "coastal" },
            Manipal: { householdCount: 70, baseDemandKWh: 2.0, prosumerBasePct: 0.14, zoneType: "coastal" },
            Kundapur: { householdCount: 60, baseDemandKWh: 1.8, prosumerBasePct: 0.15, zoneType: "coastal" },
        },
    },
    "Dakshina Kannada": {
        cities: {
            Mangaluru: { householdCount: 220, baseDemandKWh: 2.9, prosumerBasePct: 0.14, zoneType: "coastal" },
            Puttur: { householdCount: 85, baseDemandKWh: 2.0, prosumerBasePct: 0.13, zoneType: "coastal" },
            Bantwal: { householdCount: 80, baseDemandKWh: 1.9, prosumerBasePct: 0.13, zoneType: "coastal" },
        },
    },
    Chikkaballapur: {
        cities: {
            Chikkaballapur: { householdCount: 95, baseDemandKWh: 2.0, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            "Kolar Gold Fields": { householdCount: 70, baseDemandKWh: 1.8, prosumerBasePct: 0.12, zoneType: "semi-urban" },
            Gauribidanur: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
    Kolar: {
        cities: {
            Kolar: { householdCount: 100, baseDemandKWh: 2.1, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Malur: { householdCount: 70, baseDemandKWh: 1.8, prosumerBasePct: 0.12, zoneType: "rural" },
            Bangarpet: { householdCount: 65, baseDemandKWh: 1.7, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
    Ramanagara: {
        cities: {
            Ramanagara: { householdCount: 85, baseDemandKWh: 1.9, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Channapatna: { householdCount: 70, baseDemandKWh: 1.8, prosumerBasePct: 0.12, zoneType: "semi-urban" },
            Magadi: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.13, zoneType: "rural" },
        },
    },
    Chamarajanagar: {
        cities: {
            Chamarajanagar: { householdCount: 75, baseDemandKWh: 1.8, prosumerBasePct: 0.1, zoneType: "rural" },
            Kollegal: { householdCount: 65, baseDemandKWh: 1.7, prosumerBasePct: 0.11, zoneType: "rural" },
            Gundlupete: { householdCount: 55, baseDemandKWh: 1.6, prosumerBasePct: 0.11, zoneType: "rural" },
        },
    },
    Bidar: {
        cities: {
            Bidar: { householdCount: 95, baseDemandKWh: 2.1, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Basavakalyan: { householdCount: 70, baseDemandKWh: 1.8, prosumerBasePct: 0.11, zoneType: "semi-urban" },
            Bhalki: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.11, zoneType: "rural" },
        },
    },
    Kalaburagi: {
        cities: {
            Kalaburagi: { householdCount: 150, baseDemandKWh: 2.5, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Sedam: { householdCount: 70, baseDemandKWh: 1.8, prosumerBasePct: 0.11, zoneType: "rural" },
            Afzalpur: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.11, zoneType: "rural" },
        },
    },
    Yadgir: {
        cities: {
            Yadgir: { householdCount: 85, baseDemandKWh: 1.9, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Shorapur: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.11, zoneType: "rural" },
            Gurmitkal: { householdCount: 55, baseDemandKWh: 1.6, prosumerBasePct: 0.11, zoneType: "rural" },
        },
    },
    Vijayapura: {
        cities: {
            Vijayapura: { householdCount: 125, baseDemandKWh: 2.3, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Sindagi: { householdCount: 70, baseDemandKWh: 1.8, prosumerBasePct: 0.11, zoneType: "rural" },
            Muddebihal: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
    Bagalkot: {
        cities: {
            Bagalkot: { householdCount: 110, baseDemandKWh: 2.2, prosumerBasePct: 0.1, zoneType: "semi-urban" },
            Badami: { householdCount: 65, baseDemandKWh: 1.8, prosumerBasePct: 0.11, zoneType: "rural" },
            Jamkhandi: { householdCount: 70, baseDemandKWh: 1.9, prosumerBasePct: 0.11, zoneType: "rural" },
        },
    },
    Vijayanagara: {
        cities: {
            Hosapete: { householdCount: 90, baseDemandKWh: 2.1, prosumerBasePct: 0.12, zoneType: "semi-urban" },
            Harapanahalli: { householdCount: 60, baseDemandKWh: 1.7, prosumerBasePct: 0.12, zoneType: "rural" },
            Hagaribommanahalli: { householdCount: 50, baseDemandKWh: 1.6, prosumerBasePct: 0.12, zoneType: "rural" },
        },
    },
};

export const DISTRICTS = Object.keys(KARNATAKA_GRID);

export const DISTRICT_CITY_MAP: Record<string, string[]> = Object.fromEntries(
    Object.entries(KARNATAKA_GRID).map(([district, config]) => [district, Object.keys(config.cities)])
);

export const GRIDWISE_STATE = "Karnataka";

export type GeoHierarchy = {
    state: string;
    district: string;
    city: string;
    subCity: string;
    localArea: string;
};

const CITY_HIERARCHY_OVERRIDES: Record<
    string,
    {
        subCities: string[];
        localAreas: string[];
    }
> = {
    Bengaluru: {
        subCities: ["South Bengaluru", "North Bengaluru", "East Bengaluru"],
        localAreas: ["Jayanagar", "Hebbal", "Indiranagar", "Marathahalli"],
    },
    Whitefield: {
        subCities: ["Whitefield Core", "IT Corridor", "Outer Whitefield"],
        localAreas: ["Kadugodi", "EPIP Zone", "Varthur", "Hope Farm"],
    },
    Mangaluru: {
        subCities: ["Mangaluru Port", "Mangaluru Central", "Mangaluru North"],
        localAreas: ["Hampankatta", "Surathkal", "Kadri", "Panambur"],
    },
};

function fallbackHierarchy(city: string) {
    return {
        subCities: [
            `${city} Central`,
            `${city} East Cluster`,
            `${city} West Cluster`,
        ],
        localAreas: [
            `${city} Zone A`,
            `${city} Zone B`,
            `${city} Zone C`,
            `${city} Zone D`,
        ],
    };
}

export function getGeoHierarchy(
    district: string,
    city: string,
    timestamp: Date = new Date()
): GeoHierarchy {
    const hierarchy = CITY_HIERARCHY_OVERRIDES[city] ?? fallbackHierarchy(city);
    const subCity = hierarchy.subCities[timestamp.getHours() % hierarchy.subCities.length];
    const localArea = hierarchy.localAreas[timestamp.getDate() % hierarchy.localAreas.length];

    return {
        state: GRIDWISE_STATE,
        district,
        city,
        subCity,
        localArea,
    };
}

const FALLBACK_CITY_CONFIG: CityGridConfig = {
    householdCount: 100,
    baseDemandKWh: 2.2,
    prosumerBasePct: 0.1,
    zoneType: "semi-urban",
};

export function getCityGridConfig(district: string, city: string): CityGridConfig {
    return KARNATAKA_GRID[district]?.cities[city] ?? FALLBACK_CITY_CONFIG;
}
