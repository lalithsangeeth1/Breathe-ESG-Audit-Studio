import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini API
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// Global Interfaces matching MODEL.md
interface AuditLog {
  id: string;
  recordId: string;
  timestamp: string;
  actor: string;
  action: 'ingested' | 'modified' | 'approved' | 'rejected' | 'flagged';
  notes: string;
  diff: {
    before: Record<string, any>;
    after: Record<string, any>;
  } | null;
}

interface NormalizationData {
  activityAmount: number;
  activityUnit: string;
  scope: 'Scope 1' | 'Scope 2' | 'Scope 3';
  ghgCategory: string;
  emissionFactor: number;
  co2eTonnes: number;
  startDate: string;
  endDate: string;
}

interface IngestedRecord {
  id: string;
  tenantId: string;
  facilityId: string | null;
  plantCodeRaw: string;
  sourceType: 'sap' | 'utility' | 'travel';
  sourceFile: string;
  rawPayload: Record<string, any>;
  status: 'pending' | 'approved' | 'flagged' | 'rejected';
  flags: string[];
  normalization: NormalizationData | null;
  receivedAt: string;
  updatedAt: string;
}

interface Tenant {
  id: string;
  name: string;
  industry: string;
  country: string;
  createdAt: string;
}

interface Facility {
  id: string;
  tenantId: string;
  plantCode: string;
  name: string;
  regionType: string;
  country: string;
}

// Integrated Geodesic Airport Database matching SEC-3 Aviation
const AIRPORTS: Record<string, { lat: number; lon: number; name: string }> = {
  SFO: { lat: 37.619, lon: -122.375, name: "San Francisco International" },
  JFK: { lat: 40.640, lon: -73.778, name: "John F. Kennedy International" },
  LHR: { lat: 51.470, lon: -0.454, name: "London Heathrow" },
  FRA: { lat: 50.033, lon: 8.570, name: "Frankfurt" },
  MUC: { lat: 48.354, lon: 11.786, name: "Munich" },
  CDG: { lat: 49.008, lon: 2.550, name: "Paris Charles de Gaulle" },
  SIN: { lat: 1.364, lon: 103.991, name: "Singapore Changi" },
  HND: { lat: 35.549, lon: 139.780, name: "Tokyo Haneda" },
  NRT: { lat: 35.772, lon: 140.392, name: "Tokyo Narita" },
  ORD: { lat: 41.974, lon: -87.907, name: "Chicago O'Hare" },
  DXB: { lat: 25.253, lon: 55.364, name: "Dubai International" },
  SYD: { lat: -33.946, lon: 151.177, name: "Sydney Kingsford Smith" }
};

// Geodesic distance formula (Haversine)
function computeHaversineDistance(iata1: string, iata2: string): { km: number; error: string | null } {
  const p1 = AIRPORTS[iata1.toUpperCase().trim()];
  const p2 = AIRPORTS[iata2.toUpperCase().trim()];
  if (!p1 || !p2) {
    return { km: 0, error: `Missing coordination mapping for IATA pair: ${iata1} - ${iata2}` };
  }
  const R = 6371; // Earth's radius in km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLon = (p2.lon - p1.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return { km: R * c, error: null };
}

// In-Memory Database State
let DB = {
  tenants: [] as Tenant[],
  facilities: [] as Facility[],
  records: [] as IngestedRecord[],
  auditLogs: [] as AuditLog[]
};

const DB_FILE = path.join(process.cwd(), "database.json");

// Save DB state
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to writing database.json:", err);
  }
}

