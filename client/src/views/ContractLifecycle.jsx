import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Calendar, AlertTriangle, Clock, RefreshCw, AlertOctagon, CheckCircle2 } from 'lucide-react';

export default function ContractLifecycle() {
  const [calendar, setCalendar] = useState(null);
  const [oiCurve, setOiCurve] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('GOLDM');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalendar();
    fetchOiCurve('GOLDM');
  }, []);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const res = await api.getLifecycleCalendar();
      setCalendar(res);
    } catch (e) {
      console.error('Error fetching contract calendar:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOiCurve = async (sym) => {
    try {
      const res = await api.getOiLifecycleCurve(sym);
      setOiCurve(res.curve || []);
    } catch (e) {
      console.error('Error fetching OI curve:', e);
    }
  };

  const handleSymbolChange = (sym) => {
    setSelectedSymbol(sym);
    fetchOiCurve(sym);
  };

  const contracts = calendar?.contracts || [];
  const contractsInTender = contracts.filter(c => c.phase === 'TENDER_DELIVERY_PERIOD');
  const contractsInRoll = contracts.filter(c => c.phase === 'ROLL_RECOMMENDED');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Intro Header */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white tracking-tight m-0">Contract Lifecycle Planning & Tender Risk Calendar</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl m-0">
              Track contract maturity, liquidity development, and the critical 5-day Tender Delivery Period. 
              On MCX, holding contracts into the tender window triggers staggered 5%/day margin hikes and physical delivery obligations. 
              Plan your entries and roll-overs within the optimal prime liquidity window.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-400">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Tender Window: 5 Trading Days</span>
          </div>
        </div>
      </div>

      {/* Tender Period Danger Alert (if any contracts are currently in tender) */}
      {contractsInTender.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs leading-relaxed text-rose-300">
          <AlertOctagon className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm mb-1 text-rose-400 font-mono">
              CRITICAL NOTICE: {contractsInTender.length} Contract(s) Active in Tender Delivery Period
            </h4>
            <p className="m-0 text-slate-300">
              {contractsInTender.map(c => `${c.symbol} (${c.expiryDate})`).join(', ')} have entered or are within 7 calendar days of expiration. 
              Physical delivery matching occurs during this window. Speculative derivative strategies must square off or roll into next-month expiries immediately.
            </p>
          </div>
        </div>
      )}

      {/* Lifecycle KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Contracts Tracked"
          value={contracts.length}
          subtitle="Non-continuous series monitored across all bullion families"
          trend="neutral"
        />

        <StatCard
          title="Contracts in Tender Window"
          value={contractsInTender.length}
          subtitle="Staggered delivery margins active (Square-off mandatory for spec)"
          trend={contractsInTender.length > 0 ? 'down' : 'neutral'}
          badge={contractsInTender.length > 0 ? 'Danger' : 'Safe'}
        />

        <StatCard
          title="Contracts in Roll Window"
          value={contractsInRoll.length}
          subtitle="Prime 8-14 day window before expiry to roll forward"
          trend={contractsInRoll.length > 0 ? 'gold' : 'neutral'}
          badge="Roll Window"
        />

        <StatCard
          title="Calendar Reference Date"
          value={calendar?.referenceDate || 'Live'}
          subtitle="All contract horizons evaluated relative to exchange date"
          trend="neutral"
        />
      </div>

      {/* Open Interest & Liquidity Migration Lifecycle Curve */}
      <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 uppercase font-mono tracking-wider">
              {selectedSymbol} Open Interest & Liquidity Development Curve
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Tracking Open Interest (10g units) buildup from listing (60 DTE) to maturity (0 DTE)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {['GOLDM', 'GOLD', 'GOLDTEN', 'GOLDPETAL', 'GOLDGUINEA'].map(sym => (
              <button
                key={sym}
                onClick={() => handleSymbolChange(sym)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition cursor-pointer border ${
                  selectedSymbol === sym
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={oiCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="oiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="daysToExpiry" stroke="#64748b" tick={{ fontSize: 10 }} label={{ value: 'Days to Expiry (DTE) → (Expiry at 0)', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                labelFormatter={dte => `${dte} Days to Expiry`}
                formatter={v => [`${v.toLocaleString()} (10g Units)`, 'Open Interest']}
              />
              <ReferenceLine x={7} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Tender Window (7d)', fill: '#f43f5e', fontSize: 10 }} />
              <ReferenceLine x={14} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Peak Liquidity / Roll Window (14d)', fill: '#10b981', fontSize: 10 }} />
              <Area type="monotone" dataKey="openInterest10g" stroke="#f59e0b" fillOpacity={1} fill="url(#oiGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Contract Calendar Table */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
            Full Contract Lifecycle & Expiry Planning Calendar
          </h3>
          <span className="text-xs text-slate-400 font-mono">Non-continuous expiration series</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40">
                <th className="py-2.5 px-4 font-semibold">Symbol</th>
                <th className="py-2.5 px-4 font-semibold">Contract</th>
                <th className="py-2.5 px-4 font-semibold">Expiry Date</th>
                <th className="py-2.5 px-4 font-semibold">Days to Expiry</th>
                <th className="py-2.5 px-4 font-semibold">Tender Start Date</th>
                <th className="py-2.5 px-4 font-semibold">Days to Tender</th>
                <th className="py-2.5 px-4 font-semibold">Norm Price (₹/10g)</th>
                <th className="py-2.5 px-4 font-semibold">Lifecycle Phase</th>
                <th className="py-2.5 px-4 font-semibold">Roll Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {contracts.map((c, idx) => (
                <tr key={`${c.symbol}-${c.expiryDate}-${idx}`} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-bold text-white">{c.symbol}</td>
                  <td className="py-3 px-4 text-slate-300 font-sans">{c.contractName}</td>
                  <td className="py-3 px-4 text-amber-300 font-semibold">{c.expiryDate}</td>
                  <td className="py-3 px-4 font-bold">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${
                      c.daysToExpiry <= 7 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-200'
                    }`}>
                      {c.daysToExpiry}d
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{c.tenderStartDate}</td>
                  <td className="py-3 px-4 text-slate-300">{c.daysToTender}d</td>
                  <td className="py-3 px-4 font-bold text-slate-100">₹{c.latestNormPrice.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                      c.phase === 'TENDER_DELIVERY_PERIOD'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : c.phase === 'ROLL_RECOMMENDED'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {c.phaseBadge}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-sans max-w-xs">{c.rollRecommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
