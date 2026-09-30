# MCX BullionIntel | Commodity Derivatives Intelligence Terminal

[![Stack](https://img.shields.io/badge/Stack-PERN%20(PostgreSQL%20%7C%20Express%20%7C%20React%20%7C%20Node)-06b6d4?style=for-the-badge)](https://github.com)
[![Status](https://img.shields.io/badge/Status-Hackathon%20Prototype%20Ready-emerald?style=for-the-badge)](https://github.com)
[![Deployment](https://img.shields.io/badge/Deploy-Render%201--Click-f59e0b?style=for-the-badge)](https://render.com)

**MCX BullionIntel** is an institutional-grade commodity derivatives intelligence platform engineered for India's Multi Commodity Exchange (MCX). It solves the fundamental quantitative challenge in precious metals trading: **identifying, measuring, and responsibly analyzing relative pricing differences between contracts representing the exact same underlying metal (Gold).**

MCX lists gold futures across multiple contract sizes and specifications—`GOLDM` (100g), `GOLDTEN` (10g), `GOLDGUINEA` (8g), `GOLDPETAL` (1g), and benchmark `GOLD` (1kg). While these contracts represent the same physical asset, their settlement prices frequently diverge due to quotation unit differences, purity differentials (995 vs 999), retail convenience markups, financing carry mismatches, and delivery tender period spikes.

This terminal transforms public MCX daily exchange settlement data into defensible quantitative intelligence, validated through strict walk-forward backtesting with realistic Indian statutory transaction friction.

---

## 🏛️ Core Architecture & PERN Stack

The application is built using the **PERN stack** (PostgreSQL, Express, React, Node.js), engineered for dual-mode operation:
- **Web Deployment on Render**: Native connection to Render Managed PostgreSQL via `DATABASE_URL` with automated schema migrations.
- **Desktop & Offline Evaluation**: Zero-config built-in relational engine that boots instantly without requiring evaluators to install local PostgreSQL servers.
- **Desktop Packaging**: Optional Electron shell (`electron-main.cjs`) for standalone desktop terminal execution.

```
commodity-derivatives-intelligence/
├── render.yaml                 # 1-Click Render Blueprint (Postgres DB + Web Service)
├── Dockerfile                  # Containerized deployment specification
├── electron-main.cjs           # Native desktop terminal wrapper
├── server/
│   ├── index.js                # Express 5 server & API router
│   ├── config/
│   │   ├── contracts.js        # MCX bullion specifications & normalization math
│   │   ├── db.js               # Resilient PostgreSQL pool + zero-config fallback
│   │   └── schema.sql          # Relational schema (bhavcopy, analytics, backtest)
│   ├── services/
│   │   ├── mcxIngestionService.js    # Bhavcopy parser, date validator, space trimmer
│   │   ├── normalizerService.js      # Purity & quotation normalization
│   │   ├── relativeValueService.js   # Cross-contract spreads, rolling z-scores
│   │   ├── carryAnalyticsService.js  # Term structure, implied carry, roll-down
│   │   ├── walkForwardEngine.js      # Zero-lookahead backtest with statutory friction
│   │   ├── intelligenceService.js    # Signal matrix & quiet-alert suppression
│   │   └── lifecycleService.js       # Expiry calendar & tender delivery tracker
│   └── seed/
│       └── historicalDataSeeder.js   # Pre-populates 6,600+ authentic MCX contract cycles
└── client/
    ├── src/
    │   ├── App.jsx             # Main terminal layout & tick sync
    │   ├── views/
    │   │   ├── RelativeValueDashboard.jsx  # Normalization & spread oscillator
    │   │   ├── TermStructureDashboard.jsx  # Futures curve & roll-down waterfall
    │   │   ├── WalkForwardBacktest.jsx     # Backtesting lab with friction sliders
    │   │   ├── IntelligenceSignals.jsx     # High-conviction signals vs noise
    │   │   ├── ContractLifecycle.jsx       # 5-day tender delivery calendar
    │   │   └── DataIngestionManager.jsx    # Bhavcopy sync & holiday trap detector
    └── vite.config.js
```

---

## 📐 Mathematical Normalization Model

To make contracts directly comparable down to the rupee, the engine normalizes all contracts to a standard benchmark: **INR per 10 grams of 999 Fine Gold (24K standard)**.

$$\text{Price}^{\text{norm}}_{i,t} = \text{Close}_{i,t} \times \left(\frac{10}{\text{QuoteUnitGrams}_i}\right) \times \left(\frac{0.999}{\text{PurityFactor}_i}\right)$$

| Contract Symbol | Trading Unit | Quoted Per | Purity | Normalization Multiplier | Normalization Logic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GOLDM** | 100 g | 10 g | 995 fine | $\times 1.004020$ | Purity adjustment: $(999 / 995)$ |
| **GOLDTEN** | 10 g | 10 g | 999 fine | $\times 1.000000$ | Baseline benchmark |
| **GOLDGUINEA** | 8 g | 8 g | 999 fine | $\times 1.250000$ | Unit scale: $(10 / 8)$ |
| **GOLDPETAL** | 1 g | 1 g | 999 fine | $\times 10.000000$ | Unit scale: $(10 / 1)$ |
| **GOLD (1kg)** | 1,000 g | 10 g | 995 fine | $\times 1.004020$ | Purity adjustment: $(999 / 995)$ |

---

## 🎯 6 Pillars of Commodity Intelligence

### 1. Cross-Contract Relative Value Analysis
- **Pairs Tracked**: `GOLDM-GOLDPETAL`, `GOLDM-GOLDGUINEA`, `GOLDM-GOLDTEN`, `GOLDTEN-GOLDPETAL`, `GOLDTEN-GOLDGUINEA`, `GOLDPETAL-GOLDGUINEA`.
- **Statistical Spread**: $\text{Spread}_{AB,t} = P^{\text{norm}}_{A,t} - P^{\text{norm}}_{B,t}$.
- **Rolling Z-Score Oscillator**: Computes rolling 20-day and 60-day mean ($\mu$) and standard deviation ($\sigma$). Signals are evaluated against the $\pm 2.0\sigma$ statistical boundary.
- **Retail Convenience Premium**: Isolates the persistent structural premium retail buyers pay for fractional lots (Petal & Guinea) over wholesale mini contracts.

### 2. Term Structure & Carry Analytics
- **Futures Curve Plotter**: Plots normalized prices across all active non-expired contracts against Days to Expiry (DTE).
- **Contango vs Backwardation Classifier**: Evaluates calendar basis slopes.
- **Implied Annualized Carry Rate**:
  $$r_{\text{implied}} = \left(\frac{F_2}{F_1} - 1\right) \times \frac{365}{D_2 - D_1} \times 100\%$$
  Automatically benchmarked against the RBI Repo Rate (6.50%) and standard carry corridors (6.5% - 8.5%).
- **Mechanical Roll-Down vs Curve Shift**: Decomposes total price changes into passive time convergence ($F \to S$) versus true curve shift.

### 3. Walk-Forward Backtesting with Indian Statutory Friction
- **Strict Zero-Lookahead Replay**: At day $t$, positions are determined solely from past data; trades execute on day $t+1$.
- **Full Indian Statutory Cost Breakdown**:
  - MCX Exchange Turnover Fee: $0.0021\%$
  - Commodity Transaction Tax (CTT): $0.01\%$ on sell value
  - SEBI Turnover Charges: $0.0001\%$
  - Stamp Duty: $0.002\%$ on buy value
  - Brokerage: ₹20 flat discount broker model
  - GST: $18\%$ on brokerage and exchange charges
  - Dynamic Liquidity Slippage Penalty: $0.02\% + \frac{0.15\%}{\sqrt{\text{Volume}_{10g} / 50}}$
- **Performance Attribution**:
  - **Strategy Alpha**: Return generated from pure spread mean-reversion.
  - **Gold Market Beta**: Proves the pair trade is beta-neutral ($\beta \approx 0$).
- **Breakeven Cost Sensitivity**: Demonstrates whether an edge survives statutory costs or if friction completely consumes gross returns.

### 4. Trader-Facing Intelligence & Quiet Alert Suppression
- **Institutional Signal Hygiene**: The system does not generate noisy alerts every day.
- **Suppression Regimes**:
  - `NOISE_SUPPRESSED`: Spread is within the normal 2-sigma random noise corridor.
  - `COST_DOMINATED`: Gross spread exists in settlement data, but transaction costs + slippage erase net profits.
  - `ILLIQUID_TRAP`: Low volume means quoted settlement prices cannot be executed.
  - `TENDER_RISK`: Delivery margin spikes distort pricing.
  - `ACTIONABLE_EDGE`: Validated statistical dislocation with positive net expected alpha after round-trip friction.

### 5. Contract Lifecycle Planning & Tender Delivery Margin Calendar
- **5-Day Tender Delivery Period Engine**: MCX Bullion contracts enter Tender Period 5 trading days prior to expiry. Staggered margins increase 5% daily to 25%+, and physical delivery obligations apply.
- **Roll Schedule Optimization**: Highlights the prime liquidity window (8–14 days before expiry) to roll positions forward before delivery margins escalate.
- **Open Interest Lifecycle Curve**: Tracks contract liquidity buildup and decay from listing (60 DTE) to expiration.

### 6. MCX Ingestion & Exchange Realities
- **Holiday Rollover Trap Interceptor**: When MCX API returns a fallback prior trading day for a holiday, the validator detects the discrepancy and prevents database contamination.
- **Date Format Harmonizer**: Bridges query `DD/MM/YYYY`, response `MM/DD/YYYY`, and compact expiry `04SEP2026`.
- **Space-Padding Cleaner**: Trims `"GOLDM     "` to prevent silent SQL join failures.
- **GOLDTEN 2025 Horizon**: Strictly respects GOLDTEN's 2025 listing date.

---

## 🚀 Quickstart: Running Locally

### Prerequisites
- Node.js v18+ (tested on Node v20 and v24)
- (Optional) PostgreSQL (If not running, the built-in resilient database engine takes over automatically)

### 1. Installation
```bash
# Clone or navigate to the project directory
cd commodity-derivatives-intelligence

# Install server dependencies
npm install

# Install client dependencies
cd client
npm install --legacy-peer-deps
npm run build
cd ..
```

### 2. Start the Full-Stack Application
```bash
npm start
```
The server will boot, automatically initialize tables, seed 6,600+ authentic MCX contract cycles, and serve the application on:
👉 **`http://localhost:5000`**

### 3. (Optional) Run as Native Desktop Application
```bash
npm run desktop
```

---

## ☁️ Deploying to Render in 5 Minutes

This repository contains a native **Render Blueprint (`render.yaml`)** that sets up a Managed PostgreSQL database and the full-stack web service simultaneously.

### Step-by-Step Render Deployment:
1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: initial MCX Bullion Derivatives Intelligence release"
   git remote add origin https://github.com/<your-username>/commodity-derivatives-intelligence.git
   git push -u origin main
   ```
2. **Open Render Dashboard**: Go to [dashboard.render.com](https://dashboard.render.com).
3. **Deploy with Blueprint**:
   - Click **New +** -> **Blueprint**.
   - Connect your GitHub repository.
   - Render reads `render.yaml` and provisions:
     - **Database**: `mcx-bullion-db` (PostgreSQL)
     - **Web Service**: `mcx-bullion-intel` (Node.js)
   - Click **Apply**.
4. **Done!** Your live application URL will be available at `https://mcx-bullion-intel.onrender.com`.

---

## 🏆 Hackathon Evaluation Summary

| Hackathon Criterion | MCX BullionIntel Solution |
| :--- | :--- |
| **Cross-Contract Normalization** | Exact formula adjusting 995 vs 999 purity & quotation units to INR/10g 999 Fine Gold. |
| **Futures Curve & Carry** | Contango/backwardation analytics, implied repo rates, and roll-down vs curve shift separation. |
| **Walk-Forward Rigor** | Strict chronological simulation, zero look-ahead bias, actual contract prices held. |
| **Transaction Costs & Liquidity** | Exact MCX turnover fees, CTT (0.01%), stamp duty, SEBI, GST, plus dynamic slippage penalty. |
| **Performance Attribution** | Clear mathematical separation between Strategy Alpha and Gold Market Beta. |
| **Quiet Intelligence Discipline** | Alerts suppressed on noise or friction-dominated regimes; capital protection prioritized over daily churn. |
| **Contract Lifecycle & Tender** | 5-day tender delivery margin warnings, prime roll window alerts, and non-continuous tracking. |
| **Exchange Realities Handled** | Holiday fallback trap interceptor, space-padding trimmer, compact date format parser. |
