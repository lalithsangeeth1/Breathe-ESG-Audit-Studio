# Breathe ESG — Data Model (`MODEL.md`)

This document defines the core data structures and relational schemas implemented in the Breathe ESG Audit Studio. To satisfy enterprise-grade audit requirements, the model supports **strict multi-tenancy**, **Scope 1/2/3 mapping**, **immutability of raw ingestion**, and a **detailed ledger of changes (Audit Trail)**.

---

## 1. Schema Architecture

```
                       +-------------------+
                       |      Tenant       |
                       +-------------------+
                                 | (1)
                                 |
                                 v (0..*)
                       +-------------------+
                       |     Facility      | (e.g., Plant Munich, Chicago HQ)
                       +-------------------+
                                 | (1)
                                 |
                                 v (0..*)
                       +--------------------------+
                       |      IngestedRecord      | (Raw Ingested Data + Metadata)
                       +--------------------------+
                        | (1)                  | (1)
                        |                      |
                        v (0..*)               v (1)
               +------------------+   +-------------------+
               |     AuditLog     |   |   Normalization   | (Normalized emission equivalent)
               +------------------+   +-------------------+
```

---

## 2. Model Specifications

### A. Tenant (Client Company)
Each client company is isolated at the database layer to guarantee rigorous data sovereignty. Analysts belong to a tenant or manage multiple tenants down-stream.
```typescript
interface Tenant {
  id: string;          // Unique UUID (e.g., "tenant-heavy-ind-01")
  name: string;        // Client's Legal Name (e.g., "Breathe Heavy Industries")
  industry: string;    // Industry Sector (e.g., "Manufacturing")
  country: string;     // Primary Region
  createdAt: string;   // Timestamp
}
```

### B. Facility (Site / Plant)
Enterprise clients have physical infrastructure that produces activities. In SAP, these are mapped as `WERKS` (Plant Codes) or location markers. 
```typescript
interface Facility {
  id: string;          // Unique UUID
  tenantId: string;    // Foreign key to Tenant
  plantCode: string;   // SAP plant code lookup match (e.g., "DE_1100", "US_2200")
  name: string;        // Human readable site name (e.g., "Munich Casting Foundry")
  regionType: string;  // E.g., "EU-Grid", "US-MRO-West" (used for electricity grid multipliers)
  country: string;     // Country code (e.g., "DE", "US")
}
```

### C. IngestedRecord
The central transactional node. To maintain standard compliance (such as **GHG Protocol** and **ISO 14064-3**), we separate the **raw payload** from the **calculated normalizations** to prevent modification of original client telemetry.
```typescript
interface IngestedRecord {
  id: string;               // Unique transaction ID (UUID)
  tenantId: string;         // Foreign key to Tenant
  facilityId: string | null;// Foreign key to Facility (null represents unmapped plant code)
  plantCodeRaw: string;     // Original raw plant string (e.g., "WERKS: 1100" or empty)
  sourceType: 'sap' | 'utility' | 'travel';
  sourceFile: string;       // Original source identifier (e.g., "File: SAP_Fuel_Q4_v2.csv")
  rawPayload: Record<string, any>; // EXTREMELY CRITICAL: Raw untouched JSON block (e.g. BAPI export, Concur JSON)
  
  // Status and Validation Indicators
  status: 'pending' | 'approved' | 'flagged' | 'rejected';
  flags: string[];          // List of automated validation highlights
  
  // Normalization Core (computed dynamically, cached here upon review)
  normalization: NormalizationData | null;
  
  // Timestamps
  receivedAt: string;       // Ingested date
  updatedAt: string;       // Last processed date
}
```

### D. NormalizationData
Stores computed properties representing the physical-to-carbon translation.
```typescript
interface NormalizationData {
  activityAmount: number;         // Normalization coefficient (e.g. 15000)
  activityUnit: string;           // Normalized unit (e.g. "Liters", "kWh", "pkm")
  scope: 'Scope 1' | 'Scope 2' | 'Scope 3';
  ghgCategory: string;            // Official GHG category (e.g., "1. Stationary Combustion", "3. Business Travel")
  emissionFactor: number;         // Multiplier code: kg CO2e per unit (e.g., 2.684 for Diesel)
  co2eTonnes: number;             // Metric tons of CO2e (computed as Amount * EF / 1000)
  startDate: string;              // ISO format (YYYY-MM-DD)
  endDate: string;                // ISO format (YYYY-MM-DD)
}
```

### E. AuditLog (Ledger)
Every interaction with an `IngestedRecord` triggers a permanent log entry to provide legal-grade audit proofs. This block is strictly appended and irreversible.
```typescript
interface AuditLog {
  id: string;               // Unique UUID
  recordId: string;         // Referenced record
  timestamp: string;        // ISO timestamp
  actor: string;            // Username / Analyst name (e.g., "Rahul (Lead Analyst)")
  action: 'ingested' | 'modified' | 'approved' | 'rejected' | 'flagged';
  notes: string;            // Why the change occurred (e.g., "Manually mapped WERKS 1100 to Munich Foundry")
  diff: {                   // Tracks exact JSON property delta
    before: Record<string, any>;
    after: Record<string, any>;
  } | null;
}
```

---

## 3. Scope Categorization Rules

Our engine normalizes operations into the three core scopes of the **GHG Protocol**:

1. **Scope 1 (Direct Emissions)**: SAP-ingested fuel consumption (e.g. Stationary Diesel, Fleet Petrol, Procurement of heavy chemicals).
2. **Scope 2 (Indirect Grid Emissions)**: Utility electricity (e.g. Grid-generated energy consumed at Munich or Chicago factories).
3. **Scope 3 (Other Indirect Value Chain)**: Corporate travel platform itineraries (e.g., Scope 3 Category 6: Business Travel. Differentiated by aviation shorthaul, business-class longhaul, or hotel night stays).

---

## 4. Source-of-Truth Integrity Assurance

To satisfy financial and legal ESG audits:
- **Zero Raw Mutations**: Field corrections by analysts DO NOT mutate the `rawPayload` property, ensuring that inspectors can cross-reference the original SAP flat file or PGE portal data with the approved calculations.
- **Traceable Mapping Indexes**: Any mapping logic utilizes a formal static database structure containing emission factor records backed by official references (EPA, UK DEFRA, or IEA).
