# CryptoTrend — Electron Glass (Live + Fallback)

**This version actually fetches live data**:
- Primary: Binance public API (1h klines)
- Fallback: CoinGecko OHLC (daily) if Binance is blocked

Also shows an inline **line chart** (no external libraries), status messages, and saves a Markdown report to **Documents**.

## How to get the EXE (no installs on your PC)
1. Push this folder to a new GitHub repo.
2. Go to **Actions** → run **Build Windows EXE (Electron)**.
3. Download the **CryptoTrendGlass-Windows** artifact → inside is **CryptoTrendGlass.exe**. Double-click to run.

## Local dev (optional)
```bash
npm install
npm start
# build exe locally
npm run dist
```
