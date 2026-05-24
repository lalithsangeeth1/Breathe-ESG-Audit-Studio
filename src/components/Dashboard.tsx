import React from "react";
import { DashboardStats } from "../types";
import { 
  Flame, 
  Zap, 
  Plane, 
  Layers, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FolderMinus, 
  TrendingUp, 
  Building2 
} from "lucide-react";

interface DashboardProps {
  stats: DashboardStats;
  onNavigateToRows: (statusFilter?: string) => void;
}

export default function Dashboard({ stats, onNavigateToRows }: DashboardProps) {
  // Compute percentages for stats rings
  const totalRecords = stats.statuses.total || 1;
  const approvedPct = Math.round((stats.statuses.approved / totalRecords) * 100);

  // Maximum emissions for scaling graphs
  const maxFacilityValue = Math.max(...stats.facilities.map(f => f.value), 1);
  const maxMonthValue = Math.max(...stats.timeline.map(t => t.total), 1);

  return (
    <div className="space-y-4">
      {/* Carbon Scope Totals Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total Metric Tons Card */}
        <div id="card-total-emissions" className="bg-[#0f172a] text-white rounded-lg p-4 border border-slate-850 relative overflow-hidden flex flex-col justify-between min-h-[120px] shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Layers className="w-16 h-16 stroke-1" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Aggregate Footprint</span>
            <h3 className="text-3xl font-bold mt-1 tracking-tight text-white leading-none">
              {stats.totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 ml-1">tCO₂e</span>
            </h3>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-900/30 p-1 px-2 rounded-md w-fit border border-emerald-500/10">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active Carbon Ledger</span>
          </div>
        </div>

        {/* Scope 1 Panel with Crimson left border */}
        <div id="card-scope-1" className="bg-white rounded-lg p-4 border border-slate-200 border-l-4 border-l-rose-500 flex flex-col justify-between min-h-[120px] shadow-2xs">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Scope 1: Direct Fuels</span>
            <div className="p-1 bg-rose-50 text-rose-600 rounded">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900 leading-none">
              {stats.scopes.scope1.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">tCO₂e</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">Stationary combustion, mobile logistical fleet</p>
          </div>
        </div>

        {/* Scope 2 Panel with Amber left border */}
        <div id="card-scope-2" className="bg-white rounded-lg p-4 border border-slate-200 border-l-4 border-l-amber-500 flex flex-col justify-between min-h-[120px] shadow-2xs">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Scope 2: Purchased Power</span>
            <div className="p-1 bg-amber-50 text-amber-600 rounded">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900 leading-none">
              {stats.scopes.scope2.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">tCO₂e</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">Indirect electricity imported across sites</p>
          </div>
        </div>

        {/* Scope 3 Panel with Emerald left border */}
        <div id="card-scope-3" className="bg-white rounded-lg p-4 border border-slate-200 border-l-4 border-l-emerald-500 flex flex-col justify-between min-h-[120px] shadow-2xs">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Scope 3: Corporate Activity</span>
            <div className="p-1 bg-emerald-50 text-emerald-600 rounded">
              <Plane className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900 leading-none">
              {stats.scopes.scope3.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">tCO₂e</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">Corporate employee business travel & transport</p>
          </div>
        </div>

      </div>

      {/* Record Auditing Status Gauge Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* LEFT COLUMN: Queue statistics */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Audit Ledger Health</span>
            <h4 className="text-xs font-bold text-slate-800">Telemetry Ingestion Status</h4>
          </div>

          <div className="py-2 flex flex-col items-center">
            {/* Simple stacked progress ring indicators */}
            <div className="w-24 h-24 rounded-full border-4 border-slate-100 relative flex items-center justify-center">
              <div className="text-center">
                <span className="text-xl font-bold text-slate-800 leading-none block">{approvedPct}%</span>
                <span className="text-[9px] font-mono text-slate-400 block uppercase font-black">Cleared</span>
              </div>
            </div>
          </div>

          {/* Status buttons clicking link filters */}
          <div className="space-y-1 text-xs">
            <button 
              onClick={() => onNavigateToRows("approved")}
              className="w-full flex items-center justify-between p-1.5 rounded bg-emerald-50/50 hover:bg-emerald-100 border border-slate-100 hover:border-emerald-200 transition text-left cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium text-[11px]">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Approved / Cleared
              </span>
              <span className="font-mono text-[10px] font-semibold bg-emerald-200/50 text-emerald-800 px-1.5 py-0.5 rounded leading-none">
                {stats.statuses.approved}
              </span>
            </button>

            <button 
              onClick={() => onNavigateToRows("flagged")}
              className="w-full flex items-center justify-between p-1.5 rounded bg-rose-50/50 hover:bg-rose-100 border border-slate-100 hover:border-rose-200 transition text-left cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-rose-700 font-medium text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-650" /> Flagged Anomalies
              </span>
              <span className="font-mono text-[10px] font-semibold bg-rose-200/50 text-rose-800 px-1.5 py-0.5 rounded leading-none">
                {stats.statuses.flagged}
              </span>
            </button>

            <button 
              onClick={() => onNavigateToRows("pending")}
              className="w-full flex items-center justify-between p-1.5 rounded bg-amber-50/50 hover:bg-amber-100 border border-slate-150 hover:border-amber-200 transition text-left cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-amber-700 font-medium text-[11px]">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending Review
              </span>
              <span className="font-mono text-[10px] font-semibold bg-amber-200/50 text-amber-800 px-1.5 py-0.5 rounded leading-none">
                {stats.statuses.pending}
              </span>
            </button>
            
            <button 
              onClick={() => onNavigateToRows("rejected")}
              className="w-full flex items-center justify-between p-1.5 rounded bg-slate-55 hover:bg-slate-100 border border-slate-100 transition text-left cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                <FolderMinus className="w-3.5 h-3.5 text-slate-500" /> Rejected Logs
              </span>
              <span className="font-mono text-[10px] font-semibold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded leading-none">
                {stats.statuses.rejected}
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT VISUALIZATIONS COLUMN */}
        <div className="md:col-span-3 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Facility Emissions Graphic */}
          <div className="flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" /> Facility Emission Spreads
              </h4>
              <p className="text-[10px] text-slate-400 font-sans">Tonnes of CO₂e aggregated by active asset codes</p>
            </div>
            
            <div className="space-y-2.5 py-1">
              {stats.facilities.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">No active disclosures computed yet</div>
              ) : (
                stats.facilities.map((fac, idx) => {
                  const pct = Math.round((fac.value / maxFacilityValue) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-slate-700 truncate pr-2 max-w-[140px]">{fac.name}</span>
                        <span className="font-mono font-bold text-slate-600">
                          {fac.value.toFixed(1)} <span className="text-[9px] text-slate-400 font-sans font-normal">tCO₂</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-slate-800 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="text-[9px] font-mono text-slate-400 border-t border-slate-100 pt-2 block overflow-hidden truncate">
              Index calculation methodology derived via active regional grid coefficients.
            </div>
          </div>

          {/* Monthly Ingestion Timeline Bar Graphs */}
          <div className="flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-600 shrink-0" /> Chronological Timeline Highlights
              </h4>
              <p className="text-[10px] text-slate-400 font-sans">Sequential trends compiled for disclosure reporting cycles</p>
            </div>

            <div className="h-28 flex items-end gap-2.5 justify-around py-2 my-1">
              {stats.timeline.length === 0 ? (
                <div className="text-center w-full py-6 text-xs text-slate-400">No timeline trends cached yet</div>
              ) : (
                stats.timeline.map((item, idx) => {
                  const s1Pct = (item["Scope 1"] / maxMonthValue) * 100;
                  const s2Pct = (item["Scope 2"] / maxMonthValue) * 100;
                  const s3Pct = (item["Scope 3"] / maxMonthValue) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-16 bg-slate-950 text-white text-[9px] p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-md w-28 font-mono text-center">
                        <span className="block border-b border-slate-800 pb-0.5 mb-1 font-sans font-bold">{item.month}</span>
                        <span className="block text-rose-400">S1: {item["Scope 1"].toFixed(1)}t</span>
                        <span className="block text-amber-400">S2: {item["Scope 2"].toFixed(1)}t</span>
                        <span className="block text-emerald-400">S3: {item["Scope 3"].toFixed(1)}t</span>
                      </div>
                      
                      {/* Stacked Bars */}
                      <div className="w-6 bg-slate-50 hover:bg-slate-100 transition rounded flex flex-col justify-end overflow-hidden h-full border border-slate-150">
                        {/* Scope 1 bar portion */}
                        <div 
                          className="bg-rose-500 w-full transition-all duration-500"
                          style={{ height: `${s1Pct}%` }}
                        />
                        {/* Scope 2 bar portion */}
                        <div 
                          className="bg-amber-400 w-full transition-all duration-500"
                          style={{ height: `${s2Pct}%` }}
                        />
                        {/* Scope 3 bar portion */}
                        <div 
                          className="bg-emerald-500 w-full transition-all duration-500"
                          style={{ height: `${s3Pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono font-medium text-slate-400 mt-1.5">{item.month.split(" ")[0]}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Custom Legend */}
            <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500 border-t border-slate-100 pt-2 select-none">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-rose-500 rounded-xs font-serif"></span>Scope 1</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-xs"></span>Scope 2</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-xs"></span>Scope 3</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
