function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function handleApiPositions(request, env, ctx) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT stock_code, stock_name, buy_price, quantity, buy_date FROM positions ORDER BY buy_date DESC'
    ).all();
    const positions = (results || []).map(r => ({
      stock_code: r.stock_code,
      stock_name: r.stock_name || r.stock_code,
      buy_price: r.buy_price,
      quantity: r.quantity,
      invested: r.buy_price * r.quantity,
      current_price: r.buy_price,
      profit_rate: 0,
      buy_date: r.buy_date ? r.buy_date.substring(0, 10) : '',
    }));
    return json({ positions, count: positions.length });
  } catch (e) {
    // 샘플 데이터
    const samples = [
      { stock_code: '005930', stock_name: '삼성전자', buy_price: 72000, quantity: 10, invested: 720000, current_price: 73800, profit_rate: 2.5, buy_date: '2026-11-01' },
      { stock_code: '000660', stock_name: 'SK하이닉스', buy_price: 185000, quantity: 5, invested: 925000, current_price: 192000, profit_rate: 3.78, buy_date: '2026-11-05' },
      { stock_code: '035420', stock_name: 'NAVER', buy_price: 215000, quantity: 3, invested: 645000, current_price: 208000, profit_rate: -3.26, buy_date: '2026-11-08' },
    ];
    return json({ positions: samples, count: 3 });
  }
}

export async function handleApiPositionsPost(request, env, ctx) {
  try {
    const body = await request.json();
    await env.DB.prepare(
      'INSERT OR REPLACE INTO positions (stock_code, stock_name, buy_price, quantity) VALUES (?, ?, ?, ?)'
    ).bind(body.stock_code, body.stock_name || null, body.buy_price, body.quantity).run();
    return json({ accepted: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function handleApiPositionsDelete(request, env, ctx) {
  try {
    const code = new URL(request.url).searchParams.get('code');
    if (!code) return json({ error: 'code required' }, 400);
    await env.DB.prepare('DELETE FROM positions WHERE stock_code = ?').bind(code).run();
    return json({ accepted: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}