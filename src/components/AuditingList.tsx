import React, { useState, useEffect } from "react";
import { IngestedRecord, Facility } from "../types";
import { 
  Flame, 
  Zap, 
  Plane, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XOctagon, 
  Search, 
  SlidersHorizontal,
  ChevronRight,
  Database,
  FileText,
  History,
  Sparkles,
  RefreshCw,
  X
} from "lucide-react";

interface AuditingListProps {
  records: IngestedRecord[];
  facilities: Facility[];
  selectedStatusFilter: string;
  onSelectStatusFilter: (status: string) => void;
  onUpdateRecord: (id: string, updatePayload: { facilityId?: string; payloadOverride?: Record<string, any>; notes?: string }) => Promise<void>;
  onActionRecord: (id: string, action: 'approved' | 'rejected' | 'flagged', notes: string) => Promise<void>;
}

export default function AuditingList({
  records,
  facilities,
  selectedStatusFilter,
  onSelectStatusFilter,
  onUpdateRecord,
  onActionRecord
}: AuditingListProps) {
  // Navigation states
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [selectedRecord, setSelectedRecord] = useState<IngestedRecord | null>(null);
  
  // Modal auxiliary details states
  const [activeTab, setActiveTab] = useState<'details' | 'raw' | 'history'>('details');
  const [actionNote, setActionNote] = useState<string>("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState<boolean>(false);
  
  // Override Form states
  const [selectedFacId, setSelectedFacId] = useState<string>("");
  const [overrideFuelQty, setOverrideFuelQty] = useState<string>("");
  const [overrideUtilityQty, setOverrideUtilityQty] = useState<string>("");
  const [overrideCabinClass, setOverrideCabinClass] = useState<string>("");
  const [overrideTravelSegments, setOverrideTravelSegments] = useState<string>("");
  const [isSavingOverride, setIsSavingOverride] = useState<boolean>(false);

  // Gemini states
  const [geminiExplanation, setGeminiExplanation] = useState<string>("");
  const [isGeneratingGemini, setIsGeneratingGemini] = useState<boolean>(false);

  // Fetch audits when selectedRecord changes
  useEffect(() => {
    if (selectedRecord) {
      setIsLoadingAudits(true);
      fetch(`/api/records/${selectedRecord.id}/audit`)
        .then(res => res.json())
        .then(data => {
          setAuditLogs(data);
          setIsLoadingAudits(false);
        })
        .catch(err => {
          console.error("Audits trace failed:", err);
          setIsLoadingAudits(false);
        });

      // Reset overrides inputs mapping
      setSelectedFacId(selectedRecord.facilityId || "");
      setOverrideFuelQty(String(selectedRecord.rawPayload.MENGE || ""));
      setOverrideUtilityQty(String(selectedRecord.rawPayload["Consumption (kWh)"] || ""));
      setOverrideCabinClass(String(selectedRecord.rawPayload["Cabin Class"] || "Economy"));
      setOverrideTravelSegments(String(selectedRecord.rawPayload["Segments"] || ""));
      
      setGeminiExplanation("");
      setActionNote("");
      setActiveTab('details');
    }
  }, [selectedRecord]);

  // Synchronize modal state if record changes externally
  useEffect(() => {
    if (selectedRecord) {
      const updated = records.find(r => r.id === selectedRecord.id);
      if (updated) {
        setSelectedRecord(updated);
      }
    }
  }, [records]);

  // Handle manual parameters modification saves
  const handleSaveOverrides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setIsSavingOverride(true);

    const payloadOverride: Record<string, any> = {};
    if (selectedRecord.sourceType === "sap") {
      payloadOverride.MENGE = overrideFuelQty;
    } else if (selectedRecord.sourceType === "utility") {
      payloadOverride["Consumption (kWh)"] = overrideUtilityQty;
    } else if (selectedRecord.sourceType === "travel") {
      payloadOverride["Cabin Class"] = overrideCabinClass;
      payloadOverride["Segments"] = overrideTravelSegments;
    }

    const note = `Auditor manual overrides: Facility changed: ${selectedFacId !== selectedRecord.facilityId}. Overrides parameters: ${JSON.stringify(payloadOverride)}`;

    await onUpdateRecord(selectedRecord.id, {
      facilityId: selectedFacId || undefined,
      payloadOverride,
      notes: note
    });

    setIsSavingOverride(false);
  };

  // Action clicks triggers
  const executeWorkflowAction = async (action: 'approved' | 'rejected' | 'flagged') => {
    if (!selectedRecord) return;
    const notes = actionNote || `Reconciled ledger row. Re-evaluated as ${action} under corporate audit criteria.`;
    await onActionRecord(selectedRecord.id, action, notes);
    setActionNote("");
  };

  // Run Gemini API Explainer
  const runGeminiExplainer = async () => {
    if (!selectedRecord) return;
    setIsGeneratingGemini(true);
    setGeminiExplanation("");

    try {
      const response = await fetch("/api/gemini/explain-flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: selectedRecord.id })
      });
      const data = await response.json();
      if (data.explanation) {
        setGeminiExplanation(data.explanation);
      } else {
        setGeminiExplanation("Failed to obtain AI response context. Please check secrets.");
      }
    } catch (err: any) {
      setGeminiExplanation(`API Session Exception: ${err.message}`);
    } finally {
      setIsGeneratingGemini(false);
    }
  };

  // Filtering calculations
  const filteredRecords = records.filter(r => {
    const statusMatch = selectedStatusFilter === "all" || r.status === selectedStatusFilter;
    const sourceMatch = sourceFilter === "all" || r.sourceType === sourceFilter;
    
    // Search within payload string keys or file names
    const rawStr = JSON.stringify(r.rawPayload).toLowerCase();
    const flagsStr = r.flags.join(" ").toLowerCase();
    const sourceFileStr = r.sourceFile.toLowerCase();
    const matchSearch = searchInput === "" || 
      rawStr.includes(searchInput.toLowerCase()) || 
      flagsStr.includes(searchInput.toLowerCase()) ||
      sourceFileStr.includes(searchInput.toLowerCase()) ||
      r.id.toLowerCase().includes(searchInput.toLowerCase());

    return statusMatch && sourceMatch && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Control Filters Toolbar */}
      <div className="bg-white p-3 rounded-lg border border-slate-205 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Status Pills Choice */}
        <div id="status-pill-filter" className="flex flex-wrap items-center gap-1.5">
          {["all", "pending", "flagged", "approved", "rejected"].map((stat) => {
            const count = stat === "all" ? records.length : records.filter(r => r.status === stat).length;
            const isActive = selectedStatusFilter === stat;
            return (
              <button
                key={stat}
                onClick={() => onSelectStatusFilter(stat)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  isActive 
                    ? "bg-[#0f172a] text-white" 
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="capitalize">{stat}</span>
                <span className={`font-mono text-[9px] px-1 py-0.2 rounded leading-none ${
                  isActive ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-500"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Source filtering, search indicators */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Source filters dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-705 rounded-lg p-1 px-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
            >
              <option value="all">All Raw Streams</option>
              <option value="sap">SAP Fueled Exports</option>
              <option value="utility">Utility Portal Scrapes</option>
              <option value="travel">Corporate Travels</option>
            </select>
          </div>

          {/* Search text inputs */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter by raw ID, tags, files..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-slate-50 placeholder-slate-400 border border-slate-200 text-slate-700 text-xs rounded-lg pl-8 pr-3 py-1.5 w-56 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

        </div>

      </div>

      {/* Primary Ingestion Data Grid - High Density Style */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-55/70 text-[10px] font-mono text-slate-500 uppercase tracking-widest border-b border-slate-200">
                <th className="p-3 py-2.5 font-bold">Ledger ID</th>
                <th className="p-3 py-2.5 font-bold">Category</th>
                <th className="p-3 py-2.5 font-bold">Allocation Asset Code</th>
                <th className="p-3 py-2.5 font-bold">Processed Activity</th>
                <th className="p-3 py-2.5 font-bold text-right">Metric Tons CO₂e</th>
                <th className="p-3 py-2.5 font-bold text-center">Audit Status</th>
                <th className="p-3 py-2.5 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium font-mono">
                    No sequential transaction entries match active filters database.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const facilityMatch = facilities.find(f => f.id === rec.facilityId);
                  
                  return (
                    <tr 
                      key={rec.id}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedRecord(rec)}
                    >
                      {/* ID Row */}
                      <td className="p-3 font-mono font-bold text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-800 group-hover:text-indigo-600 group-hover:underline">{rec.id}</span>
                        </div>
                        <span className="block text-[9px] text-slate-400 font-sans font-normal mt-0.5 truncate max-w-[140px]" title={rec.sourceFile}>
                          {rec.sourceFile}
                        </span>
                      </td>

                      {/* Source Identity Badge */}
                      <td className="p-3 font-medium select-none">
                        {rec.sourceType === "sap" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-semibold bg-rose-50 p-0.5 px-2 rounded border border-rose-100">
                            <Flame className="w-3 h-3 text-rose-500" /> Direct Fuel
                          </span>
                        )}
                        {rec.sourceType === "utility" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold bg-amber-50 p-0.5 px-2 rounded border border-amber-100">
                            <Zap className="w-3 h-3 text-amber-500" /> Electrical
                          </span>
                        )}
                        {rec.sourceType === "travel" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 p-0.5 px-2 rounded border border-emerald-100">
                            <Plane className="w-3 h-3 text-emerald-555" /> Logistics
                          </span>
                        )}
                      </td>

                      {/* Associated Facility Plant Code */}
                      <td className="p-3">
                        {facilityMatch ? (
                          <div>
                            <span className="font-bold text-slate-700 block">{facilityMatch.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">Plant-Code: {facilityMatch.plantCode || "N/A"}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-rose-600 font-semibold flex items-center gap-0.5">Unallocated Site</span>
                            <span className="text-[9px] text-slate-400 font-mono">Code: {rec.plantCodeRaw || "Unset"}</span>
                          </div>
                        )}
                      </td>

                      {/* Processed Telemetry Parameters */}
                      <td className="p-3">
                        {rec.normalization ? (
                          <div>
                            <span className="font-bold text-slate-700 font-mono">
                              {rec.normalization.activityAmount.toLocaleString()} {rec.normalization.activityUnit}
                            </span>
                            <span className="block text-[9px] text-slate-400 mt-0.5 truncate max-w-[160px]">{rec.normalization.ghgCategory}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">Raw data unaligned</span>
                        )}
                      </td>

                      {/* CO2 Equivalent Tons in bold */}
                      <td className="p-3 text-right font-mono font-bold text-slate-800 text-xs">
                        {rec.normalization ? (
                          <span>
                            {rec.normalization.co2eTonnes.toFixed(4)} <span className="text-[10px] font-sans font-normal text-slate-400">t</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Visual Auditor Status Badge */}
                      <td className="p-3 text-center select-none">
                        {rec.status === "approved" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Cleared
                          </span>
                        )}
                        {rec.status === "flagged" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-500" /> Flagged
                          </span>
                        )}
                        {rec.status === "pending" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                            <Clock className="w-3 h-3 text-amber-500" /> Pending
                          </span>
                        )}
                        {rec.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                            <XOctagon className="w-3 h-3 text-slate-500" /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Right navigate indicator */}
                      <td className="p-3 text-center">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-900 transition-colors" />
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED LEDGER AUDITING MODAL - High Density Redux */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-3xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl h-[85vh] shadow-xl flex flex-col overflow-hidden border border-slate-250">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-205 bg-slate-55/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded text-white ${
                  selectedRecord.sourceType === "sap" ? "bg-rose-500" :
                  selectedRecord.sourceType === "utility" ? "bg-amber-500" : "bg-emerald-500"
                }`}>
                  {selectedRecord.sourceType === "sap" ? <Flame className="w-4 h-4" /> :
                   selectedRecord.sourceType === "utility" ? <Zap className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    Ingested Ledger Review: <span className="font-mono font-medium text-slate-500 text-xs">{selectedRecord.id}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Received AT: {new Date(selectedRecord.receivedAt).toUTCString()}</p>
                </div>
              </div>
              
              <button 
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-900 p-1 bg-slate-100 hover:bg-slate-200 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inner Tabs Navigate */}
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 bg-slate-50 text-xs">
              <button 
                onClick={() => setActiveTab('details')}
                className={`py-2 px-1 font-bold border-b-2 transition ${activeTab === 'details' ? 'border-indigo-600 text-indigo-650' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
              >
                <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Normalization indicators</span>
              </button>
              <button 
                onClick={() => setActiveTab('raw')}
                className={`py-2 px-1 font-bold border-b-2 transition ${activeTab === 'raw' ? 'border-indigo-600 text-indigo-650' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
              >
                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Original Telemetry</span>
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 font-bold border-b-2 transition ${activeTab === 'history' ? 'border-indigo-600 text-indigo-650' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
              >
                <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Permanent Audit Trail ({auditLogs.length})</span>
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Main Content Area (2 Cols) */}
              <div className="md:col-span-2 space-y-4">
                
                {/* Visualizer Flags Block */}
                {selectedRecord.flags.length > 0 && (
                  <div className="p-3 bg-rose-50/70 rounded border border-rose-100 flex items-start gap-2.5 shadow-3xs">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <h4 className="text-[10px] font-bold text-rose-800 uppercase tracking-widest font-mono">AI Ingestion Rule Violations</h4>
                      <ul className="list-disc pl-4 text-xs text-rose-700 mt-1 space-y-0.5">
                        {selectedRecord.flags.map((flg, idx) => (
                          <li key={idx} className="leading-snug">{flg}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tab 1: Normalizations Parameters & Modifiers */}
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    
                    {/* Calculation summary block */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">GHG Scope</span>
                        <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">{selectedRecord.normalization?.ghgCategory || "N/A"}</div>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Multiplier EF</span>
                        <div className="text-[11px] font-medium font-mono text-slate-800 mt-0.5 truncate">{selectedRecord.normalization?.emissionFactor || 0} kg/u</div>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block font-black text-slate-500">Calculated CO₂e</span>
                        <div className="text-xs font-black text-indigo-650 mt-0.5">{selectedRecord.normalization?.co2eTonnes.toFixed(4) || "0.00"} t</div>
                      </div>
                    </div>

                    {/* Operational Overrides Modification Form */}
                    <div className="border border-slate-200 rounded p-4 shadow-3xs">
                      <h4 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-3">Analyst Metric Alterations Panel</h4>
                      <form onSubmit={handleSaveOverrides} className="space-y-3.5 text-xs">
                        
                        {/* Facility align choice */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-705 block">Site Allocation Asset Reference</label>
                          <select
                            value={selectedFacId}
                            onChange={(e) => setSelectedFacId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 p-1.5 text-slate-800 rounded font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer text-xs"
                          >
                            <option value="">-- No explicit site allocation mapped --</option>
                            {facilities.map(f => (
                              <option key={f.id} value={f.id}>{f.name} (Plant {f.plantCode} / {f.country})</option>
                            ))}
                          </select>
                        </div>

                        {/* Ingested metrics overrides based on source types */}
                        {selectedRecord.sourceType === "sap" && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700 block">Fuel Volume (MENGE)</label>
                              <input
                                type="number"
                                step="any"
                                value={overrideFuelQty}
                                onChange={(e) => setOverrideFuelQty(e.target.value)}
                                className="w-full bg-slate-55 border border-slate-200 p-1.5 text-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-bold text-slate-400 block pb-1">SAP Unit (MEINS)</label>
                              <div className="bg-slate-100 border border-slate-200 p-1.5 rounded text-slate-400 font-mono text-xs select-none">
                                {String(selectedRecord.rawPayload.MEINS || "L")}
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedRecord.sourceType === "utility" && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700 block">Active Consumption (kWh)</label>
                              <input
                                type="number"
                                step="any"
                                value={overrideUtilityQty}
                                onChange={(e) => setOverrideUtilityQty(e.target.value)}
                                className="w-full bg-slate-55 border border-slate-205 p-1.5 text-slate-850 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-bold text-slate-400 block pb-1">Billing Multiplier</label>
                              <div className="bg-slate-100 border border-slate-200 p-1.5 rounded text-slate-400 font-mono text-xs select-none">
                                {String(selectedRecord.rawPayload.Multiplier || "1.0")}
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedRecord.sourceType === "travel" && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700 block">Aviation Class</label>
                              <select
                                value={overrideCabinClass}
                                onChange={(e) => setOverrideCabinClass(e.target.value)}
                                className="w-full bg-slate-55 border border-slate-200 p-1.5 text-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
                              >
                                <option value="Economy">Economy (Standard)</option>
                                <option value="Business">Business Class (Ozone Weight)</option>
                                <option value="First">First Class (Thermal)</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700 block">Airport Travel Legs</label>
                              <input
                                type="text"
                                value={overrideTravelSegments}
                                onChange={(e) => setOverrideTravelSegments(e.target.value)}
                                className="w-full bg-slate-55 border border-slate-200 p-1.5 text-slate-800 font-mono rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                              />
                            </div>
                          </div>
                        )}

                        <div className="pt-1.5 flex justify-end">
                          <button
                            type="submit"
                            disabled={isSavingOverride}
                            className="bg-slate-900 cursor-pointer text-white px-3.5 py-1.5 rounded text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 transition disabled:opacity-50"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{isSavingOverride ? "Recomputing metrics..." : "Commit Overrides & Recalculate"}</span>
                          </button>
                        </div>

                      </form>
                    </div>

                    {/* Gemini AI Auditor Recommendations Trigger Card */}
                    <div className="bg-gradient-to-tr from-indigo-50/50 via-slate-50/60 to-emerald-50/40 border border-indigo-100 rounded-lg p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-indigo-200 pointer-events-none">
                        <Sparkles className="w-16 h-16 stroke-1 opacity-20" />
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded shrink-0">
                          <Sparkles className="w-4 h-4 text-emerald-300" />
                        </div>
                        <div className="space-y-1.5 flex-grow">
                          <h4 className="font-bold text-slate-900 text-xs">AI Copilot Ledger Recommendation</h4>
                          <p className="text-[11px] text-slate-500 leading-normal max-w-xl">
                            Evaluate active discrepancies against international greenhouse gas criteria. Instantly outlines draft corporate correspondence for billing and suppliers.
                          </p>
                          <div className="pt-1">
                            <button
                              onClick={runGeminiExplainer}
                              disabled={isGeneratingGemini}
                              className="bg-indigo-600 cursor-pointer text-white px-3 py-1.5 rounded text-[11px] font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition flex items-center gap-1 disabled:opacity-50"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> 
                              <span>{isGeneratingGemini ? "AI generating report..." : "Analyze Record with Gemini"}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Gemini explanation outputs rendering */}
                      {geminiExplanation && (
                        <div className="mt-3 p-3 bg-white border border-slate-200 rounded text-xs text-slate-700 leading-relaxed shadow-3xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2 font-mono text-[9px]">
                            <span className="font-bold text-indigo-700 uppercase tracking-widest block">
                              🤖 Compliance Analysis & Communications Draft
                            </span>
                            <button 
                              onClick={() => setGeminiExplanation("")} 
                              className="text-slate-400 hover:text-slate-700"
                            >
                              Clear
                            </button>
                          </div>
                          
                          <div className="whitespace-pre-wrap font-sans text-slate-700 text-[11px] leading-relaxed space-y-2">
                            {geminiExplanation}
                          </div>
                        </div>
                      )}

                    </div>

                  </div>
                )}

                {/* Tab 2: Raw telemetry payload (Prettified JSON views) */}
                {activeTab === 'raw' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400">
                      View of original telemetry elements received. Modified parameter indicators do not affect this secure log layer.
                    </p>
                    <div className="bg-slate-900 text-emerald-450 p-3 rounded border border-slate-800 font-mono text-[10px] overflow-x-auto select-all max-h-[350px]">
                      <pre>{JSON.stringify(selectedRecord.rawPayload, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Tab 3: Audit log timeline history delta lists */}
                {activeTab === 'history' && (
                  <div className="space-y-3 font-sans">
                    <p className="text-[11px] text-slate-400">
                      Permanent chronological ledger tracing auditing transitions.
                    </p>
                    
                    {isLoadingAudits ? (
                      <div className="text-center py-10 text-slate-400 text-xs font-mono">Querying historical ledger sequences...</div>
                    ) : (
                      <div className="relative border-l border-slate-200 pl-3.5 ml-2.5 space-y-4 py-1">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="relative space-y-1">
                            {/* Bullet icon */}
                            <div className="absolute -left-[19.5px] top-1 w-2.5 h-2.5 rounded-full border border-white bg-slate-800 shadow-3xs" />
                            
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-450 font-mono">
                              <span className="font-bold text-slate-700 bg-slate-100 px-1 rounded">{log.actor}</span>
                              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                              <span>•</span>
                              <span className="font-bold border border-slate-200 px-1 py-0.2 rounded text-[8px] uppercase">{log.action}</span>
                            </div>
                            
                            <p className="text-xs text-slate-705 leading-relaxed">{log.notes}</p>
                            
                            {/* Differences delta highlights */}
                            {log.diff && (
                              <div className="mt-1.5 bg-slate-50 p-1.5 rounded border border-slate-200 font-mono text-[9px] space-y-1 text-slate-500 max-h-[120px] overflow-y-auto">
                                <span className="font-sans font-bold text-[8px] text-slate-400 uppercase">Change Delta Record:</span>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-rose-600 block border-b border-slate-100 mb-0.5">- Previous:</span>
                                    <pre className="truncate block">{JSON.stringify(log.diff.before.normalization || log.diff.before.facilityId, null, 1)}</pre>
                                  </div>
                                  <div>
                                    <span className="text-emerald-600 block border-b border-slate-100 mb-0.5">+ Amended:</span>
                                    <pre className="truncate block">{JSON.stringify(log.diff.after.normalization || log.diff.after.facilityId, null, 1)}</pre>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                )}

              </div>

              {/* Side Panels: Status & Actions (1 Col) */}
              <div className="space-y-3">
                
                {/* Status State Badge */}
                <div className="border border-slate-200 rounded p-3 bg-slate-50 space-y-2 text-xs">
                  <h4 className="font-mono text-[9px] text-slate-400 uppercase tracking-wider block">Verification Outcome</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold p-0.5 px-2 rounded ${
                      selectedRecord.status === "approved" ? "text-emerald-800 bg-emerald-50 border border-emerald-100" :
                      selectedRecord.status === "flagged" ? "text-rose-800 bg-rose-50 border border-rose-100 animate-pulse" :
                      selectedRecord.status === "pending" ? "text-amber-800 bg-amber-50 border border-amber-100" :
                      "text-slate-700 bg-slate-100 border border-slate-200"
                    }`}>
                      <span className="capitalize">{selectedRecord.status}</span>
                    </span>
                  </div>
                </div>

                {/* Step Action Notes Input */}
                <div className="border border-slate-200 rounded p-3 space-y-2 text-xs">
                  <h4 className="font-semibold text-slate-800 text-xs">Audit Review Ledger Entry notes</h4>
                  <textarea
                    placeholder="Provide professional auditing justification notes for compliance records..."
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    className="w-full h-24 bg-slate-55 border border-slate-200 p-2 rounded text-xs hover:border-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans text-slate-800"
                  />
                  <p className="text-[9px] text-slate-400 leading-snug">
                    Permanent notation linked strictly to ISO 14064 compliance ledger logs.
                  </p>
                </div>

                {/* Main Action Controllers Group */}
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => executeWorkflowAction("approved")}
                    className="w-full bg-slate-900 cursor-pointer text-white font-semibold p-2 rounded text-[11px] hover:bg-slate-800 flex items-center justify-center gap-1.5 transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> 
                    <span>Approve & Lock Row</span>
                  </button>

                  <button
                    onClick={() => executeWorkflowAction("flagged")}
                    className="w-full bg-rose-50 text-rose-700 border border-rose-100 font-semibold p-2 rounded text-[11px] hover:bg-rose-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Flag Warning Escalation</span>
                  </button>

                  <button
                    onClick={() => executeWorkflowAction("rejected")}
                    className="w-full bg-slate-50 text-slate-700 border border-slate-250 font-semibold p-2 rounded text-[11px] hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <XOctagon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reject Data Record</span>
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
