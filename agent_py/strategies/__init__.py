"""
Strategies package.

Provides unified strategy interface and factory.
"""
from .types import SwapIntent
from .base import BasePolicy
from .registry import build_policy, list_strategies

__all__ = [
    "SwapIntent",
    "BasePolicy",
    "build_policy",
    "list_strategies",
]
