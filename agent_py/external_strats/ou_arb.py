"""
OU Arbitrage strategy - placeholder implementation.

This is a minimal arbitrage strategy that can be replaced with the actual
ou_arb.py implementation. It demonstrates the expected interface.
"""
from .base import BaseStrategy, MarketData, OrderInstruction
from typing import Dict, Any, List


class OUArbStrategy(BaseStrategy):
    """
    Ornstein-Uhlenbeck Arbitrage strategy.

    Parameters:
        threshold: Minimum spread threshold for arbitrage (float)
        size: Order size in tokens (float)
    """

    def __init__(self, params: Dict[str, Any] = None):
        super().__init__(params)
        self.threshold = self.params.get("threshold", 0.01)  # 1% spread
        self.size = self.params.get("size", 10.0)

    def evaluate(self, market: MarketData, state: Dict[str, Any]) -> List[OrderInstruction]:
        """
        Evaluate market for arbitrage opportunity.

        Logic:
        - Calculate spread = (best_ask - best_bid) / best_bid
        - If spread > threshold, generate BUY order (expecting mean reversion)
        - Otherwise, no action
        """
        orders = []

        # Calculate spread
        if market.best_bid > 0:
            spread = (market.best_ask - market.best_bid) / market.best_bid

            # Check for arbitrage opportunity
            if spread > self.threshold:
                # Buy when spread is wide (expecting mean reversion)
                orders.append(OrderInstruction(
                    side="BUY",
                    size=self.size,
                    price=market.best_ask,
                    meta={
                        "reason": f"arb_spread_{spread:.4f}",
                        "threshold": self.threshold,
                        "spread": spread,
                        "pm_ask": market.best_ask,
                        "op_bid": market.best_bid
                    }
                ))

        return orders
