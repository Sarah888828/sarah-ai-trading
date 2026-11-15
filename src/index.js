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
    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    // API Routes
    if (path === '/api/status' && method === 'GET') return handleApiStatus();
    if (path === '/api/account' && method === 'GET') return handleApiAccount();
    if (path === '/api/positions' && method === 'GET') return handleApiPositions();
    if (path === '/api/positions' && method === 'POST') return handleApiPositionsPost(request);
    if (path === '/api/positions' && method === 'DELETE') return handleApiPositionsDelete(request);
    if (path === '/api/trades' && method === 'GET') return handleApiTrades();
    if (path === '/api/trades' && method === 'POST') return handleApiTradesPost(request);
    if (path === '/api/strategies' && method === 'GET') return handleApiStrategies();
    if (path === '/api/sector-analysis' && method === 'GET') return handleApiSectorAnalysis(request, env);
    if (path === '/api/backtest/run' && method === 'GET') return handleApiBacktestRun(request);
    if (path === '/api/backtest/run_all' && method === 'GET') return handleApiBacktestRunAll();
    if (path === '/api/backtest/strategies' && method === 'GET') return handleApiBacktestStrategies();
    if (path === '/api/logs' && method === 'GET') return handleApiLogs();

    // Serve dashboard (simple inline HTML)
    if (path === '/' || path === '/index.html') {
      return new Response('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>Sarah.ai</title><style>body{background:#0a0a0f;color:#f1f5f9;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:20px;padding:20px;text-align:center}h1{font-size:2rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.card{border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:24px;background:rgba(255,255,255,0.03);max-width:500px;width:100%}.link{display:inline-block;margin:6px;padding:8px 16px;border-radius:8px;background:rgba(99,102,241,0.15);color:#6366f1;text-decoration:none;font-size:14px}.link:hover{background:rgba(99,102,241,0.25)}.status{color:#22c55e;font-size:14px}.badge{display:inline-block;padding:2px 8px;border-radius:4px;background:rgba(99,102,241,0.2);color:#6366f1;font-size:11px;margin-bottom:8px}</style></head><body><h1>Sarah.ai</h1><div class="card"><div class="badge">Cloudflare Workers</div><p style="color:#94a3b8;margin:12px 0">AI-Powered Trading System</p><div class="status">● System Running</div></div><div class="card"><h3 style="margin-bottom:12px">API Endpoints</h3><a class="link" href="/api/status">System Status</a><a class="link" href="/api/account">Account Info</a><a class="link" href="/api/positions">Positions</a><a class="link" href="/api/strategies">Strategies</a><a class="link" href="/api/backtest/run_all">Backtest All</a></div><p style="color:#64748b;font-size:12px">' + new Date().toISOString().substring(0, 10) + ' · Sarah.ai</p></body></html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

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
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}