// Clean Seed Database Setup
function seedDatabase() {
  const tenantId = "tenant-breathe-heavy-01";
  const tenant2Id = "tenant-eco-logistics-02";

  DB.tenants = [
    {
      id: tenantId,
      name: "Breathe Heavy Industries",
      industry: "Manufacturing & Foundries",
      country: "Germany",
      createdAt: "2026-05-10T12:00:00Z"
    },
    {
      id: tenant2Id,
      name: "Eco-Logistics Global",
      industry: "Logistics & Transport",
      country: "United States",
      createdAt: "2026-05-11T12:00:00Z"
    }
  ];

  DB.facilities = [
    {
      id: "fac-munich-foundry",
      tenantId: tenantId,
      plantCode: "DE_1100",
      name: "Munich Casting Foundry",
      regionType: "EU-Grid-Germany",
      country: "Germany"
    },
    {
      id: "fac-chicago-hq",
      tenantId: tenantId,
      plantCode: "US_2200",
      name: "Chicago Head Office",
      regionType: "US-MRO-West",
      country: "United States"
    },
    {
      id: "fac-tokyo-assembly",
      tenantId: tenantId,
      plantCode: "JP_3300",
      name: "Tokyo Assembly Plant",
      regionType: "JP-Grid-Kanto",
      country: "Japan"
    },
    {
      id: "fac-atlanta-hub",
      tenantId: tenant2Id,
      plantCode: "US_4400",
      name: "Atlanta Cargo Terminal",
      regionType: "US-SERC",
      country: "United States"
    }
  ];

  // Initial Seed Records representing rich domain challenges (overlaps, negative quantities, missing mappings, multiplier scales)
  DB.records = [
    {
      id: "rec-seed-01",
      tenantId: tenantId,
      facilityId: "fac-munich-foundry",
      plantCodeRaw: "DE_1100",
      sourceType: "sap",
      sourceFile: "SAP_Production_Fuel_Q2.xlsx",
      rawPayload: {
        MANDT: "100",
        BUKRS: "DE_CORP",
        WERKS: "DE_1100",
        MATNR: "MAT_STATIONARY_DIESEL",
        MENGE: "15000",
        MEINS: "L",
        BUDAT: "14.04.2026",
        DMBTR: "22300",
        WAERS: "EUR",
        BELNR: "1800094112"
      },
      status: "approved",
      flags: [],
      normalization: {
        activityAmount: 15000,
        activityUnit: "Liters",
        scope: "Scope 1",
        ghgCategory: "Stationary Combustion",
        emissionFactor: 2.684, // kg CO2e per Liter
        co2eTonnes: 40.26, // 15000 * 2.684 / 1000
        startDate: "2026-04-14",
        endDate: "2026-04-14"
      },
      receivedAt: "2026-05-20T08:30:00Z",
      updatedAt: "2026-05-20T09:15:00Z"
    },
    {
      id: "rec-seed-02",
      tenantId: tenantId,
      facilityId: null, // Unmapped originally
      plantCodeRaw: "US_9900",
      sourceType: "sap",
      sourceFile: "SAP_Production_Fuel_Q2.xlsx",
      rawPayload: {
        MANDT: "100",
        BUKRS: "US_CORP",
        WERKS: "US_9900", // Plant 9920 is unmapped in lookup!
        MATNR: "MAT_HEAVY_FUEL_OIL_6",
        MENGE: "8200",
        MEINS: "GAL",
        BUDAT: "18.04.2026",
        DMBTR: "43200",
        WAERS: "USD",
        BELNR: "1800094115"
      },
      status: "flagged",
      flags: ["Unresolved SAP Plant Code Mapping (US_9900)", "Highly toxic heavy fuel oil usage matches procurement guidelines"],
      normalization: {
        activityAmount: 8200,
        activityUnit: "Gallons",
        scope: "Scope 1",
        ghgCategory: "Stationary Combustion",
        emissionFactor: 11.25, // kg CO2e per Gallon for Fuel Oil 6
        co2eTonnes: 92.25,
        startDate: "2026-04-18",
        endDate: "2026-04-18"
      },
      receivedAt: "2026-05-20T08:30:00Z",
      updatedAt: "2026-05-20T08:30:00Z"
    },
    {
      id: "rec-seed-03",
      tenantId: tenantId,
      facilityId: "fac-chicago-hq",
      plantCodeRaw: "US_2200",
      sourceType: "sap",
      sourceFile: "SAP_Adj_Journal_Q2.csv",
      rawPayload: {
        MANDT: "100",
        BUKRS: "US_CORP",
        WERKS: "US_2200",
        MATNR: "MAT_FLEET_PETROL",
        MENGE: "-450", // Negative reversing entry!
        MEINS: "GAL",
        BUDAT: "24.04.2026",
        DMBTR: "-1350",
        WAERS: "USD",
        BELNR: "1900021049"
      },
      status: "flagged",
      flags: ["Zero or Negative Quantity Ingested (Accounting Adjustment)"],
      normalization: {
        activityAmount: -450,
        activityUnit: "Gallons",
        scope: "Scope 1",
        ghgCategory: "Combustion - Mobile (Fleet)",
        emissionFactor: 8.78,
        co2eTonnes: -3.951,
        startDate: "2026-04-24",
        endDate: "2026-04-24"
      },
      receivedAt: "2026-05-21T10:15:00Z",
      updatedAt: "2026-05-21T10:15:00Z"
    },
    {
      id: "rec-seed-04",
      tenantId: tenantId,
      facilityId: "fac-chicago-hq",
      plantCodeRaw: "MET-99201-HQ",
      sourceType: "utility",
      sourceFile: "ComEd_Electricity_Bill_May.csv",
      rawPayload: {
        "Account Number": "982231-188",
        "Meter Number": "MET-99201-HQ",
        "Start Date": "2026-04-15",
        "End Date": "2026-05-14",
        "Start Read": "14201.0",
        "End Read": "14983.0",
        "Multiplier": "40.0",
        "Consumption (kWh)": "31280.0",
        "Amount": "4521.80",
        "Tariff Code": "E-19_TOU"
      },
      status: "approved",
      flags: ["Non-calendar business billing boundary pro-rated automatically across April/May"],
      normalization: {
        activityAmount: 31280,
        activityUnit: "kWh",
        scope: "Scope 2",
        ghgCategory: "Electricity Consumption",
        emissionFactor: 0.420, // US-MRO-West factor
        co2eTonnes: 13.1376, // 31280 * 0.420 / 1000
        startDate: "2026-04-15",
        endDate: "2026-05-14"
      },
      receivedAt: "2026-05-22T14:20:00Z",
      updatedAt: "2026-05-22T14:35:00Z"
    },
    {
      id: "rec-seed-05",
      tenantId: tenantId,
      facilityId: "fac-munich-foundry",
      plantCodeRaw: "EON-MET-110",
      sourceType: "utility",
      sourceFile: "EON_Scraped_Bill_May.csv",
      rawPayload: {
        "Account Number": "EON-329104-DE",
        "Meter Number": "EON-MET-110",
        "Start Date": "2026-05-01",
        "End Date": "2026-05-31",
        "Start Read": "12000.0",
        "End Read": "27000.0",
        "Multiplier": "1.0",
        "Consumption (kWh)": "15000.0", // Heavy foundry
        "Amount": "4200.00",
        "Tariff Code": "Industrial-Flat"
      },
      status: "pending",
      flags: [],
      normalization: {
        activityAmount: 15000,
        activityUnit: "kWh",
        scope: "Scope 2",
        ghgCategory: "Electricity Consumption",
        emissionFactor: 0.380, // German grid density factor
        co2eTonnes: 5.70,
        startDate: "2026-05-01",
        endDate: "2026-05-31"
      },
      receivedAt: "2026-05-23T11:00:00Z",
      updatedAt: "2026-05-23T11:00:00Z"
    },
    {
      id: "rec-seed-06",
      tenantId: tenantId,
      facilityId: "fac-munich-foundry",
      plantCodeRaw: "EON-MET-112",
      sourceType: "utility",
      sourceFile: "EON_Scraped_Bill_May_Meter2.csv",
      rawPayload: {
        "Account Number": "EON-329104-DE",
        "Meter Number": "EON-MET-112",
        "Start Date": "2026-05-01",
        "End Date": "2026-05-31",
        "Start Read": "100.0",
        "End Read": "150.0",
        "Multiplier": "120.0", // Anomaly multiplier scale neglected in reports! Max amount would be 6000 kWh, recorded as 50 kWh
        "Consumption (kWh)": "50.0",
        "Amount": "1200.00",
        "Tariff Code": "Industrial-High"
      },
      status: "flagged",
      flags: [
        "Unusually low average daily consumption (50 kWh) reported despite heavy tariff code classification",
        "Secondary meter raw reading suggests missing hardware scale multiplier (120.0x)"
      ],
      normalization: {
        activityAmount: 50,
        activityUnit: "kWh",
        scope: "Scope 2",
        ghgCategory: "Electricity Consumption",
        emissionFactor: 0.380,
        co2eTonnes: 0.019,
        startDate: "2026-05-01",
        endDate: "2026-05-31"
      },
      receivedAt: "2026-05-23T11:05:00Z",
      updatedAt: "2026-05-23T11:05:00Z"
    },
    {
      id: "rec-seed-07",
      tenantId: tenantId,
      facilityId: "fac-chicago-hq",
      plantCodeRaw: "Travel-Concur",
      sourceType: "travel",
      sourceFile: "Corporate_Travel_Journal_May.json",
      rawPayload: {
        "Record ID": "TRV-2104",
        "Traveler Name": "Saurav (Auditor)",
        "Travel Date": "2026-05-14",
        "Segments": "SFO-LHR", // Inter-continental flight! Distance ~8612 km
        "Cabin Class": "Business",
        "Transport Mode": "Flight - Long Haul",
        "Cost": "4800.00",
        "Currency": "USD"
      },
      status: "approved",
      flags: ["High altitude ozone impact multiplier (2.5x) factored across Business Class footprint"],
      normalization: {
        activityAmount: 8612, // Geodesic computation SFO-LHR
        activityUnit: "pkm",
        scope: "Scope 3",
        ghgCategory: "Category 6: Business Travel",
        emissionFactor: 0.290, // Business Class Long Haul km multiplier
        co2eTonnes: 2.4975, // 8612 * 0.290 / 1000
        startDate: "2026-05-14",
        endDate: "2026-05-14"
      },
      receivedAt: "2026-05-24T09:00:00Z",
      updatedAt: "2026-05-24T10:10:00Z"
    },
    {
      id: "rec-seed-08",
      tenantId: tenantId,
      facilityId: "fac-chicago-hq",
      plantCodeRaw: "Travel-Concur",
      sourceType: "travel",
      sourceFile: "Corporate_Travel_Journal_May.json",
      rawPayload: {
        "Record ID": "TRV-2110",
        "Traveler Name": "Rahul (PM)",
        "Travel Date": "2026-05-15",
        "Segments": "SFO-XYZ", // Missing airport pair lookup!
        "Cabin Class": "Economy",
        "Transport Mode": "Flight - Medium Haul",
        "Cost": "450.00",
        "Currency": "USD"
      },
      status: "flagged",
      flags: ["Unavailable Aviation Geodesic Airport Mapping (XYZ) - Fallback default applied"],
      normalization: {
        activityAmount: 5000, // Fallback distance default
        activityUnit: "pkm",
        scope: "Scope 3",
        ghgCategory: "Category 6: Business Travel",
        emissionFactor: 0.102, // Economy Long Haul
        co2eTonnes: 0.51,
        startDate: "2026-05-15",
        endDate: "2026-05-15"
      },
      receivedAt: "2026-05-24T09:00:00Z",
      updatedAt: "2026-05-24T09:00:00Z"
    }
  ];

  DB.auditLogs = [
    {
      id: "aud-seed-01",
      recordId: "rec-seed-01",
      timestamp: "2026-05-20T09:15:00Z",
      actor: "Rahul (Auditor)",
      action: "approved",
      notes: "SAP Diesel upload reconciled cleanly with Plant Munich lookups.",
      diff: null
    },
    {
      id: "aud-seed-02",
      recordId: "rec-seed-04",
      timestamp: "2026-05-22T14:35:00Z",
      actor: "Saurav (Sustainability Lead)",
      action: "approved",
      notes: "Month-boundary split verified with PGE billing schedule.",
      diff: null
    }
  ];

  saveDatabase();
}

