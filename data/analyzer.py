"""
기술적 분석 모듈
이동평균선, RSI, MACD, 볼린저 밴드 등 계산
"""

import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class TechnicalAnalyzer:
    """기술적 분석 클래스"""

    def __init__(self):
        from config import ANALYSIS_CONFIG
        self.config = ANALYSIS_CONFIG

    def analyze(self, df):
        """
        전체 기술적 분석 수행
        
        Args:
            df: OHLCV DataFrame
        
        Returns:
            DataFrame: 분석 결과가 추가된 데이터
        """
        if df is None or df.empty:
            return df

        df = df.copy()

        # 이동평균선
        df = self.add_moving_averages(df)

        # RSI
        df = self.add_rsi(df)

        # 볼린저 밴드
        df = self.add_bollinger_bands(df)

        # MACD
        df = self.add_macd(df)

        # 거래량 이동평균
        df = self.add_volume_ma(df)

        # 일일 수익률
        if "close" in df.columns:
            df["returns"] = df["close"].pct_change()

        return df

    def add_moving_averages(self, df):
        """이동평균선 추가"""
        config = self.config
        for period in [config["ma_short"], config["ma_mid"], config["ma_long"]]:
            if "close" in df.columns:
                df[period] = df["close"].rolling(window=period).mean()
        return df

    def add_rsi(self, df):
        """RSI (Relative Strength Index) 추가"""
        period = self.config["rsi_period"]
        
        if "close" not in df.columns or len(df) < period + 1:
            return df

        delta = df["close"].diff()
        gain = delta.where(delta > 0, 0)
        loss = (-delta).where(delta < 0, 0)

        avg_gain = gain.rolling(window=period).mean()
        avg_loss = loss.rolling(window=period).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        df["RSI"] = 100 - (100 / (1 + rs))

        return df

    def add_bollinger_bands(self, df):
        """볼린저 밴드 추가"""
        period = self.config["bollinger_period"]
        num_std = self.config["bollinger_std"]

        if "close" not in df.columns or len(df) < period:
            return df

        df["Bollinger_MA"] = df["close"].rolling(window=period).mean()
        df["Bollinger_Std"] = df["close"].rolling(window=period).std()
        df["Bollinger_Upper"] = df["Bollinger_MA"] + (df["Bollinger_Std"] * num_std)
        df["Bollinger_Lower"] = df["Bollinger_MA"] - (df["Bollinger_Std"] * num_std)

        return df

    def add_macd(self, df):
        """MACD (Moving Average Convergence Divergence) 추가"""
        fast = self.config["macd_fast"]
        slow = self.config["macd_slow"]
        signal = self.config["macd_signal"]

        if "close" not in df.columns or len(df) < slow:
            return df

        df["EMA_Fast"] = df["close"].ewm(span=fast, adjust=False).mean()
        df["EMA_Slow"] = df["close"].ewm(span=slow, adjust=False).mean()
        df["MACD"] = df["EMA_Fast"] - df["EMA_Slow"]
        df["MACD_Signal"] = df["MACD"].ewm(span=signal, adjust=False).mean()
        df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]

        return df

    def add_volume_ma(self, df):
        """거래량 이동평균 추가"""
        if "volume" in df.columns and len(df) >= 20:
            df["Volume_MA"] = df["volume"].rolling(window=20).mean()
        return df