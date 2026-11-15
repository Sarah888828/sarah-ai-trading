"""
주식 자동매매 시스템 - Flask 웹 대시보드
실행: python web_dashboard.py
기본 주소: http://127.0.0.1:5000
"""

import json, os, logging
from datetime import datetime, timedelta
from flask import Flask, jsonify, request

from db.manager import DatabaseManager
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DATA_DIR, "trading.db")


def _is_market_open():
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    start = now.replace(hour=9, minute=0, second=0)
    end = now.replace(hour=15, minute=30, second=0)
    return start <= now <= end


def _sample_positions():
    return [
        {"stock_code": "005930", "stock_name": "삼성전자", "buy_price": 72000,
         "quantity": 10, "invested": 720000, "current_price": 73800,
         "profit_rate": 2.5, "buy_date": "2026-11-01"},
        {"stock_code": "000660", "stock_name": "SK하이닉스", "buy_price": 185000,
         "quantity": 5, "invested": 925000, "current_price": 192000,
         "profit_rate": 3.78, "buy_date": "2026-11-05"},
        {"stock_code": "035420", "stock_name": "NAVER", "buy_price": 215000,
         "quantity": 3, "invested": 645000, "current_price": 208000,
         "profit_rate": -3.26, "buy_date": "2026-11-08"},
    ]


def _sample_trades():
    return [
        {"type": "buy", "stock_name": "삼성전자", "stock_code": "005930",
         "price": 71500, "quantity": 10, "amount": 715000, "profit_rate": None,
         "date": "2026-11-01 09:15"},
        {"type": "buy", "stock_name": "SK하이닉스", "stock_code": "000660",
         "price": 183000, "quantity": 5, "amount": 915000, "profit_rate": None,
         "date": "2026-11-05 10:30"},
        {"type": "sell", "stock_name": "LG에너지솔루션", "stock_code": "373220",
         "price": 420000, "quantity": 2, "amount": 840000, "profit_rate": 5.2,
         "date": "2026-11-10 14:20"},
        {"type": "buy", "stock_name": "NAVER", "stock_code": "035420",
         "price": 215000, "quantity": 3, "amount": 645000, "profit_rate": None,
         "date": "2026-11-08 11:00"},
        {"type": "sell", "stock_name": "현대차", "stock_code": "005380",
         "price": 245000, "quantity": 4, "amount": 980000, "profit_rate": -1.5,
         "date": "2026-11-07 15:00"},
    ]
def _sample_logs():
    return [
        {"time": (datetime.now() - timedelta(minutes=5)).strftime("%H:%M:%S"),
         "message": "INFO     시스템 초기화 완료"},
        {"time": (datetime.now() - timedelta(minutes=4)).strftime("%H:%M:%S"),
         "message": "INFO     데이터베이스 연결 성공"},
        {"time": (datetime.now() - timedelta(minutes=3)).strftime("%H:%M:%S"),
         "message": "INFO     매수 신호 감지: 삼성전자(005930)"},
        {"time": (datetime.now() - timedelta(minutes=2)).strftime("%H:%M:%S"),
         "message": "INFO     매수 주문 실행: 10주 @ 73,800원"},
        {"time": (datetime.now() - timedelta(minutes=1)).strftime("%H:%M:%S"),
         "message": "INFO     주문 체결 완료"},
        {"time": datetime.now().strftime("%H:%M:%S"),
         "message": "INFO     다음 매매 체크까지 대기"},
    ]


def _load_positions():
    try:
        db = DatabaseManager(d1_api_base=os.environ.get("D1_API_BASE"))
        return db.get_positions()
    except:
        return _sample_positions()


def _load_trades():
    try:
        db = DatabaseManager(d1_api_base=os.environ.get("D1_API_BASE"))
        return db.get_trade_logs()
    except:
        return _sample_trades()


def _load_logs():
    log_file = os.path.join(os.path.dirname(__file__), "logs", "trading.log")
    if os.path.exists(log_file):
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
            logs = []
            for line in lines[-50:]:
                parts = line.strip().split(" - ", 1)
                if len(parts) == 2:
                    logs.append({"time": parts[0].strip("[]"), "message": parts[1]})
            if logs:
                return logs
        except:
            pass
    return _sample_logs()


def _get_invested():
    return sum(p.get("invested", 0) for p in _load_positions())


def _get_profit_rate():
    positions = _load_positions()
    if not positions:
        return 0.0
    total = sum(p.get("invested", 0) for p in positions)
    if total == 0:
        return 0.0
    profit = sum(p.get("invested", 0) * p.get("profit_rate", 0) / 100 for p in positions)
    return round(profit / total * 100, 2)
@app.route("/")
def index():
    return open(os.path.join(os.path.dirname(__file__), "static", "dashboard.html"), encoding="utf-8").read()
@app.route("/api/status")
def api_status():
    return jsonify({
        "status": "running",
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "market_open": _is_market_open(),
    })


@app.route("/api/positions")
def api_positions():
    positions = _load_positions()
    return jsonify({"positions": positions, "count": len(positions)})


@app.route("/api/account")
def api_account():
    invested = _get_invested()
    return jsonify({
        "total_balance": 10000000,
        "invested": invested,
        "available": 10000000 - invested,
        "total_profit_rate": _get_profit_rate(),
    })


@app.route("/api/trades")
def api_trades():
    trades = _load_trades()
    return jsonify({"trades": trades, "count": len(trades)})


