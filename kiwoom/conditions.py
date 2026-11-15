"""
조건검색식 관리 모듈
키움증권 KOA Studio에서 등록한 조건검색식을 조회하고 관리
"""

import logging

logger = logging.getLogger(__name__)


class ConditionManager:
    """조건검색식 관리 클래스"""

    def __init__(self, kiwoom):
        self.kiwoom = kiwoom
        self.conditions = {}

    def load_conditions(self):
        """저장된 조건검색식 로드"""
        try:
            result = self.kiwoom.dynamic_call("GetConditionLoad")
            if result == 1:
                logger.info("조건검색식 로드 성공")
                return True
            else:
                logger.warning("조건검색식 로드 실패")
                return False
        except Exception as e:
            logger.error(f"조건검색식 로드 오류: {e}")
            return False

    def get_condition_list(self):
        """조건검색식 목록 조회"""
        try:
            conditions = self.kiwoom.dynamic_call("GetConditionNameList")
            self.conditions = {}
            
            if conditions:
                for item in conditions.split(";"):
                    if not item:
                        continue
                    parts = item.split(",")
                    if len(parts) == 2:
                        index, name = parts
                        self.conditions[name] = int(index)
            
            return self.conditions
        except Exception as e:
            logger.error(f"조건검색식 목록 조회 오류: {e}")
            return {}

    def get_stocks_by_condition(self, condition_name):
        """조건검색식으로 종목 조회"""
        if condition_name not in self.conditions:
            logger.warning(f"조건검색식을 찾을 수 없음: {condition_name}")
            return []

        try:
            condition_index = self.conditions[condition_name]
            stocks = self.kiwoom.dynamic_call(
                "SendCondition", "0101", condition_name, condition_index, 0
            )
            return stocks if stocks else []
        except Exception as e:
            logger.error(f"조건검색 오류 [{condition_name}]: {e}")
            return []