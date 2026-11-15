"""
시세 데이터 수집 모듈 (키움 API + 네이버 금융 + 무료 데이터)
"""

import os
import json
import logging
import urllib.request
from datetime import datetime, timedelta
import numpy as np

logger = logging.getLogger(__name__)


class DataCollector:
    """시세 데이터 수집기"""

    KOSPI200 = {
        "005930": "삼성전자", "000660": "SK하이닉스", "373220": "LG에너지솔루션",
        "207940": "삼성바이오로직스", "005380": "현대차", "068270": "셀트리온",
        "105560": "KB금융", "035420": "NAVER", "000270": "기아",
        "005490": "POSCO홀딩스", "066570": "LG전자", "015760": "한국전력",
        "323410": "카카오뱅크", "352820": "하이브", "086790": "하나금융지주",
        "033780": "KT&G", "018260": "삼성SDI", "011170": "롯데케미칼",
    }

    def __init__(self, kiwoom=None):
        self.kiwoom = kiwoom  # None이면 네이버 금융 API 사용
        self.cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cache")
        os.makedirs(self.cache_dir, exist_ok=True)

    def get_daily_chart(self, stock_code, count=200):
        """일봉 차트 조회 (네이버 금융 → 키움 API 순차 시도)"""
        # 1. 네이버 금융 API 시도
        data = self._fetch_naver_chart(stock_code, count)
        if data:
            return data
        # 2. 키움 API 시도 (32bit Python 필요)
        if self.kiwoom:
            return self._fetch_kiwoom_chart(stock_code, count)
        # 3. 샘플 데이터
        logger.info(f"데이터 없음, 샘플 생성: {stock_code}")
        return self._generate_sample(stock_code, count)

    def _fetch_naver_chart(self, stock_code, count=200):
        """네이버 금융 API로 일봉 데이터 조회"""
        try:
            url = f"https://api.finance.naver.com/siseJson.naver?symbol={stock_code}&requestType=1&startTime=20250101&endTime={datetime.now().strftime('%Y%m%d')}&timeframe=day"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                text = resp.read().decode("utf-8")
                import ast
                rows = ast.literal_eval(text)
                if len(rows) > 1:
                    data = []
                    for row in rows[1:]:  # 첫 행은 헤더
                        if len(row) >= 6:
                            data.append({
                                "date": str(row[0]),
                                "open": int(row[1]), "high": int(row[2]),
                                "low": int(row[3]), "close": int(row[4]),
                                "volume": int(row[5]),
                                "stock_code": stock_code,
                                "stock_name": self.KOSPI200.get(stock_code, stock_code),
                            })
                    return data[-count:]
        except Exception as e:
            logger.debug(f"네이버 금융 API 실패 [{stock_code}]: {e}")
        return None

    def _fetch_kiwoom_chart(self, stock_code, count=200):
        """키움 API로 일봉 조회"""
        try:
            df = self.kiwoom.kiwoom.GetMasterChartInfo(stock_code, count, "day")
            if df is not None and not df.empty:
                import pandas as pd
                df = df.rename(columns={"일자": "date", "시가": "open", "고가": "high", "저가": "low", "종가": "close", "거래량": "volume"})
                df["date"] = pd.to_datetime(df["date"].astype(str))
                df = df.sort_values("date")
                return df.to_dict("records")
        except Exception as e:
            logger.error(f"키움 차트 오류 [{stock_code}]: {e}")
        return None

    def _generate_sample(self, stock_code, count=200):
        """샘플 OHLCV 생성"""
        np.random.seed(int(stock_code[-4:], 16) % 10000)
        base = {"005930": 72000, "000660": 180000, "035420": 210000}.get(stock_code, 50000)
        d = datetime(2025, 1, 2)
        p = base
        data = []
        for _ in range(count * 2):
            d += timedelta(days=1)
            if d.weekday() >= 5: continue
            ch = np.random.normal(0.0005, 0.018)
            o, h, l, c = p, p*(1+abs(np.random.normal(0,0.012))), p*(1-abs(np.random.normal(0,0.012))), p*(1+ch)
            v = int(np.random.uniform(300000, 5000000))
            p = c
            data.append({"date": d.strftime("%Y-%m-%d"), "open": round(o), "high": round(h), "low": round(l), "close": round(c), "volume": v,
                         "stock_code": stock_code, "stock_name": self.KOSPI200.get(stock_code, stock_code)})
        return data[:count]

    def get_current_price(self, stock_code):
        """네이버 금융 실시간 현재가"""
        if self.kiwoom:
            try:
                return abs(int(self.kiwoom.kiwoom.GetMasterLastPrice(stock_code)))
            except: pass
        try:
            url = f"https://polling.finance.naver.com/api/realtime?query=stock:{stock_code}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                j = json.loads(resp.read().decode("utf-8"))
                if j.get("result",{}).get("areas"):
                    d = j["result"]["areas"][0].get("datas",[])
                    if d: return int(d[0].get("nv",0))
        except: pass
        return None