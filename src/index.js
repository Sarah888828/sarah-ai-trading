import dashboard from '../static/index.html';
import { handleApiStatus } from './api/status.js';
import { handleApiAccount } from './api/account.js';
import { handleApiPositions, handleApiPositionsPost, handleApiPositionsDelete } from './api/positions.js';
import { handleApiTrades, handleApiTradesPost } from './api/trades.js';
import { handleApiStrategies } from './api/strategies.js';
import { handleApiBacktestRun, handleApiBacktestRunAll, handleApiBacktestStrategies } from './api/backtest.js';
import { handleApiLogs } from './api/logs.js';
import { handleApiSectorAnalysis } from './api/sector-analysis.js';
import { handleCronBacktest } from './cron/backtest.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const ownerEmail = env.ACCESS_OWNER_EMAIL?.trim().toLowerCase();
    const identity = ownerEmail && ctx?.access ? await ctx.access.getIdentity() : null;
    if (!ownerEmail || identity?.email?.toLowerCase() !== ownerEmail) {
      return Response.json({ error: 'Forbidden' }, {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if ((path === '/' || path === '/index.html') && (method === 'GET' || method === 'HEAD')) {
      return new Response(method === 'HEAD' ? null : dashboard, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    const isPortfolioWrite =
      (path === '/api/positions' && (method === 'POST' || method === 'DELETE')) ||
      (path === '/api/trades' && method === 'POST');
    if (isPortfolioWrite && (!env.API_TOKEN ||
        request.headers.get('Authorization') !== `Bearer ${env.API_TOKEN}`)) {
      return Response.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      });
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
    if (path === '/api/sector-analysis' && method === 'GET') return handleApiSectorAnalysis(request, env, ctx);
    if (path === '/api/backtest/run' && method === 'GET') return handleApiBacktestRun(request, env, ctx);
    if (path === '/api/backtest/run_all' && method === 'GET') return handleApiBacktestRunAll(request, env, ctx);
    if (path === '/api/backtest/strategies' && method === 'GET') return handleApiBacktestStrategies(request, env, ctx);
    if (path === '/api/logs' && method === 'GET') return handleApiLogs(request, env, ctx);

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async scheduled(event, env, ctx) {
    if (event.cron === '0 3 * * *') {
      await handleCronBacktest(env);
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}