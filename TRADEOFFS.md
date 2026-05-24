# Breathe ESG — Engineering Trade-offs (`TRADEOFFS.md`)

To build a high-fidelity, high-integrity platform in a short period without committing sloppy code or introducing feature creep, we made deliberate compromises. This document chronicles three features we intentionally chose not to build, and our architectural defense of those choices.

---

## 1. Automated PDF Invoice Parsing (Optical Character Recognition)
* **What we had to decide**: Facilities teams frequently obtain utility readings as PDF documents, and a common "AI solution" is to run OCR on bills with regular expressions.
* **Why we did not build it**: Commercial-grade PDF parsing for utilities is incredibly fragile. Billing layouts change across municipal regions, causing OCR regex models to silently misread integers, drop decimal places, or miss critical meter multipliers.
* **The Trade-off**: We optimized specifically for PG&E/E.ON portal CSV flat-file downloads. These are universally available to facilities managers via their utility portals, provide robust digital structures with zero parsing drift, and guarantee high data accuracy.

---

## 2. Direct SAP R/3 / S4HANA RFC Gateway Integrations
* **What we had to decide**: Linking live to SAP so transactions flow to Breathe ESG automatically.
* **Why we did not build it**: Building enterprise-tier SAP gateways requires months of networking approvals, OAuth 2.0 Client credentials setup, proprietary SAP BAPI adapter certificates, and extensive firewall routing.
* **The Trade-off**: We designed a robust, clean SAP CSV export uploader and direct manual text paste engine. In real enterprise environments, 90% of sustainability onboarding starts with transactional exports extracted by client database administrators, allowing SAP audits to operate on stable, verifiable batches.

---

## 3. Dynamic Real-Time Currency Exchange Market Pipelines
* **What we had to decide**: Converting procurement currencies ($ vs € vs ¥) dynamically to reconcile carbon-per-dollar ratios.
* **Why we did not build it**: Adding continuous web integrations for currency indexes introduces external network dependencies and latency. More importantly, financial exchange rate fluctuations do not represent changes in physical carbon boundaries.
* **The Trade-off**: We categorized physical activity amounts (Liters, Tonnes, Kilowatt-hours) as our supreme source of computational truth. Currency indicators are cached side-by-side with records for financial auditing context, but carbon equivalents use the physical transaction mass directly.
