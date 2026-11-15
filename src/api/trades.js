function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handleApiTrades(request, env, ctx) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT trade_type, stock_code, stock_name, price, quantity, (price * quantity) AS amount, profit_rate, traded_at FROM trade_logs ORDER BY traded_at DESC LIMIT 50'
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
  } catch (e) {
    const samples = [
      { type: 'buy', stock_code: '005930', stock_name: '삼성전자', price: 71500, quantity: 10, amount: 715000, profit_rate: null, date: '2026-11-01 09:15' },
      { type: 'buy', stock_code: '000660', stock_name: 'SK하이닉스', price: 183000, quantity: 5, amount: 915000, profit_rate: null, date: '2026-11-05 10:30' },
      { type: 'sell', stock_code: '373220', stock_name: 'LG에너지솔루션', price: 420000, quantity: 2, amount: 840000, profit_rate: 5.2, date: '2026-11-10 14:20' },
    ];
    return json({ trades: samples, count: 3 });
  }
}

export async function handleApiTradesPost(request, env, ctx) {
  try {
    const body = await request.json();
    await env.DB.prepare(
      'INSERT INTO trade_logs (trade_type, stock_code, stock_name, price, quantity, profit_rate) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(body.trade_type, body.stock_code, body.stock_name || null, body.price, body.quantity, body.profit_rate || null).run();
    return json({ accepted: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}