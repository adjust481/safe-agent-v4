"""
Base types for external strategy scripts (sniper.py, ou_arb.py).

These are minimal implementations to support the original strategy logic.
"""
from dataclasses import dataclass
from typing import Dict, Any, List, Optional


@dataclass
class MarketData:
    """
    Market data snapshot for strategy evaluation.

    Attributes:
        best_bid: Best bid price (float)
        best_ask: Best ask price (float)
        extra: Additional market data (dict)
    """
    best_bid: float
    best_ask: float
    extra: Dict[str, Any] = None

    def __post_init__(self):
        if self.extra is None:
            self.extra = {}


@dataclass
class OrderInstruction:
    """
    Order instruction from external strategy.

    Attributes:
        side: "BUY" or "SELL"
        size: Order size in token units (float)
        price: Target price (float)
        meta: Additional metadata (dict)
    """
    side: str  # "BUY" or "SELL"
    size: float
    price: float
    meta: Dict[str, Any] = None

    def __post_init__(self):
        if self.side not in ("BUY", "SELL"):
            raise ValueError(f"Invalid side: {self.side}")
        if self.meta is None:
            self.meta = {}


class BaseStrategy:
    """
    Base class for external strategies.

    External strategies (sniper, ou_arb) should inherit from this
    and implement evaluate().
    """

    def __init__(self, params: Dict[str, Any] = None):
        """
        Initialize strategy.

        Args:
            params: Strategy parameters (e.g., target_price, threshold)
        """
        self.params = params or {}

    def evaluate(self, market: MarketData, state: Dict[str, Any]) -> List[OrderInstruction]:
        """
        Evaluate market and return order instructions.

        Args:
            market: Current market data
            state: Strategy state (persistent across calls)

        Returns:
            List of OrderInstruction (empty list = no action)
        """
        return []
