"""
데이터베이스 모델 정의 (SQLite)
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()


class Position(Base):
    """보유 포지션 테이블"""
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_code = Column(String(10), nullable=False, unique=True)
    stock_name = Column(String(50))
    buy_price = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    order_no = Column(String(20))
    buy_date = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class TradeLog(Base):
    """매매 내역 테이블"""
    __tablename__ = "trade_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_type = Column(String(10), nullable=False)  # buy / sell
    stock_code = Column(String(10), nullable=False)
    stock_name = Column(String(50))
    price = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    amount = Column(Integer, nullable=False)  # 총 금액
    profit_rate = Column(Float)  # 수익률 (매도 시)
    order_no = Column(String(20))
    traded_at = Column(DateTime, default=datetime.now)


class StockAnalysis(Base):
    """종목 분석 결과 테이블"""
    __tablename__ = "stock_analysis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_code = Column(String(10), nullable=False)
    analysis_date = Column(DateTime, default=datetime.now)
    current_price = Column(Integer)
    ma_short = Column(Float)
    ma_mid = Column(Float)
    ma_long = Column(Float)
    rsi = Column(Float)
    macd = Column(Float)
    signal_score = Column(Integer)  # 종합 신호 점수