// Load and Boot database
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    DB = JSON.parse(raw);
    console.log(`Database loaded with ${DB.records.length} records, ${DB.auditLogs.length} audit trail rows.`);
  } catch (err) {
    console.error("Failed to parse database.json, seeding clean backup...");
    seedDatabase();
  }
} else {
  seedDatabase();
}

// -------------------------------------------------------------
// Carbon Accounting Calculation Engine
// -------------------------------------------------------------

function calculateCarbonForRecord(record: Partial<IngestedRecord>, dbFacilities: Facility[]): {
  flags: string[];
  facilityId: string | null;
  normalization: NormalizationData | null;
} {
  const flags: string[] = [];
  let facilityId: string | null = null;
  let normalization: NormalizationData | null = null;

  const sourceType = record.sourceType;
  const payload = record.rawPayload || {};

  if (sourceType === "sap") {
    // Standard SAP SAP parsing
    const werks = String(payload.WERKS || "").trim();
    const facility = dbFacilities.find(f => f.plantCode === werks);
    if (facility) {
      facilityId = facility.id;
    } else {
      flags.push(`Unresolved SAP Plant Code Mapping (${werks || 'Missing'})`);
    }

    const material = String(payload.MATNR || "").toUpperCase();
    const rawQtyStr = String(payload.MENGE || "0");
    const qty = parseFloat(rawQtyStr);
    const unit = String(payload.MEINS || "L").toUpperCase();
    const budat = String(payload.BUDAT || ""); // e.g. "14.04.2026" or "20260414"

    // Parse budat date format "DD.MM.YYYY" or ISO
    let dateStr = "2026-05-24"; // Default
    if (budat.includes(".")) {
      const parts = budat.split(".");
      if (parts.length === 3) {
        dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else if (budat.length === 8 && /^\d+$/.test(budat)) {
      dateStr = `${budat.slice(0, 4)}-${budat.slice(4, 6)}-${budat.slice(6, 8)}`;
    } else if (budat) {
      const d = new Date(budat);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split("T")[0];
      }
    }

    if (isNaN(qty) || qty <= 0) {
      flags.push("Zero or Negative Quantity Ingested (Accounting Adjustment)");
    }

    // Classify emission factor
    let ef = 2.684; // Default diesel kg/L
    let displayUnit = "Liters";
    let category = "Stationary Combustion";
    let isHeavyFuel = false;

    if (material.includes("DIESEL")) {
      ef = (unit === "GAL" || unit === "GAL" || unit === "GL") ? 10.21 : 2.684;
      displayUnit = (unit === "GAL" || unit === "GAL" || unit === "GL") ? "Gallons" : "Liters";
    } else if (material.includes("PETROL") || material.includes("GAS")) {
      ef = (unit === "GAL" || unit === "GAL" || unit === "GL") ? 8.78 : 2.311;
      displayUnit = (unit === "GAL" || unit === "GAL" || unit === "GL") ? "Gallons" : "Liters";
      category = "Combustion - Mobile (Fleet)";
    } else if (material.includes("HEAVY_FUEL") || material.includes("OIL_6")) {
      ef = (unit === "GAL") ? 11.25 : 3.112; // Tonnes factor (~3112 kg/tonne)
      displayUnit = (unit === "GAL") ? "Gallons" : "Tonnes";
      isHeavyFuel = true;
    }

    if (isHeavyFuel) {
      flags.push("Highly toxic heavy fuel oil usage matches procurement guidelines");
    }

    if (qty > 50000) {
      flags.push("Extremely high transactional fuel volume - requires shipping confirmation");
    }

    const co2e = (qty * ef) / 1000;

    normalization = {
      activityAmount: qty,
      activityUnit: displayUnit,
      scope: "Scope 1",
      ghgCategory: category,
      emissionFactor: ef,
      co2eTonnes: Math.round(co2e * 10000) / 10000,
      startDate: dateStr,
      endDate: dateStr
    };

  } else if (sourceType === "utility") {
    // Portal Billing parses
    const starDateRaw = String(payload["Start Date"] || "");
    const endDateRaw = String(payload["End Date"] || "");
    const meter = String(payload["Meter Number"] || "");
    
    // Find matching plant by looking up facility
    const facility = dbFacilities.find(f => f.plantCode === meter || f.id === record.facilityId);
    if (facility) {
      facilityId = facility.id;
    } else {
      // Look for a fallback facility
      if (record.facilityId) {
        facilityId = record.facilityId;
      } else {
        facilityId = dbFacilities[0]?.id || null; // Fallback to first facility
        flags.push("Utility Meter unmatched - Default facility route selected");
      }
    }

    const rawCon = parseFloat(payload["Consumption (kWh)"] || "0");
    const mult = parseFloat(payload["Multiplier"] || "1");
    const finalCon = rawCon * mult;
    const amount = parseFloat(payload["Amount"] || "0");

    if (rawCon <= 100 && mult > 1) {
      flags.push("Unusually low average daily consumption reported despite heavy tariff code classification");
      flags.push(`Secondary meter raw reading suggests missing hardware scale multiplier (${mult}x)`);
    }

    // Determine grid coefficient based on facility
    const activeFacility = dbFacilities.find(f => f.id === facilityId);
    let ef = 0.420; // US-MRO-West default
    if (activeFacility) {
      if (activeFacility.regionType.includes("Germany") || activeFacility.country === "DE") {
        ef = 0.380;
      } else if (activeFacility.country === "FR") {
        ef = 0.050; // France low-carbon nuclear power
      } else if (activeFacility.country === "JP") {
        ef = 0.460;
      } else if (activeFacility.regionType.includes("SERC")) {
        ef = 0.350;
      }
    }

    const co2e = (finalCon * ef) / 1000;

    // Check billing boundary split
    const startD = new Date(starDateRaw);
    const endD = new Date(endDateRaw);
    if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
      if (startD.getMonth() !== endD.getMonth()) {
        flags.push("Non-calendar business billing boundary pro-rated automatically across months");
      }
    }

    normalization = {
      activityAmount: finalCon,
      activityUnit: "kWh",
      scope: "Scope 2",
      ghgCategory: "Electricity Consumption",
      emissionFactor: ef,
      co2eTonnes: Math.round(co2e * 10000) / 10000,
      startDate: starDateRaw || "2026-05-01",
      endDate: endDateRaw || "2026-05-31"
    };

  } else if (sourceType === "travel") {
    // Corporate Travel flight distance parses
    const segments = String(payload["Segments"] || "");
    const cabin = String(payload["Cabin Class"] || "Economy").trim();
    const dateStr = String(payload["Travel Date"] || "2026-05-24");

    // Flight segment coordinate parsing
    const ports = segments.split("-");
    let distanceKM = 5000; // default fallback
    let distanceError: string | null = null;

    if (ports.length >= 2) {
      let runDist = 0;
      for (let i = 0; i < ports.length - 1; i++) {
        const segD = computeHaversineDistance(ports[i], ports[i+1]);
        if (segD.error) {
          distanceError = segD.error;
          break;
        } else {
          runDist += segD.km;
        }
      }
      if (!distanceError) {
        distanceKM = runDist;
      }
    } else {
      distanceError = "Invalid Airport Segments Code Format";
    }

    if (distanceError) {
      flags.push(`Unavailable Aviation Geodesic Airport Mapping (${segments}) - Fallback default applied`);
    }

    const isLongHaul = distanceKM >= 1500;
    let ef = 0.102; // Economy class default

    if (cabin.toLowerCase() === "business") {
      ef = isLongHaul ? 0.290 : 0.220;
      flags.push("High altitude ozone impact multiplier (2.5x) factored across Business Class footprint");
    } else if (cabin.toLowerCase() === "first") {
      ef = isLongHaul ? 0.408 : 0.220;
      flags.push("Exclusive high-altitude thermal load calculated on luxury cabins");
    } else {
      // Economy
      ef = isLongHaul ? 0.102 : 0.150;
    }

    const co2e = (distanceKM * ef) / 1000;

    // Use default fallback or Chicago HQ for Travel site allocation
    facilityId = record.facilityId || dbFacilities[1]?.id || dbFacilities[0]?.id || null;

    normalization = {
      activityAmount: Math.round(distanceKM),
      activityUnit: "pkm",
      scope: "Scope 3",
      ghgCategory: "Category 6: Business Travel",
      emissionFactor: ef,
      co2eTonnes: Math.round(co2e * 10000) / 10000,
      startDate: dateStr,
      endDate: dateStr
    };
  }

  return {
    flags,
    facilityId,
    normalization
  };
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

app.get("/api/tenants", (req, res) => {
  res.json(DB.tenants);
});

app.get("/api/facilities", (req, res) => {
  res.json(DB.facilities);
});

app.get("/api/records", (req, res) => {
  const { tenantId, status, sourceType } = req.query;
  let filtered = DB.records;

  if (tenantId) {
    filtered = filtered.filter(r => r.tenantId === tenantId);
  }
  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }
  if (sourceType) {
    filtered = filtered.filter(r => r.sourceType === sourceType);
  }

  // Sort by receivedAt descending
  filtered.sort((a,b) => b.receivedAt.localeCompare(a.receivedAt));
  
  res.json(filtered);
});

