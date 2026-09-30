import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar } from 'recharts';
import { Cpu, Play, Sliders, AlertTriangle, CheckCircle, ShieldCheck, DollarSign } from 'lucide-react';

export default function WalkForwardBacktest() {
  const [params, setParams] = useState({
    pairName: 'GOLDM - GOLDPETAL',
    startDate: '2024-01-01',
    endDate: '2026-09-30',
    zEntryThreshold: 2.0,
    zExitThreshold: 0.5,
    stopLossZ: 3.5,
    frictionMultiplier: 1.0,
    initialCapital: 1000000,
    minVolumeFilter10g: 30
  });

  const [result, setResult] = useState(null);
  const [sensitivityCurve, setSensitivityCurve] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    runBacktestExecution();
  }, []);

  const runBacktestExecution = async () => {
    try {
      setLoading(true);
      setError(null);
      const [btRes, sensRes] = await Promise.all([
        api.runBacktest(params),
        api.getCostSensitivity(params)
      ]);
      setResult(btRes.backtest);
      setSensitivityCurve(sensRes.sensitivityCurve || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleParamChange = (field, val) => {
    setParams(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Intro Header */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/30 border border-slate-800 p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight m-0">Walk-Forward Backtesting & Performance Attribution</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl m-0">
              Strict chronological simulation with zero look-ahead bias. Trades execute using actual contract prices held, 
              subject to full Indian statutory commodity transaction costs (Exchange fee, CTT, Stamp Duty, SEBI, GST, Brokerage) 
              plus dynamic liquidity slippage. Performance is decomposed into pure Strategy Alpha vs Gold Market Beta.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-400">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Zero Look-Ahead Enforced</span>
          </div>
        </div>
      </div>

      {/* Interactive Parameter Control Panel */}
      <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Backtest Simulation Parameters</span>
          </h3>
          <button
            onClick={runBacktestExecution}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition cursor-pointer disabled:opacity-50 shadow-md shadow-amber-500/20"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Simulating...' : 'Run Simulation'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pair Selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-mono">Relative Value Pair</label>
            <select
              value={params.pairName}
              onChange={e => handleParamChange('pairName', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="GOLDM - GOLDPETAL">GOLDM - GOLDPETAL</option>
              <option value="GOLDM - GOLDGUINEA">GOLDM - GOLDGUINEA</option>
              <option value="GOLDM - GOLDTEN">GOLDM - GOLDTEN</option>
              <option value="GOLDTEN - GOLDPETAL">GOLDTEN - GOLDPETAL</option>
              <option value="GOLDTEN - GOLDGUINEA">GOLDTEN - GOLDGUINEA</option>
              <option value="GOLDPETAL - GOLDGUINEA">GOLDPETAL - GOLDGUINEA</option>
            </select>
          </div>

          {/* Entry Z-Score */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Entry Z-Score Threshold</span>
              <span className="text-amber-400 font-bold">{params.zEntryThreshold}σ</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={params.zEntryThreshold}
              onChange={e => handleParamChange('zEntryThreshold', parseFloat(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          {/* Exit Z-Score */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Exit Target Z-Score</span>
              <span className="text-cyan-400 font-bold">{params.zExitThreshold}σ</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.1"
              value={params.zExitThreshold}
              onChange={e => handleParamChange('zExitThreshold', parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* Transaction Cost Multiplier */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Friction Multiplier</span>
              <span className="text-rose-400 font-bold">{params.frictionMultiplier}x {params.frictionMultiplier === 0 ? '(Gross)' : '(MCX Statutory)'}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.25"
              value={params.frictionMultiplier}
              onChange={e => handleParamChange('frictionMultiplier', parseFloat(e.target.value))}
              className="w-full accent-rose-400"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Outcome Banner - Highlights the Analytical Rigor requirement */}
      {result && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
          result.costSurvived 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {result.costSurvived ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="font-bold text-sm mb-1">
              {result.costSurvived 
                ? 'Arbitrage Edge Survives Statutory Friction!' 
                : 'Rigorous Analytical Finding: No Persistent Edge Survives Transaction Costs'}
            </h4>
            <p className="m-0 text-slate-300">
              {result.costSurvived
                ? `The strategy generated gross profits of ₹${result.grossPnl.toLocaleString()} and retained a net profit of ₹${result.netPnl.toLocaleString()} after absorbing ₹${result.totalFriction.toLocaleString()} in exchange fees, CTT, stamp duty, and slippage.`
                : `Gross mean-reversion profits of ₹${result.grossPnl.toLocaleString()} were completely eroded by ₹${result.totalFriction.toLocaleString()} in cumulative statutory costs and execution slippage, yielding net PnL of ₹${result.netPnl.toLocaleString()}. This confirms that naive settlement price spreads cannot be extracted profitably by retail accounts without institutional fee concessions.`}
            </p>
          </div>
        </div>
      )}

      {/* Backtest KPI Grid */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Gross Strategy PnL"
            value={`₹${result.grossPnl.toLocaleString()}`}
            subtitle="Before transaction costs and slippage"
            trend={result.grossPnl >= 0 ? 'up' : 'down'}
          />

          <StatCard
            title="Total Friction Paid"
            value={`₹${result.totalFriction.toLocaleString()}`}
            subtitle="MCX fees (0.0021%), CTT (0.01%), Stamp (0.002%), SEBI, GST & Slippage"
            trend="down"
            badge={`Drag: ${result.grossPnl !== 0 ? Math.abs((result.totalFriction / (Math.abs(result.grossPnl) || 1)) * 100).toFixed(0) : 0}%`}
          />

          <StatCard
            title="Net Realized PnL"
            value={`₹${result.netPnl.toLocaleString()}`}
            subtitle={`Net Return on Capital: ${result.returnOnCapitalPct}%`}
            trend={result.netPnl >= 0 ? 'up' : 'down'}
            badge={result.netPnl >= 0 ? 'Profitable' : 'Unprofitable'}
          />

          <StatCard
            title="Performance Attribution"
            value={`Alpha: ${(result.alphaAnnualized * 100).toFixed(2)}%`}
            subtitle={`Gold Market Beta: ${result.betaToGold.toFixed(3)} (Beta-Neutral Pair)`}
            trend="gold"
          />

          <StatCard
            title="Sharpe & Sortino Ratios"
            value={result.sharpeRatio.toFixed(2)}
            subtitle={`Sortino: ${result.sortinoRatio.toFixed(2)} (Rf = 6.5% Annualized)`}
            trend={result.sharpeRatio > 1 ? 'up' : 'neutral'}
          />

          <StatCard
            title="Max Drawdown"
            value={`${result.maxDrawdownPct.toFixed(2)}%`}
            subtitle="Peak-to-trough capital decline"
            trend={result.maxDrawdownPct < 5 ? 'up' : 'down'}
          />

          <StatCard
            title="Win Rate & Trades"
            value={`${result.winRate.toFixed(1)}%`}
            subtitle={`${result.totalTrades} completed round-trip trades (Profit Factor: ${result.profitFactor})`}
            trend={result.winRate > 50 ? 'up' : 'neutral'}
          />

          <StatCard
            title="Cost Breakeven Multiple"
            value={`${result.breakevenFrictionMultiple.toFixed(2)}x`}
            subtitle={result.breakevenFrictionMultiple >= 1.0 ? 'Edge survives 100% statutory costs' : 'Requires fee discount to break even'}
            trend={result.breakevenFrictionMultiple >= 1.0 ? 'up' : 'down'}
          />
        </div>
      )}

      {/* Cumulative Equity Curve & Cost Sensitivity Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Equity Curve */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase font-mono tracking-wider">Mark-to-Market Net Equity Curve</h3>
              <p className="text-xs text-slate-400 font-sans">Walk-forward portfolio equity in INR (Initial Capital: ₹10,00,000)</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result?.dailyEquityCurve || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                  formatter={v => [`₹${v.toLocaleString()}`, 'Portfolio Equity']}
                />
                <ReferenceLine y={1000000} stroke="#64748b" strokeDasharray="3 3" label={{ value: 'Initial Capital', fill: '#64748b', fontSize: 10 }} />
                <Line type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cost Sensitivity Curve */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase font-mono tracking-wider">Friction Sensitivity & Breakeven Analysis</h3>
              <p className="text-xs text-slate-400 font-sans">Net PnL vs Transaction Cost Multiple (Demonstrating Edge vs Friction)</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sensitivityCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={v => `₹${v.toLocaleString()}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                  formatter={v => [`₹${v.toLocaleString()}`, 'Net PnL']}
                />
                <ReferenceLine y={0} stroke="#ef4444" />
                <Bar dataKey="netPnl" name="Net PnL" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Trade Execution Log */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">Executed Walk-Forward Trade Log (Actual Contracts Held)</h3>
          <span className="text-xs text-slate-400 font-mono">Showing last {result?.trades?.length || 0} trades</span>
        </div>
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2 px-3 font-semibold">#</th>
                <th className="py-2 px-3 font-semibold">Strategy Leg</th>
                <th className="py-2 px-3 font-semibold">Entry Date</th>
                <th className="py-2 px-3 font-semibold">Exit Date</th>
                <th className="py-2 px-3 font-semibold">Days</th>
                <th className="py-2 px-3 font-semibold">Entry Z</th>
                <th className="py-2 px-3 font-semibold">Exit Z</th>
                <th className="py-2 px-3 font-semibold">Gross PnL</th>
                <th className="py-2 px-3 font-semibold text-rose-400">Friction Paid</th>
                <th className="py-2 px-3 font-semibold">Net PnL</th>
                <th className="py-2 px-3 font-semibold">Exit Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {(result?.trades || []).map(t => (
                <tr key={t.tradeId} className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-500">{t.tradeId}</td>
                  <td className="py-2 px-3 font-bold text-amber-300">{t.type}</td>
                  <td className="py-2 px-3">{t.entryDate}</td>
                  <td className="py-2 px-3">{t.exitDate}</td>
                  <td className="py-2 px-3">{t.daysHeld}d</td>
                  <td className="py-2 px-3">{t.entryZ}σ</td>
                  <td className="py-2 px-3">{t.exitZ}σ</td>
                  <td className={`py-2 px-3 font-medium ${t.grossPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{t.grossPnl.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-rose-400">-₹{t.frictionPaid.toLocaleString()}</td>
                  <td className={`py-2 px-3 font-bold ${t.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{t.netPnl.toLocaleString()}
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      {t.exitReason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
