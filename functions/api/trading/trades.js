/**
 * D1 기반 매매 내역 API (3NF)
 * JOIN으로 stock_name 조회, amount 컬럼 제거 (price*quantity로 계산)
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const sql = `
      SELECT t.id, t.trade_type, t.stock_code, s.stock_name, s.market_type,
             t.price, t.quantity, (t.price * t.quantity) AS amount,
             t.profit_rate, t.order_no, t.traded_at
      FROM trade_logs t
      LEFT JOIN stocks s ON t.stock_code = s.stock_code
      ORDER BY t.traded_at DESC
      LIMIT 50
    `;
    const { results } = await env.DB.prepare(sql).all();
    return json({ trades: results || [], count: results?.length || 0 });
  } catch (error) {
    console.error("Failed to read trades:", error);
    return json({ error: "매매 내역 조회 실패", trades: [], count: 0 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    if (!body.stock_code || !body.trade_type) {
      return json({ error: "stock_code and trade_type required" }, 400);
    }
    // stocks 자동 등록
    if (body.stock_name) {
      await env.DB.prepare("INSERT OR IGNORE INTO stocks (stock_code, stock_name) VALUES (?, ?)")
        .bind(body.stock_code, body.stock_name).run();
    }
    // amount는 저장 안 함 (price*quantity로 계산)
    await env.DB.prepare(
      "INSERT INTO trade_logs (trade_type, stock_code, price, quantity, profit_rate, order_no) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(body.trade_type, body.stock_code, body.price, body.quantity,
      body.profit_rate || null, body.order_no || null).run();
    return json({ accepted: true });
  } catch (error) {
    console.error("Failed to save trade log:", error);
    return json({ error: "매매 내역 저장 실패" }, 500);
  }
}