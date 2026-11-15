function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// 하버사인 거리 계산 (샘플 데이터 생성 시드용)
function generateSampleData(days, seed) {
  let price = 50000 + (seed % 50000);
  const data = [];
  const d = new Date('2025-01-02');
  
  // Simple seeded random
  let s = seed || 42;
  function rand() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }

  for (let i = 0; i < days * 2; i++) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = (rand() - 0.48) * 0.035;
    const o = price;
    const h = o * (1 + Math.abs(rand() - 0.5) * 0.025);
    const l = o * (1 - Math.abs(rand() - 0.5) * 0.025);
    const c = o * (1 + change);
    price = c;
    data.push({ date: d.toISOString().substring(0, 10), open: Math.round(o), high: Math.round(h), low: Math.round(l), close: Math.round(c), volume: Math.round(rand() * 5000000 + 300000) });
    if (data.length >= days) break;
  }
  return data;
}

// 기술적 분석 계산
function calcIndicators(data) {
  for (let i = 0; i < data.length; i++) {
    // MA
    if (i >= 4) data[i].ma_5 = data.slice(i - 4, i + 1).reduce((s, r) => s + r.close, 0) / 5;
    else data[i].ma_5 = data[i].close;
    if (i >= 19) data[i].ma_20 = data.slice(i - 19, i + 1).reduce((s, r) => s + r.close, 0) / 20;
    else data[i].ma_20 = data[i].close;
    // RSI
    if (i >= 14) {
      let gains = 0, losses = 0;
      for (let j = i - 13; j <= i; j++) {
        const diff = data[j].close - data[j - 1].close;
        if (diff > 0) gains += diff; else losses -= diff;
      }
      const rs = gains / (losses || 1);
      data[i].RSI = 100 - 100 / (1 + rs);
    } else data[i].RSI = 50;
  }
  return data;
}

// 단일 전략 백테스팅
function runSingleBacktest(data, strategy) {
  let capital = 10000000;
  let peak = capital;
  let positions = {};
  let trades = [];
  const equity = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const prev = data[i - 1];
    const close = row.close;

    // 매도 체크
    const toRemove = [];
    for (const code in positions) {
      const pos = positions[code];
      const profitRate = (close - pos.buyPrice) / pos.buyPrice;
      const stopLoss = strategy.stop_loss || -0.03;
      const takeProfit = strategy.take_profit || 0.06;
      if (profitRate <= stopLoss || profitRate >= takeProfit) {
        capital += pos.quantity * close;
        trades.push({ stock: code, buy_date: pos.buyDate, sell_date: row.date, profit_rate: Math.round(profitRate * 10000) / 100, reason: profitRate <= stopLoss ? '손절' : '익절' });
        toRemove.push(code);
      }
    }
    toRemove.forEach(code => delete positions[code]);

    // 매수 체크 (단순 골든크로스)
    const posCount = Object.keys(positions).length;
    if (posCount < (strategy.max_positions || 3) && prev && row.ma_5 > row.ma_20 && prev.ma_5 <= prev.ma_20) {
      const size = strategy.position_size || 0.2;
      const amount = capital * size;
      const qty = Math.max(1, Math.floor(amount / close));
      if (qty > 0 && capital >= qty * close) {
        capital -= qty * close;
        positions['s' + (trades.length + 1)] = { buyPrice: close, quantity: qty, buyDate: row.date };
      }
    }

    const posVal = Object.values(positions).reduce((s, p) => s + p.quantity * close, 0);
    const total = capital + posVal;
    equity.push({ date: row.date, equity: total });
    if (total > peak) peak = total;
  }

  const finalEquity = capital + Object.values(positions).reduce((s, p) => s + p.quantity * data[data.length - 1].close, 0);
  const totalReturn = (finalEquity - 10000000) / 10000000;
  const winTrades = trades.filter(t => t.profit_rate > 0).length;
  const loseTrades = trades.filter(t => t.profit_rate < 0).length;

  // MDD
  let p = 10000000;
  let mdd = 0;
  for (const eq of equity) {
    if (eq.equity > p) p = eq.equity;
    const dd = (p - eq.equity) / p;
    if (dd > mdd) mdd = dd;
  }

  return {
    summary: {
      total_return: Math.round(totalReturn * 10000) / 100,
      win_rate: trades.length > 0 ? Math.round(winTrades / trades.length * 10000) / 100 : 0,
      max_drawdown: Math.round(mdd * 10000) / 100,
      profit_factor: Math.round((winTrades / Math.max(loseTrades, 1)) * 100) / 100,
      total_trades: trades.length,
      win_trades: winTrades,
      lose_trades: loseTrades,
    },
    trades: trades.slice(-20),
  };
}
const STRATEGIES = [
  { name: '골든크로스 + RSI + 볼린저밴드', category: 'General', position_size: 0.3, max_positions: 3, stop_loss: -0.03, take_profit: 0.06 },
  { name: 'YSN Momentum Burst', category: 'Momentum', position_size: 0.25, max_positions: 4, stop_loss: -0.04, take_profit: 0.08 },
  { name: 'YSN AI Reversal', category: 'Reversal', position_size: 0.2, max_positions: 3, stop_loss: -0.03, take_profit: 0.06 },
  { name: 'YSN Trend Following', category: 'Trend', position_size: 0.3, max_positions: 3, stop_loss: -0.05, take_profit: 0.12 },
  { name: 'YSN Scalping Pro', category: 'Scalping', position_size: 0.15, max_positions: 5, stop_loss: -0.015, take_profit: 0.025 },
  { name: 'YSN Breakout Hunter', category: 'Breakout', position_size: 0.2, max_positions: 4, stop_loss: -0.035, take_profit: 0.07 },
  { name: 'StockEasy 1호 - 모멘텀 Easy', category: 'Momentum', position_size: 0.2, max_positions: 5, stop_loss: -0.035, take_profit: 0.08 },
  { name: 'StockEasy 2호 - 피크 Easy', category: 'Breakout', position_size: 0.2, max_positions: 4, stop_loss: -0.04, take_profit: 0.1 },
  { name: 'StockEasy 3호 - 밸류 Easy', category: 'Value', position_size: 0.25, max_positions: 3, stop_loss: -0.06, take_profit: 0.15 },
  { name: 'StockEasy 4호 - 서프 Easy', category: 'Surprise', position_size: 0.15, max_positions: 5, stop_loss: -0.03, take_profit: 0.07 },
  { name: 'KOSPD ETF 모멘텀', category: 'ETF', position_size: 0.2, max_positions: 5, stop_loss: -0.03, take_profit: 0.06 },
  { name: 'KOSPD ETF 괴리율 역전', category: 'ETF', position_size: 0.15, max_positions: 3, stop_loss: -0.04, take_profit: 0.08 },
];

export async function handleApiBacktestRun(request, env, ctx) {
  const idx = new URL(request.url).searchParams.get('strategy');
  const strategy = STRATEGIES[parseInt(idx) || 0] || STRATEGIES[0];
  const data = calcIndicators(generateSampleData(252, 42));
  const result = runSingleBacktest(data, strategy);
  return json(result);
}

export async function handleApiBacktestRunAll(request, env, ctx) {
  const data = calcIndicators(generateSampleData(252, 42));
  const results = STRATEGIES.map(s => {
    const result = runSingleBacktest(data, s);
    return { name: s.name, category: s.category, result };
  });
  return json({ results });
}

export async function handleApiBacktestStrategies(request, env, ctx) {
  return json({ strategies: STRATEGIES.map((s, i) => ({ index: i, name: s.name, category: s.category })) });
}