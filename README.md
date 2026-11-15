# 키움증권 OpenAPI+ 주식 자동매매 시스템

## 📋 개요
Python 기반 키움증권 OpenAPI+를 활용한 주식 자동매매 시스템입니다.

## ⚙️ 사전 준비
1. **키움증권 계좌 개설** (https://www.kiwoom.com)
2. **OpenAPI+ 사용 신청** 
   - 키움증권 홈페이지 > OpenAPI+ > 사용신청
   - HTS(영웅문) 설치 필수
3. **KOA Studio 설치**
   - 키움증권 OpenAPI+ 페이지에서 KOA Studio 다운로드
   - 개발에 필요한 API 레퍼런스 제공

## 🚀 설치 및 실행

### 1. Python 가상환경 생성
```bash
python -m venv venv
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows
```

### 2. 패키지 설치
```bash
pip install -r requirements.txt
```

### 3. 설정 파일 작성
`config.py` 파일을 열어 계좌 정보를 설정합니다.

### 4. 실행
```bash
python main.py
```

> ⚠️ **중요**: 키움 OpenAPI+는 32비트 Python 환경에서만 동작합니다.
> 반드시 32비트 Python(3.8~3.11)을 설치해주세요.
> Windows에서만 실행 가능합니다.

## 📁 프로젝트 구조
```
stock-trading/
├── main.py                 # 메인 실행 파일
├── config.py               # 설정 파일
├── kiwoom/
│   ├── client.py           # 키움 OpenAPI+ 래퍼  
│   └── conditions.py       # 조건검색식
├── trader/
│   ├── strategy.py         # 매매 전략
│   └── executor.py         # 주문 실행
├── data/
│   ├── collector.py        # 시세 데이터 수집
│   └── analyzer.py         # 기술적 분석
├── db/
│   ├── models.py           # DB 모델
│   └── manager.py          # DB 관리
└── utils/
    └── logger.py           # 로깅
```

## 🛡️ 주의사항
- 실제 투자 전 반드시 **모의투자**로 충분히 테스트하세요
- 자동매매는 원금 손실의 위험이 있습니다
- API 사용량과 호출 제한을 준수하세요
- 보안을 위해 `config.py`의 계좌 정보는 `.gitignore`에 추가하세요