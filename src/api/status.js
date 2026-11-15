export async function handleApiStatus(request, env, ctx) {
  const now = new Date();
  const hour = now.getUTCHours() + 9; // KST
  const day = now.getUTCDay();
  const marketOpen = day >= 1 && day <= 5 && hour >= 9 && hour < 15;

  return new Response(JSON.stringify({
    status: 'running',
    server_time: now.toISOString().replace('T', ' ').substring(0, 19),
    market_open: marketOpen,
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}