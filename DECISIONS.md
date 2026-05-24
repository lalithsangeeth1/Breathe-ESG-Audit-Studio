# Breathe ESG — Engineering Decisions (`DECISIONS.md`)

This log describes the enterprise ambiguities resolved during prototype construction, the real-world formatting choices chosen for ingestion, and a constructive list of product queries prepared for the Breathe ESG Product Manager.

---

## 1. Scope and Source Subsets Decided

To move from "toy mockups" to an authentic, high-fidelity system, we chose to implement precise ingestion realities for three complex source profiles:

### A. Business Source 1: SAP Fuel and Procurement Exports
* **Selected Subset**: Flat CSV file representing a typical transaction register from an SAP `OData` service (`Z_EMISS_FUEL`) or a `BAPI` transaction stream export.
* **Handled Reality**:
  * **German Headers vs English Layouts**: Mixed column names from classic SAP fields: `MANDT` (Client), `WERKS` (Plant/Facility Code), `BUDAT` (Posting Date in German format `DD.MM.YYYY`), `MENGE` (Fuel Quantity), `MEINS` (Purchase Unit), `MATNR` (Material ID, e.g. Diesel or Heavy Fuel Oil No. 6), and `DMBTR` (Local Currency Value).
  * **Unit Dynamic Multipliers**: Raw values in unpredictable dimensions: `L` (Liters), `LIT` (Liters), `GL` / `GAL` (US Gallons), and `TO` (Metric Tonnes).
  * **Ignore Boundaries**: Financial transactions containing negative quantities that represent purely accounting reversals or ledger adjusting values with no physical carbon equivalent.

### B. Business Source 2: Utility electricity portals
* **Selected Subset**: Clean PG&E/E.ON portal CSV extract mimicking facility portal scrapes.
* **Handled Reality**:
  * **Non-Calendar Billing Frequencies**: Meter read billing windows that start mid-month (e.g., `18-April` to `17-May`). E-Grid emission factors require month-by-month allocations. We designed a **Pro-Rata Calendar Splitting Algorithm** that calculates exact daily weights to allocate consumption cleanly to accounting months!
  * **Telemetry Multipliers**: Standard billing meters record values on small integers with a separate `Multiplier` field (e.g. `40.0`, `120.0`) which, if ignored, underestimates electricity grid consumption by 98%. We compute: `Actual kWh = (End Read - Start Read) * Multiplier`.

### C. Business Source 3: Corporate Travel (Concur/Navan dumps)
* **Selected Subset**: JSON/CSV extraction from corporate systems.
* **Handled Reality**:
  * **Missing Physical Distance Gaps**: Concur exports typically lack distance metrics (miles/km), exposing only traveler identities and Airport IATA Codes (e.g., `SFO-LHR`). We embedded a **geodesic great-circle math lookup database** in our code containing coordinates for major global aviation portals (e.g. JFK, SFO, ORD, LHR, FRA, MUC, CDG, SIN, HND) to compute physical passenger-kilometers (`pkm`) accurately!
  * **Cabin Class Emissions Weighting**: Business and First Class seats take up multi-fold physical aircraft footprint compared to Economy. Standard factors apply a 2.5x to 4x multiplier to account for aviation warming factors. Our model handles this distinction cleanly.

---

## 2. Product and Domain Ambiguities Resolved

* **What constitutes a "suspicious" record?** We set high-pass and low-pass anomaly limits. For example, a diesel consumption record exceeding 50,000 Liters in a single posting or a corporate travel record with flight lengths exceeding 20,000 km are flagged automatically for validation review.
* **How are duplicates handled?** If a SAP record shares `ID` with an existing transaction, we flag it as an active warning `[Potential Duplicate Transaction Code]`, rather than failing the upload. This allows auditors to approve or override potential legitimate dual-postings.
* **What if a plant is unmapped?** In SAP, plant code references like `WERKS: 1100` are simple strings. If standard lookups do not map `1100` to an active factory, the row is ingested, marked as `Flagged` with `Unresolved SAP Plant Code Mapping`, and the UI allows the analyst to manually select a facility to assign it to before approval.

---

## 3. Product Manager Backlog (Queries for PM)

If we were to collaborate with you on Day 5, we would present the following questions:

1. **How should we handle retroactive adjustments?** If an auditor rejects an approved record *after* the client-wide greenhouse inventory is locked for a year, do we support nested audit revisions, or does a correction create adjusting journal offsets in the current calendar year?
2. **What level of tenant autonomy is required?** Will client companies upload their own data via self-service portals with customized mapping tables, or do our in-house analysts execute all mappings and reviews on behalf of clients?
3. **What is our standard database for Emission Factors?** Do we utilize a standard library (e.g., UK Government GHG Conversion Factors, US EPA eGRID) or does the platform need to support completely custom emission factors per tenant based on local grid offsets (PPA, RECs)?
