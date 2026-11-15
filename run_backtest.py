"""
YSN AI Terminal - Logic Works 백테스팅 CLI
python run_backtest.py                          # 샘플 데이터 전체 전략 실행
python run_backtest.py --strategy 0              # 특정 전략만 실행 (인덱스)
python run_backtest.py --list                   # 전략 목록
python run_backtest.py --ysn                    # YSN 전략 세트 실행
python run_backtest.py --stock 005930 --days 365 # 실제 종목
"""

import os, sys, json, argparse, logging
from datetime import datetime, timedelta
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def generate_sample_data(days=252):
    np.random.seed(42)
    date = datetime(2025, 1, 2)
    price = 70000
    data = []
    high_20d_list = []
    for i in range(days):
        date += timedelta(days=1)
        if date.weekday() >= 5:
            continue
        change = np.random.normal(0.001, 0.02)
        o = price
        h = o * (1 + abs(np.random.normal(0, 0.015)))
        l = o * (1 - abs(np.random.normal(0, 0.015)))
        c = o * (1 + change)
        v = int(np.random.uniform(500000, 5000000))
        price = c

        ma_5 = sum(d["close"] for d in data[-4:]) / max(len(data[-4:]), 1) if data else c
        ma_20 = sum(d["close"] for d in data[-19:]) / max(len(data[-19:]), 1) if data else c
        rsi = max(0, min(100, 50 + np.random.normal(0, 15)))
        vol_ratio = v / 2000000 if v else 1.0

        # 보조 지표들
        bollinger_ma = ma_20
        bollinger_std = np.std([d["close"] for d in data[-20:]]) if len(data) >= 20 else c * 0.02
        bollinger_upper = bollinger_ma + 2 * bollinger_std
        bollinger_lower = bollinger_ma - 2 * bollinger_std
        ema_fast = sum(d["close"] * (0.15 * (1 - 0.15) ** (4 - i)) for i, d in enumerate(data[-5:])) if data else c
        ema_slow = sum(d["close"] * (0.04 * (1 - 0.04) ** (19 - i)) for i, d in enumerate(data[-20:])) if data else c
        macd = ema_fast - ema_slow
        macd_signal = macd * 0.3 + (data[-1].get("macd_signal", macd) * 0.7 if data else macd)
        high_20d_list.append(h)
        if len(high_20d_list) > 20:
            high_20d_list.pop(0)
        high_20d = max(high_20d_list) if high_20d_list else h

        momentum_5d = ((c / data[-5]["close"]) - 1) * 100 if len(data) >= 5 else 0

        row = {"date": date.strftime("%Y-%m-%d"), "open": round(o), "high": round(h), "low": round(l),
            "close": round(c), "volume": v, "ma_5": round(ma_5, 1), "ma_20": round(ma_20, 1),
            "RSI": round(rsi, 1), "volume_ratio": round(vol_ratio, 2),
            "bollinger_upper": round(bollinger_upper, 1), "bollinger_mid": round(bollinger_ma, 1),
            "bollinger_lower": round(bollinger_lower, 1), "MACD": round(macd, 1),
            "macd_signal": round(macd_signal, 1), "high_20d": round(high_20d, 1),
            "momentum_5d": round(momentum_5d, 2)}
        data.append(row)
    return data


def load_strategies():
    strategies = []
    # sample_strategy.json
    sample_path = os.path.join(os.path.dirname(__file__), "backtest", "sample_strategy.json")
    if os.path.exists(sample_path):
        with open(sample_path, "r", encoding="utf-8") as f:
            strategies.append(json.load(f))

    # strategies_ysn.json (Momentum, Reversal, Trend, Scalping, Breakout)
    _load_json_bundle(os.path.join(os.path.dirname(__file__), "backtest", "strategies_ysn.json"), strategies)
    # strategies_stockeasy.json (StockEasy 1~4호)
    _load_json_bundle(os.path.join(os.path.dirname(__file__), "backtest", "strategies_stockeasy.json"), strategies)

    # 개별 json 파일들
    btd = os.path.join(os.path.dirname(__file__), "backtest")
    excluded = {"sample_strategy.json", "strategies_ysn.json", "strategies_stockeasy.json"}
    for f in os.listdir(btd):
        if f.endswith(".json") and f not in excluded:
            with open(os.path.join(btd, f), "r", encoding="utf-8") as fp:
                s = json.load(fp)
                if "strategies" not in s and "name" in s:
                    strategies.append(s)
    return strategies