@app.route("/api/logs")
def api_logs():
    logs = _load_logs()
    return jsonify({"logs": logs})


@app.route("/api/strategies")
def api_strategies():
    return jsonify({"strategies": [
        {"name": "골든크로스", "enabled": True, "description": "5일선이 20일선 돌파 시 매수",
         "params": {"short_ma": 5, "long_ma": 20}},
        {"name": "RSI 과매도/과매수", "enabled": True,
         "description": "RSI 30 이하 매수, 70 이상 매도",
         "params": {"period": 14, "oversold": 30, "overbought": 70}},
        {"name": "볼린저 밴드", "enabled": True,
         "description": "하단 돌파 매수, 상단 돌파 매도",
         "params": {"period": 20, "std_dev": 2}},
    ]})

@app.route("/api/backtest/run")
def api_backtest_run():
    try:
        from backtest import BacktestEngine, load_strategy
        idx = request.args.get("strategy", default=None, type=int)
        from run_backtest import load_strategies, generate_sample_data
        strategies = load_strategies()
        if idx is not None and 0 <= idx < len(strategies):
            sc = strategies[idx]
        else:
            sp = os.path.join(os.path.dirname(__file__), "backtest", "sample_strategy.json")
            with open(sp, "r", encoding="utf-8") as f:
                sc = json.load(f)
        s = load_strategy(sc)
        d = generate_sample_data(252)
        r = BacktestEngine(initial_capital=10000000).run(d, s)
        return jsonify(r.to_dict())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/backtest/strategies")
def api_backtest_strategies():
    from run_backtest import load_strategies
    strategies = load_strategies()
    r = []
    for i, s in enumerate(strategies):
        r.append({"index": i, "name": s.get("name", f"Strategy {i}"),
                  "category": s.get("category", "General"),
                  "description": s.get("description", "")[:80]})
    return jsonify({"strategies": r})

@app.route("/api/backtest/run_all")
def api_backtest_run_all():
    try:
        from backtest import BacktestEngine, load_strategy
        from run_backtest import load_strategies, generate_sample_data
        strategies = load_strategies()
        d = generate_sample_data(252)
        engine = BacktestEngine(initial_capital=10000000)
        results = []
        for s in strategies:
            strategy = load_strategy(s)
            r = engine.run(d, strategy)
            results.append({"name": s["name"], "category": s.get("category", "General"),
                            "result": r.to_dict()})
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# 각 탭 페이지 라우트 (독립 페이지)
# ============================================================

@app.route("/page/summary")
def page_summary():
    """AI 요약 페이지 - 시장 개요 + 계좌 요약"""
    try:
        from run_backtest import generate_sample_data
        data = generate_sample_data(30)
        up = sum(1 for d in data if d["close"] > data[data.index(d)-1]["close"]) if len(data) > 1 else 0
        down = len(data) - up - 1
        return jsonify({
            "kospi": {"price": 5290.53, "change": -0.98, "open": True},
            "kosdaq": {"price": 699.66, "change": 0.45, "open": True},
            "market_status": "장중",
            "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ai_insight": f"오늘 시장은 혼조세를 보이고 있습니다. 상승 {up}개, 하락 {down}개 종목.",
        })
    except:
        return jsonify({"kospi": {"price": 5290, "change": -0.98}, "kosdaq": {"price": 700, "change": 0.45}, "market_status": "장중"})

@app.route("/page/portfolio")
def page_portfolio():
    """포트폴리오 페이지 - 보유 종목 + 거래내역"""
    invested = _get_invested()
    return jsonify({
        "positions": _load_positions(),
        "trades": _load_trades(),
        "account": {"total": 10000000, "invested": invested, "available": 10000000 - invested, "profit_rate": _get_profit_rate()},
    })

@app.route("/page/strategies")
def page_strategies():
    """전략 페이지 - 전략 라이브러리"""
    from run_backtest import load_strategies
    strategies = load_strategies()
    return jsonify({"strategies": [{"index": i, "name": s.get("name"), "category": s.get("category", "General"),
        "description": s.get("description", ""), "params": s.get("buy", [])} for i, s in enumerate(strategies)]})

@app.route("/page/backtest")
def page_backtest():
    """백테스팅 페이지 - 전략 성과 비교"""
    try:
        from backtest import BacktestEngine, load_strategy
        from run_backtest import load_strategies, generate_sample_data
        strategies = load_strategies()
        data = generate_sample_data(252)
        engine = BacktestEngine(initial_capital=10000000)
        results = []
        for s in strategies:
            try:
                strategy = load_strategy(s)
                r = engine.run(data, strategy)
                results.append({"name": s["name"], "category": s.get("category", "General"), "result": r.to_dict()})
            except:
                results.append({"name": s.get("name", "?"), "category": s.get("category", "General"), "result": {"summary": {"total_return": 0, "win_rate": 0, "max_drawdown": 0, "profit_factor": 0, "total_trades": 0}}})
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e), "results": []}), 500

@app.route("/page/logs")
def page_logs():
    """로그 페이지 - 시스템 로그"""
    logs = _load_logs()
    return jsonify({"logs": logs, "config": {}})
if __name__ == "__main__":
    print("=" * 50)
    print("   주식 자동매매 시스템 - 웹 대시보드")
    print(f"   접속: http://127.0.0.1:5000")
    print("=" * 50)
    app.run(host="127.0.0.1", port=5000, debug=True)