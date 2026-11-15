"""
매매 전략 모듈
매수/매도 신호 생성 및 전략 관리
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)


class TradingStrategy:
    """매매 전략 클래스"""

    def __init__(self, analyzer):
        self.analyzer = analyzer
        self.config = self._load_config()

    def _load_config(self):
        """설정 로드"""
        try:
            from config import STRATEGY_CONFIG, ANALYSIS_CONFIG
            return {
                "strategy": STRATEGY_CONFIG,
                "analysis": ANALYSIS_CONFIG,
            }
        except ImportError:
            logger.warning("설정 파일을 찾을 수 없습니다. 기본값 사용")
            return {
                "strategy": {
                    "buy": {"enabled": True},
                    "sell": {"profit_target": 0.03, "stop_loss": -0.02},
                },
                "analysis": {},
            }

    def get_buy_candidates(self):
        """매수 후보 종목 조회"""
        # TODO: 조건검색식 또는 사용자 정의 로직으로 대체
        # 샘플 종목 리스트 (실제 사용 시 제거)
        sample_codes = []
        
        # config에서 조건검색식 이름 로드
        try:
            from config import CONDITIONS_CONFIG
            condition_names = CONDITIONS_CONFIG.get("condition_names", [])
            # 조건검색식으로 종목 조회하는 로직 추가 필요
        except:
            pass

        return sample_codes

    def check_buy_signal(self, df):
        """
        매수 신호 확인
        
        전략 예시:
        - 5일선이 20일선 돌파 (골든크로스)
        - RSI 30 이하에서 반등
        - 거래량 증가
        """
        if df is None or df.empty:
            return False

        signals = []
        config = self.config["analysis"]

        # 1. 이동평균선 골든크로스
        ma_short = config.get("ma_short", 5)
        ma_long = config.get("ma_mid", 20)
        
        if ma_short in df.columns and ma_long in df.columns:
            prev_short = df[ma_short].iloc[-2] if len(df) > 1 else 0
            prev_long = df[ma_long].iloc[-2] if len(df) > 1 else 0
            curr_short = df[ma_short].iloc[-1]
            curr_long = df[ma_long].iloc[-1]
            
            if prev_short <= prev_long and curr_short > curr_long:
                signals.append("golden_cross")
                logger.debug("골든크로스 감지")

        # 2. RSI 과매도
        if "RSI" in df.columns:
            rsi = df["RSI"].iloc[-1]
            rsi_oversold = config.get("rsi_oversold", 30)
            if rsi <= rsi_oversold:
                signals.append("rsi_oversold")
                logger.debug(f"RSI 과매도: {rsi:.1f}")

        # 3. 볼린저 밴드 하단 돌파
        if "Bollinger_Lower" in df.columns:
            close = df["close"].iloc[-1]
            lower = df["Bollinger_Lower"].iloc[-1]
            if close <= lower:
                signals.append("bollinger_lower")
                logger.debug("볼린저 밴드 하단 도달")

        # 4. 거래량 급증
        if "volume" in df.columns and "Volume_MA" in df.columns:
            curr_vol = df["volume"].iloc[-1]
            vol_ma = df["Volume_MA"].iloc[-1]
            if vol_ma > 0 and curr_vol > vol_ma * 2:
                signals.append("volume_spike")
                logger.debug("거래량 급증 감지")

        # 매수 조건: 최소 1개 이상 신호 발생
        result = len(signals) >= 1
        if result:
            logger.info(f"매수 신호 발생: {', '.join(signals)}")
        
        return result

    def check_sell_signal(self, profit_rate):
        """
        매도 신호 확인
        
        Args:
            profit_rate: 현재 수익률 (예: 0.03 = 3%)
        
        Returns:
            True: 매도 신호
        """
        config = self.config["strategy"]["sell"]
        
        # 목표 수익률 도달
        if profit_rate >= config.get("profit_target", 0.03):
            logger.info(f"목표 수익률 도달: {profit_rate*100:.2f}%")
            return True
        
        # 손절
        if profit_rate <= config.get("stop_loss", -0.02):
            logger.info(f"손절: {profit_rate*100:.2f}%")
            return True
        
        return False

    def validate_buy_price(self, current_price):
        """매수 가격 유효성 검증"""
        config = self.config["strategy"]["buy"]
        max_price = config.get("max_buy_price", 1000000)
        min_amount = config.get("min_order_amount", 100000)
        
        if current_price > max_price:
            logger.debug(f"가격 초과: {current_price:,} > {max_price:,}")
            return False
        
        if current_price <= 0:
            return False
        
        return True