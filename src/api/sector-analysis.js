const MARKET_TYPES = {
  KR: ["KOSPI", "KOSDAQ"],
  US: ["US"],
  CN: ["CN"],
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function recommendation(avgReturn, avgVolumeRatio, sampleCount) {
  if (sampleCount < 3) {
    return {
      signal: "insufficient_data",
      label: "데이터 부족",
      rationale: "섹터 내 종목 및 가격 이력이 충분하지 않아 비교 가능한 추천을 만들 수 없습니다.",
    };
  }
  if (avgReturn >= 1 && avgVolumeRatio >= 1.2) {
    return {
      signal: "watch_momentum",
      label: "모멘텀 관찰",
      rationale: "최근 평균 수익률과 거래량이 함께 높습니다. 추세 지속 여부와 변동성을 확인하세요.",
    };
  }
  if (avgReturn <= -1 && avgVolumeRatio >= 1.2) {
    return {
      signal: "high_volatility",
      label: "변동성 주의",
      rationale: "하락과 거래량 증가가 함께 관측됩니다. 이를 매수 신호로 간주하지 말고 위험을 검토하세요.",
    };
  }
  return {
    signal: "neutral",
    label: "중립 관찰",
    rationale: "뚜렷한 모멘텀/급격한 거래량 변화가 확인되지 않았습니다.",
  };
}

export async function handleApiSectorAnalysis(request, env) {
  const url = new URL(request.url);
  const market = (url.searchParams.get("market") || "KR").toUpperCase();
  const marketTypes = MARKET_TYPES[market];
  if (!marketTypes) {
    return json({ error: "market must be KR, US, or CN" }, 400);
  }

  const placeholders = marketTypes.map(() => "?").join(",");
  try {
    const query = `
      WITH daily AS (
        SELECT s.stock_code, s.sector, s.market_type, p.date, p.close, p.volume,
               LAG(p.close) OVER (PARTITION BY p.stock_code ORDER BY p.date) AS prev_close,
               LAG(p.volume) OVER (PARTITION BY p.stock_code ORDER BY p.date) AS prev_volume
        FROM stocks s
        JOIN price_history p ON p.stock_code = s.stock_code
        WHERE s.market_type IN (${placeholders})
          AND s.sector IS NOT NULL AND TRIM(s.sector) <> ''
      ), latest AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY stock_code ORDER BY date DESC) AS rn
        FROM daily
      )
      SELECT sector, COUNT(*) AS stocks,
             AVG(100.0 * (close - prev_close) / NULLIF(prev_close, 0)) AS avg_return_pct,
             SUM(CASE WHEN close > prev_close THEN 1 ELSE 0 END) AS advancing,
             SUM(CASE WHEN close < prev_close THEN 1 ELSE 0 END) AS declining,
             AVG(1.0 * volume / NULLIF(prev_volume, 0)) AS avg_volume_ratio,
             MAX(date) AS as_of
      FROM latest WHERE rn = 1
      GROUP BY sector ORDER BY avg_return_pct DESC
    `;
    const { results = [] } = await env.DB.prepare(query).bind(...marketTypes).all();
    const sectors = results.map((row) => {
      const avgReturn = Number(row.avg_return_pct || 0);
      const volumeRatio = Number(row.avg_volume_ratio || 0);
      const count = Number(row.stocks || 0);
      return {
        sector: row.sector,
        stocks: count,
        avg_return_pct: Number(avgReturn.toFixed(2)),
        advancing: Number(row.advancing || 0),
        declining: Number(row.declining || 0),
        avg_volume_ratio: Number(volumeRatio.toFixed(2)),
        as_of: row.as_of,
        recommendation: recommendation(avgReturn, volumeRatio, count),
      };
    });

    return json({
      market,
      market_types: marketTypes,
      source: "D1 stocks + price_history",
      data_status: sectors.length ? "available" : "insufficient_data",
      sectors,
      note: "분석 참고용이며 매매 지시나 수익 보장이 아닙니다. 데이터가 없으면 추천을 생성하지 않습니다.",
    });
  } catch (error) {
    console.error("Sector analysis failed:", error);
    return json({ error: "섹터 분석 데이터베이스 조회 실패", market, sectors: [] }, 500);
  }
}