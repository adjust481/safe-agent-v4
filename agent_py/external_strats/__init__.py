"""
External strategies package.

Contains original strategy implementations (sniper, ou_arb).
"""
from .base import BaseStrategy, MarketData, OrderInstruction
from .sniper import SniperStrategy
from .ou_arb import OUArbStrategy

__all__ = [
    "BaseStrategy",
    "MarketData",
    "OrderInstruction",
    "SniperStrategy",
    "OUArbStrategy",
]
