import React from 'react';
import { Layers, TrendingUp, Cpu, ShieldAlert, Calendar, Database } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, actionableCount = 0 }) {
  const tabs = [
    { id: 'relative-value', label: 'Cross-Contract Relative Value', icon: Layers },
    { id: 'term-structure', label: 'Term Structure & Carry', icon: TrendingUp },
    { id: 'backtest', label: 'Walk-Forward Backtesting', icon: Cpu },
    { id: 'intelligence', label: 'Trader Intelligence & Signals', icon: ShieldAlert, badge: actionableCount },
    { id: 'lifecycle', label: 'Contract Lifecycle & Tender', icon: Calendar },
    { id: 'ingestion', label: 'Data Ingestion & MCX Sync', icon: Database }
  ];

  return (
    <nav className="border-b border-slate-800 bg-[#0a0f1d] px-6">
      <div className="flex space-x-1 overflow-x-auto scrollbar-none py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