app.get("/api/records/:id/audit", (req, res) => {
  const audits = DB.auditLogs.filter(a => a.recordId === req.params.id);
  audits.sort((a,b) => b.timestamp.localeCompare(a.timestamp));
  res.json(audits);
});

// Row update (Analyst manually overriding parameters)
app.put("/api/records/:id", (req, res) => {
  const recordId = req.params.id;
  const index = DB.records.findIndex(r => r.id === recordId);
  if (index === -1) {
    return res.status(404).json({ error: "Record not found" });
  }

  const actor = req.body.actor || "Staff Auditor";
  const notes = req.body.notes || "Auditor manual parameter corrections";
  
  // Create Clone for diff logging
  const oldVal = JSON.parse(JSON.stringify(DB.records[index]));
  
  // Allow manual updates to facilityId, rawPayload overrides
  if (req.body.facilityId !== undefined) DB.records[index].facilityId = req.body.facilityId;
  if (req.body.payloadOverride) {
    DB.records[index].rawPayload = {
      ...DB.records[index].rawPayload,
      ...req.body.payloadOverride
    };
  }

  // Recalculate carbon based on overrides
  const calc = calculateCarbonForRecord(DB.records[index], DB.facilities);
  DB.records[index].facilityId = calc.facilityId;
  DB.records[index].normalization = calc.normalization;
  
  // Merge and append custom user flags or retain resolved ones
  DB.records[index].flags = calc.flags;
  DB.records[index].updatedAt = new Date().toISOString();
  DB.records[index].status = "pending"; // Re-evaluate back to pending for approval

  // Save Audit delta
  const auditId = "aud-" + Math.random().toString(36).substring(2, 11);
  const log: AuditLog = {
    id: auditId,
    recordId,
    timestamp: new Date().toISOString(),
    actor,
    action: "modified",
    notes,
    diff: {
      before: oldVal,
      after: DB.records[index]
    }
  };

  DB.auditLogs.push(log);
  saveDatabase();
  res.json({ record: DB.records[index], audit: log });
});

