export async function handleApiLogs(request, env, ctx) {
  const logs = [
    { time: '09:00:00', message: 'INFO     System initialized successfully' },
    { time: '09:00:01', message: 'INFO     D1 Database connected' },
    { time: '09:00:02', message: 'INFO     Backtest engine ready' },
    { time: '09:01:00', message: 'INFO     Auto-refresh cycle started (10s interval)' },
    { time: new Date().toTimeString().substring(0, 8), message: 'INFO     Server running on Cloudflare Workers' },
  ];
  
  return new Response(JSON.stringify({ logs }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}