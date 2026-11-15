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

  // DO 초기화 (첫 요청 시) — 동기식으로 변경
  initialize() {
    // 저장된 데이터 복원 (동기식 storage.getSync 사용)
    var saved = this.storage.getSync ? this.storage.getSync('cache') : null;
    if (saved) {
      this.cache = { ...this.cache, ...saved };
    }
  }
// HTTP 요청 처리
  fetch(request) {
    var self = this;
    return self._initializeAndHandle(request).then(function(result) {
      return result;
    }).catch(function(e) {
      return self.jsonResponse({ error: e.message }, 500);
    });
  }

  // 내부 초기화 + 핸들링
  _initializeAndHandle(request) {
    this.initialize();
    var url = new URL(request.url);
    var path = url.pathname;
    var method = request.method;

    // CORS
    if (method === 'OPTIONS') {
      return Promise.resolve(new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      }));
    }

    try {
      // POST: 외부 데이터 수신 (키움 API → DO)
      if (path === '/feed' && method === 'POST') {
        var self = this;
        return request.json().then(function(body) {
          if (body.type === 'position') {
            var idx = self.cache.positions.findIndex(function(p) { return p.stock_code === body.data.stock_code; });
            if (idx >= 0) self.cache.positions[idx] = body.data;
            else self.cache.positions.push(body.data);
          } else if (body.type === 'trade') {
            self.cache.trades.unshift(body.data);
            if (self.cache.trades.length > 200) self.cache.trades.pop();
          }
          // D1에 영구 저장 (비동기, 응답 기다리지 않음)
          self.syncToD1(body).then(null, function(e) { console.error('D1 sync error:', e); });
          return new Response(JSON.stringify({ accepted: true }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        });
      }

      // GET: 캐시된 데이터 조회 (D1 쿼리 없이 즉시 응답)
      if (path === '/positions') {
        return Promise.resolve(this.jsonResponse({ positions: this.cache.positions, count: this.cache.positions.length }));
      }
      if (path === '/trades') {
        return Promise.resolve(this.jsonResponse({ trades: this.cache.trades, count: this.cache.trades.length }));
      }

      // POST: 백테스팅 실행 (CPU Time 제한 없음)
      if (path === '/backtest' && method === 'POST') {
        var self = this;
        return request.json().then(function(body) {
          return self.runFullBacktest(body.strategies || 12).then(function(results) {
            return self.jsonResponse(results);
          });
        });
      }

      // GET: 백테스팅 결과 (캐시)
      if (path === '/backtest') {
        if (this.cache.backtestResults) {
          return Promise.resolve(this.jsonResponse(this.cache.backtestResults));
        }
        // 결과 없으면 실행
        var self = this;
        return this.runFullBacktest(12).then(function(results) {
          return self.jsonResponse(results);
        });
      }

      // GET: 상태 정보
      if (path === '/status') {
        return Promise.resolve(this.jsonResponse({
          uptime: process.uptime ? Math.floor(process.uptime()) : 0,
          cached_positions: this.cache.positions.length,
          cached_trades: this.cache.trades.length,
          last_backtest: this.cache.lastBacktest,
          market_open: this.cache.marketStatus.open,
        }));
      }

      return Promise.resolve(this.jsonResponse({ error: 'Not found' }, 404));
    } catch (e) {
      return Promise.resolve(this.jsonResponse({ error: e.message }, 500));
    }
  }
// 전체 백테스팅 실행 (12개 전략, CPU 제한 없음)
  runFullBacktest(strategyCount) {
    var data = this.generateSampleData(252);
    this.calcIndicators(data);

    var strategies = this.getStrategies().slice(0, strategyCount);
    var results = [];

    for (var si = 0; si < strategies.length; si++) {
      var s = strategies[si];
      var result = this.runSingleBacktest(data, s);
      results.push({ name: s.name, category: s.category, result: result });
    }

    this.cache.backtestResults = { results: results };
    this.cache.lastBacktest = new Date().toISOString();

    // Storage에 캐시 저장 (DO 재시작 대비) — 동기식 putSync 사용 가능하면
    if (this.storage.putSync) {
      this.storage.putSync('cache', this.cache);
    } else {
      // fallback: Promise 반환
      var self = this;
      return this.storage.put('cache', this.cache).then(function() {
        return { results: results };
      });
    }

    return Promise.resolve({ results: results });
  }

  // --- 백테스팅 엔진 ---

  generateSampleData(days) {
    var price = 72000;
    var data = [];
    var d = new Date('2025-01-02');
    var s = 42;
    var rand = function() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };

    for (var i = 0; i < days * 2; i++) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      var change = (rand() - 0.48) * 0.035;
      var o = price;
      var h = o * (1 + Math.abs(rand() - 0.5) * 0.025);
      var l = o * (1 - Math.abs(rand() - 0.5) * 0.025);
      var c = o * (1 + change);
      price = c;
      data.push({ date: d.toISOString().substring(0, 10), open: Math.round(o), high: Math.round(h), low: Math.round(l), close: Math.round(c), volume: Math.round(rand() * 5000000 + 300000) });
      if (data.length >= days) break;
    }
    return data;
  }

  calcIndicators(data) {
    for (var i = 0; i < data.length; i++) {
      if (i >= 4) data[i].ma_5 = data.slice(i - 4, i + 1).reduce(function(s, r) { return s + r.close; }, 0) / 5;
      else data[i].ma_5 = data[i].close;
      if (i >= 19) data[i].ma_20 = data.slice(i - 19, i + 1).reduce(function(s, r) { return s + r.close; }, 0) / 20;
      else data[i].ma_20 = data[i].close;
      if (i >= 14) {
        var gains = 0, losses = 0;
        for (var j = i - 13; j <= i; j++) {
          var diff = data[j].close - data[j - 1].close;
          if (diff > 0) gains += diff; else losses -= diff;
        }
        data[i].RSI = 100 - 100 / (1 + (gains / (losses || 1)));
      } else data[i].RSI = 50;
    }
    return data;
  }

  runSingleBacktest(data, strategy) {
    var capital = 10000000;
    var positions = {};
    var trades = [];
    var equity = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var prev = data[i - 1];
      var close = row.close;

      var toRemove = [];
      for (var code in positions) {
        if (positions.hasOwnProperty(code)) {
          var pos = positions[code];
          var pr = (close - pos.buyPrice) / pos.buyPrice;
          if (pr <= (strategy.stop_loss || -0.03) || pr >= (strategy.take_profit || 0.06)) {
            capital += pos.quantity * close;
            trades.push({ stock: code, buy_date: pos.buyDate, sell_date: row.date, profit_rate: Math.round(pr * 10000) / 100, reason: pr <= (strategy.stop_loss || -0.03) ? '손절' : '익절' });
            toRemove.push(code);
          }
        }
      }
      for (var ri = 0; ri < toRemove.length; ri++) {
        delete positions[toRemove[ri]];
      }

      if (Object.keys(positions).length < (strategy.max_positions || 3) && prev && row.ma_5 > row.ma_20 && prev.ma_5 <= prev.ma_20) {
        var amount = capital * (strategy.position_size || 0.2);
        var qty = Math.max(1, Math.floor(amount / close));
        if (qty > 0 && capital >= qty * close) {
          capital -= qty * close;
          positions['s' + (trades.length + 1)] = { buyPrice: close, quantity: qty, buyDate: row.date };
        }
      }

      var pv = 0;
      for (var code2 in positions) {
        if (positions.hasOwnProperty(code2)) {
          pv += positions[code2].quantity * close;
        }
      }
      var total = capital + pv;
      equity.push({ date: row.date, equity: total });
    }

    var fe = capital;
    var lastClose = data[data.length - 1].close;
    for (var code3 in positions) {
      if (positions.hasOwnProperty(code3)) {
        fe += positions[code3].quantity * lastClose;
      }
    }
    var tr = (fe - 10000000) / 10000000;
    var wt = 0, lt = 0;
    for (var ti = 0; ti < trades.length; ti++) {
      if (trades[ti].profit_rate > 0) wt++;
      else if (trades[ti].profit_rate < 0) lt++;
    }
    var p2 = 10000000, mdd = 0;
    for (var ei = 0; ei < equity.length; ei++) {
      if (equity[ei].equity > p2) p2 = equity[ei].equity;
      var dd = (p2 - equity[ei].equity) / p2;
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

  // D1에 영구 저장 (비동기 → .then() 체인)
  syncToD1(data) {
    if (!this.env || !this.env.DB) return Promise.resolve();
    try {
      if (data.type === 'position') {
        return this.env.DB.prepare(
          'INSERT OR REPLACE INTO positions (stock_code, stock_name, buy_price, quantity) VALUES (?, ?, ?, ?)'
        ).bind(data.data.stock_code, data.data.stock_name || null, data.data.buy_price, data.data.quantity).run().then(null, function(e) {
          console.error('D1 sync error:', e.message);
        });
      } else if (data.type === 'trade') {
        return this.env.DB.prepare(
          'INSERT INTO trade_logs (trade_type, stock_code, stock_name, price, quantity, profit_rate) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(data.data.trade_type, data.data.stock_code, data.data.stock_name || null, data.data.price, data.data.quantity, data.data.profit_rate || null).run().then(null, function(e) {
          console.error('D1 sync error:', e.message);
        });
      }
      return Promise.resolve();
    } catch (e) {
      console.error('D1 sync error:', e.message);
      return Promise.resolve();
    }
  }

  // 알람 핸들러 (Cron Trigger 대체, 24/7 상태 체크)
  alarm() {
    // 매시간 시장 상태 업데이트
    var now = new Date();
    var hour = now.getUTCHours() + 9;
    var day = now.getUTCDay();
    this.cache.marketStatus = {
      open: day >= 1 && day <= 5 && hour >= 9 && hour < 15,
      time: now.toISOString(),
    };
    // 다음 알람 설정 (1시간 후) — 동기식 setAlarmSync 사용 가능하면
    if (this.storage.setAlarmSync) {
      this.storage.setAlarmSync(Date.now() + 3600000);
      return Promise.resolve();
    }
    return this.storage.setAlarm(Date.now() + 3600000);
  }

  jsonResponse(data, status) {
    if (status === undefined) status = 200;
    return new Response(JSON.stringify(data), {
      status: status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    });
  }
}