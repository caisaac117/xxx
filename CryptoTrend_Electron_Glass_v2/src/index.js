const navButtons = document.querySelectorAll('.nav');
navButtons.forEach(btn => btn.addEventListener('click', () => {
  navButtons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.dataset.visible = 'false');
  document.getElementById(btn.dataset.page).dataset.visible = 'true';
}));

document.getElementById('minBtn').addEventListener('click', () => window.api.minimize());
document.getElementById('maxBtn').addEventListener('click', () => window.api.maxrestore());
document.getElementById('closeBtn').addEventListener('click', () => window.api.close());

const genBtn = document.getElementById('genBtn');
const spinner = document.getElementById('spinner');
const mockToggle = document.getElementById('mockToggle');
const statusEl = document.getElementById('status');
const chartCanvas = document.getElementById('chart');
const ctx = chartCanvas.getContext('2d');

function setStatus(msg) { statusEl.textContent = msg; }

genBtn.addEventListener('click', async () => {
  genBtn.disabled = true;
  spinner.classList.remove('hidden');
  setStatus('Generating report…');
  try {
    let markdown;
    if (mockToggle.checked) {
      markdown = generateMockMarkdown();
      drawChart([1,2,3,4,3,4,5,6,5,6].map((v,i)=>({t:i, c:v*100})));
    } else {
      const data = await fetchLive('BTCUSDT','1h',90);
      drawChart(data.map((k,i)=>({t:i, c:Number(k[4])})));
      markdown = await generateLiveMarkdown();
    }
    const res = await window.api.generateReport(markdown);
    if (!res.ok) alert('Error: ' + res.error);
    else setStatus('Report saved to: ' + res.path);
  } catch (e) {
    alert('Error: ' + e);
    setStatus(String(e));
  } finally {
    spinner.classList.add('hidden');
    genBtn.disabled = false;
  }
});

function drawChart(points) {
  // simple line chart renderer
  ctx.clearRect(0,0,chartCanvas.width, chartCanvas.height);
  if (!points || points.length === 0) return;
  const pad = 20;
  const xs = points.map(p=>p.t);
  const ys = points.map(p=>p.c);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const sx = (x)=> pad + ( (x - xmin) / (xmax - xmin || 1) ) * (chartCanvas.width - 2*pad);
  const sy = (y)=> chartCanvas.height - pad - ( (y - ymin) / (ymax - ymin || 1) ) * (chartCanvas.height - 2*pad);
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#7AF2E3';
  points.forEach((p,i)=> {
    const x = sx(p.t), y = sy(p.c);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

async function fetchLive(symbol, interval, days) {
  // First try Binance
  try {
    await pingBinance(); // connectivity check
    const out = await fetchKlinesBinance(symbol, interval, days);
    if (out && out.length) return out;
  } catch (e) {
    console.warn('Binance failed, falling back to CoinGecko:', e);
  }
  // Fallback to CoinGecko market_chart? (uses day granularity)
  const cg = await fetchOHLCGecko(symbol.replace('USDT','').toLowerCase(), days);
  return cg.map(([t,o,h,l,c])=>[t,o,h,l,c,0]);
}

async function pingBinance() {
  const pong = await fetch('https://api.binance.com/api/v3/ping');
  if (!pong.ok) throw new Error('Binance ping failed: ' + pong.status);
}

async function fetchKlinesBinance(symbol, interval, days) {
  const ms = days * 24 * 60 * 60 * 1000;
  const start = Date.now() - ms;
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${start}&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Binance klines HTTP ' + res.status);
  return await res.json();
}

// CoinGecko fallback (daily candles)
async function fetchOHLCGecko(coinId, days) {
  // map coinId: btc->bitcoin, eth->ethereum, sol->solana
  const map = { btc:'bitcoin', eth:'ethereum', sol:'solana' };
  const id = map[coinId] || coinId;
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${Math.max(1, Math.min(90, days))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('CoinGecko OHLC HTTP ' + res.status);
  return await res.json();
}

function generateMockMarkdown() {
  const now = new Date().toISOString().slice(0,16).replace('T',' ');
  return [
    '# Crypto Trend Report (Mock)',
    `_Generated: ${now}_`,
    '## BTC/USDT', 'Close: **70000.00** | RSI: 54.2 | Regime: 1 | MACD hist: 0.0012',
    '## ETH/USDT', 'Close: **3800.00** | RSI: 51.0 | Regime: 1 | MACD hist: 0.0008',
    '## SOL/USDT', 'Close: **145.00** | RSI: 57.6 | Regime: -1 | MACD hist: -0.0002',
    '## News', '- (Add RSS fetch to index.js if desired for in-app headlines)',
    ''
  ].join('\n');
}

async function generateLiveMarkdown() {
  const symbols = ['BTCUSDT','ETHUSDT','SOLUSDT'];
  const results = await Promise.all(symbols.map(s => fetchLive(s, '1h', 90)));
  const lines = ['# Crypto Trend Report', `_Generated: ${new Date().toISOString().slice(0,16).replace('T',' ')}_`];
  results.forEach((r, idx) => {
    const sym = symbols[idx].replace('USDT','/USDT');
    if (!r || r.length === 0) {
      lines.push(`## ${sym}`,'(no data)');
      return;
    }
    const closes = r.map(k => Number(k[4]));
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const rsi14 = rsi(closes, 14);
    const macdh = macdHist(closes, 12, 26, 9);
    const close = closes[closes.length-1];
    const rsiLast = rsi14[rsi14.length-1] ?? 50;
    const mLast = macdh[macdh.length-1] ?? 0;
    const regime = (ema20[ema20.length-1] ?? 0) > (ema50[ema50.length-1] ?? 0) ? 1 : -1;
    lines.push(`## ${sym}`, `Close: **${close.toFixed(2)}** | RSI: ${rsiLast.toFixed(1)} | Regime: ${regime} | MACD hist: ${mLast.toFixed(4)}`);
  });
  lines.push('## News','(Add RSS headlines here — see index.js to wire your feeds)');
  return lines.join('\n');
}

// ----------- indicators (JS) -----------
function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  values.forEach((v, i) => {
    if (i === 0) { prev = v; out.push(v); return; }
    prev = v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}
function rsi(values, period=14) {
  const out = [NaN];
  let gains=0, losses=0;
  for (let i=1;i<values.length;i++) {
    const delta = values[i]-values[i-1];
    gains = (gains*(period-1) + Math.max(delta,0)) / period;
    losses = (losses*(period-1) + Math.max(-delta,0)) / period;
    const rs = losses === 0 ? 100 : gains / losses;
    const r = 100 - (100 / (1 + rs));
    out.push(r);
  }
  return out;
}
function macdHist(values, fast=12, slow=26, signal=9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = emaFast.map((v,i)=> v - (emaSlow[i]||0));
  const signalLine = ema(macdLine, signal);
  return macdLine.map((v,i)=> v - (signalLine[i]||0));
}
