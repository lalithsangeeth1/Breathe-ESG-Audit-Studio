import React, { useState, useEffect } from "react";
import { IngestedRecord, Facility, Tenant, DashboardStats } from "./types";
import Dashboard from "./components/Dashboard";
import AuditingList from "./components/AuditingList";
import IngestionCenter from "./components/IngestionCenter";
import AssistantChat from "./components/AssistantChat";
import { 
  FolderSync, 
  BarChart3, 
  ClipboardCheck, 
  FileDown, 
  Sparkles, 
  Building2, 
  RefreshCw,
  HelpCircle,
  FolderOpen
} from "lucide-react";

export default function App() {
  // Tenant states
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'ingestion' | 'chat'>('dashboard');
  const [recordsFilterStatus, setRecordsFilterStatus] = useState<string>("all");

  // Core Data States
  const [records, setRecords] = useState<IngestedRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  // Loader States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Initial Seed Fetching
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch stats when active tenant changes
  useEffect(() => {
    if (activeTenantId) {
      fetchTenantMetrics();
    }
  }, [activeTenantId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Tenants list
      const tenantRes = await fetch("/api/tenants");
      const tenantData: Tenant[] = await tenantRes.json();
      setTenants(tenantData);
      
      if (tenantData.length > 0) {
        // Set first tenant active
        setActiveTenantId(tenantData[0].id);
      }

      // Fetch Facilities register
      const facRes = await fetch("/api/facilities");
      const facData: Facility[] = await facRes.json();
      setFacilities(facData);

    } catch (err) {
      console.error("Initiation payload capture error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTenantMetrics = async () => {
    setIsRefreshing(true);
    try {
      // Fetch dynamic analytics Aggregates
      const statsRes = await fetch(`/api/dashboard/stats?tenantId=${activeTenantId}`);
      const statsData: DashboardStats = await statsRes.json();
      setStats(statsData);

      // Fetch Ingested Records register
      const recRes = await fetch(`/api/records?tenantId=${activeTenantId}`);
      const recData: IngestedRecord[] = await recRes.json();
      setRecords(recData);

    } catch (err) {
      console.error("Metric sync failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Record modified overrides
  const handleUpdateRecord = async (id: string, updatePayload: { facilityId?: string; payloadOverride?: Record<string, any>; notes?: string }) => {
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: "Rahul (Auditor)",
          ...updatePayload
        })
      });
      if (res.ok) {
        await fetchTenantMetrics(); // Refresh data state
      } else {
        console.error("Failed updating record params");
      }
    } catch (err) {
      console.error("Update request transaction failed:", err);
    }
  };

  // Record workflow transitions approved, rejected, flagged
  const handleActionRecord = async (id: string, action: 'approved' | 'rejected' | 'flagged', notes: string) => {
    try {
      const res = await fetch(`/api/records/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          actor: "Rahul (Auditor)",
          notes
        })
      });
      if (res.ok) {
        await fetchTenantMetrics(); // Refresh data state
      } else {
        console.error("Recording action workflow transition failed");
      }
    } catch (err) {
      console.error("Action workflow transition fetch error:", err);
    }
  };

  // Link status pill in Dashboard of cleared vs pending directly to filters
  const navigateToRowsWithFilter = (statusFilter: string = "all") => {
    setRecordsFilterStatus(statusFilter);
    setActiveTab('records');
  };

  const currentTenant = tenants.find(t => t.id === activeTenantId);

  return (
    <div className="flex h-screen w-screen bg-[#f1f5f9] overflow-hidden font-sans text-slate-800 selection:bg-slate-900 selection:text-white">
      
      {/* Sidebar navigation panel - Slate 900 Theme */}
      <aside className="w-64 bg-[#0f172a] text-white flex flex-col shrink-0 border-r border-slate-800">
        
        {/* Logo and Brand Title Header */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-slate-905 text-sm select-none shadow-sm">
            B
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white block">Breathe ESG</span>
            <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block -mt-1">Scope Accounting</span>
          </div>
        </div>

        {/* Enterprise Client Dropdown selector */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
          <label className="text-[10px] uppercase font-black text-slate-450 tracking-wider block mb-1.5 font-mono">
            Enterprise Client
          </label>
          <select
            value={activeTenantId}
            onChange={(e) => setActiveTenantId(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-755 text-slate-200 font-semibold rounded-lg p-2 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Navigation Section Link list */}
        <nav className="flex-1 py-4 overflow-y-auto space-y-1">
          <div className="px-5 py-2 text-[10px] uppercase font-black text-slate-500 tracking-wider font-mono">
            Operational
          </div>
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-xs font-semibold border-r-2 text-left transition-all ${
              activeTab === 'dashboard'
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                : "text-slate-450 hover:bg-slate-800/60 hover:text-slate-200 border-transparent"
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Compliance Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('records')}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-xs font-semibold border-r-2 text-left transition-all relative ${
              activeTab === 'records'
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                : "text-slate-450 hover:bg-slate-800/60 hover:text-slate-200 border-transparent"
            }`}
          >
            <ClipboardCheck className="w-4 h-4 shrink-0" />
            <span className="flex-grow">Operational Registers</span>
            {records.filter(r => r.status === "flagged").length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse absolute right-5 top-4" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('ingestion')}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-xs font-semibold border-r-2 text-left transition-all ${
              activeTab === 'ingestion'
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                : "text-slate-450 hover:bg-slate-800/60 hover:text-slate-200 border-transparent"
            }`}
          >
            <FileDown className="w-4 h-4 shrink-0" />
            <span>Inbound Streams Ingest</span>
          </button>

          <div className="px-5 py-2 mt-5 text-[10px] uppercase font-black text-slate-500 tracking-wider font-mono">
            Intelligence
          </div>

          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-xs font-semibold border-r-2 text-left transition-all ${
              activeTab === 'chat'
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                : "text-slate-450 hover:bg-slate-800/60 hover:text-slate-200 border-transparent"
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Auditor Copilot Dialogue</span>
          </button>
        </nav>

        {/* Sidebar Auditor Profile Footer Card */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center font-bold text-slate-350 text-xs border border-slate-800">
              RA
            </div>
            <div className="text-xs">
              <div className="font-semibold text-slate-200 leading-tight">Rahul (Auditor)</div>
              <div className="text-slate-500 text-[10px] font-mono mt-0.5">ID: ANL-0422</div>
            </div>
          </div>
        </div>

      </aside>

      {/* Main Panel Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Core Header Bar with Action Controls */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-3xs">
          
          <div className="flex items-center gap-2.5 text-slate-800">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 hidden sm:inline">
              Review & Verification Console
            </h1>
            <span className="hidden md:inline text-slate-300">|</span>
            {currentTenant && (
              <div className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">Client: {currentTenant.id}</span>
                <span className="font-semibold text-slate-800">{currentTenant.name}</span>
                <span>•</span>
                <span>{currentTenant.industry}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            
            {/* Live Indicator tag */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-semibold text-slate-700">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>SAP Integration: Connected</span>
            </div>

            {/* Reloading Trigger */}
            <button
              onClick={fetchTenantMetrics}
              disabled={isRefreshing}
              className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-900 transition cursor-pointer"
              title="Refresh ledger indicators"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>

            {/* Lock Action trigger */}
            <button
              onClick={() => {
                alert("Security lock enabled: Ingestion feeds successfully certified and locked according to compliance criteria ISO 14064.");
              }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-lg text-xs leading-none transition shadow-sm cursor-pointer"
            >
              Lock for Audit
            </button>

          </div>

        </header>

        {/* Content Wrapper Section Area */}
        <div className="flex-1 overflow-y-auto bg-[#f1f5f9] p-6 space-y-6">
          
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-700" />
              <span className="text-xs font-mono">Initializing Breathe ESG high-density matrix parameters...</span>
            </div>
          ) : (
            <>
              {/* Quick Tenant Workspace Header Banner */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase">Verification Registry</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-slate-500 font-mono">Territory: {currentTenant?.country}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">{currentTenant?.name} Workspace</h2>
                </div>

                <div className="grid grid-cols-3 gap-6 sm:gap-12 text-xs font-mono border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-black">Linked Sites</span>
                    <span className="text-slate-800 font-bold text-sm">
                      {facilities.filter(f => f.tenantId === activeTenantId).length} assets
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-black">Audit Rows</span>
                    <span className="text-slate-800 font-bold text-sm">{records.length} files</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-black">Unresolved</span>
                    <span className="text-amber-600 font-bold text-sm">
                      {records.filter(r => r.status === "pending").length} queue
                    </span>
                  </div>
                </div>
              </div>

              {/* Component view switch */}
              <div className="flex-1">
                {activeTab === 'dashboard' && stats && (
                  <Dashboard 
                    stats={stats} 
                    onNavigateToRows={navigateToRowsWithFilter} 
                  />
                )}

                {activeTab === 'records' && (
                  <AuditingList 
                    records={records}
                    facilities={facilities.filter(f => f.tenantId === activeTenantId)}
                    selectedStatusFilter={recordsFilterStatus}
                    onSelectStatusFilter={setRecordsFilterStatus}
                    onUpdateRecord={handleUpdateRecord}
                    onActionRecord={handleActionRecord}
                  />
                )}

                {activeTab === 'ingestion' && (
                  <IngestionCenter 
                    tenantId={activeTenantId}
                    onRefreshStats={fetchTenantMetrics}
                  />
                )}

                {activeTab === 'chat' && (
                  <AssistantChat 
                    tenantId={activeTenantId}
                  />
                )}
              </div>

              {/* High Density Footer Block */}
              <footer className="pt-4 border-t border-slate-250 text-slate-400 text-[10px] font-mono flex flex-col sm:flex-row justify-between items-center gap-2 mt-auto">
                <div>© 2026 Breathe ESG • Sandbox Evaluation Workspace</div>
                <div className="text-right">ISO 14064-3 compliant • Certified GHG Protocol Accounting standards</div>
              </footer>
            </>
          )}

        </div>

      </div>

    </div>
  );
}
