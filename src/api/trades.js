function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function handleApiTrades(request, env, ctx) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT t.trade_type, t.stock_code, s.stock_name, t.price, t.quantity,
              t.price * t.quantity AS amount, t.profit_rate, t.traded_at
       FROM trade_logs t LEFT JOIN stocks s ON s.stock_code = t.stock_code
       ORDER BY t.traded_at DESC, t.id DESC LIMIT 50`
    ).all();
    const trades = (results || []).map(r => ({
      type: r.trade_type,
      stock_code: r.stock_code,
      stock_name: r.stock_name || r.stock_code,
      price: r.price,
      quantity: r.quantity,
      amount: r.amount,
      profit_rate: r.profit_rate,
      date: r.traded_at ? r.traded_at.substring(0, 16).replace('T', ' ') : '',
    }));
    return json({ trades, count: trades.length });
  } catch (error) {
    console.error('Failed to read trades:', error);
    return json({ error: 'Could not read trades' }, 500);
  }
}

export async function handleApiTradesPost(request, env, ctx) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.stock_code) return json({ error: 'stock_code required' }, 400);
    const trade = env.DB.prepare(
      'INSERT INTO trade_logs (trade_type, stock_code, price, quantity, profit_rate, order_no) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(body.trade_type, body.stock_code, body.price, body.quantity,
      body.profit_rate ?? null, body.order_no ?? null);
    if (body.stock_name) {
      const stock = env.DB.prepare(
        'INSERT INTO stocks (stock_code, stock_name) VALUES (?, ?) ON CONFLICT(stock_code) DO NOTHING'
      ).bind(body.stock_code, body.stock_name);
      await env.DB.batch([stock, trade]);
    } else {
      await trade.run();
    }
    return json({ accepted: true });
  } catch (e) {
    console.error('Failed to write trades:', e);
    return json({ error: 'Could not write trades' }, 500);
  }
}