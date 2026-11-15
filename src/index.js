// Cloudflare Workers 메인 라우터
// - DO(Durable Object)를 통한 24/7 백테스팅 엔진
// - 정적 파일 서빙
// - API 라우팅

import { handleApiStatus } from './api/status.js';
import { handleApiAccount } from './api/account.js';
import { handleApiPositions, handleApiPositionsPost, handleApiPositionsDelete } from './api/positions.js';
import { handleApiTrades, handleApiTradesPost } from './api/trades.js';
import { handleApiStrategies } from './api/strategies.js';
import { handleApiLogs } from './api/logs.js';
import { handleCronBacktest } from './cron/backtest.js';

// DO 네임스페이스
const DO_NAME = 'TRADING_DO';

function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    // ===== DO 기반 백테스팅 API (CPU Time 제한 없음) =====
    if (path.startsWith('/do/backtest')) {
      const doId = env[DO_NAME].idFromName('backtest-engine');
      const doStub = env[DO_NAME].get(doId);
      // DO로 요청 전달 (CPU Time 제한 없음)
      const doUrl = new URL(request.url);
      doUrl.pathname = doUrl.pathname.replace('/do', '');
      const doRequest = new Request(doUrl.toString(), request);
      return doStub.fetch(doRequest);
    }

    // ===== DO 기반 포지션/거래내역 캐싱 =====
    if (path === '/do/positions' || path === '/do/trades' || path === '/do/status') {
      const doId = env[DO_NAME].idFromName('trading-cache');
      const doStub = env[DO_NAME].get(doId);
      const doUrl = new URL(request.url);
      doUrl.pathname = doUrl.pathname.replace('/do', '');
      const doRequest = new Request(doUrl.toString(), request);
      return doStub.fetch(doRequest);
    }

    // ===== 일반 Workers API (기존 유지) =====
    if (path === '/api/status' && method === 'GET') return handleApiStatus(request, env, ctx);
    if (path === '/api/account' && method === 'GET') return handleApiAccount(request, env, ctx);
    if (path === '/api/positions' && method === 'GET') return handleApiPositions(request, env, ctx);
    if (path === '/api/positions' && method === 'POST') return handleApiPositionsPost(request, env, ctx);
    if (path === '/api/positions' && method === 'DELETE') return handleApiPositionsDelete(request, env, ctx);
    if (path === '/api/trades' && method === 'GET') return handleApiTrades(request, env, ctx);
    if (path === '/api/trades' && method === 'POST') return handleApiTradesPost(request, env, ctx);
    if (path === '/api/strategies' && method === 'GET') return handleApiStrategies(request, env, ctx);
    if (path === '/api/backtest/run' && method === 'GET') {
      // DO를 통해 백테스팅 실행 (CPU Time 제한 없음)
      const doId = env[DO_NAME].idFromName('backtest-engine');
      const doStub = env[DO_NAME].get(doId);
      return doStub.fetch(new Request(new URL('/backtest?strategy=' + url.searchParams.get('strategy'), request.url), request));
    }
    if (path === '/api/backtest/run_all' && method === 'GET') {
      const doId = env[DO_NAME].idFromName('backtest-engine');
      const doStub = env[DO_NAME].get(doId);
      return doStub.fetch(new Request(new URL('/backtest', request.url), request));
    }
    if (path === '/api/backtest/strategies' && method === 'GET') {
      import('./api/backtest.js').then(m => m.handleApiBacktestStrategies(request, env, ctx));
    }
    if (path === '/api/logs' && method === 'GET') return handleApiLogs(request, env, ctx);

    // Serve static files
    if (path === '/' || path === '/index.html') {
      return new Response(await env.ASSETS.fetch(request).then(r => r.text()), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  },

  // Cron Trigger: 매일 새벽 3시 DO에서 백테스팅
  async scheduled(event, env, ctx) {
    if (event.cron === '0 3 * * *') {
      const doId = env[DO_NAME].idFromName('backtest-engine');
      const doStub = env[DO_NAME].get(doId);
      await doStub.fetch(new Request('https://do/backtest', { method: 'POST' }));
    }
  },
};