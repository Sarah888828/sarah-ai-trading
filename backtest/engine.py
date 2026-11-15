"""
백테스팅 엔진 - Logic Works 방식
"""
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class BacktestResult:
    def __init__(self):
        self.total_trades = 0
        self.win_trades = 0
        self.lose_trades = 0
        self.total_return = 0.0
        self.max_drawdown = 0.0
        self.sharpe_ratio = 0.0
        self.trades = []
        self.equity_curve = []

    @property
    def win_rate(self):
        if self.total_trades == 0:
            return 0.0
        return self.win_trades / self.total_trades * 100

    @property
    def profit_factor(self):
        gp = sum(t.get("profit", 0) for t in self.trades if t.get("profit", 0) > 0)
        gl = abs(sum(t.get("profit", 0) for t in self.trades if t.get("profit", 0) < 0))
        if gl == 0:
            return float("inf")
        return gp / gl

    def to_dict(self):
        return {
            "summary": {
                "total_trades": self.total_trades,
                "win_trades": self.win_trades,
                "lose_trades": self.lose_trades,
                "win_rate": round(self.win_rate, 2),
                "total_return": round(self.total_return * 100, 2),
                "max_drawdown": round(self.max_drawdown * 100, 2),
                "profit_factor": round(self.profit_factor, 2),
                "sharpe_ratio": round(self.sharpe_ratio, 2),
            },
            "trades": self.trades[-50:],
            "equity": self.equity_curve,
        }


class BacktestEngine:
    def __init__(self, initial_capital=10000000):
        self.initial_capital = initial_capital

    def run(self, data, strategy):
        capital = self.initial_capital
        peak = self.initial_capital
        positions = {}
        trades = []
        equity = []

        for i in range(1, len(data)):
            row = data[i]
            prev_row = data[i - 1]
            date = row.get("date", f"day_{i}")
            close = row.get("close", 0)

            to_remove = []
            for code, pos in positions.items():
                should_sell, reason = strategy.check_sell(row, prev_row, pos["buy_price"], close)
                if should_sell:
                    rev = pos["quantity"] * close
                    cost = pos["quantity"] * pos["buy_price"]
                    profit = rev - cost
                    pr = profit / cost * 100
                    capital += rev
                    trades.append({"stock": code, "buy_date": pos["buy_date"], "sell_date": date,
                        "buy_price": pos["buy_price"], "sell_price": close, "quantity": pos["quantity"],
                        "profit": profit, "profit_rate": round(pr, 2), "reason": reason or "매도"})
                    to_remove.append(code)
            for code in to_remove:
                del positions[code]

            if strategy.check_buy(row, prev_row, len(positions)):
                code = f"stock_{len(trades) + 1}"
                amount = capital * strategy.position_size
                qty = max(1, int(amount / close)) if close > 0 else 0
                actual = qty * close
                if actual > 0 and capital >= actual:
                    capital -= actual
                    positions[code] = {"buy_price": close, "quantity": qty, "buy_date": date}

            pv = sum(p["quantity"] * close for p in positions.values())
            te = capital + pv
            equity.append({"date": date, "equity": te, "capital": capital, "positions": pv})
            if te > peak:
                peak = te

        result = BacktestResult()
        result.total_trades = len(trades)
        result.trades = trades
        result.total_return = (te - self.initial_capital) / self.initial_capital
        win = sum(1 for t in trades if t.get("profit", 0) > 0)
        lose = sum(1 for t in trades if t.get("profit", 0) < 0)
        result.win_trades = win
        result.lose_trades = lose

        md = 0.0
        p = self.initial_capital
        for eq in equity:
            if eq["equity"] > p:
                p = eq["equity"]
            dd = (p - eq["equity"]) / p if p > 0 else 0
            if dd > md:
                md = dd
        result.max_drawdown = md

        if len(equity) > 1:
            ret = pd.Series([e["equity"] for e in equity]).pct_change().dropna()
            if len(ret) > 0 and ret.std() > 0:
                result.sharpe_ratio = float((ret.mean() / ret.std()) * np.sqrt(252))

        result.equity_curve = equity
        logger.info(f"백테스팅 완료: 수익률 {result.total_return*100:.2f}%")
        return result