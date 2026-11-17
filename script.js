// ===== 1. متغیرهای اصلی =====
let running = false;
let balance = 10000;
let trades = [];
let lastPrice = 2350.00;
let openTrade = null;
let candles = [];
let intervalId = null;
let rowId = 0;

// ===== 2. المان‌های صفحه =====
const $ = id => document.getElementById(id);
const balanceEl = $('balance'), pnlEl = $('pnl'), priceEl = $('price');
const tradesCountEl = $('trades-count'), statusEl = $('status');
const startBtn = $('start-btn'), stopBtn = $('stop-btn');
const tradesBody = $('trades-body');

// ===== 3. راه‌اندازی چارت =====
const chartContainer = $('chart-container');
const chart = LightweightCharts.createChart(chartContainer, {
  width: chartContainer.clientWidth,
  height: 350,
  layout: { background: { color: '#1e222d' }, textColor: '#d1d4dc' },
  grid: { vertLines: { color: '#2a2e39' }, horzLines: { color: '#2a2e39' } },
  timeScale: { timeVisible: true, secondsVisible: true },
});
const candleSeries = chart.addCandlestickSeries({
  upColor: '#26a69a', downColor: '#ef5350',
  borderUpColor: '#26a69a', borderDownColor: '#ef5350',
  wickUpColor: '#26a69a', wickDownColor: '#ef5350',
});

// ریسپانسیو کردن چارت
window.addEventListener('resize', () => {
  chart.applyOptions({ width: chartContainer.clientWidth });
});

// ===== 4. ساخت داده‌های اولیه چارت =====
function initData() {
  candles = [];
  let p = 2350.00;
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = 60; i >= 0; i--) {
    const open = p;
    const close = p + (Math.random() - 0.5) * 4;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    
    candles.push({
      time: now - (i * 60),
      open: +open.toFixed(2), high: +high.toFixed(2),
      low: +low.toFixed(2), close: +close.toFixed(2)
    });
    p = close;
  }
  
  candleSeries.setData(candles);
  chart.timeScale().fitContent();
  lastPrice = candles[candles.length - 1].close;
  priceEl.textContent = lastPrice.toFixed(2);
}

// ===== 5. منطق ربات و معاملات =====
function openPosition(type) {
  if (openTrade) return;
  
  const sl = type === 'buy' ? lastPrice - 4 : lastPrice + 4;
  const tp = type === 'buy' ? lastPrice + 8 : lastPrice - 8;
  
  openTrade = { type, entry: lastPrice, sl, tp, time: Date.now() };
  
  // اضافه کردن به جدول
  const tr = document.createElement('tr');
  tr.id = 'trade-' + (++rowId);
  openTrade._rowId = tr.id;
  tr.innerHTML = `
    <td>${trades.length + 1}</td>
    <td class="${type}">${type === 'buy' ? 'خرید 🟢' : 'فروش 🔴'}</td>
    <td>${lastPrice.toFixed(2)}</td>
    <td>—</td>
    <td>—</td>
    <td style="color:#f0b90b">در جریان...</td>`;
  
  const emptyRow = tradesBody.querySelector('.empty');
  if (emptyRow) emptyRow.parentElement.remove();
  tradesBody.appendChild(tr);
}

function closePosition(reason) {
  if (!openTrade) return;
  
  const exit = lastPrice;
  const diff = openTrade.type === 'buy' ? exit - openTrade.entry : openTrade.entry - exit;
  const pnl = diff * 20; // سود/زیان
  
  balance += pnl;
  openTrade.exit = exit;
  openTrade.pnl = pnl;
  openTrade.reason = reason;
  trades.push(openTrade);
  
  // آپدیت جدول
  const tr = document.getElementById(openTrade._rowId);
  if (tr) {
    tr.children[3].textContent = exit.toFixed(2);
    tr.children[4].textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(2);
    tr.children[4].style.color = pnl >= 0 ? '#26a69a' : '#ef5350';
    tr.children[5].textContent = reason;
    tr.children[5].style.color = '#d1d4dc';
  }
  
  openTrade = null;
  updateStats();
}

function updateStats() {
  balanceEl.textContent = '$' + balance.toFixed(2);
  const totalPnl = balance - 10000;
  pnlEl.textContent = (totalPnl >= 0 ? '+' : '') + '$' + totalPnl.toFixed(2);
  pnlEl.style.color = totalPnl >= 0 ? '#26a69a' : '#ef5350';
  tradesCountEl.textContent = trades.length;
}

// ===== 6. موتور اصلی (هر ثانیه اجرا میشود) =====
function tick() {
  if (!running) return;
  
  // تغییر قیمت شبیه‌سازی‌شده
  lastPrice = +(lastPrice + (Math.random() - 0.5) * 1.5).toFixed(2);
  priceEl.textContent = lastPrice.toFixed(2);
  
  // آپدیت آخرین کندل چارت
  const now = Math.floor(Date.now() / 1000);
  const lastCandle = candles[candles.length - 1];
  
  if (now - lastCandle.time >= 5) {
    // کندل جدید
    const newCandle = { time: now, open: lastPrice, high: lastPrice, low: lastPrice, close: lastPrice };
    candles.push(newCandle);
    candleSeries.update(newCandle);
  } else {
    // آپدیت کندل فعلی
    lastCandle.close = lastPrice;
    lastCandle.high = Math.max(lastCandle.high, lastPrice);
    lastCandle.low = Math.min(lastCandle.low, lastPrice);
    candleSeries.update(lastCandle);
  }
  
  // بررسی حد ضرر و حد سود
  if (openTrade) {
    if (openTrade.type === 'buy') {
      if (lastPrice <= openTrade.sl) closePosition('حد ضرر');
      else if (lastPrice >= openTrade.tp) closePosition('حد سود');
    } else {
      if (lastPrice >= openTrade.sl) closePosition('حد ضرر');
      else if (lastPrice <= openTrade.tp) closePosition('حد سود');
    }
  }
  
  // باز کردن معامله جدید (تصادفی برای تست)
  if (!openTrade && Math.random() < 0.05) {
    openPosition(Math.random() > 0.5 ? 'buy' : 'sell');
  }
}

// ===== 7. رویداد دکمه‌ها =====
startBtn.addEventListener('click', () => {
  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = 'RUNNING';
  statusEl.style.color = '#26a69a';
  
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(tick, 1000);
});

stopBtn.addEventListener('click', () => {
  running = false;
  clearInterval(intervalId);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'STOPPED';
  statusEl.style.color = '#ef5350';
});

// ===== 8. شروع به کار =====
initData();
