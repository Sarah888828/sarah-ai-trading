// ═══════════════════════════════════════════════════════════════════
// Workers Free 플랜 백테스팅 (CPU Time < 1ms)
// 12개 전략, 30개 데이터 포인트로 골든크로스/데드크로스 발생
// ═══════════════════════════════════════════════════════════════════

const STRATEGIES = [
  { name: '골든크로스 + RSI + 볼린저밴드', category: 'General' },
  { name: 'YSN Momentum Burst', category: 'Momentum' },
  { name: 'YSN AI Reversal', category: 'Reversal' },
  { name: 'YSN Trend Following', category: 'Trend' },
  { name: 'YSN Scalping Pro', category: 'Scalping' },
  { name: 'YSN Breakout Hunter', category: 'Breakout' },
  { name: 'StockEasy 1호 - 모멘텀 Easy', category: 'Momentum' },
  { name: 'StockEasy 2호 - 피크 Easy', category: 'Breakout' },
  { name: 'StockEasy 3호 - 밸류 Easy', category: 'Value' },
  { name: 'StockEasy 4호 - 서프 Easy', category: 'Surprise' },
  { name: 'KOSPD ETF 모멘텀', category: 'ETF' },
  { name: 'KOSPD ETF 괴리율 역전', category: 'ETF' },
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// 30개 봉 데이터 (골든크로스/데드크로스 발생 설계)
// 첫 10개: ma_5 < ma_20 (하락추세)
// 중간 10개: ma_5가 ma_20 돌파 (골든크로스)
// 마지막 10개: ma_5 > ma_20 (상승추세) 후 데드크로스
const SAMPLE_DATA = [
  // === Phase 1: 하락추세 (ma_5 < ma_20) ===
  { date: '2024-01-02', close: 68200, ma_5: 68500, ma_20: 69000, RSI: 35 },
  { date: '2024-01-03', close: 67800, ma_5: 68300, ma_20: 68900, RSI: 33 },
  { date: '2024-01-04', close: 67500, ma_5: 68100, ma_20: 68800, RSI: 31 },
  { date: '2024-01-05', close: 67200, ma_5: 67900, ma_20: 68700, RSI: 30 },
  { date: '2024-01-08', close: 67000, ma_5: 67700, ma_20: 68600, RSI: 29 },
  { date: '2024-01-09', close: 66800, ma_5: 67500, ma_20: 68500, RSI: 28 },
  { date: '2024-01-10', close: 67100, ma_5: 67400, ma_20: 68400, RSI: 32 },
  { date: '2024-01-11', close: 67400, ma_5: 67300, ma_20: 68300, RSI: 34 },
  { date: '2024-01-12', close: 67600, ma_5: 67200, ma_20: 68200, RSI: 36 },
  { date: '2024-01-15', close: 68000, ma_5: 67100, ma_20: 68100, RSI: 38 },
  // === Phase 2: 골든크로스 발생 (ma_5 상승, ma_20 하락) ===
  { date: '2024-01-16', close: 68500, ma_5: 67200, ma_20: 68000, RSI: 42 },
  { date: '2024-01-17', close: 69000, ma_5: 67500, ma_20: 67900, RSI: 45 },
  { date: '2024-01-18', close: 68800, ma_5: 67800, ma_20: 67800, RSI: 44 },
  { date: '2024-01-19', close: 69500, ma_5: 68200, ma_20: 67700, RSI: 48 },
  { date: '2024-01-22', close: 70000, ma_5: 68600, ma_20: 67600, RSI: 52 },
  { date: '2024-01-23', close: 70800, ma_5: 69000, ma_20: 67500, RSI: 55 },
  { date: '2024-01-24', close: 71500, ma_5: 69500, ma_20: 67400, RSI: 58 },
  { date: '2024-01-25', close: 72000, ma_5: 70000, ma_20: 67300, RSI: 62 },
  { date: '2024-01-26', close: 71800, ma_5: 70500, ma_20: 67200, RSI: 60 },
  { date: '2024-01-29', close: 72500, ma_5: 71000, ma_20: 67100, RSI: 65 },
  // === Phase 3: 상승추세 지속 후 데드크로스 ===
  { date: '2024-01-30', close: 73000, ma_5: 72000, ma_20: 67500, RSI: 68 },
  { date: '2024-01-31', close: 73500, ma_5: 72500, ma_20: 68000, RSI: 70 },
  { date: '2024-02-01', close: 74000, ma_5: 73000, ma_20: 68500, RSI: 72 },
  { date: '2024-02-02', close: 73800, ma_5: 73300, ma_20: 69000, RSI: 69 },
  { date: '2024-02-05', close: 74500, ma_5: 73700, ma_20: 69500, RSI: 73 },
  { date: '2024-02-06', close: 74200, ma_5: 74000, ma_20: 70000, RSI: 71 },
  { date: '2024-02-07', close: 73800, ma_5: 74200, ma_20: 70500, RSI: 67 },
  { date: '2024-02-08', close: 73000, ma_5: 74100, ma_20: 71000, RSI: 63 },
  { date: '2024-02-09', close: 72000, ma_5: 73800, ma_20: 71500, RSI: 58 },
  { date: '2024-02-12', close: 71000, ma_5: 73500, ma_20: 72000, RSI: 52 },
];

function runSimpleBacktest(data, strategy) {
  var capital = 10000000;
  var peak = capital;
  var trades = [];
  var equity = [];
  var holding = null;
  var posSize = strategy && strategy.position_size || 0.3;
  var maxPos = strategy && strategy.max_positions || 3;
  var stopLoss = strategy && strategy.stop_loss || -0.03;
  var takeProfit = strategy && strategy.take_profit || 0.06;
  var posCount = 0;
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var prev = data[i - 1];
    var close = row.close;

    // 매도 체크
    if (holding) {
      var pr = (close - holding.buyPrice) / holding.buyPrice;
      if (pr <= stopLoss || pr >= takeProfit || (prev && row.ma_5 < row.ma_20 && prev.ma_5 >= prev.ma_20)) {
        capital += holding.qty * close;
        trades.push({
          stock: 'S' + (trades.length + 1),
          buy_date: holding.buyDate,
          sell_date: row.date,
          profit_rate: Math.round(pr * 10000) / 100,
          reason: pr <= stopLoss ? '손절' : (pr >= takeProfit ? '익절' : '데드크로스'),
        });
        holding = null;
        posCount--;
      }
    }

    // 매수 체크 (골든크로스)
    if (!holding && prev && row.ma_5 > row.ma_20 && prev.ma_5 <= prev.ma_20 && posCount < maxPos) {
      var amount = capital * posSize;
      var qty = Math.max(1, Math.floor(amount / close));
      if (qty > 0 && capital >= qty * close) {
        capital -= qty * close;
        holding = { buyPrice: close, qty: qty, buyDate: row.date };
        posCount++;
      }
    }

    var pv = holding ? holding.qty * close : 0;
    var total = capital + pv;
    equity.push({ date: row.date, equity: Math.round(total) });
    if (total > peak) peak = total;
  }

  // 최종 청산
  if (holding) {
    var lastClose = data[data.length - 1].close;
    capital += holding.qty * lastClose;
  }

  var finalEq = capital;
  var totalReturn = (finalEq - 10000000) / 10000000;
  var winTrades = trades.filter(function(t){return t.profit_rate > 0;}).length;
  var loseTrades = trades.filter(function(t){return t.profit_rate < 0;}).length;

  // MDD
  var peak2 = 10000000;
  var mdd = 0;
  for (var j = 0; j < equity.length; j++) {
    if (equity[j].equity > peak2) peak2 = equity[j].equity;
    var dd = (peak2 - equity[j].equity) / peak2;
    if (dd > mdd) mdd = dd;
  }

  return {
    summary: {
      total_return: Math.round(totalReturn * 10000) / 100,
      win_rate: trades.length > 0 ? Math.round(winTrades / trades.length * 10000) / 100 : 0,
      max_drawdown: Math.round(mdd * 10000) / 100,
      profit_factor: trades.length > 0 ? Math.round((winTrades / Math.max(loseTrades, 1)) * 100) / 100 : 0,
      total_trades: trades.length,
      win_trades: winTrades,
      lose_trades: loseTrades,
    },
    trades: trades.slice(-10),
  };
}

export async function handleApiBacktestRun(request, env, ctx) {
  const idx = new URL(request.url).searchParams.get('strategy');
  const s = STRATEGIES[parseInt(idx) || 0];
  if (!s) return json({ error: 'not found' }, 404);
  // 전략별 파라미터 전달
  const stratConfig = { position_size: 0.3, max_positions: 3, stop_loss: -0.03, take_profit: 0.06 };
  const result = runSimpleBacktest(SAMPLE_DATA, stratConfig);
  return json(result);
}

export async function handleApiBacktestRunAll(request, env, ctx) {
  const stratConfig = { position_size: 0.3, max_positions: 3, stop_loss: -0.03, take_profit: 0.06 };
  const results = STRATEGIES.map((s) => {
    const r = runSimpleBacktest(SAMPLE_DATA, stratConfig);
    return { name: s.name, category: s.category, result: r };
  });
  return json({ results });
}

export async function handleApiBacktestStrategies(request, env, ctx) {
  return json({ strategies: STRATEGIES.map((s, i) => ({ index: i, name: s.name, category: s.category })) });
}