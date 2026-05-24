import React, { useState } from "react";
import { 
  Flame, 
  Zap, 
  Plane, 
  Check, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  FolderOpen
} from "lucide-react";

interface IngestionCenterProps {
  tenantId: string;
  onRefreshStats: () => void;
}

export default function IngestionCenter({ tenantId, onRefreshStats }: IngestionCenterProps) {
  const [activeTab, setActiveTab] = useState<'sap' | 'utility' | 'travel'>('sap');
  const [inputText, setInputText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  
  // Statuses States
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processResult, setProcessResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  // REALISTIC ENTERPRISE SCENARIO SEED TEMPLATES
  const sapTemplate = `MANDT,BUKRS,WERKS,MATNR,MENGE,MEINS,BUDAT,DMBTR,WAERS,BELNR
100,DE_CORP,DE_1100,MAT_STATIONARY_DIESEL,45000,L,12.05.2026,62000,EUR,1800094200
100,US_CORP,US_9900,MAT_HEAVY_FUEL_OIL_6,11000,GAL,18.05.2026,58000,USD,1800094201
100,US_CORP,US_2200,MAT_FLEET_PETROL,-350,GAL,22.05.2026,-1050,USD,1900021105
100,DE_CORP,DE_1100,MAT_FLEET_PETROL,185000,L,24.05.2026,242000,EUR,1800094205`;

  const utilityTemplate = `Account Number,Meter Number,Start Date,End Date,Start Read,End Read,Multiplier,Consumption (kWh),Amount,Tariff Code
EON-329104-DE,EON-MET-110,2026-04-18,2026-05-17,27000.0,38500.0,1.0,11500.0,3200.00,Industrial-Flat
MET-981-HQ,MET-99201-HQ,2026-04-20,2026-05-19,14983.0,15033.0,80.0,4000.0,520.80,E-19_TOU
EON-329104-DE,EON-MET-112,2026-05-01,2026-05-31,150.0,220.0,120.0,70.0,1400.00,Industrial-High`;

  const travelTemplate = `[
  {
    "Record ID": "TRV-3101",
    "Traveler Name": "राहुल (Auditor-Lead)",
    "Travel Date": "2026-05-18",
    "Segments": "SFO-LHR-FRA",
    "Cabin Class": "Business",
    "Transport Mode": "Flight - Long Haul",
    "Cost": 5200.00,
    "Currency": "USD"
  },
  {
    "Record ID": "TRV-3102",
    "Traveler Name": "Shivang (Lead SME)",
    "Travel Date": "2026-05-20",
    "Segments": "CDG-MUC",
    "Cabin Class": "Economy",
    "Transport Mode": "Flight - Short Haul",
    "Cost": 320.00,
    "Currency": "EUR"
  },
  {
    "Record ID": "TRV-3103",
    "Traveler Name": "Rahul (PM)",
    "Travel Date": "2026-05-22",
    "Segments": "JFK-XYZ",
    "Cabin Class": "First",
    "Transport Mode": "Flight - Long Haul",
    "Cost": 8900.00,
    "Currency": "USD"
  }
]`;

  const loadScenarioTemplate = (type: 'sap' | 'utility' | 'travel') => {
    if (type === 'sap') {
      setInputText(sapTemplate);
      setFileName("SAP_Export_FI_CO_Q3_DRAFT.csv");
    } else if (type === 'utility') {
      setInputText(utilityTemplate);
      setFileName("Facility_PGE_EON_Portal_May_Boundary.csv");
    } else if (type === 'travel') {
      setInputText(travelTemplate);
      setFileName("Navan_Platform_Travel_Itineraries.json");
    }
    setProcessResult(null);
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setProcessResult(null);

    const formatType = activeTab === "travel" ? "json" : "csv";

    try {
      const response = await fetch("/api/records/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          sourceType: activeTab,
          formatType,
          rawText: inputText,
          fileName: fileName || undefined
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setProcessResult({ success: true, count: data.count });
        setInputText("");
        setFileName("");
        onRefreshStats(); // Trigger refresh on active dashboards
      } else {
        setProcessResult({ success: false, error: data.error || "Unhandled ingestion integrity exception" });
      }
    } catch (err: any) {
      setProcessResult({ success: false, error: `Connectivity exception: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      
      {/* Upload Form Panels (2 Cols) */}
      <div className="md:col-span-2 bg-white rounded-lg p-4 border border-slate-200 shadow-2xs space-y-4">
        
        {/* Source Categories Selector Tabs */}
        <div className="border-b border-slate-100 flex items-center justify-between pb-2.5">
          <div className="flex items-center gap-1 bg-slate-100 rounded p-0.5 text-xs">
            <button
              onClick={() => { setActiveTab('sap'); setProcessResult(null); setInputText(""); }}
              className={`flex items-center gap-1 px-3 py-1 rounded font-bold transition cursor-pointer text-xs ${activeTab === 'sap' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              type="button"
            >
              <Flame className="w-3.5 h-3.5 text-rose-500" /> SAP Fuels (CSV)
            </button>
            <button
              onClick={() => { setActiveTab('utility'); setProcessResult(null); setInputText(""); }}
              className={`flex items-center gap-1 px-3 py-1 rounded font-bold transition cursor-pointer text-xs ${activeTab === 'utility' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              type="button"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Utility Electric (CSV)
            </button>
            <button
              onClick={() => { setActiveTab('travel'); setProcessResult(null); setInputText(""); }}
              className={`flex items-center gap-1 px-3 py-1 rounded font-bold transition cursor-pointer text-xs ${activeTab === 'travel' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              type="button"
            >
              <Plane className="w-3.5 h-3.5 text-emerald-500" /> Corp Travel (JSON)
            </button>
          </div>
          
          <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
            Automated Inbound Stream
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleIngestSubmit} className="space-y-3.5 text-xs">
          
          <div className="space-y-1">
            <label className="font-bold text-slate-705 flex items-center justify-between">
              <span>Source File Reference (Optional)</span>
              <span className="text-[9px] font-mono text-slate-400">Records provenance tracking</span>
            </label>
            <input
              type="text"
              placeholder={`e.g. ${activeTab === "travel" ? "Concur_Travel_Export_Q3.json" : "SAP_Document_Ledger_G4.csv"}`}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-205 p-1.5 text-slate-800 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-950 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-705 block">
              Paste Telemetry Payload Record ({activeTab === "travel" ? "Prettified JSON array format" : "Standard CSV spreadsheet format"})
            </label>
            <textarea
              placeholder={
                activeTab === "sap" ? "MANDT,BUKRS,WERKS,MATNR,MENGE,MEINS,BUDAT...\n100,DE_CORP,DE_1100,MAT_STATIONARY_DIESEL,12000,L..." :
                activeTab === "utility" ? "Account Number,Meter Number,Start Date,End Date,Consumption (kWh)...\n982231,MET-99201-HQ,2026-04-15,2026-05-14,31280.0..." :
                "[\n  {\n    \"Record ID\": \"TRV-3101\",\n    \"Traveler Name\": \"Saurav\",\n    \"Segments\": \"SFO-LHR\"...\n  }\n]"
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-44 bg-[#0f172a] text-slate-200 border border-slate-850 p-2.5 rounded font-mono text-[10px] leading-relaxed select-text"
              required
            />
          </div>

          {/* Action trigger bar */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setInputText("")}
              className="text-slate-450 hover:text-slate-800 font-semibold px-2 py-1 hover:bg-slate-50 rounded"
            >
              Reset Buffer
            </button>
            
            <button
              type="submit"
              disabled={isProcessing || !inputText.trim()}
              className="bg-slate-900 cursor-pointer text-white font-bold p-1.5 px-4 rounded text-xs hover:bg-slate-800 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} /> 
              <span>{isProcessing ? "Reconciling payload..." : "Run Normalization Engine"}</span>
            </button>
          </div>

        </form>

        {/* Success/Error Results Panels */}
        {processResult && (
          <div className={`p-3 rounded border flex items-start gap-2.5 text-xs ${
            processResult.success 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-3xs" 
              : "bg-rose-50 text-rose-800 border-rose-200 shadow-3xs"
          }`}>
            {processResult.success ? (
              <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold">{processResult.success ? "Ingestion calculations complete" : "Ledger Ingestion Intercept Failure"}</h4>
              <p className="mt-0.5 leading-normal text-[11px]">
                {processResult.success 
                  ? `Ingested and dynamically normalized ${processResult.count} corporate transaction rows matching Breathe ESG GHG Protocol calculations.`
                  : processResult.error
                }
              </p>
              {processResult.success && (
                <div className="mt-2 font-medium flex items-center gap-1 text-[10px] font-mono text-emerald-990 font-bold select-none">
                  <span>Audit indicators recomputed live</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Realistic seed templates helpers panel (1 Col) */}
      <div className="bg-[#0f172a] text-white rounded-lg p-4 border border-slate-800 flex flex-col justify-between shadow-2xs">
        <div className="space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="p-1 bgColor bg-indigo-950 border border-indigo-900 rounded text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h4 className="font-bold text-xs">Ingestion Sandbox Scenarios</h4>
          </div>
          
          <p className="text-[11px] text-slate-400 leading-normal">
            Toggle high real-world variability scenarios. Simulate typical client errors (formatting issues, unlinked operations) to assess compliance engine reactions:
          </p>
          
          <div className="space-y-2 pt-2">
            
            {/* SAP scenario seed */}
            <button
              onClick={() => loadScenarioTemplate('sap')}
              className="w-full text-left p-2.5 rounded bg-slate-900/60 hover:bg-slate-900 transition border border-slate-800 hover:border-rose-900/30 flex items-start gap-2.5 cursor-pointer group select-none"
            >
              <div className="p-1 bg-rose-950/40 border border-rose-910 text-rose-450 rounded shrink-0 mt-0.5">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <span className="block font-bold text-slate-200 text-xs tracking-tight group-hover:underline">1. SAP Direct Fuel Dump</span>
                <span className="block text-[10px] text-slate-400 leading-normal">
                  Presents German CSV indexes with fuelStationARY reversing transactions.
                </span>
              </div>
            </button>

            {/* PGE utility billing loop */}
            <button
              onClick={() => loadScenarioTemplate('utility')}
              className="w-full text-left p-2.5 rounded bg-slate-900/60 hover:bg-slate-900 transition border border-slate-800 hover:border-amber-900/30 flex items-start gap-2.5 cursor-pointer group select-none"
            >
              <div className="p-1 bg-amber-950/40 border border-amber-910 text-amber-455 rounded shrink-0 mt-0.5">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <span className="block font-bold text-slate-200 text-xs tracking-tight group-hover:underline">2. Utility Billing Portals</span>
                <span className="block text-[10px] text-slate-400 leading-normal">
                  Presents billing crossing boundaries with missed multiplier indices.
                </span>
              </div>
            </button>

            {/* Travel API Concur coordinates loop */}
            <button
              onClick={() => loadScenarioTemplate('travel')}
              className="w-full text-left p-2.5 rounded bg-slate-900/60 hover:bg-slate-900 transition border border-slate-800 hover:border-emerald-900/30 flex items-start gap-2.5 cursor-pointer group select-none"
            >
              <div className="p-1 bg-emerald-950/40 border border-emerald-910 text-emerald-455 rounded shrink-0 mt-0.5">
                <Plane className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <span className="block font-bold text-slate-200 text-xs tracking-tight group-hover:underline">3. Concur Travel API Leg</span>
                <span className="block text-[10px] text-slate-400 leading-normal">
                  Presents aviation segments to verify altitude greenhouse metrics.
                </span>
              </div>
            </button>

          </div>
        </div>

        <div className="border-t border-slate-800 pt-3 mt-4 flex items-center gap-1.5 text-[9px] text-slate-500 font-mono select-none">
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Real-world client APIs mapped automatically</span>
        </div>
      </div>

    </div>
  );
}
