import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import RelativeValueDashboard from './views/RelativeValueDashboard';
import TermStructureDashboard from './views/TermStructureDashboard';
import WalkForwardBacktest from './views/WalkForwardBacktest';
import IntelligenceSignals from './views/IntelligenceSignals';
import ContractLifecycle from './views/ContractLifecycle';
import DataIngestionManager from './views/DataIngestionManager';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('relative-value');
  const [latestMarket, setLatestMarket] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshAllData();
  }, []);

  const refreshAllData = async () => {
    try {
      setIsRefreshing(true);
      const [mkt, intel] = await Promise.all([
        api.getLatestMarket(),
        api.getIntelligenceOverview()
      ]);
      setLatestMarket(mkt);
      setIntelligence(intel);
    } catch (e) {
      console.error('Error refreshing market data:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const actionableCount = intelligence?.metrics?.actionableSignals || 0;

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Terminal Header */}
      <Header
        latestMarket={latestMarket}
        onRefresh={refreshAllData}
        isRefreshing={isRefreshing}
      />

      {/* Main Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        actionableCount={actionableCount}
      />

      {/* Dynamic View Content */}
      <main className="flex-1 pb-16">
        {activeTab === 'relative-value' && <RelativeValueDashboard />}
        {activeTab === 'term-structure' && <TermStructureDashboard />}
        {activeTab === 'backtest' && <WalkForwardBacktest />}
        {activeTab === 'intelligence' && <IntelligenceSignals />}
        {activeTab === 'lifecycle' && <ContractLifecycle />}
        {activeTab === 'ingestion' && <DataIngestionManager onDataIngested={refreshAllData} />}
      </main>

      {/* Institutional Quant Terminal Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070a12] py-4 px-6 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-semibold">GOLDINTEL Terminal</span>
            <span className="text-slate-700">|</span>
            <span>PERN Stack (PostgreSQL, Express, React, Node.js)</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Engine Status: Nominal</span>
            </span>
            <span className="text-slate-700">|</span>
            <span>Statutory Friction Engine: Active</span>
            <span className="text-slate-700">|</span>
            <span className="text-amber-400">Render Deployment Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
