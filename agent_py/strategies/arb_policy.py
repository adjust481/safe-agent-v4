"""
Arbitrage strategy adapter: OrderInstruction -> SwapIntent.

Wraps external_strats.ou_arb.OUArbStrategy and converts its output
to the unified SwapIntent format.
"""
from typing import Dict, Any
from .base import BasePolicy
from .types import SwapIntent
from external_strats.ou_arb import OUArbStrategy
from external_strats.base import MarketData


class ArbPolicy(BasePolicy):
    """
    Adapter for OUArbStrategy.

    Converts OrderInstruction output to SwapIntent with proper
    amount calculation and slippage handling.
    """

    def __init__(self, params: Dict[str, Any] = None):
        super().__init__(name="arb", params=params)
        # Initialize underlying strategy
        self.strategy = OUArbStrategy(params)

    def decide(self, ctx: Dict[str, Any]) -> SwapIntent:
        """
        Make arbitrage decision.

        Args:
            ctx: Context with signal, balances, slippage, etc.

        Returns:
            SwapIntent: HOLD or SWAP decision
        """
        # Extract context
        signal = ctx.get("signal", {})
        sub_balance_wei = ctx.get("sub_balance_wei", 0)
        max_per_trade_wei = ctx.get("max_per_trade_wei", 0)
        default_amount_in_wei = ctx.get("default_amount_in_wei", 0)
        cap_wei = ctx.get("cap_wei", 0)
        slippage_bps = ctx.get("slippage_bps", 100)  # Default 1%

        # Check if cap is zero (agent cannot trade)
        if cap_wei == 0:
            return SwapIntent(
                action="HOLD",
                reason="arb:cap_is_zero",
                meta={"signal": signal}
            )

        # Check if we have valid signal data
        if not signal or ("best_ask" not in signal and "pm_ask" not in signal) or ("best_bid" not in signal and "op_bid" not in signal):
            return SwapIntent(
                action="HOLD",
                reason="arb:no_signal",
                meta={"signal": signal}
            )

        # Construct MarketData from signal
        # For arb, signal may contain spread/pm_ask/op_bid
        market = MarketData(
            best_bid=signal.get("best_bid", signal.get("op_bid", 1.0)),
            best_ask=signal.get("best_ask", signal.get("pm_ask", 1.0)),
            extra=signal
        )

        # Get strategy state (persistent across calls)
        strategy_state = ctx.get("strategy_state", {})

        # Evaluate strategy
        orders = self.strategy.evaluate(market, strategy_state)

        # No orders = HOLD
        if not orders:
            return SwapIntent(
                action="HOLD",
                reason="arb:no_opportunity",
                meta={"signal": signal}
            )

        # Take first order
        order = orders[0]

        # Determine direction: BUY = zero_for_one=True (token0->token1)
        zero_for_one = (order.side == "BUY")

        # Calculate amount_in (wei)
        # Use vault risk controls, not order.size
        if default_amount_in_wei > 0:
            amount_in = min(sub_balance_wei, max_per_trade_wei, default_amount_in_wei)
        else:
            amount_in = min(sub_balance_wei, max_per_trade_wei)

        # Ensure positive amount
        if amount_in <= 0:
            return SwapIntent(
                action="HOLD",
                reason="arb:insufficient_balance",
                meta={"order": order.meta, "signal": signal}
            )

        # Calculate min_amount_out with slippage
        # Conservative: min_out = amount_in * (1 - slippage_bps/10000)
        min_amount_out = int(amount_in * (1 - slippage_bps / 10000))

        # Build reason string
        reason = f"arb:{order.meta.get('reason', 'execute')}"

        return SwapIntent(
            action="SWAP",
            reason=reason,
            zero_for_one=zero_for_one,
            amount_in=amount_in,
            min_amount_out=min_amount_out,
            meta={
                "order": order.meta,
                "signal": signal,
                "side": order.side,
                "price": order.price,
                "spread": order.meta.get("spread")
            }
        )
