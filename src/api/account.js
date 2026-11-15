export async function handleApiAccount(request, env, ctx) {
  // D1에서 포지션 조회
  let invested = 0;
  try {
    const { results } = await env.DB.prepare(
      'SELECT buy_price, quantity FROM positions'
    ).all();
    for (const row of results) {
      invested += row.buy_price * row.quantity;
    }
  } catch (e) {
    // 샘플 데이터
    invested = 2290000;
  }

  return new Response(JSON.stringify({
    total_balance: 10000000,
    invested: invested,
    available: 10000000 - invested,
    total_profit_rate: invested > 0 ? ((10000000 - invested) / invested * 100) : 0,
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}