"""
데이터베이스 관리 모듈
"""

import os
import logging
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base, Position, TradeLog

logger = logging.getLogger(__name__)


class DatabaseManager:
    """데이터베이스 관리 클래스"""

    def __init__(self, db_path=None):
        if db_path is None:
            db_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), 
                "data", "trading.db"
            )
        
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.engine = create_engine(f"sqlite:///{db_path}")
        self.Session = sessionmaker(bind=self.engine)
        self.db_path = db_path

    def initialize(self):
        """데이터베이스 초기화 (테이블 생성)"""
        Base.metadata.create_all(self.engine)
        logger.info(f"데이터베이스 초기화 완료: {self.db_path}")

    def get_session(self):
        """세션 획득"""
        return self.Session()

    # --- 포지션 관리 ---

    def save_position(self, position_data):
        """포지션 저장"""
        session = self.get_session()
        try:
            # 기존 포지션 확인
            existing = session.query(Position).filter_by(
                stock_code=position_data["stock_code"]
            ).first()

            if existing:
                # 업데이트
                for key, value in position_data.items():
                    setattr(existing, key, value)
            else:
                position = Position(**position_data)
                session.add(position)

            session.commit()
            logger.debug(f"포지션 저장: {position_data.get('stock_code')}")
        except Exception as e:
            session.rollback()
            logger.error(f"포지션 저장 오류: {e}")
        finally:
            session.close()

    def get_positions(self):
        """전체 포지션 조회"""
        session = self.get_session()
        try:
            positions = session.query(Position).all()
            return [
                {
                    "stock_code": p.stock_code,
                    "stock_name": p.stock_name,
                    "buy_price": p.buy_price,
                    "quantity": p.quantity,
                    "buy_date": p.buy_date.strftime("%Y-%m-%d %H:%M:%S") if p.buy_date else None,
                }
                for p in positions
            ]
        except Exception as e:
            logger.error(f"포지션 조회 오류: {e}")
            return []
        finally:
            session.close()

    def remove_position(self, stock_code):
        """포지션 삭제"""
        session = self.get_session()
        try:
            session.query(Position).filter_by(stock_code=stock_code).delete()
            session.commit()
            logger.debug(f"포지션 삭제: {stock_code}")
        except Exception as e:
            session.rollback()
            logger.error(f"포지션 삭제 오류: {e}")
        finally:
            session.close()

    # --- 매매 로그 관리 ---

    def save_trade_log(self, log_data):
        """매매 로그 저장"""
        session = self.get_session()
        try:
            log = TradeLog(**log_data)
            session.add(log)
            session.commit()
            logger.info(f"매매 로그 저장: {log_data.get('trade_type')} "
                       f"{log_data.get('stock_code')}")
        except Exception as e:
            session.rollback()
            logger.error(f"매매 로그 저장 오류: {e}")
        finally:
            session.close()

    def get_trade_logs(self, limit=50):
        """매매 내역 조회"""
        session = self.get_session()
        try:
            logs = session.query(TradeLog).order_by(
                TradeLog.traded_at.desc()
            ).limit(limit).all()
            return [
                {
                    "type": log.trade_type,
                    "stock": f"{log.stock_name}({log.stock_code})",
                    "price": log.price,
                    "quantity": log.quantity,
                    "amount": log.amount,
                    "profit": f"{log.profit_rate*100:.2f}%" if log.profit_rate else "-",
                    "date": log.traded_at.strftime("%Y-%m-%d %H:%M"),
                }
                for log in logs
            ]
        except Exception as e:
            logger.error(f"매매 로그 조회 오류: {e}")
            return []
        finally:
            session.close()

    def close(self):
        """데이터베이스 연결 종료"""
        self.engine.dispose()
        logger.info("데이터베이스 연결 종료")