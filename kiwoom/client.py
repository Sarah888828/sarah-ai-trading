"""
키움증권 OpenAPI+ 클라이언트 모듈
로그인, 연결 관리, 실시간 이벤트 처리
"""

import sys
import time
import logging
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import QEventLoop
from pykiwoom.kiwoom import Kiwoom

logger = logging.getLogger(__name__)


class KiwoomClient:
    """키움증권 OpenAPI+ 래퍼 클래스"""

    def __init__(self):
        self.app = None
        self.kiwoom = None
        self.is_connected = False
        self.account_number = None

    def connect(self):
        """키움증권 OpenAPI+ 연결 및 로그인"""
        try:
            # PyQt5 애플리케이션 생성 (32bit Python 필수)
            self.app = QApplication(sys.argv)
            self.kiwoom = Kiwoom()
            self.kiwoom.CommConnect()

            # 로그인 대기 (최대 30초)
            loop = QEventLoop()
            self.kiwoom.OnEventConnect.connect(lambda err: loop.quit())
            
            import time as _time
            _time.sleep(0.1)  # 이벤트 등록 대기
            loop.exec_()

            # 로그인 상태 확인
            state = self.kiwoom.GetConnectState()
            if state == 0:
                logger.error("로그인 실패: 서버 연결 안 됨")
                return False

            # 계좌번호 조회
            accounts = self.kiwoom.GetLoginInfo("ACCNO")
            if not accounts:
                logger.error("계좌번호를 찾을 수 없습니다.")
                return False

            self.account_number = accounts[0].strip()
            self.is_connected = True
            
            user_id = self.kiwoom.GetLoginInfo("USER_ID")
            logger.info(f"로그인 성공: {user_id}")
            logger.info(f"계좌번호: {self.account_number}")
            
            return True

        except Exception as e:
            logger.error(f"키움증권 연결 실패: {e}")
            logger.error("32비트 Python과 pykiwoom 설치를 확인하세요.")
            return False

    def disconnect(self):
        """연결 종료"""
        if self.kiwoom:
            self.kiwoom.CommTerminate()
        if self.app:
            self.app.quit()
        self.is_connected = False
        logger.info("키움증권 연결 종료")

    def get_account_info(self):
        """계좌 정보 조회"""
        if not self.is_connected:
            return None

        try:
            # 예수금 조회
            deposit = self.kiwoom.GetDepositInfo()
            
            # 계좌 잔고 조회
            balance = self.kiwoom.GetAccountBalance(self.account_number)
            
            return {
                "account": self.account_number,
                "deposit": deposit,
                "balance": balance,
            }
        except Exception as e:
            logger.error(f"계좌 정보 조회 실패: {e}")
            return None

    def get_stock_code_by_name(self, name):
        """종목명으로 종목코드 조회"""
        try:
            code = self.kiwoom.GetMasterCodeName(name)
            return code
        except:
            return None

    def get_stock_name_by_code(self, code):
        """종목코드로 종목명 조회"""
        try:
            name = self.kiwoom.GetMasterCodeName(code)
            return name
        except:
            return None

    def start_realtime(self):
        """실시간 데이터 수신 시작"""
        if not self.is_connected:
            logger.warning("연결되지 않은 상태입니다.")
            return

        # 실시간 시세 등록
        # self.kiwoom.OnReceiveRealData.connect(self._on_realtime_data)
        logger.info("실시간 데이터 수신 준비 완료")

    def _on_realtime_data(self, code, real_type, real_data):
        """실시간 데이터 수신 콜백"""
        try:
            if real_type == "주식시세":
                current_price = abs(int(real_data.get("현재가", "0")))
                logger.debug(f"실시간 시세 [{code}]: {current_price:,}원")
        except Exception as e:
            logger.error(f"실시간 데이터 처리 오류: {e}")

    def get_current_price(self, stock_code):
        """현재가 조회"""
        try:
            price = self.kiwoom.GetMasterLastPrice(stock_code)
            return abs(int(price))
        except Exception as e:
            logger.error(f"현재가 조회 실패 [{stock_code}]: {e}")
            return None

    def send_order(self, order_type, stock_code, quantity, price):
        """
        주문 전송
        
        Args:
            order_type: 1=매수, 2=매도
            stock_code: 종목코드
            quantity: 주문 수량
            price: 주문 가격 (0=시장가)
        """
        if not self.is_connected:
            logger.error("주문 실패: 연결 안 됨")
            return None

        try:
            # 주문 구분: 00=지정가, 03=시장가
            order_class = "00" if price > 0 else "03"
            
            order_no = self.kiwoom.SendOrder(
                "자동매매",          # 주문명
                "0101",             # 화면번호
                self.account_number,# 계좌번호
                order_type,         # 주문유형
                stock_code,         # 종목코드
                quantity,           # 주문수량
                price,              # 주문가격
                order_class,        # 주문구분
                ""                  # 원주문번호
            )
            
            if order_no:
                logger.info(f"주문 전송 성공: {order_no}")
            else:
                logger.error("주문 전송 실패")
            
            return order_no

        except Exception as e:
            logger.error(f"주문 오류: {e}")
            return None