import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Database, Clock, RefreshCw, Zap } from 'lucide-react';

export default function Header({ latestMarket, onRefresh, isRefreshing }) {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const benchmarkGold = latestMarket?.contracts?.find(c => c.symbol === 'GOLDM') || latestMarket?.contracts?.[0];

  return (
    <header className="border-b border-slate-800 bg-[#0c1220]/95 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/30">
            <Zap className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white m-0">MCX BULLION<span className="text-amber-400 font-extrabold">INTEL</span></h1>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">PROTOTYPE</span>
            </div>
            <p className="text-xs text-slate-400 font-medium m-0">Commodity Derivatives Cross-Contract Intelligence Terminal</p>
          </div>
        </div>

        {/* Live Metrics Ticker */}
        {benchmarkGold && (
          <div className="hidden lg:flex items-center gap-6 px-4 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Normalized Benchmark (999 Fine):</span>
              <span className="ml-2 font-mono font-bold text-amber-400">₹{parseFloat(benchmarkGold.price_norm_10g_999).toLocaleString()}<span className="text-slate-500 text-xs">/10g</span></span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">Reference Trade Date:</span>
              <span className="ml-2 font-mono font-medium text-slate-200">{latestMarket.tradeDate || 'Live'}</span>
            </div>
          </div>
        )}

        {/* System Status and Live Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>MCX BHAVCOPY: ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer disabled:opacity-50"
            title="Refresh Market Analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
}
