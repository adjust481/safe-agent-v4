"""
Strategy registry and factory.

Provides build_policy() to instantiate strategies by name.
"""
from typing import Dict, Any, Optional
from .base import BasePolicy
from .sniper_policy import SniperPolicy
from .arb_policy import ArbPolicy


# Registry of available strategies
STRATEGY_REGISTRY = {
    "sniper": SniperPolicy,
    "arb": ArbPolicy,
    "arbitrage": ArbPolicy,  # Alias
}


def build_policy(name: str, params: Dict[str, Any] = None) -> Optional[BasePolicy]:
    """
    Build a policy instance by name.

    Args:
        name: Strategy name (e.g., "sniper", "arb", "momentum")
        params: Optional parameters for the strategy

    Returns:
        BasePolicy instance, or None if strategy not found
    """
    strategy_class = STRATEGY_REGISTRY.get(name.lower())

    if strategy_class is None:
        return None

    return strategy_class(params)


def list_strategies() -> list:
    """
    List all available strategy names.

    Returns:
        List of strategy names
    """
    return list(STRATEGY_REGISTRY.keys())
