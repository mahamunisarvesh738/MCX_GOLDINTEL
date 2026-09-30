import React from 'react';

export default function StatCard({ title, value, subtitle, change, trend = 'neutral', badge, icon: Icon }) {
  const trendColors = {
    up: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    down: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    neutral: 'text-slate-400 bg-slate-800/40 border-slate-700/40',
    gold: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  };

  return (
    <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-4.5 hover:border-slate-700/80 transition shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
        {badge && (
          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-slate-100 tracking-tight">{value}</span>
        {change && (
          <span className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded border ${trendColors[trend] || trendColors.neutral}`}>
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed m-0">{subtitle}</p>
      )}
    </div>
  );
}
