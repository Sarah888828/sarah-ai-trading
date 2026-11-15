"""
데이터베이스 관리 모듈
- 로컬 SQLite (매매 엔진용)
- Cloudflare D1 API (배포 환경용)
"""

import os
import json
import logging
import urllib.request

logger = logging.getLogger(__name__)


class DatabaseManager:
    """D1 + 로컬 SQLite 하이브리드 DB 관리자"""

    def __init__(self, d1_api_base=None, db_path=None):
        self.d1_api_base = d1_api_base
        self.local_mode = d1_api_base is None
        self.db_path = db_path
        if self.local_mode:
            self._init_sqlite(db_path)
        else:
            base = d1_api_base.rstrip("/")
            self.api_positions = f"{base}/positions"
            self.api_trades = f"{base}/trades"

    def _init_sqlite(self, db_path):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "trading.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from .models import Base
        self.engine = create_engine(f"sqlite:///{db_path}")
        self.Session = sessionmaker(bind=self.engine)
        self.Base = Base

    def initialize(self):
        if self.local_mode:
            self.Base.metadata.create_all(self.engine)
            logger.info("로컬 SQLite 초기화 완료")
        else:
            logger.info("D1 사용 (wrangler migrate 필요)")

    def _d1_request(self, url, method="GET", body=None):
        try:
            data = json.dumps(body).encode("utf-8") if body else None
            req = urllib.request.Request(url, data=data,
                headers={"Content-Type": "application/json"}, method=method)
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.error(f"D1 요청 실패 [{url}]: {e}")
            return None

    def save_position(self, data):
        if not self.local_mode:
            return self._d1_request(self.api_positions, "POST", data)
        from .models import Position
        session = self.Session()
        try:
            ex = session.query(Position).filter_by(stock_code=data["stock_code"]).first()
            if ex:
                for k, v in data.items(): setattr(ex, k, v)
            else:
                session.add(Position(**data))
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"포지션 저장 오류: {e}")
        finally:
            session.close()

    def get_positions(self):
        if not self.local_mode:
            r = self._d1_request(self.api_positions)
            return r.get("positions", []) if r else []
        from .models import Position
        session = self.Session()
        try:
            rows = session.query(Position).all()
            return [{"stock_code": r.stock_code, "stock_name": r.stock_name,
                "buy_price": r.buy_price, "quantity": r.quantity,
                "invested": r.buy_price * r.quantity,
                "current_price": r.buy_price, "profit_rate": 0.0,
                "buy_date": r.buy_date.strftime("%Y-%m-%d") if r.buy_date else "-"} for r in rows]
        except:
            return []
        finally:
            session.close()

    def remove_position(self, stock_code):
        if not self.local_mode:
            return self._d1_request(f"{self.api_positions}?code={stock_code}", "DELETE")
        from .models import Position
        session = self.Session()
        try:
            session.query(Position).filter_by(stock_code=stock_code).delete()
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"포지션 삭제 오류: {e}")
        finally:
            session.close()

    def save_trade_log(self, data):
        if not self.local_mode:
            return self._d1_request(self.api_trades, "POST", data)
        from .models import TradeLog
        session = self.Session()
        try:
            session.add(TradeLog(**data))
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"매매 로그 저장 오류: {e}")
        finally:
            session.close()

    def get_trade_logs(self, limit=50):
        if not self.local_mode:
            r = self._d1_request(self.api_trades)
            return r.get("trades", []) if r else []
        from .models import TradeLog
        session = self.Session()
        try:
            rows = session.query(TradeLog).order_by(TradeLog.traded_at.desc()).limit(limit).all()
            return [{"type": r.trade_type, "stock_name": r.stock_name, "stock_code": r.stock_code,
                "price": r.price, "quantity": r.quantity, "amount": r.amount,
                "profit_rate": round(r.profit_rate * 100, 2) if r.profit_rate else None,
                "date": r.traded_at.strftime("%Y-%m-%d %H:%M") if r.traded_at else "-"} for r in rows]
        except:
            return []
        finally:
            session.close()

    def close(self):
        if self.local_mode:
            self.engine.dispose()
        logger.info("DB 연결 종료")