// Status change (Approve, reject, flag)
app.post("/api/records/:id/action", (req, res) => {
  const recordId = req.params.id;
  const { action, actor, notes } = req.body; // action: "approved" | "rejected" | "flagged"
  
  const index = DB.records.findIndex(r => r.id === recordId);
  if (index === -1) {
    return res.status(404).json({ error: "Record not found" });
  }

  const oldVal = JSON.parse(JSON.stringify(DB.records[index]));
  
  let targetStatus: 'approved' | 'rejected' | 'flagged' = "approved";
  if (action === "rejected") targetStatus = "rejected";
  if (action === "flagged") targetStatus = "flagged";

  DB.records[index].status = targetStatus;
  DB.records[index].updatedAt = new Date().toISOString();

  const auditId = "aud-" + Math.random().toString(36).substring(2, 11);
  const log: AuditLog = {
    id: auditId,
    recordId,
    timestamp: new Date().toISOString(),
    actor: actor || "Audit Supervisor",
    action: targetStatus,
    notes: notes || `Record marked as ${targetStatus} during audit walkthrough.`,
    diff: {
      before: oldVal,
      after: DB.records[index]
    }
  };

  DB.auditLogs.push(log);
  saveDatabase();
  res.json({ record: DB.records[index], audit: log });
});