def _load_json_bundle(path, strategies):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        if "strategies" in data:
            strategies.extend(data["strategies"])
        elif "name" in data:
            strategies.append(data)

def print_result(result, title="백테스팅 결과"):
    s = result.to_dict()["summary"]
    print(f"\n{'='*55}")
    print(f"  {title}")
    print(f"{'='*55}")
    print(f"  총 매매: {s['total_trades']}회 | 승/패: {s['win_trades']}/{s['lose_trades']}")
    print(f"  승률: {s['win_rate']}% | 수익률: {s['total_return']}%")
    print(f"  MDD: {s['max_drawdown']}% | PF: {s['profit_factor']} | SR: {s['sharpe_ratio']}")
    print(f"{'='*55}")


def main():
    parser = argparse.ArgumentParser(description="YSN AI Terminal - Logic Works 백테스팅")
    parser.add_argument("--strategy", type=int, default=None, help="전략 인덱스 (0부터)")
    parser.add_argument("--list", action="store_true", help="전략 목록")
    parser.add_argument("--ysn", action="store_true", help="YSN 전략 세트 실행")
    parser.add_argument("--stock", default=None, help="종목코드")
    parser.add_argument("--days", type=int, default=252)
    parser.add_argument("--capital", type=int, default=10000000)
    args = parser.parse_args()

    from backtest import BacktestEngine, load_strategy

    strategies = load_strategies()

    if args.list or args.strategy is None and not args.ysn:
        print(f"\n{'='*55}")
        print(f"  YSN AI Terminal - Logic Works 백테스팅")
        print(f"{'='*55}")
        for i, s in enumerate(strategies):
            cat = s.get("category", "General")
            print(f"  [{i}] {s['name']} ({cat})")
            print(f"      {s.get('description', '')[:60]}")
        print(f"{'='*55}")
        print(f"  사용법: python run_backtest.py --strategy 0")
        print()
        if args.list:
            return

    # 데이터
    if args.stock:
        logger.info(f"종목 로드: {args.stock}")
        data = generate_sample_data(args.days)
    else:
        data = generate_sample_data(args.days)

    # 실행할 전략 목록
    if args.strategy is not None:
        selected = [strategies[args.strategy]]
    elif args.ysn:
        selected = [s for s in strategies if s.get("category") != "General"]
        if not selected:
            selected = strategies
    else:
        selected = strategies

    if len(selected) == 1:
        s = selected[0]
        strategy = load_strategy(s)
        result = engine.run(data, strategy)
        print_result(result, f"YSN | {s['name']}")
    else:
        print(f"\n{'='*55}")
        print(f"  YSN AI Terminal - 전략 비교 백테스팅")
        print(f"{'='*55}")
        results = []
        for s in selected:
            strategy = load_strategy(s)
            r = engine.run(data, strategy)
            results.append((s["name"], r))
            print_result(r, f"[{s.get('category','General')}] {s['name']}")
        print(f"\n  {'Strategy':25s} {'Win%':8s} {'Return':8s} {'MDD':8s} {'PF':6s} {'SR':6s}")
        print(f"  {'-'*61}")
        for name, r in results:
            sm = r.to_dict()["summary"]
            print(f"  {name[:24]:25s} {sm['win_rate']:7.2f}% {sm['total_return']:7.2f}% {sm['max_drawdown']:7.2f}% {sm['profit_factor']:<6.2f} {sm['sharpe_ratio']:<6.2f}")


if __name__ == "__main__":
    main()