"""
키움증권 OpenAPI+ 기반 주식 자동매매 시스템
메인 실행 파일
"""

import sys
import time
import signal
import schedule
from datetime import datetime

from utils.logger import setup_logger
from kiwoom.client import KiwoomClient
from trader.strategy import TradingStrategy
from trader.executor import OrderExecutor
from data.collector import DataCollector
from data.analyzer import TechnicalAnalyzer
from db.manager import DatabaseManager


class AutoTradingSystem:
    """자동매매 시스템 메인 클래스"""

    def __init__(self):
        self.logger = setup_logger()
        self.is_running = False
        self.kiwoom = None
        self.strategy = None
        self.executor = None
        self.collector = None
        self.analyzer = None
        self.db = None

    def initialize(self):
        """시스템 초기화"""
        self.logger.info("=" * 50)
        self.logger.info("키움증권 자동매매 시스템 시작")
        self.logger.info("=" * 50)

        # DB 초기화
        self.db = DatabaseManager()
        self.db.initialize()
        self.logger.info("✓ 데이터베이스 초기화 완료")

        # 키움증권 연결
        self.kiwoom = KiwoomClient()
        if not self.kiwoom.connect():
            self.logger.error("키움증권 연결 실패")
            return False
        self.logger.info("✓ 키움증권 OpenAPI+ 연결 완료")

        # 모듈 초기화
        self.collector = DataCollector(self.kiwoom)
        self.analyzer = TechnicalAnalyzer()
        self.strategy = TradingStrategy(self.analyzer)
        self.executor = OrderExecutor(self.kiwoom, self.db)
        
        self.logger.info("✓ 자동매매 시스템 초기화 완료")
        return True

    def run_daily_routine(self):
        """일일 매매 루틴 실행"""
        now = datetime.now()
        self.logger.info(f"일일 루틴 실행: {now.strftime('%Y-%m-%d %H:%M:%S')}")

        # 1. 보유 종목 확인
        positions = self.executor.get_positions()
        self.logger.info(f"보유 종목: {len(positions)}개")

        if not positions:
            self.logger.info("보유 종목 없음 → 신규 매수 검토")
            self._check_buy_opportunities()
        else:
            # 2. 보유 종목 매도 검토
            self._check_sell_opportunities(positions)

    def _check_buy_opportunities(self):
        """신규 매수 기회 검토"""
        # 조건검색식 기반 종목 조회
        stock_list = self.strategy.get_buy_candidates()
        
        for stock_code in stock_list:
            if self.executor.position_count >= self.executor.max_positions:
                break

            # 데이터 수집
            df = self.collector.get_daily_chart(stock_code)
            if df is None or df.empty:
                continue

            # 기술적 분석
            df = self.analyzer.analyze(df)
            
            # 매수 조건 확인
            if self.strategy.check_buy_signal(df):
                # 현재가 조회
                current_price = self.collector.get_current_price(stock_code)
                if current_price and self.strategy.validate_buy_price(current_price):
                    self.logger.info(f"매수 신호 감지: {stock_code} @ {current_price:,}원")
                    self.executor.buy(stock_code, current_price)

    def _check_sell_opportunities(self, positions):
        """보유 종목 매도 검토"""
        for position in positions:
            stock_code = position["stock_code"]
            buy_price = position["buy_price"]
            
            # 현재가 조회
            current_price = self.collector.get_current_price(stock_code)
            if not current_price:
                continue

            # 수익률 계산
            profit_rate = (current_price - buy_price) / buy_price
            
            # 매도 조건 확인
            if self.strategy.check_sell_signal(profit_rate):
                self.logger.info(f"매도 신호 감지: {stock_code} "
                               f"(수익률: {profit_rate*100:.2f}%)")
                self.executor.sell(stock_code, current_price, position["quantity"])

    def start_realtime_monitor(self):
        """실시간 모니터링 시작"""
        self.kiwoom.start_realtime()
        self.logger.info("✓ 실시간 모니터링 시작")

    def stop(self):
        """시스템 종료"""
        self.logger.info("자동매매 시스템 종료 중...")
        self.is_running = False
        
        if self.kiwoom:
            self.kiwoom.disconnect()
        
        if self.db:
            self.db.close()
        
        self.logger.info("자동매매 시스템이 정상 종료되었습니다.")

    def run(self):
        """메인 실행 루프"""
        if not self.initialize():
            return

        self.is_running = True
        
        # 스케줄 등록 (장중 5분마다 체크)
        schedule.every(5).minutes.do(self.run_daily_routine)
        
        # 시작 즉시 1회 실행
        self.run_daily_routine()
        
        # 실시간 모니터링 시작
        if self.collector.data_config["real_time_enabled"]:
            self.start_realtime_monitor()

        self.logger.info("자동매매 시스템 대기 중...")
        
        try:
            while self.is_running:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            self.logger.info("사용자 중단 요청")
        finally:
            self.stop()


def signal_handler(signum, frame):
    """시그널 핸들러"""
    print("\n\n종료 신호 감지. 안전하게 종료합니다...")
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    system = AutoTradingSystem()
    system.run()