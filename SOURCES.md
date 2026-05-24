# Breathe ESG — Data Sources (`SOURCES.md`)

This register details the research behind each of our three primary corporate activity telemetry profiles, their structured syntax, and real-world failure patterns.

---

## Source 1: SAP Fuel and Procurement Exports

### 1. Real-World Formats Researched
* **Format**: SAP OData services (`Z_FI_CO_FUEL`) or a physical `SE16`/`SE16N` data dictionary export from table `BSEG` (Accounting Document Segment) or `COEP` (CO Object: Period-Based Line Items).
* **Syntax details learned**:
  * Fields in SAP remain highly conservative, utilizing classic German database column conventions (e.g. `MANDT` = Client, `BUKRS` = Company Code, `WERKS` = Plant, `MENGE` = Quantity, `MEINS` = Unit of Measure, `BUDAT` = Posting Date, `DMBTR` = Local Currency Amount).
  * Measurement units are frequently stored in SAP-specific ISO abbreviations or proprietary strings (e.g., Liters can be `L`, `LIT`, or `LE`; US Gallon can be `GL` or `GAL`; Tonne can be `TO`, `TN`, or `TOST`).

### 2. Sample Data Shape
Our uploader handles exports with headers containing:
```csv
MANDT,BUKRS,WERKS,MATNR,MENGE,MEINS,BUDAT,DMBTR,WAERS,BELNR
100,US_CORP,US_2200,MAT_STATIONARY_DIESEL,12500,GAL,15.04.2026,38900,USD,1800049221
100,EU_SUBS,DE_1100,MAT_FLEET_PETROL,3800,L,22.05.2026,6200,EUR,1800049222
```

### 3. Production Risks & Breaks
* **Missing Units Mapping**: If an administrator registers a custom raw unit shorthand in an SAP branch office (e.g. `KGL` for Kilogallon) representing customized liquid measures, the ingestion engine will fail to compute physical mass and generate an calculation exception flag.
* **Negative Quantities**: SAP utilizes negative `MENGE` fields to indicate accounting cancellations or ledger reversals. If processed raw, this subtracts carbon from a company's legal greenhouse ledger, which auditors will reject.

---

## Source 2: Utility Electricity Portals

### 1. Real-World Formats Researched
* **Format**: CSV portal exports and Green Button XML standard common among power operators (PG&E, ConEd, E.ON, National Grid).
* **Syntax details learned**:
  * High-density billing cycles are rarely clean calendar windows. Meter readings track physical periods (e.g., `18-April-2026` to `17-May-2026`) that overlap accounting limits.
  * Electricity bills utilize standard *Meter Multipliers* (usually designated as `Multiplier` or `Rate Code`). In high-voltage heavy factories, physical gears tick on a small scale, and the company multiplies the reading by `40`, `80`, or `120`.

### 2. Sample Data Shape
Our uploader processes CSV billing extracts with headers containing:
```csv
Account Number,Meter Number,Start Date,End Date,Start Read,End Read,Multiplier,Consumption (kWh),Amount,Tariff Code
982231-188,MET-99201-A,2026-04-15,2026-05-14,14201.0,14983.0,40.0,31280.0,4521.80,E-19_TOU
```

### 3. Production Risks & Breaks
* **Uncoordinated Month Splits**: If billing cycles cross year-boundaries (e.g., Dec 15 to Jan 14) and no pro-rata allocation is applied, the prior-year scope calculation will be incorrect by 50%, causing compliance and reporting restatements.
* **Estimated Bills**: Utilities often record "Estimated Reads" (marked as `E` vs `A` for Actual). A real production engine must tag those readings as estimated and replace them with actual values when the year-end reconciliation is computed.

---

## Source 3: Corporate Travel (Concur/Navan Platforms)

### 1. Real-World Formats Researched
* **Format**: Concur Travel Intelligence Extract (CSV/JSON API dump).
* **Syntax details learned**:
  * Real corporate travel feeds lack physical travel distance. Instead, exports yield Airport IATA route legs (e.g., `MUC-LHR` or `SFO-LHR-DXB`).
  * Distances are rarely supplied because platforms delegate the details to travel agents. To parse these, an engine must convert Airport codes to latitude & longitude and apply the **Haversine Geodetic Equation**.
  * Class categories are critical. Standard factors apply distinct modifiers for Economy, Business, and First Class to account for physical seating space and thermal offsets.

### 2. Sample Data Shape
Our JSON/CSV uploader expects corporate travel tracks with structure:
```json
[
  {
    "Record ID": "TRV-1192",
    "Traveler Name": "Saurav (Auditor)",
    "Travel Date": "2026-05-18",
    "Segments": "SFO-JFK",
    "Cabin Class": "Business",
    "Transport Mode": "Flight - Short Haul",
    "Cost": 1250.00,
    "Currency": "USD"
  }
]
```

### 3. Production Risks & Breaks
* **Multi-stop Connected Routes**: If traveler books complex flight sequences (e.g. `SFO-JFK-LHR-SIN` with layovers), treating it as a single distance vector (`SFO` straight to `SIN`) will yield short-circle errors underestimating fuel consumption by thousands of kilometers.
* **New and Remote IATA Codes**: Small general aviation airstrips or new private airports lack public coordinates. Calculating geodesic routes on empty coordinates triggers calculation failures unless a fallback standard mileage factor is established.