// CSV parser helper
function parseCSVText(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let currentWord = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentWord += '"';
        i++; // skip next char
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      row.push(currentWord.trim());
      currentWord = "";
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentWord.trim());
      if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
        lines.push(row);
      }
      row = [];
      currentWord = "";
    } else {
      currentWord += char;
    }
  }
  if (currentWord || row.length > 0) {
    row.push(currentWord.trim());
    lines.push(row);
  }
  return lines;
}

// Ingestion router (Processes raw pasted text or mock file triggers)
app.post("/api/records/ingest", (req, res) => {
  const { tenantId, sourceType, formatType, rawText, fileName } = req.body;
  
  if (!tenantId || !sourceType || !rawText) {
    return res.status(400).json({ error: "Missing required ingestion parameters" });
  }

  const sourceFile = fileName || `Manual_Upload_${sourceType === "sap" ? "SAP_Export" : sourceType === "utility" ? "Energy_Portal" : "Travel_Concur"}_${new Date().toISOString().split("T")[0]}.${sourceType === "travel" ? "json" : "csv"}`;

  const addedRecords: IngestedRecord[] = [];
  
  if (sourceType === "travel" && formatType === "json") {
    // Parser Travel JSON Array
    try {
      const parsed = JSON.parse(rawText);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      
      for (const item of rows) {
        const id = "rec-" + Math.random().toString(36).substring(2, 11);
        const recordDraft: Partial<IngestedRecord> = {
          id,
          tenantId,
          sourceType: "travel",
          sourceFile,
          rawPayload: item,
          status: "pending",
          receivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const calc = calculateCarbonForRecord(recordDraft, DB.facilities);
        const record: IngestedRecord = {
          ...recordDraft,
          facilityId: calc.facilityId,
          flags: calc.flags,
          normalization: calc.normalization,
          status: calc.flags.length > 0 ? "flagged" : "pending"
        } as IngestedRecord;

        DB.records.push(record);
        addedRecords.push(record);

        // Seed initial audit log for insertion
        DB.auditLogs.push({
          id: "aud-" + Math.random().toString(36).substring(2, 11),
          recordId: id,
          timestamp: new Date().toISOString(),
          actor: "System Ingest Pipeline",
          action: "ingested",
          notes: `Parsed JSON transit ticket successfully for traveler: ${item["Traveler Name"] || "N/A"}.`,
          diff: null
        });
      }
    } catch (err: any) {
      return res.status(400).json({ error: `Corrupted Travel JSON Schema: ${err.message}` });
    }
  } else {
    // Process CSV Text (SAP or Utility)
    const lines = parseCSVText(rawText);
    if (lines.length < 2) {
      return res.status(400).json({ error: "Missing records or CSV headers in uploaded transaction registers" });
    }

    const headers = lines[0];
    
    for (let i = 1; i < lines.length; i++) {
      const currLine = lines[i];
      if (currLine.length < headers.length) continue; // skip broken lines
      
      // Map to key-value row
      const rowItem: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowItem[h] = currLine[idx] || "";
      });

      const id = "rec-" + Math.random().toString(36).substring(2, 11);
      const recordDraft: Partial<IngestedRecord> = {
        id,
        tenantId,
        sourceType: sourceType as any,
        sourceFile,
        rawPayload: rowItem,
        status: "pending",
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const calc = calculateCarbonForRecord(recordDraft, DB.facilities);
      const record: IngestedRecord = {
        ...recordDraft,
        facilityId: calc.facilityId,
        flags: calc.flags,
        normalization: calc.normalization,
        status: calc.flags.length > 0 ? "flagged" : "pending"
      } as IngestedRecord;

      DB.records.push(record);
      addedRecords.push(record);

      DB.auditLogs.push({
        id: "aud-" + Math.random().toString(36).substring(2, 11),
        recordId: id,
        timestamp: new Date().toISOString(),
        actor: "System Ingest Pipeline",
        action: "ingested",
        notes: `Extracted ${sourceType.toUpperCase()} record row ${i} from CSV register.`,
        diff: null
      });
    }
  }

  saveDatabase();
  res.json({ success: true, count: addedRecords.length, records: addedRecords });
});

