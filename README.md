# Breathe ESG — Audit Studio

> **Scope 1, 2, and 3 Verification & Compliance Engine**

Breathe ESG Audit Studio is an enterprise-grade sandboxed compliance workspace designed under the guidance of **ISO 14064-3** and the **Greenhouse Gas (GHG) Protocol** Corporate Standard. It serves as a unified system to ingest, normalize, analyze, and certify carbon emissions across direct fuels, imported electricity, and complex corporate transport metrics.

---

### 🌐 Live Application Link
Access the live deployed evaluation production environment here:
👉 **[Breathe ESG Audit Studio Deployed Application](https://breathe-esg-audit-studio-1077138247781.asia-southeast1.run.app)**

---

## 🚀 Core Features & Capabilities

### 1. Multi-Tenant Enterprise Workspaces
- Dynamically navigate across multiple enterprise client profiles (e.g., *Saurav Metals*, *Shivang Techcorp*, *Rahul Automotives*).
- Isolate associated facility assets, geographical territory data, and transaction files per tenant workspace.

### 2. High-Density Compliance Dashboards
- Display real-time aggregate carbon footprints calculated in Metric Tonnes of $\text{CO}_2\text{e}$ ($\text{tCO}_2\text{e}$).
- Breakdown carbon accounting instantly across:
  - **Scope 1 (Direct Fuels):** Stationary combustion and mobile logical fleet calculations.
  - **Scope 2 (Purchased Power):** Indirect electricity imported across facility meters.
  - **Scope 3 (Corporate Activity):** Employee business travel and transportation.
- Visual high-density bento grids outlining active facility emissions spreads and chronological reporting timeline trends.

### 3. Comprehensive Operational Registers (Auditing Grid)
- Interactive, multi-filtered ledger rows detailing transactional proof items.
- Full inspection modal for each record displaying:
  - **Normalization Indicators:** Active greenhouse gas classifications, emission factor multipliers, and calculated output aggregates.
  - **Original Telemetry Sandbox:** Full un-manipulated raw JSON telemetry records showing incoming payload layers.
  - **Immutable Audit Trails:** Historical chronology capturing auditor manual parameter adjustments, facility re-allocations, status changes, and differences (deltas).

### 4. Inbound Streams Ingest Center
- Dynamically upload or simulate real-world client data streams in bulk.
- Toggle realistic out-of-the-box sandbox scenarios:
  - **SAP Fuel Exports (CSV):** Stationary and fleet diesel oil reverses.
  - **Utility Portal Scrapes (CSV):** Electricity metrics and facility PGE meters.
  - **Concur Travel Legs (JSON):** Aviation coordinates used to verify geodesic travel elevations.

### 5. AI Copilot Auditor Dialogue (Gemini Integration)
- Select any ledger record and trigger Gemini to explain rule violations, flag inconsistencies, and draft supplier correspondence.
- Dynamic interactive chat drawer connected to active workspace parameters to help auditors analyze anomalies and verify regional coefficients.

---

## 🛠️ Technology Stack
- **Frontend Framework:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS (fully responsive, custom slate theme)
- **Icons:** Lucide React
- **Backend API Server:** Express with ts-node/tsx compiling to standalone production CommonJS formats
- **AI Orchestration:** Google GenAI SDK powered by Gemini
