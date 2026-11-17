// ===== تنظیمات =====
// این نسخه به API نیاز ندارد و با داده شبیه‌سازی‌شده کار می‌کند
const SYMBOL = 'XAU/USD';

// ===== وضعیت =====
let running = false;
let balance = 10000;
let trades = [];
let lastPrice = null;
let openTrade = null;
let candles = [];
let intervalId = null;
let rowId = 0;
let basePrice = 2350; // قیمت پایه برای شبیه‌سازی

// ===== عناصر =====
const $ = id => document.getElementById(id);
const balanceEl = $('balance'), pnlEl = $('pnl'), priceEl = $('price');
const tradesCountEl = $('trades-count'), statusEl = $('status');
const startBtn = $('start-btn'), stopBtn = $('stop-btn');
const tradesBody = $('trades-body');

// ===== چارت =====
const chart = LightweightCharts.createChart($('chart-container'), {
  width: $('chart-container').clientWidth,
  height: 350,
  layout: { background: { color: '#1e222d' }, textColor: '#d1d4dc' },
  grid: { vertLines: { color: '#2a2e39' }, horzLines: { color: '#2a2e39' } },
  timeScale: { timeVisible: true },
});
const candleSeries = chart.addCandlestickSeries({
  upColor: '#26a69a', downColor: '#ef5350',
  borderUpColor: '#26a69a', borderDownColor: '#ef5350',
  wickUpColor: '#26a69a', wickDownColor: '#ef5350',
});
window.addEventListener('resize', () => chart.applyOptions({ width: $('chart-container').clientWidth }));

// ===== ساخت داده‌های شبیه‌سازی‌شده (بدون API) =====
function generateMockData(count = 200) {
  const data = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  const hour = 3600;

  for (let i = count; i >= 0; i--) {
    const time = now - (i * hour);
    // نوسان تصادفی برای شبیه‌سازی
    const change = (Math.random() - 0.5) * 8;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 4;
    const low = Math.min(open, close) - Math.random() * 4;
    
    data.push({
      time: time,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
    });
    
    price = close;
  }
  return data;
}

// ===== استراتژی MA =====
function sma(arr, period) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    out.push(arr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return out;
}

function checkSignal() {
  if (candles.length < 50) return null;
  const closes = candles.map(c => c.close);
  const fast = sma(closes, 10);
  const slow = sma(closes, 30);
  const i = closes.length - 1;
  if (!fast[i] || !slow[i] || !fast[i-1] || !slow[i-1]) return null;
  if (fast[i-1] <= slow[i-1] && fast[i] > slow[i]) return 'buy';
  if (fast[i-1] >= slow[i-1] && fast[i] < slow[i]) return 'sell';
  return null;
}

// ===== مدیریت معاملات =====
function openPosition(type) {
  if (openTrade) return;
  const sl = type === 'buy' ? lastPrice - 5 : lastPrice + 5;
  const tp = type === 'buy' ? lastPrice + 10 : lastPrice - 10;
  openTrade = { type, entry: lastPrice, sl, tp, time: Date.now() };
  addTradeRow(openTrade, 'در جریان...');
}

function closePosition(reason) {
  if (!openTrade) return;
  const exit = lastPrice;
  const diff = openTrade.type === 'buy' ? exit - openTrade.entry : openTrade.entry - exit;
  const pnl = diff * 10;
  balance += pnl;
  
  openTrade.exit = exit;
  openTrade.pnl = pnl;
  openTrade.reason = reason;
  trades.push(openTrade);
  
  updateTradeRow(openTrade);
  openTrade = null;
  updateStats();
}

function manageOpenTrade() {
  if (!openTrade) return;
  if (openTrade.type === 'buy') {
    if (lastPrice <= openTrade.sl) closePosition('حد ضرر (SL)');
    else if (lastPrice >= openTrade.tp) closePosition('حد سود (TP)');
  } else {
    if (lastPrice >= openTrade.sl) closePosition('حد ضرر (SL)');
    else if (lastPrice <= openTrade.tp) closePosition('حد سود (TP)');
  }
}

// ===== رابط کاربری =====
function addTradeRow(t, state) {
  const tr = document.createElement('tr');
  tr.id = 'trade-' + (++rowId);
  t._rowId = tr.id;
  tr.innerHTML = `
    <td>${trades.length + 1}</td>
    <td class="${t.type}">${t.type === 'buy' ? 'خرید 🟢' : 'فروش 🔴'}</td>
    <td>${t.entry.toFixed(2)}</td>
    <td>—</td>
    <td>—</td>
    <td style="color:#f0b90b">${state}</td>`;
  tradesBody.appendChild(tr);
  const empty = tradesBody.querySelector('.empty');
  if (empty) empty.parentElement.remove();
}

function updateTradeRow(t) {
  const tr = document.getElementById(t._rowId);
  if (!tr) return;
  tr.children[3].textContent = t.exit.toFixed(2);
  tr.children[4].textContent = (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2);
  tr.children[4].style.color = t.pnl >= 0 ? '#26a69a' : '#ef5350';
  tr.children[5].textContent = t.reason;
  tr.children[5].style.color = '#d1d4dc';
}

function updateStats() {
  balanceEl.textContent = '$' + balance.toFixed(2);
  const totalPnl = balance - 10000;
  pnlEl.textContent = (totalPnl >= 0 ? '+' : '') + '$' + totalPnl.toFixed(2);
  pnlEl.style.color = totalPnl >= 0 ? '#26a69a' : '#ef5350';
  tradesCountEl.textContent = trades.length;
}

// ===== موتور اصلی =====
function tick() {
  if (!running) return;
  
  // نوسان قیمت
  const delta = (Math.random() - 0.5) * 0.6;
  lastPrice = +(lastPrice + delta).toFixed(2);
  priceEl.textContent = lastPrice.toFixed(2);

  // آپدیت کندل
  const now = Math.floor(Date.now() / 1000);
  const lastCandle = candles[candles.length - 1];
  if (now - lastCandle.time >= 5) {
    const newCandle = { time: now, open: lastPrice, high: lastPrice, low: lastPrice, close: lastPrice };
    candles.push(newCandle);
    candleSeries.update(newCandle);
  } else {
    lastCandle.close = lastPrice;
    lastCandle.high = Math.max(lastCandle.high, lastPrice);
    lastCandle.low = Math.min(lastCandle.low, lastPrice);
    candleSeries.update(lastCandle);
  }

  manageOpenTrade();
  if (!openTrade) {
    const sig = checkSignal();
    if (sig) openPosition(sig);
  }
}

// ===== رویدادها =====
startBtn.onclick = () => {
  if (!candles.length) {
    // ساخت داده شبیه‌سازی‌شده
    candles = generateMockData(200);
    candleSeries.setData(candles);
    chart.timeScale().fitContent();
    lastPrice = candles[candles.length - 1].close;
    priceEl.textContent = lastPrice.toFixed(2);
  }
  
  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = 'RUNNING';
  statusEl.style.color = '#26a69a';
  
  if(intervalId) clearInterval(intervalId);
  intervalId = setInterval(tick, 1000);
};

stopBtn.onclick = () => {
  running = false;
  clearInterval(intervalId);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'STOPPED';
  statusEl.style.color = '#ef5350';
};

// ===== شروع اولیه (چارت با داده شبیه‌سازی‌شده پر می‌شود) =====
candles = generateMockData(200);
candleSeries.setData(candles);
chart.timeScale().fitContent();
lastPrice = candles[candles.length - 1].close;
priceEl.textContent = lastPrice.toFixed(2);