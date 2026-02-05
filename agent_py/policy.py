"""
Rule-based decision policy for agent trading.

Conservative "HOLD by default" policy:
- Only trade if agent sub-balance is sufficient
- Only trade if within maxNotionalPerTrade limit
- Only trade if route is enabled
- Default action is HOLD
"""
from utils import format_token_amount

class TradingPolicy:
    """Conservative trading policy."""

    def __init__(self, min_balance_threshold=10.0, trade_size=50.0):
        """
        Initialize policy.

        Args:
            min_balance_threshold: Minimum agent sub-balance to consider trading (in tokens)
            trade_size: Default trade size (in tokens)
        """
        self.min_balance_threshold = min_balance_threshold
        self.trade_size = trade_size

    def decide(self, snapshot):
        """
        Make trading decision based on vault state.

        Args:
            snapshot: Vault state snapshot from snapshot.py

        Returns:
            dict with keys:
                - action: "HOLD" or "SWAP"
                - reason: Human-readable explanation
                - params: Swap parameters if action is "SWAP", else None
        """
        agent_balance = format_token_amount(snapshot['agent_sub_balance'])
        max_per_trade = format_token_amount(snapshot['agent_config']['maxNotionalPerTrade'])
        route_enabled = snapshot['default_route']['enabled']
        agent_enabled = snapshot['agent_config']['enabled']

        # Check 1: Agent must be enabled
        if not agent_enabled:
            return {
                'action': 'HOLD',
                'reason': 'Agent is disabled',
                'params': None
            }

        # Check 2: Route must be enabled
        if not route_enabled:
            return {
                'action': 'HOLD',
                'reason': 'Default route is disabled',
                'params': None
            }

        # Check 3: Sufficient balance
        if agent_balance < self.min_balance_threshold:
            return {
                'action': 'HOLD',
                'reason': f'Agent balance ({agent_balance:.2f}) below threshold ({self.min_balance_threshold:.2f})',
                'params': None
            }

        # Check 4: Trade size within limits
        if self.trade_size > max_per_trade:
            return {
                'action': 'HOLD',
                'reason': f'Trade size ({self.trade_size:.2f}) exceeds max per trade ({max_per_trade:.2f})',
                'params': None
            }

        # Check 5: Sufficient balance for trade
        if agent_balance < self.trade_size:
            return {
                'action': 'HOLD',
                'reason': f'Insufficient balance ({agent_balance:.2f}) for trade size ({self.trade_size:.2f})',
                'params': None
            }

        # All checks passed - execute swap
        # Use default route and zeroForOne=true
        return {
            'action': 'SWAP',
            'reason': f'All checks passed, executing swap of {self.trade_size:.2f} tokens',
            'params': {
                'amount_in': self.trade_size,
                'zero_for_one': True,
                'min_amount_out': 1.0  # Minimal slippage protection
            }
        }

def main():
    """Test policy with mock snapshot."""
    from snapshot import get_vault_snapshot
    from utils import create_web3_instance, load_deployment_info, get_vault_contract

    try:
        # Setup
        w3 = create_web3_instance()
        deployment = load_deployment_info()
        vault = get_vault_contract(w3)

        # Get snapshot
        snapshot = get_vault_snapshot(w3, vault, deployment)

        # Test policy
        policy = TradingPolicy(min_balance_threshold=10.0, trade_size=50.0)
        decision = policy.decide(snapshot)

        print("=== Policy Decision ===\n")
        print(f"Action: {decision['action']}")
        print(f"Reason: {decision['reason']}")

        if decision['params']:
            print(f"\nSwap Parameters:")
            print(f"  Amount in     : {decision['params']['amount_in']:.2f} tokens")
            print(f"  Zero for one  : {decision['params']['zero_for_one']}")
            print(f"  Min amount out: {decision['params']['min_amount_out']:.2f} tokens")

    except Exception as e:
        print(f"Error: {e}")
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
