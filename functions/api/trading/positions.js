/**
 * D1 기반 포지션 API (3NF)
 * positions 테이블에서 stock_code로 stocks 테이블 JOIN 조회
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
      SELECT p.stock_code, s.stock_name, s.market_type, s.sector,
             p.buy_price, p.quantity, p.order_no, p.buy_date
      FROM positions p
      LEFT JOIN stocks s ON p.stock_code = s.stock_code
      ORDER BY p.buy_date DESC
    `;
    const { results } = await env.DB.prepare(sql).all();
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

    // stocks에 없으면 upsert (종목정보 자동등록)
    const stockExists = await env.DB.prepare("SELECT stock_code FROM stocks WHERE stock_code = ?").bind(body.stock_code).first();
    if (!stockExists && body.stock_name) {
      await env.DB.prepare("INSERT OR IGNORE INTO stocks (stock_code, stock_name) VALUES (?, ?)")
        .bind(body.stock_code, body.stock_name).run();
    }

    const existing = await env.DB.prepare("SELECT id FROM positions WHERE stock_code = ?").bind(body.stock_code).first();
    if (existing) {
      await env.DB.prepare("UPDATE positions SET buy_price = ?, quantity = ?, order_no = ?, updated_at = datetime('now') WHERE stock_code = ?")
        .bind(body.buy_price, body.quantity, body.order_no || null, body.stock_code).run();
    } else {
      await env.DB.prepare("INSERT INTO positions (stock_code, buy_price, quantity, order_no) VALUES (?, ?, ?, ?)")
        .bind(body.stock_code, body.buy_price, body.quantity, body.order_no || null).run();
    }
    return json({ accepted: true });
  } catch (error) {
    console.error("Failed to save position:", error);
    return json({ error: "포지션 저장 실패" }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const code = new URL(request.url).searchParams.get("code");
    if (!code) return json({ error: "code parameter required" }, 400);
    await env.DB.prepare("DELETE FROM positions WHERE stock_code = ?").bind(code).run();
    return json({ accepted: true });
  } catch (error) {
    console.error("Failed to delete position:", error);
    return json({ error: "포지션 삭제 실패" }, 500);
  }
}