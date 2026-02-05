"""
Base class for all trading policies.

All strategies must inherit from BasePolicy and implement the decide() method.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any
from .types import SwapIntent


class BasePolicy(ABC):
    """
    Abstract base class for trading policies.

    Each policy must implement decide() which takes a context dict
    and returns a SwapIntent.
    """

    def __init__(self, name: str, params: Dict[str, Any] = None):
        """
        Initialize policy.

        Args:
            name: Policy identifier (e.g., "sniper", "arb", "momentum")
            params: Optional configuration parameters
        """
        self.name = name
        self.params = params or {}

    @abstractmethod
    def decide(self, ctx: Dict[str, Any]) -> SwapIntent:
        """
        Make trading decision based on context.

        Args:
            ctx: Context dictionary containing:
                - signal: Market signal data (dict)
                - sub_balance_wei: Agent's sub-account balance (int)
                - max_per_trade_wei: Maximum allowed per trade (int)
                - default_amount_in_wei: Default trade size (int)
                - slippage_bps: Slippage tolerance in basis points (int)
                - agent_address: Agent's address (str)
                - user_address: User's address (str)
                - strategy_state: Optional persistent state (dict)

        Returns:
            SwapIntent: Decision to HOLD or SWAP
        """
        pass
