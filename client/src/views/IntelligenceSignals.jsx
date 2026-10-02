import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import { ShieldAlert, BellOff, CheckCircle2, AlertTriangle, Scale, VolumeX, EyeOff, Info, ArrowRight } from 'lucide-react';

export default function IntelligenceSignals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntelligence();
  }, []);

  const fetchIntelligence = async () => {
    try {
      setLoading(true);
      const res = await api.getIntelligenceOverview();
      setData(res);
    } catch (e) {
      console.error('Error fetching intelligence overview:', e);
    } finally {
      setLoading(false);
    }
  };

  const metrics = data?.metrics || {};
  const pairs = data?.pairs || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Intro Header */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight m-0">Trader-Facing Intelligence & Quiet Alert Suppression</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl m-0">
              Institutional-grade signal hygiene: Alerts are intentionally suppressed during normal statistical noise, 
              illiquid settlement traps, physical delivery tender windows, or when transaction costs devour potential edge. 
              Only statistically validated opportunities with positive net expected alpha generate high-conviction trade alerts.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
            <BellOff className="w-4 h-4 text-emerald-400" />
            <span>Quiet Mode Active: {metrics.suppressionRatePct || 100}% Suppressed</span>
          </div>
        </div>
      </div>

      {/* System Regime State Banner */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full animate-pulse ${
            data?.systemRegime === 'ACTIONABLE_DISLOCATION_DETECTED' ? 'bg-emerald-400' : 'bg-slate-400'
          }`} />
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Current Intelligence Regime</div>
            <div className="text-sm font-bold text-white font-mono">
              {data?.systemRegime === 'ACTIONABLE_DISLOCATION_DETECTED'
                ? 'Actionable Dislocation Detected'
                : data?.systemRegime === 'FRICTION_DOMINATED'
                ? 'Friction Dominated (Capital Protected)'
                : 'Efficient Pricing Equilibrium (Signals Suppressed)'}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-300 font-sans max-w-xl text-right m-0 hidden md:block">
          {data?.systemMessage || 'System is suppressing spurious noise to safeguard trading capital.'}
        </p>
      </div>

      {/* Suppression Metrics KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Alert Suppression Rate"
          value={`${metrics.suppressionRatePct || 100}%`}
          subtitle="Percentage of contract pairs intentionally muted to eliminate false alerts"
          badge="High Discipline"
          trend="gold"
          icon={BellOff}
        />

        <StatCard
          title="Actionable High-Conviction Signals"
          value={metrics.actionableSignals || 0}
          subtitle="Passes |Z| ≥ 2.0, executable depth, and positive net edge hurdles"
          trend={(metrics.actionableSignals || 0) > 0 ? 'up' : 'neutral'}
          icon={CheckCircle2}
        />

        <StatCard
          title="Cost-Barrier Muted Spreads"
          value={metrics.costSuppressed || 0}
          subtitle="Gross spread exists in settlement data but is wiped out by MCX fees and slippage"
          trend="neutral"
          icon={Scale}
        />

        <StatCard
          title="Tender & Liquidity Lockouts"
          value={(metrics.tenderRestricted || 0)}
          subtitle="Delivery tender margins or thin order books prevent safe execution"
          trend="neutral"
          icon={AlertTriangle}
        />
      </div>

      {/* Pair-by-Pair Intelligence Cards */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
          Monitored Pair Evaluation & Suppression Audit
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pairs.map((p) => {
            const isActionable = p.status === 'ACTIONABLE';
            const isCostMuted = p.statusBadge === 'Cost-Barrier Muted';
            const isTender = p.statusBadge === 'Tender Window Danger';

            return (
              <div
                key={p.pair_name}
                className={`rounded-xl border p-5 transition flex flex-col justify-between ${
                  isActionable
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                    : isCostMuted
                    ? 'bg-amber-950/15 border-amber-500/30'
                    : isTender
                    ? 'bg-rose-950/15 border-rose-500/30'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h4 className="font-bold font-mono text-sm text-white m-0 truncate">{p.pair_name}</h4>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {p.contract_a} (₹{parseFloat(p.price_a_norm).toLocaleString()}) vs {p.contract_b} (₹{parseFloat(p.price_b_norm).toLocaleString()})
                      </span>
                    </div>
                    <span className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border whitespace-nowrap ${
                      isActionable
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : isCostMuted
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : isTender
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {p.statusBadge}
                    </span>
                  </div>

                  {/* Quantitative Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 my-3 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Normalized Spread</span>
                      <span className="font-bold text-slate-100">₹{parseFloat(p.spread).toFixed(1)}/10g</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">20d Z-Score</span>
                      <span className={`font-bold ${p.absZ >= 2.0 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {parseFloat(p.z_score_20d).toFixed(2)}σ
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Est. Round-Trip Cost</span>
                      <span className="font-bold text-rose-400">~₹{p.estimatedFriction}/10g</span>
                    </div>
                  </div>

                  {/* Spread vs Cost Threshold Visualizer */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Gross Spread (₹{Math.abs(parseFloat(p.spread)).toFixed(1)}) vs Statutory Hurdle (₹{p.estimatedFriction})</span>
                      <span className={p.netEdge > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                        Net Edge: {p.netEdge > 0 ? `+₹${p.netEdge}` : `-₹${Math.abs(p.netEdge)}`}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden flex">
                      <div
                        className={`h-full ${p.netEdge > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(100, (Math.abs(parseFloat(p.spread)) / 200) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Rationale Box */}
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-slate-400 block text-[10px] uppercase font-mono mb-1">Analytical Assessment</span>
                    {p.rationale}
                  </div>
                </div>

                {/* Footer Recommendation */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-slate-400">Quant Action:</span>
                  <span className={`font-bold ${isActionable ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {p.recommendation}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
