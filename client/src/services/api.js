import axios from 'axios';

const API_BASE = '/api';

export const api = {
  // Market
  getContracts: () => axios.get(`${API_BASE}/market/contracts`).then(r => r.data),
  getLatestMarket: () => axios.get(`${API_BASE}/market/latest`).then(r => r.data),
  getContractHistory: (symbol, limit = 120) => axios.get(`${API_BASE}/market/history/${symbol}?limit=${limit}`).then(r => r.data),

  // Relative Value
  getPairs: () => axios.get(`${API_BASE}/relative-value/pairs`).then(r => r.data),
  getRelativeValueSnapshot: () => axios.get(`${API_BASE}/relative-value/snapshot`).then(r => r.data),
  getPairHistory: (pairName, limit = 180) => axios.get(`${API_BASE}/relative-value/history?pair=${encodeURIComponent(pairName)}&limit=${limit}`).then(r => r.data),

  // Carry & Term Structure
  getTermStructure: (date) => axios.get(`${API_BASE}/carry/term-structure${date ? `?date=${date}` : ''}`).then(r => r.data),
  getRollDown: (symbol = 'GOLDM', windowDays = 15) => axios.get(`${API_BASE}/carry/roll-down?symbol=${symbol}&window=${windowDays}`).then(r => r.data),

  // Backtest
  runBacktest: (params) => axios.post(`${API_BASE}/backtest/run`, params).then(r => r.data),
  getCostSensitivity: (params) => axios.post(`${API_BASE}/backtest/cost-sensitivity`, params).then(r => r.data),

  // Intelligence
  getIntelligenceOverview: () => axios.get(`${API_BASE}/intelligence/overview`).then(r => r.data),

  // Lifecycle
  getLifecycleCalendar: (date) => axios.get(`${API_BASE}/lifecycle/calendar${date ? `?date=${date}` : ''}`).then(r => r.data),
  getOiLifecycleCurve: (symbol = 'GOLDM') => axios.get(`${API_BASE}/lifecycle/oi-curve?symbol=${symbol}`).then(r => r.data),

  // Ingestion
  uploadCsv: (formData) => axios.post(`${API_BASE}/ingestion/upload-csv`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data),
  validateDate: (data) => axios.post(`${API_BASE}/ingestion/validate-date`, data).then(r => r.data)
};
