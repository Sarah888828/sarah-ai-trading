"""
시세 데이터 수집 모듈
"""

import logging
import pandas as pd
from config import DATA_CONFIG

logger = logging.getLogger(__name__)


class DataCollector:
    """시세 데이터 수집 클래스"""

    def __init__(self, kiwoom):
        self.kiwoom = kiwoom
        self.data_config = DATA_CONFIG

    def get_daily_chart(self, stock_code, count=None):
        """
        일봉 차트 데이터 조회
        
        Args:
            stock_code: 종목코드
            count: 조회할 봉 개수 (기본: 설정값)
        
        Returns:
            DataFrame: OHLCV 데이터
        """
        if count is None:
            count = self.data_config.get("chart_count", 200)

        try:
            df = self.kiwoom.kiwoom.GetMasterChartInfo(
                stock_code, count, "day"
            )
            
            if df is None or df.empty:
                logger.warning(f"차트 데이터 없음: {stock_code}")
                return None

            # 컬럼명 정리
            df = df.rename(columns={
                "일자": "date",
                "시가": "open",
                "고가": "high",
                "저가": "low",
                "종가": "close",
                "거래량": "volume",
            })

            # 날짜 정렬 (오름차순)
            if "date" in df.columns:
                df["date"] = pd.to_datetime(df["date"].astype(str))
                df = df.sort_values("date").reset_index(drop=True)

            logger.debug(f"차트 데이터 수집 완료: {stock_code} ({len(df)}봉)")
            return df

        except Exception as e:
            logger.error(f"차트 데이터 조회 오류 [{stock_code}]: {e}")
            return None

    def get_current_price(self, stock_code):
        """현재가 조회"""
        return self.kiwoom.get_current_price(stock_code)

    def get_tick_data(self, stock_code, count=100):
        """틱 데이터 조회"""
        try:
            df = self.kiwoom.kiwoom.GetMasterChartInfo(
                stock_code, count, "tick"
            )
            return df
        except Exception as e:
            logger.error(f"틱 데이터 조회 오류 [{stock_code}]: {e}")
            return None