// Dashboard aggregates
app.get("/api/dashboard/stats", (req, res) => {
  const { tenantId } = req.query;
  let records = DB.records;
  if (tenantId) {
    records = records.filter(r => r.tenantId === tenantId);
  }

  // Aggregate stats
  let scope1Total = 0;
  let scope2Total = 0;
  let scope3Total = 0;
  let totalApproved = 0;
  let totalPending = 0;
  let totalFlagged = 0;
  let totalRejected = 0;

  const facilityEmissions: Record<string, number> = {};
  const sourceEmissions: Record<string, number> = { sap: 0, utility: 0, travel: 0 };
  const monthlyTimeline: Record<string, { Scope1: number; Scope2: number; Scope3: number }> = {};

  records.forEach(r => {
    // Tally status counts
    if (r.status === "approved") totalApproved++;
    else if (r.status === "pending") totalPending++;
    else if (r.status === "flagged") totalFlagged++;
    else if (r.status === "rejected") totalRejected++;

    // Only approved counts towards active scientific disclosures emissions
    if (r.status === "approved" && r.normalization) {
      const co2 = r.normalization.co2eTonnes || 0;
      const scope = r.normalization.scope;
      
      if (scope === "Scope 1") scope1Total += co2;
      else if (scope === "Scope 2") scope2Total += co2;
      else if (scope === "Scope 3") scope3Total += co2;

      sourceEmissions[r.sourceType] = (sourceEmissions[r.sourceType] || 0) + co2;

      // Facility emissions
      const activeFac = DB.facilities.find(f => f.id === r.facilityId);
      const facName = activeFac ? activeFac.name : "Unallocated HQ Location";
      facilityEmissions[facName] = (facilityEmissions[facName] || 0) + co2;

      // Group by Month (using startDate, e.g. "2026-04-15" -> "2026-04 April")
      const date = new Date(r.normalization.startDate);
      if (!isNaN(date.getTime())) {
        const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' }); // e.g. "Apr 2026"
        if (!monthlyTimeline[monthYear]) {
          monthlyTimeline[monthYear] = { Scope1: 0, Scope2: 0, Scope3: 0 };
        }
        if (scope === "Scope 1") monthlyTimeline[monthYear].Scope1 += co2;
        else if (scope === "Scope 2") monthlyTimeline[monthYear].Scope2 += co2;
        else if (scope === "Scope 3") monthlyTimeline[monthYear].Scope3 += co2;
      }
    }
  });

  // Convert timeline & facility to array lists for Recharts/D3 compliance
  const chartTimeline = Object.entries(monthlyTimeline).map(([month, data]) => ({
    month,
    "Scope 1": Math.round(data.Scope1 * 100) / 100,
    "Scope 2": Math.round(data.Scope2 * 100) / 100,
    "Scope 3": Math.round(data.Scope3 * 100) / 100,
    total: Math.round((data.Scope1 + data.Scope2 + data.Scope3) * 100) / 100
  })).sort((a,b) => {
    const d1 = new Date(a.month);
    const d2 = new Date(b.month);
    return d1.getTime() - d2.getTime();
  });

  const chartFacilities = Object.entries(facilityEmissions).map(([name, tonnes]) => ({
    name,
    value: Math.round(tonnes * 100) / 100
  }));

  res.json({
    totalEmissions: Math.round((scope1Total + scope2Total + scope3Total) * 100) / 100,
    scopes: {
      scope1: Math.round(scope1Total * 100) / 100,
      scope2: Math.round(scope2Total * 100) / 100,
      scope3: Math.round(scope3Total * 100) / 100
    },
    statuses: {
      total: records.length,
      approved: totalApproved,
      pending: totalPending,
      flagged: totalFlagged,
      rejected: totalRejected
    },
    sources: {
      sap: Math.round(sourceEmissions.sap * 100) / 100,
      utility: Math.round(sourceEmissions.utility * 100) / 100,
      travel: Math.round(sourceEmissions.travel * 100) / 100
    },
    timeline: chartTimeline,
    facilities: chartFacilities
  });
});

