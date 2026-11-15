"""
백테스팅 전략 정의
Logic Works 방식: 선언적 JSON 조건으로 매수/매도 신호 정의
"""

import logging

logger = logging.getLogger(__name__)


def load_strategy(config):
    """
    JSON 설정으로부터 전략 로드
    
    Args:
        config: 전략 설정 딕셔너리
    
    Returns:
        Strategy 객체
    """
    name = config.get("name", "Unknown")
    logger.info(f"전략 로드: {name}")
    return Strategy(config)


class Strategy:
    """백테스팅 전략 클래스"""

    def __init__(self, config):
        self.name = config.get("name", "전략")
        self.buy_conditions = config.get("buy", [])
        self.sell_conditions = config.get("sell", [])
        self.position_size = config.get("position_size", 0.3)
        self.max_positions = config.get("max_positions", 3)
        self.stop_loss = config.get("stop_loss", -0.02)
        self.take_profit = config.get("take_profit", 0.05)

    def check_buy(self, row, prev_row, position_count):
        """매수 조건 체크"""
        if position_count >= self.max_positions:
            return False

        results = []
        for cond in self.buy_conditions:
            result = self._evaluate_condition(cond, row, prev_row)
            results.append(result)

        if self.buy_conditions:
            # AND 조건: 모두 만족
            logic = self.buy_conditions[0].get("logic", "AND")
            if logic == "AND":
                return all(results)
            else:
                return any(results)
        return False

    def check_sell(self, row, prev_row, buy_price, current_price):
        """매도 조건 체크"""
        profit_rate = (current_price - buy_price) / buy_price

        # 손절/익절 우선 체크
        if profit_rate <= self.stop_loss:
            return True, f"손절({profit_rate*100:.1f}%)"
        if profit_rate >= self.take_profit:
            return True, f"익절({profit_rate*100:.1f}%)"

        # 추가 매도 조건 체크
        for cond in self.sell_conditions:
            if self._evaluate_condition(cond, row, prev_row):
                return True, cond.get("name", "매도신호")

        return False, None

    def _evaluate_condition(self, cond, row, prev_row):
        """단일 조건 평가"""
        indicator = cond.get("indicator", "")
        operator = cond.get("operator", ">")
        value = cond.get("value")

        current_val = self._get_indicator_value(indicator, row)
        prev_val = self._get_indicator_value(indicator, prev_row) if prev_row is not None else None

        if current_val is None:
            return False

        # 크로스오버 조건
        if operator == "cross_above" and prev_val is not None:
            return prev_val <= value and current_val > value
        if operator == "cross_below" and prev_val is not None:
            return prev_val >= value and current_val < value

        # 비교 조건
        if operator == ">":
            return current_val > value
        if operator == ">=":
            return current_val >= value
        if operator == "<":
            return current_val < value
        if operator == "<=":
            return current_val <= value
        if operator == "==":
            return current_val == value

        return False

    def _get_indicator_value(self, indicator, row):
        """지표값 조회"""
        if row is None:
            return None
        return row.get(indicator)