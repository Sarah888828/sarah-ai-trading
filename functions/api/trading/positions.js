/**
 * D1 기반 주식 포지션 API
 * GET  /api/trading/positions  - 포지션 목록 조회
 * POST /api/trading/positions  - 포지션 저장/업데이트
 * DELETE /api/trading/positions?code=XXX - 포지션 삭제
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
      "SELECT stock_code, stock_name, buy_price, quantity, order_no, buy_date FROM positions ORDER BY buy_date DESC"
    ).all();
    return json({ positions: results || [], count: results?.length || 0 });
  } catch (error) {
    console.error("Failed to read positions:", error);
    return json({ error: "포지션 조회 실패", positions: [], count: 0 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    if (!body.stock_code) return json({ error: "stock_code required" }, 400);

    const existing = await env.DB.prepare(
      "SELECT id FROM positions WHERE stock_code = ?"
    ).bind(body.stock_code).first();

    if (existing) {
      await env.DB.prepare(
        "UPDATE positions SET buy_price = ?, quantity = ?, order_no = ?, stock_name = ?, updated_at = datetime('now') WHERE stock_code = ?"
      ).bind(body.buy_price, body.quantity, body.order_no || null, body.stock_name || null, body.stock_code).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO positions (stock_code, stock_name, buy_price, quantity, order_no) VALUES (?, ?, ?, ?, ?)"
      ).bind(body.stock_code, body.stock_name || null, body.buy_price, body.quantity, body.order_no || null).run();
    }
    return json({ accepted: true });
  } catch (error) {
    console.error("Failed to save position:", error);
    return json({ error: "포지션 저장 실패" }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code) return json({ error: "code parameter required" }, 400);
    await env.DB.prepare("DELETE FROM positions WHERE stock_code = ?").bind(code).run();
    return json({ accepted: true });
  } catch (error) {
    console.error("Failed to delete position:", error);
    return json({ error: "포지션 삭제 실패" }, 500);
  }
}