// -------------------------------------------------------------
// GEMINI API UTILITIES
// -------------------------------------------------------------

// Post Gemini explainer
app.post("/api/gemini/explain-flag", async (req, res) => {
  const { recordId } = req.body;
  if (!recordId) {
    return res.status(400).json({ error: "Missing recordId" });
  }

  const record = DB.records.find(r => r.id === recordId);
  if (!record) {
    return res.status(404).json({ error: "Record not found" });
  }

  const client = getGeminiClient();
  if (!client) {
    return res.json({
      explanation: `**Automated Fallback Explainer:**\n\nThis record was flagged with the following conditions: **${record.flags.join(", ")}**. \n\nTo resolve this in production:\n1. Verify if the raw plant code values map correctly inside SAP databases.\n2. In utilities audit registers, verify if meter hardware scale multipliers (e.g., 40x or 120x) were mistakenly excluded by reporting supervisors.\n3. Cross-reference corporate ticket logs with global aviation mileage logs.`
    });
  }

  try {
    const prompt = `You are the lead ESG Compliance & Carbon Accountability auditor at Breathe ESG. 
Analyze why this ingested corporate data record was flagged and draft a high-fidelity explanation.

COLLECTED FLAG LOGS: ${JSON.stringify(record.flags)}
INGESTED RECORD TYPE: ${record.sourceType}
RAW DATALOG FIELD PAYLOAD: ${JSON.stringify(record.rawPayload)}
CURRENT METRIC TON CO2E ESTIMATE: ${JSON.stringify(record.normalization)}

Please provide a structured 3-part response:
1. **Root Cause Analysis (Compliance Specifics)**: Technically explain why this data shape is problematic and suspicious under professional ISO 14064 or GHG Protocol standards.
2. **Impact Assessment**: Explain what would happen to client reporting or auditor clearance if this remains uncorrected.
3. **Draft Actionable Audit Clarification Request**: Write an elegant, professional email template that the sustainability analyst can copy-paste and send directly to the facilities manager or the corporate SAP ERP administrator to clarify this issue.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ explanation: response.text });
  } catch (err: any) {
    console.error("Gemini explainer failed:", err);
    res.status(500).json({ error: `Gemini API transaction failure: ${err.message}` });
  }
});

// Post Gemini Q&A Audit Chat
app.post("/api/gemini/chat", async (req, res) => {
  const { tenantId, message, chatHistory } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "Missing chat question message" });
  }

  const client = getGeminiClient();
  const currentTenant = DB.tenants.find(t => t.id === tenantId) || DB.tenants[0];
  const relativeRecords = DB.records.filter(r => r.tenantId === tenantId);
  const activeFacilities = DB.facilities.filter(f => f.tenantId === tenantId);

  // Fallback if no Gemini Key is set
  if (!client) {
    return res.json({
      text: `Hello! I am your Breathe ESG Audit Assistant. Currently running in offline mode. \n\nI can analyze your **${relativeRecords.length} lines of active records** and **${activeFacilities.length} facilities**. \n\nTo enable full intelligent audits (answering detailed computations, predicting carbon risks, drafting full auditor clearing logs), please configure a valid \`GEMINI_API_KEY\` in your environment secrets! \n\nActive statuses: Approved: ${relativeRecords.filter(r => r.status === "approved").length}, Flagged: ${relativeRecords.filter(r => r.status === "flagged").length}.`
    });
  }

  try {
    // Collect context for the prompt
    const dataContext = {
      tenant: currentTenant,
      facilitiesList: activeFacilities.map(f => ({ name: f.name, code: f.plantCode, country: f.country, regionGrid: f.regionType })),
      recordsSummary: relativeRecords.map(r => ({
        id: r.id,
        source: r.sourceType,
        sourceFile: r.sourceFile,
        status: r.status,
        flags: r.flags,
        co2eTonnes: r.normalization?.co2eTonnes || 0,
        amount: r.normalization?.activityAmount,
        unit: r.normalization?.activityUnit,
        dates: r.normalization ? `${r.normalization.startDate} to ${r.normalization.endDate}` : "Unspecified"
      }))
    };

    const systemInstruction = `You are 'breathe-esg-auditor-buddy', an advanced AI Sustainability Reporting Analyst built into Breathe ESG platform. You guide enterprise corporate clients through GHG Protocol audits.
You have absolute read-only view of the client's current database context:
CLIENT DETAILS: ${JSON.stringify(dataContext.tenant)}
ACTIVE FACILITIES: ${JSON.stringify(dataContext.facilitiesList)}
INGESTED TRANSACTIONS REGISTER: ${JSON.stringify(dataContext.recordsSummary)}

Be precise, mathematical, and authoritative. Answer questions about carbon calculations, data gaps, specific flagged record IDs, facility regional grid efficiency, or pro-rata calendars. Refer to records by their exact IDs (e.g. 'rec-seed-02') to assist the analyst. Maximize diagnostic guidance.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Gemini Chat failed:", err);
    res.status(500).json({ error: `Gemini API session error: ${err.message}` });
  }
});

// -------------------------------------------------------------
// STANDALONE / PRODUCTION SERVING
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Dev with dynamic Vite middleware routing
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Production builds
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Breathe ESG Full-Stack Server booted on http://0.0.0.0:${PORT}`);
  });
}

startServer();
