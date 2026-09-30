import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, AreaChart, Area } from 'recharts';
import { AlertCircle, Scale, Info, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

export default function RelativeValueDashboard() {
  const [snapshot, setSnapshot] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [selectedPair, setSelectedPair] = useState('GOLDM - GOLDPETAL');
  const [history, setHistory] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedPair) {
      fetchPairHistory(selectedPair);
    }
  }, [selectedPair]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [pairsRes, snapRes, contractRes] = await Promise.all([
        api.getPairs(),
        api.getRelativeValueSnapshot(),
        api.getContracts()
      ]);
      setPairs(pairsRes.pairs || []);
      setSnapshot(snapRes.snapshot || []);
      setContracts(contractRes.contracts || []);
      if (pairsRes.pairs?.[0]?.name) {
        setSelectedPair(pairsRes.pairs[0].name);
      }
    } catch (e) {
      console.error('Error fetching relative value data:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPairHistory = async (pairName) => {
    try {
      const res = await api.getPairHistory(pairName, 120);
      setHistory(res.history || []);
    } catch (e) {
      console.error('Error fetching pair history:', e);
    }
  };

  const currentPairData = snapshot.find(s => s.pair_name === selectedPair) || snapshot[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Overview Intro Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white tracking-tight m-0">Cross-Contract Relative Value & Normalization</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl m-0">
              Gold futures on MCX trade in multiple sizes (100g, 10g, 8g, 1g) and purities (995 vs 999). 
              Our quantitative engine unifies all contracts into <span className="text-amber-400 font-semibold font-mono">INR per 10 grams of 999 Fine Gold</span> to isolate genuine relative mispricings, retail convenience premiums, and financing carry mismatches.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-400">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Purity Multiplier Active</span>
          </div>
        </div>
      </div>

      {/* Contract Normalization Specification Matrix */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono">MCX Contract Specifications & Exact Normalization Multipliers</h3>
          <span className="text-xs text-slate-400 font-mono">Quotation Base vs Standard 10g 999 Purity</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40">
                <th className="py-2.5 px-4 font-semibold">Symbol</th>
                <th className="py-2.5 px-4 font-semibold">Contract Name</th>
                <th className="py-2.5 px-4 font-semibold">Trading Unit</th>
                <th className="py-2.5 px-4 font-semibold">Quoted Per</th>
                <th className="py-2.5 px-4 font-semibold">Purity</th>
                <th className="py-2.5 px-4 font-semibold text-amber-400">Normalization Multiplier</th>
                <th className="py-2.5 px-4 font-semibold">Expiry Window</th>
                <th className="py-2.5 px-4 font-semibold">Liquidity Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {contracts.map(c => (
                <tr key={c.symbol} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-bold text-white">{c.symbol}</td>
                  <td className="py-3 px-4 text-slate-300 font-sans">{c.name}</td>
                  <td className="py-3 px-4">{c.tradingUnitGrams}g</td>
                  <td className="py-3 px-4">{c.quoteUnitGrams}g</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-200 border border-slate-700">
                      {c.purity} ({(c.purity / 10).toFixed(1)}%)
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-amber-400">
                    × {c.normalizationMultiplier.toFixed(6)}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{c.expiryWindow}</td>
                  <td className="py-3 px-4 text-slate-400 font-sans">{c.typicalVolumeTier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monitored Pair Selector Pills */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Select Monitored Relative Value Pair</label>
        <div className="flex flex-wrap gap-2">
          {pairs.map(p => {
            const isSelected = selectedPair === p.name;
            const snap = snapshot.find(s => s.pair_name === p.name);
            const z = snap ? parseFloat(snap.z_score_20d || 0) : 0;
            return (
              <button
                key={p.name}
                onClick={() => setSelectedPair(p.name)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition cursor-pointer border ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{p.name}</span>
                {snap && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    Math.abs(z) >= 2.0 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    Z: {z.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Pair KPI Cards */}
      {currentPairData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Normalized Spread"
            value={`₹${parseFloat(currentPairData.spread || 0).toLocaleString()}`}
            subtitle={`${currentPairData.contract_a} vs ${currentPairData.contract_b} (per 10g 999)`}
            change={`${parseFloat(currentPairData.spread_pct || 0) > 0 ? '+' : ''}${parseFloat(currentPairData.spread_pct || 0).toFixed(2)}%`}
            trend={parseFloat(currentPairData.spread || 0) > 0 ? 'up' : 'down'}
          />

          <StatCard
            title="20-Day Z-Score"
            value={parseFloat(currentPairData.z_score_20d || 0).toFixed(2)}
            subtitle={`Rolling Mean: ₹${parseFloat(currentPairData.rolling_mean_20d || 0).toFixed(1)} | Std: ₹${parseFloat(currentPairData.rolling_std_20d || 0).toFixed(1)}`}
            badge={Math.abs(parseFloat(currentPairData.z_score_20d || 0)) >= 2.0 ? 'Dislocated (|Z| ≥ 2.0)' : 'In Normal Band'}
            trend={Math.abs(parseFloat(currentPairData.z_score_20d || 0)) >= 2.0 ? 'gold' : 'neutral'}
          />

          <StatCard
            title="Retail Convenience Premium"
            value={`₹${parseFloat(currentPairData.convenience_premium || 0).toFixed(1)}`}
            subtitle="Structural retail premium on fractional contracts over wholesale mini"
            trend={parseFloat(currentPairData.convenience_premium || 0) > 0 ? 'up' : 'neutral'}
          />

          <StatCard
            title="Signal & Liquidity Regime"
            value={currentPairData.regime || 'EVALUATING'}
            subtitle={currentPairData.is_executable_edge ? 'Actionable net edge survives friction' : 'Alert suppressed by safety hurdles'}
            trend={currentPairData.is_executable_edge ? 'up' : 'down'}
          />
        </div>
      )}

      {/* Spread & Z-Score Interactive Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Normalized Price Spread with Bollinger-style 2-Sigma Bands */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase font-mono tracking-wider">Normalized Spread & 20-Day Statistical Bands</h3>
              <p className="text-xs text-slate-400 font-sans">Spread (₹/10g 999) with Rolling Mean ± 2 Standard Deviations</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="trade_date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line type="monotone" dataKey="spread" name="Normalized Spread" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rolling_mean_20d" name="20d Mean" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Z-Score Oscillator */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase font-mono tracking-wider">Z-Score Oscillator (Statistical Deviation)</h3>
              <p className="text-xs text-slate-400 font-sans">Signals trigger only beyond critical threshold |Z| ≥ 2.0</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" />+2σ Overpriced</span>
              <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-400" />-2σ Underpriced</span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="trade_date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[-3.5, 3.5]} ticks={[-3, -2, -1, 0, 1, 2, 3]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <ReferenceLine y={2.0} stroke="#10b981" strokeDasharray="3 3" label={{ value: '+2.0σ Threshold', fill: '#10b981', fontSize: 10 }} />
                <ReferenceLine y={-2.0} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '-2.0σ Threshold', fill: '#f43f5e', fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                <Line type="monotone" dataKey="z_score_20d" name="20d Z-Score" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Analytical Rationale Card */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400" />
          <span>Drivers of Cross-Contract Relative Pricing Discrepancies</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 leading-relaxed">
          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
            <span className="font-semibold text-slate-200 block mb-1">1. Retail Convenience Premium</span>
            Smaller contracts like GOLDPETAL (1g) and GOLDGUINEA (8g) allow retail investors to participate without committing ₹7.5 Lakh+ for a 100g GOLDM lot. This convenience creates a persistent structural markup.
          </div>
          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
            <span className="font-semibold text-slate-200 block mb-1">2. Purity & Quote Base Adjustment</span>
            GOLDM is quoted on 995 purity, whereas GOLDPETAL, GOLDGUINEA, and GOLDTEN are 999 fine gold. Comparing raw prices without mathematical normalization produces an artificial ₹300-₹400/10g illusion.
          </div>
          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
            <span className="font-semibold text-slate-200 block mb-1">3. Expiry Alignment & Carry Gap</span>
            GOLDM expires on the 3rd–5th of the month, while GOLDTEN/GUINEA/PETAL expire on the 27th–31st. That 22–26 day financing gap carries ~6.5%–7.0% per annum Indian cost of carry that must be accounted for.
          </div>
        </div>
      </div>
    </div>
  );
}
