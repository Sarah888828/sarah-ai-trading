// Cloudflare Workers 메인 라우터
// - 정적 파일 (dashboard.html) 서빙
// - API 라우팅 (/api/*)
// - Cron Trigger (/__cron/backtest)

import { handleApiStatus } from './api/status.js';
import { handleApiAccount } from './api/account.js';
import { handleApiPositions, handleApiPositionsPost, handleApiPositionsDelete } from './api/positions.js';
import { handleApiTrades, handleApiTradesPost } from './api/trades.js';
import { handleApiStrategies } from './api/strategies.js';
import { handleApiBacktestRun, handleApiBacktestRunAll, handleApiBacktestStrategies } from './api/backtest.js';
import { handleApiLogs } from './api/logs.js';
import { handleCronBacktest } from './cron/backtest.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API Routes
    if (path === '/api/status' && method === 'GET') return handleApiStatus(request, env, ctx);
    if (path === '/api/account' && method === 'GET') return handleApiAccount(request, env, ctx);
    if (path === '/api/positions' && method === 'GET') return handleApiPositions(request, env, ctx);
    if (path === '/api/positions' && method === 'POST') return handleApiPositionsPost(request, env, ctx);
    if (path === '/api/positions' && method === 'DELETE') return handleApiPositionsDelete(request, env, ctx);
    if (path === '/api/trades' && method === 'GET') return handleApiTrades(request, env, ctx);
    if (path === '/api/trades' && method === 'POST') return handleApiTradesPost(request, env, ctx);
    if (path === '/api/strategies' && method === 'GET') return handleApiStrategies(request, env, ctx);
    if (path === '/api/backtest/run' && method === 'GET') return handleApiBacktestRun(request, env, ctx);
    if (path === '/api/backtest/run_all' && method === 'GET') return handleApiBacktestRunAll(request, env, ctx);
    if (path === '/api/backtest/strategies' && method === 'GET') return handleApiBacktestStrategies(request, env, ctx);
    if (path === '/api/logs' && method === 'GET') return handleApiLogs(request, env, ctx);

    // Serve static files
    if (path === '/' || path === '/index.html') {
      const html = await env.ASSETS.fetch(request);
      return html;
    }

    // 404
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  },

  // Cron Trigger: 매일 새벽 3시 백테스팅 자동 실행
  async scheduled(event, env, ctx) {
    if (event.cron === '0 3 * * *') {
      await handleCronBacktest(env);
    }
  },
};