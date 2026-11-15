/**
 * D1 기반 매매 내역 API
 * GET  /api/trading/trades  - 매매 내역 조회
 * POST /api/trading/trades  - 매매 내역 저장
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT trade_type, stock_code, stock_name, price, quantity, amount, profit_rate, order_no, traded_at FROM trade_logs ORDER BY traded_at DESC LIMIT 50"
    ).all();
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
    await env.DB.prepare(
      "INSERT INTO trade_logs (trade_type, stock_code, stock_name, price, quantity, amount, profit_rate, order_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      body.trade_type, body.stock_code, body.stock_name || null,
      body.price, body.quantity, body.amount,
      body.profit_rate || null, body.order_no || null
    ).run();
    return json({ accepted: true });
  } catch (error) {
    console.error("Failed to save trade log:", error);
    return json({ error: "매매 내역 저장 실패" }, 500);
  }
}