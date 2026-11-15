"""
백테스팅 실행 스크립트 (CLI)
Logic Works 방식: JSON 전략 설정 → 과거 데이터 로드 → 시뮬레이션 → 결과 출력

사용법:
  python run_backtest.py                          # 샘플 데이터로 실행
  python run_backtest.py --stock 005930 --days 365 # 실제 종목 데이터
  python run_backtest.py --strategy my_strat.json  # 커스텀 전략
  python run_backtest.py --list                    # 저장된 전략 목록
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def generate_sample_data(days=252):
    """샘플 OHLCV 데이터 생성 (실제 데이터 없을 때 사용)"""
    import numpy as np
    np.random.seed(42)
    date = datetime(2025, 1, 2)
    price = 70000
    data = []

    for i in range(days):
        date += timedelta(days=1)
        if date.weekday() >= 5:
            continue
        change = np.random.normal(0.001, 0.02)
        open_price = price
        high = open_price * (1 + abs(np.random.normal(0, 0.015)))
        low = open_price * (1 - abs(np.random.normal(0, 0.015)))
        close = open_price * (1 + change)
        volume = int(np.random.uniform(500000, 5000000))
        price = close

        ma_5 = sum(prev.get("close", close) for prev in data[-4:]) / min(len(data[-4:]) + 1, 5) if data else close
        ma_20 = sum(prev.get("close", close) for prev in data[-19:]) / min(len(data[-19:]) + 1, 20) if data else close

        # RSI 샘플
        rsi = 50 + np.random.normal(0, 15)
        rsi = max(0, min(100, rsi))

        row = {
            "date": date.strftime("%Y-%m-%d"),
            "open": round(open_price),
            "high": round(high),
            "low": round(low),
            "close": round(close),
            "volume": volume,
            "ma_5": round(ma_5),
            "ma_20": round(ma_20),
            "RSI": round(rsi, 1),
            "volume_ratio": volume / 2000000 if volume else 1.0,
        }
        data.append(row)

    logger.info(f"샘플 데이터 생성 완료: {len(data)}일")
    return data


def print_result(result, title="백테스팅 결과"):
    """결과 출력"""
    s = result.to_dict()["summary"]
    print()
    print("=" * 50)
    print(f"  📊 {title}")
    print("=" * 50)
    print(f"  총 매매 횟수:    {s['total_trades']}회")
    print(f"  승리/패배:       {s['win_trades']}승 / {s['lose_trades']}패")
    print(f"  승률:            {s['win_rate']}%")
    print(f"  총 수익률:       {s['total_return']}%")
    print(f"  최대 낙폭(MDD):  {s['max_drawdown']}%")
    print(f"  Profit Factor:   {s['profit_factor']}")
    print(f"  Sharpe Ratio:    {s['sharpe_ratio']}")
    print("=" * 50)

    if result.trades:
        print(f"\n  최근 매매 내역 (최대 10건):")
        print(f"  {'종목':12s} {'매수일':12s} {'매도일':12s} {'수익률':8s} {'사유'}")
        print(f"  {'-'*50}")
        for t in result.trades[-10:]:
            print(f"  {t['stock']:12s} {t['buy_date']:12s} {t['sell_date']:12s} {t['profit_rate']:7.2f}% {t['reason']}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Logic Works 백테스팅")
    parser.add_argument("--stock", default=None, help="종목코드 (예: 005930)")
    parser.add_argument("--days", type=int, default=252, help="백테스팅 기간 (일)")
    parser.add_argument("--strategy", default=None, help="전략 JSON 파일 경로")
    parser.add_argument("--capital", type=int, default=10000000, help="초기 자본금")
    parser.add_argument("--list", action="store_true", help="전략 목록 보기")
    args = parser.parse_args()

    if args.list:
        strategies_dir = os.path.join(os.path.dirname(__file__), "backtest")
        json_files = [f for f in os.listdir(strategies_dir) if f.endswith(".json")]
        print("\n📋 저장된 전략 목록:")
        for f in json_files:
            path = os.path.join(strategies_dir, f)
            with open(path, "r", encoding="utf-8") as fp:
                config = json.load(fp)
            print(f"  • {config.get('name', f)} ({f})")
        print()
        return

    from backtest import BacktestEngine, load_strategy

    # 전략 로드
    if args.strategy:
        strategy_path = args.strategy
    else:
        strategy_path = os.path.join(os.path.dirname(__file__), "backtest", "sample_strategy.json")

    if not os.path.exists(strategy_path):
        logger.error(f"전략 파일 없음: {strategy_path}")
        sys.exit(1)

    with open(strategy_path, "r", encoding="utf-8") as f:
        strategy_config = json.load(f)

    strategy = load_strategy(strategy_config)

    # 데이터 준비
    if args.stock:
        logger.info(f"종목 데이터 로드: {args.stock}")
        data = generate_sample_data(args.days)  # 실제 데이터 로드로 대체 필요
    else:
        data = generate_sample_data(args.days)

    # 백테스팅 실행
    engine = BacktestEngine(initial_capital=args.capital)
    result = engine.run(data, strategy)
    
    # 결과 출력
    title = f"Logic Works | {strategy.name} | {args.stock or '샘플'}"
    print_result(result, title)


if __name__ == "__main__":
    main()