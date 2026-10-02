import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, HelpCircle, Layers, ArrowUpRight, ShieldCheck } from 'lucide-react';

export default function TermStructureDashboard() {
  const [termStructure, setTermStructure] = useState(null);
  const [rollDownData, setRollDownData] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('GOLDM');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTermStructure();
    fetchRollDown('GOLDM');
  }, []);

  const fetchTermStructure = async (date) => {
    try {
      setLoading(true);
      const res = await api.getTermStructure(date);
      setTermStructure(res);
    } catch (e) {
      console.error('Error fetching term structure:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRollDown = async (sym) => {
    try {
      const res = await api.getRollDown(sym, 15);
      setRollDownData(res.series || []);
    } catch (e) {
      console.error('Error fetching roll down data:', e);
    }
  };

  const handleSymbolChange = (sym) => {
    setSelectedSymbol(sym);
    fetchRollDown(sym);
  };

  const summary = termStructure?.summary || {};
  const currentSummary = summary[selectedSymbol];

  // Prepare curve data for selected symbol or all symbols
  const curves = termStructure?.curves || {};
  const currentCurvePoints = (curves[selectedSymbol] || []).map(pt => ({
    expiryDate: pt.expiryDate,
    dte: pt.daysToExpiry,
    priceNorm: pt.priceNorm10g,
    volume10g: pt.normVolume10g,
    oi10g: pt.normOI10g,
    isTender: pt.isTenderPeriod
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30 border border-slate-800 p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight m-0">Term Structure & Carry Analytics</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl m-0">
              Measure the futures curve shape across calendar expiries. Compute implied annualized financing carry rates (F = S × e^(r × T)) and decouple predictable mechanical roll-down from genuine term-structure curve shifts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">Benchmark Repo Rate:</span>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-400 font-mono font-bold text-xs border border-slate-700">6.50%</span>
          </div>
        </div>
      </div>

      {/* Contract Symbol Filter Tabs */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono mr-2">Contract Family:</span>
        {['GOLDM', 'GOLD', 'GOLDTEN', 'GOLDPETAL', 'GOLDGUINEA'].map(sym => (
          <button
            key={sym}
            onClick={() => handleSymbolChange(sym)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer border ${
              selectedSymbol === sym
                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Term Structure KPIs */}
      {currentSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Curve Structure"
            value={
              currentSummary.structure === 'CONTANGO' ? 'Contango' :
              currentSummary.structure === 'BACKWARDATION' ? 'Backwardation' :
              currentSummary.structure === 'SINGLE_MONTH' ? 'Single Month' :
              currentSummary.structure
            }
            subtitle={currentSummary.structure === 'CONTANGO' ? 'Futures trading at a carry premium to spot' : 'Backwardation / Inverted curve'}
            trend={currentSummary.structure === 'CONTANGO' ? 'up' : 'down'}
            badge={currentSummary.structure === 'CONTANGO' ? 'Contango' : currentSummary.structure === 'BACKWARDATION' ? 'Backwardation' : 'Normal'}
          />

          <StatCard
            title="Calendar Spread (Near vs Next)"
            value={`₹${currentSummary.spreadNearNext.toLocaleString()}`}
            subtitle={`Near: ${currentSummary.nearExpiry} (${currentSummary.nearDte}d) → Next: ${currentSummary.nextExpiry} (${currentSummary.nextDte}d)`}
            trend="gold"
          />

          <StatCard
            title="Implied Annualized Carry"
            value={`${currentSummary.impliedAnnualizedCarryPct.toFixed(2)}%`}
            subtitle="Theoretical INR financing rate implied by futures calendar spread"
            change={currentSummary.impliedAnnualizedCarryPct > 6.5 ? '+0.49% vs Repo' : 'Normal'}
            trend={currentSummary.impliedAnnualizedCarryPct > 6.5 ? 'up' : 'neutral'}
          />

          <StatCard
            title="Active Expiries Tracked"
            value={currentSummary.contractsCount}
            subtitle="Full lifecycle curves maintained without near-month rollover jumps"
            badge="Non-Continuous"
            trend="neutral"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Futures Curve Chart */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase font-mono tracking-wider">{selectedSymbol} Futures Curve (Term Structure)</h3>
              <p className="text-xs text-slate-400 font-sans">Normalized Price (₹/10g 999) plotted against Days to Expiry (DTE)</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentCurvePoints} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="dte" stroke="#64748b" tick={{ fontSize: 10 }} label={{ value: 'Days to Expiry (DTE)', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={v => `₹${v.toLocaleString()}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                  labelFormatter={dte => `DTE: ${dte} Days`}
                />
                <Line type="monotone" dataKey="priceNorm" name="Normalized Price (₹/10g)" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: '#06b6d4', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mechanical Roll-Down vs Genuine Curve Shift Decomposition */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase font-mono tracking-wider">Roll-Down vs Curve Shift Decomposition</h3>
              <p className="text-xs text-slate-400 font-sans">Separating passive mechanical time decay from true supply-demand shifts</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rollDownData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="tradeDate" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="mechanicalRollDown" name="Mechanical Roll-Down" fill="#3b82f6" />
                <Bar dataKey="genuineCurveShift" name="Genuine Curve Shift" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Explanatory Technical Reference */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-5 space-y-2">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span>Why Decoupling Mechanical Roll-Down is Vital</span>
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed m-0">
          In a contango market, a futures contract naturally declines towards the physical spot price as expiry approaches (F → S as expiry approaches). 
          Unskilled analysis mistakes this predictable mechanical roll-down for strategic alpha or genuine bearish sentiment. 
          By decomposing ΔF into <span className="text-blue-400 font-mono">Mechanical Basis Decay</span> and <span className="text-amber-400 font-mono">Genuine Curve Innovation</span>, quantitative commodity traders isolate the true supply-demand balance of the metal.
        </p>
      </div>
    </div>
  );
}
