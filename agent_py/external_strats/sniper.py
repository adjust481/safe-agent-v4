"""
Sniper strategy - placeholder implementation.

This is a minimal sniper strategy that can be replaced with the actual
sniper.py implementation. It demonstrates the expected interface.
"""
from .base import BaseStrategy, MarketData, OrderInstruction
from typing import Dict, Any, List


class SniperStrategy(BaseStrategy):
    """
    Sniper strategy: Attempts to buy at target price.

    Parameters:
        target_price: Target entry price (float)
        size: Order size in tokens (float)
    """

    def __init__(self, params: Dict[str, Any] = None):
        super().__init__(params)
        self.target_price = self.params.get("target_price", 1.0)
        self.size = self.params.get("size", 10.0)

    def evaluate(self, market: MarketData, state: Dict[str, Any]) -> List[OrderInstruction]:
        """
        Evaluate market for sniper opportunity.

        Logic:
        - If best_ask <= target_price, generate BUY order
        - Otherwise, no action
        """
        orders = []

        # Check if we can snipe at target price
        if market.best_ask <= self.target_price:
            orders.append(OrderInstruction(
                side="BUY",
                size=self.size,
                price=market.best_ask,
                meta={
                    "reason": f"snipe_at_{market.best_ask:.4f}",
                    "target": self.target_price,
                    "spread": market.best_ask - market.best_bid
                }
            ))

        return orders
