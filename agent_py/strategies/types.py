"""
Unified data structures for strategy decision making.

SwapIntent is the standard output format that all strategies must return.
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass
class SwapIntent:
    """
    Unified decision output from any trading strategy.

    Attributes:
        action: "HOLD" or "SWAP"
        reason: Human-readable explanation of the decision
        zero_for_one: True = token0->token1, False = token1->token0 (only for SWAP)
        amount_in: Amount to swap in wei (only for SWAP)
        min_amount_out: Minimum acceptable output in wei (only for SWAP)
        meta: Additional metadata (e.g., signal data, order details)
    """
    action: str  # "HOLD" or "SWAP"
    reason: str
    zero_for_one: Optional[bool] = None
    amount_in: Optional[int] = None
    min_amount_out: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        """Validate intent structure."""
        if self.action not in ("HOLD", "SWAP"):
            raise ValueError(f"Invalid action: {self.action}")

        if self.action == "SWAP":
            if self.zero_for_one is None:
                raise ValueError("SWAP intent requires zero_for_one")
            if self.amount_in is None or self.amount_in <= 0:
                raise ValueError("SWAP intent requires positive amount_in")
            if self.min_amount_out is None or self.min_amount_out < 0:
                raise ValueError("SWAP intent requires non-negative min_amount_out")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "action": self.action,
            "reason": self.reason,
            "zero_for_one": self.zero_for_one,
            "amount_in": self.amount_in,
            "min_amount_out": self.min_amount_out,
            "meta": self.meta or {}
        }
