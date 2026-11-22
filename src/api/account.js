export async function handleApiAccount(request, env) {
  const startingCapital = 10000000;
  const headers = {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };
  try {
    const { invested } = await env.DB.prepare(
      'SELECT COALESCE(SUM(buy_price * quantity), 0) AS invested FROM positions'
    ).first();
    return Response.json({
      total_balance: startingCapital,
      invested,
      available: startingCapital - invested,
      total_profit_rate: null,
    }, { headers });
  } catch (error) {
    console.error('Failed to read account:', error);
    return Response.json({ error: 'Account data unavailable' }, { status: 500, headers });
  }
}
