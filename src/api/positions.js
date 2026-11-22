function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function handleApiPositions(request, env, ctx) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT p.stock_code, s.stock_name, p.buy_price, p.quantity, p.buy_date
       FROM positions p LEFT JOIN stocks s ON s.stock_code = p.stock_code
       ORDER BY p.buy_date DESC`
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
  } catch (error) {
    console.error('Failed to read positions:', error);
    return json({ error: 'Could not read positions' }, 500);
  }
}

export async function handleApiPositionsPost(request, env, ctx) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.stock_code) return json({ error: 'stock_code required' }, 400);
    const position = env.DB.prepare(
      `INSERT INTO positions (stock_code, buy_price, quantity, order_no) VALUES (?, ?, ?, ?)
       ON CONFLICT(stock_code) DO UPDATE SET buy_price = excluded.buy_price,
         quantity = excluded.quantity, order_no = excluded.order_no, updated_at = datetime('now')`
    ).bind(body.stock_code, body.buy_price, body.quantity, body.order_no ?? null);
    if (body.stock_name) {
      const stock = env.DB.prepare(
        'INSERT INTO stocks (stock_code, stock_name) VALUES (?, ?) ON CONFLICT(stock_code) DO NOTHING'
      ).bind(body.stock_code, body.stock_name);
      await env.DB.batch([stock, position]);
    } else {
      await position.run();
    }
    return json({ accepted: true });
  } catch (e) {
    console.error('Failed to write positions:', e);
    return json({ error: 'Could not write positions' }, 500);
  }
}

export async function handleApiPositionsDelete(request, env, ctx) {
  try {
    const code = new URL(request.url).searchParams.get('code');
    if (!code) return json({ error: 'code required' }, 400);
    await env.DB.prepare('DELETE FROM positions WHERE stock_code = ?').bind(code).run();
    return json({ accepted: true });
  } catch (e) {
    console.error('Failed to write positions:', e);
    return json({ error: 'Could not write positions' }, 500);
  }
}