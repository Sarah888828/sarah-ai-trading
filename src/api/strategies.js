export async function handleApiStrategies(request, env, ctx) {
  const strategies = [
    { name: '골든크로스 + RSI + 볼린저밴드', category: 'General', description: 'Logic Works 전략: 여러 조건을 조합한 매수/매도 신호', params: { short_ma: 5, long_ma: 20, rsi_period: 14 }, enabled: true },
    { name: 'YSN Momentum Burst', category: 'Momentum', description: 'AI 기반 모멘텀 + 변동성 돌파. 볼린저밴드 상단 돌파 + 거래량 급증 → 추세 추종 매수', params: { position_size: 0.25 }, enabled: true },
    { name: 'YSN AI Reversal', category: 'Reversal', description: 'AI 기반 반전 매매. RSI 과매도 + 볼린저밴드 하단 + 거래량 급증 → 바닥 반전 포착', params: { position_size: 0.2 }, enabled: true },
    { name: 'YSN Trend Following', category: 'Trend', description: 'AI 기반 추세 추종. 골든크로스 + RSI 50~70 유지 → 강한 추세에서 수익 극대화', params: { position_size: 0.3 }, enabled: true },
    { name: 'YSN Scalping Pro', category: 'Scalping', description: 'AI 기반 단타 스캘핑. 짧은 호흡으로 빠른 진입/청산, 높은 승률 목표', params: { position_size: 0.15 }, enabled: true },
    { name: 'YSN Breakout Hunter', category: 'Breakout', description: 'AI 기반 돌파 사냥. 신고가 돌파 + 강한 거래량 → 추가 상승 구간 진입', params: { position_size: 0.2 }, enabled: true },
    { name: 'StockEasy 1호 - 모멘텀 Easy', category: 'Momentum', description: '스탁이지 AI 기반 모멘텀 전략. 단기 추세 추종 + 거래량 증가', params: { position_size: 0.2 }, enabled: true },
    { name: 'StockEasy 2호 - 피크 Easy', category: 'Breakout', description: '스탁이지 AI 피크 전략. 고점 돌파 후 추가 상승 구간 포착', params: { position_size: 0.2 }, enabled: true },
    { name: 'StockEasy 3호 - 밸류 Easy', category: 'Value', description: '스탁이지 AI 가치 투자 전략. 저평가 종목 발굴 + 장기 보유', params: { position_size: 0.25 }, enabled: true },
    { name: 'StockEasy 4호 - 서프 Easy', category: 'Surprise', description: '스탁이지 AI 서프라이즈 전략. 실적/이벤트 서프라이즈 발생 시 급등 구간 진입', params: { position_size: 0.15 }, enabled: true },
    { name: 'KOSPD ETF 모멘텀', category: 'ETF', description: 'KOSPD 기반 ETF 모멘텀 전략. 단기 수익률 상위 ETF 추세 추종', params: { position_size: 0.2 }, enabled: true },
    { name: 'KOSPD ETF 괴리율 역전', category: 'ETF', description: 'ETF 괴리율이 과도한 할인 상태에서 매수, 프리미엄 상태에서 매도', params: { position_size: 0.15 }, enabled: true },
  ];
  
  return new Response(JSON.stringify({ strategies }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}