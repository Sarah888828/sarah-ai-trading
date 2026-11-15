// Durable Object: 24/7 실행되는 트레이딩 코어
// - CPU Time 제한 없음, 상태 유지, 단일 스레드 보장
// - 백테스팅 엔진 (12개 전략)
// - 포지션 캐싱
// - 실시간 상태 관리

export class TradingDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // 영구 저장 (DO 재시작해도 유지)
    this.storage = state.storage;
    // 인메모리 캐시
    this.cache = {
      positions: [],
      trades: [],
      backtestResults: null,
      lastBacktest: null,
      marketStatus: { open: false, time: '' },
    };
  }

  // DO 초기화 (첫 요청 시)
  async initialize() {
    // 저장된 데이터 복원
    const saved = await this.storage.get('cache');
    if (saved) {
      this.cache = { ...this.cache, ...saved };
    }
  }

  // HTTP 요청 처리
  async fetch(request) {
    await this.initialize();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
    }

    try {
      // POST: 외부 데이터 수신 (키움 API → DO)
      if (path === '/feed' && method === 'POST') {
        const body = await request.json();
        if (body.type === 'position') {
          const idx = this.cache.positions.findIndex(p => p.stock_code === body.data.stock_code);
          if (idx >= 0) this.cache.positions[idx] = body.data;
          else this.cache.positions.push(body.data);
        } else if (body.type === 'trade') {
          this.cache.trades.unshift(body.data);
          if (this.cache.trades.length > 200) this.cache.trades.pop();
        }
        // D1에 영구 저장 (비동기, 응답 기다리지 않음)
        this.syncToD1(body).catch(e => console.error('D1 sync error:', e));
        return new Response(JSON.stringify({ accepted: true }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // GET: 캐시된 데이터 조회 (D1 쿼리 없이 즉시 응답)
      if (path === '/positions') {
        return this.jsonResponse({ positions: this.cache.positions, count: this.cache.positions.length });
      }
      if (path === '/trades') {
        return this.jsonResponse({ trades: this.cache.trades, count: this.cache.trades.length });
      }

      // POST: 백테스팅 실행 (CPU Time 제한 없음)
      if (path === '/backtest' && method === 'POST') {
        const body = await request.json();
        const results = await this.runFullBacktest(body.strategies || 12);
        return this.jsonResponse(results);
      }

      // GET: 백테스팅 결과 (캐시)
      if (path === '/backtest') {
        if (this.cache.backtestResults) {
          return this.jsonResponse(this.cache.backtestResults);
        }
        // 결과 없으면 실행
        const results = await this.runFullBacktest(12);
        return this.jsonResponse(results);
      }

      // GET: 상태 정보
      if (path === '/status') {
        return this.jsonResponse({
          uptime: process.uptime ? Math.floor(process.uptime()) : 0,
          cached_positions: this.cache.positions.length,
          cached_trades: this.cache.trades.length,
          last_backtest: this.cache.lastBacktest,
          market_open: this.cache.marketStatus.open,
        });
      }

// 전체 백테스팅 실행 (12개 전략, CPU 제한 없음)
  async runFullBacktest(strategyCount) {
    const data = this.generateSampleData(252);
    this.calcIndicators(data);

    const strategies = this.getStrategies().slice(0, strategyCount);
    const results = [];

    for (const s of strategies) {
      const result = this.runSingleBacktest(data, s);
      results.push({ name: s.name, category: s.category, result });
    }

    this.cache.backtestResults = { results };
    this.cache.lastBacktest = new Date().toISOString();
    
    // Storage에 캐시 저장 (DO 재시작 대비)
    await this.storage.put('cache', this.cache);
    
    return { results };
  }

  // --- 백테스팅 엔진 ---

  generateSampleData(days) {
    let price = 72000;
    const data = [];
    const d = new Date('2025-01-02');
    let s = 42;
    const rand = () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };

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

  calcIndicators(data) {
runSingleBacktest(data, strategy) {
    let capital = 10000000;
    let peak = capital;
    const positions = {};
    const trades = [];
    const equity = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const prev = data[i - 1];
      const close = row.close;

      const toRemove = [];
      for (const code in positions) {
        const pos = positions[code];
        const pr = (close - pos.buyPrice) / pos.buyPrice;
        if (pr <= (strategy.stop_loss || -0.03) || pr >= (strategy.take_profit || 0.06)) {
          capital += pos.quantity * close;
          trades.push({ stock: code, buy_date: pos.buyDate, sell_date: row.date, profit_rate: Math.round(pr * 10000) / 100, reason: pr <= (strategy.stop_loss || -0.03) ? '손절' : '익절' });
          toRemove.push(code);
        }
      }
      toRemove.forEach(code => delete positions[code]);

      if (Object.keys(positions).length < (strategy.max_positions || 3) && prev && row.ma_5 > row.ma_20 && prev.ma_5 <= prev.ma_20) {
        const amount = capital * (strategy.position_size || 0.2);
        const qty = Math.max(1, Math.floor(amount / close));
        if (qty > 0 && capital >= qty * close) {
          capital -= qty * close;
          positions['s' + (trades.length + 1)] = { buyPrice: close, quantity: qty, buyDate: row.date };
        }
      }

      const pv = Object.values(positions).reduce((s, p) => s + p.quantity * close, 0);
      const total = capital + pv;
      equity.push({ date: row.date, equity: total });
      if (total > peak) peak = total;
    }

    const fe = capital + Object.values(positions).reduce((s, p) => s + p.quantity * data[data.length - 1].close, 0);
    const tr = (fe - 10000000) / 10000000;
    const wt = trades.filter(t => t.profit_rate > 0).length;
getStrategies() {
    return [
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
  }

  // D1에 영구 저장 (비동기)
  async syncToD1(data) {
    if (!this.env || !this.env.DB) return;
    try {
      if (data.type === 'position') {
        await this.env.DB.prepare(
          'INSERT OR REPLACE INTO positions (stock_code, stock_name, buy_price, quantity) VALUES (?, ?, ?, ?)'
        ).bind(data.data.stock_code, data.data.stock_name || null, data.data.buy_price, data.data.quantity).run();
      } else if (data.type === 'trade') {
        await this.env.DB.prepare(
          'INSERT INTO trade_logs (trade_type, stock_code, stock_name, price, quantity, profit_rate) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(data.data.trade_type, data.data.stock_code, data.data.stock_name || null, data.data.price, data.data.quantity, data.data.profit_rate || null).run();
      }
    } catch (e) {
      console.error('D1 sync error:', e.message);
    }
  }

  // 알람 핸들러 (Cron Trigger 대체, 24/7 상태 체크)
  async alarm() {
    // 매시간 시장 상태 업데이트
    const now = new Date();
    const hour = now.getUTCHours() + 9;
    const day = now.getUTCDay();
    this.cache.marketStatus = {
      open: day >= 1 && day <= 5 && hour >= 9 && hour < 15,
      time: now.toISOString(),
    };
    // 다음 알람 설정 (1시간 후)
    await this.storage.setAlarm(Date.now() + 3600000);
  }

  jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    });
  }
}
    const lt = trades.filter(t => t.profit_rate < 0).length;
    let p2 = 10000000, mdd = 0;
    for (const eq of equity) {
      if (eq.equity > p2) p2 = eq.equity;
      const dd = (p2 - eq.equity) / p2;
      if (dd > mdd) mdd = dd;
    }

    return {
      summary: {
        total_return: Math.round(tr * 10000) / 100,
        win_rate: trades.length > 0 ? Math.round(wt / trades.length * 10000) / 100 : 0,
        max_drawdown: Math.round(mdd * 10000) / 100,
        profit_factor: Math.round((wt / Math.max(lt, 1)) * 100) / 100,
        total_trades: trades.length,
        win_trades: wt, lose_trades: lt,
      },
      trades: trades.slice(-20),
    };
  }
    for (let i = 0; i < data.length; i++) {
      if (i >= 4) data[i].ma_5 = data.slice(i - 4, i + 1).reduce((s, r) => s + r.close, 0) / 5;
      else data[i].ma_5 = data[i].close;
      if (i >= 19) data[i].ma_20 = data.slice(i - 19, i + 1).reduce((s, r) => s + r.close, 0) / 20;
      else data[i].ma_20 = data[i].close;
      if (i >= 14) {
        let gains = 0, losses = 0;
        for (let j = i - 13; j <= i; j++) {
          const diff = data[j].close - data[j - 1].close;
          if (diff > 0) gains += diff; else losses -= diff;
        }
        data[i].RSI = 100 - 100 / (1 + (gains / (losses || 1)));
      } else data[i].RSI = 50;
    }
    return data;
  }
      return this.jsonResponse({ error: 'Not found' }, 404);

    } catch (e) {
      return this.jsonResponse({ error: e.message }, 500);
    }
  }