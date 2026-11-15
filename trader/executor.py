"""
주문 실행 및 포지션 관리 모듈
"""

import logging
from datetime import datetime
from config import STRATEGY_CONFIG

logger = logging.getLogger(__name__)


class OrderExecutor:
    """주문 실행 및 포지션 관리 클래스"""

    def __init__(self, kiwoom, db_manager):
        self.kiwoom = kiwoom
        self.db = db_manager
        self.config = STRATEGY_CONFIG
        self.max_positions = self.config.get("max_positions", 5)
        self.positions = []  # 보유 포지션 리스트

    @property
    def position_count(self):
        """현재 보유 종목 수"""
        return len(self.positions)

    def get_positions(self):
        """보유 포지션 조회"""
        try:
            # DB에서 보유 포지션 조회
            self.positions = self.db.get_positions() or []
            return self.positions
        except Exception as e:
            logger.error(f"포지션 조회 실패: {e}")
            return []

    def buy(self, stock_code, price):
        """
        매수 주문 실행
        
        Args:
            stock_code: 종목코드
            price: 현재가
        """
        # 최대 포지션 수 체크
        if self.position_count >= self.max_positions:
            logger.warning("최대 보유 종목 수 초과")
            return None

        # 매수 가능 금액 계산
        max_amount = self.config.get("max_amount_per_order", 1000000)
        quantity = max(1, int(max_amount / price))

        if quantity <= 0:
            logger.warning(f"매수 수량 부족: {quantity}")
            return None

        # 주문 실행
        logger.info(f"매수 주문: {stock_code} {quantity}주 @ {price:,}원 "
                   f"(총 {price * quantity:,}원)")

        order_no = self.kiwoom.send_order(
            order_type=1,  # 1=매수
            stock_code=stock_code,
            quantity=quantity,
            price=price,
        )

        if order_no:
            # DB에 포지션 저장
            position_data = {
                "stock_code": stock_code,
                "stock_name": self.kiwoom.get_stock_name_by_code(stock_code),
                "buy_price": price,
                "quantity": quantity,
                "order_no": order_no,
                "buy_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            self.db.save_position(position_data)
            logger.info(f"매수 완료: {position_data['stock_name']} ({stock_code})")
        else:
            logger.error(f"매수 주문 실패: {stock_code}")

        return order_no

    def sell(self, stock_code, price, quantity):
        """
        매도 주문 실행
        
        Args:
            stock_code: 종목코드
            price: 현재가
            quantity: 매도 수량
        """
        if quantity <= 0:
            logger.warning(f"매도 수량 부족: {quantity}")
            return None

        # 주문 실행
        logger.info(f"매도 주문: {stock_code} {quantity}주 @ {price:,}원 "
                   f"(총 {price * quantity:,}원)")

        order_no = self.kiwoom.send_order(
            order_type=2,  # 2=매도
            stock_code=stock_code,
            quantity=quantity,
            price=price,
        )

        if order_no:
            # DB에서 포지션 제거
            self.db.remove_position(stock_code)
            # 메모리에서도 제거
            self.positions = [p for p in self.positions 
                            if p["stock_code"] != stock_code]
            logger.info(f"매도 완료: {stock_code}")
        else:
            logger.error(f"매도 주문 실패: {stock_code}")

        return order_no

    def cancel_order(self, order_no):
        """주문 취소"""
        try:
            result = self.kiwoom.dynamic_call(
                "SendOrder", "자동매매취소", "0101",
                self.kiwoom.account_number, 3,  # 3=취소
                "", 0, "", order_no
            )
            if result == 0:
                logger.info(f"주문 취소 성공: {order_no}")
                return True
            else:
                logger.error(f"주문 취소 실패: {order_no}")
                return False
        except Exception as e:
            logger.error(f"주문 취소 오류: {e}")
            return False