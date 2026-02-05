"""
policy.py - 决策逻辑引擎

功能：
- 根据链上状态决定是否交易
- 保守原则：默认 HOLD，只有满足所有条件才 TRADE
- 可配置的阈值和规则
- 返回决策结果和原因
"""

from snapshot import VaultSnapshot
from common import format_wei


class TradingDecision:
    """交易决策结果"""

    def __init__(self, action, reason, amount_in=0, min_amount_out=0):
        self.action = action  # "HOLD" or "TRADE"
        self.reason = reason  # 决策原因
        self.amount_in = amount_in  # 交易输入金额（wei）
        self.min_amount_out = min_amount_out  # 最小输出金额（wei）

    def should_trade(self):
        """是否应该交易"""
        return self.action == "TRADE"

    def __str__(self):
        if self.should_trade():
            return f"TRADE: {self.reason} (amount_in={format_wei(self.amount_in):.4f})"
        return f"HOLD: {self.reason}"


class TradingPolicy:
    """交易策略引擎"""

    def __init__(self, config=None):
        """
        初始化策略引擎

        Args:
            config: 策略配置字典，包含：
                - min_balance_ratio: 最小余额比例（默认 0.1，即至少保留 10% 余额）
                - trade_size_ratio: 每次交易占子账户余额的比例（默认 0.25，即 25%）
                - min_trade_amount: 最小交易金额（wei，默认 1 token）
                - slippage_tolerance: 滑点容忍度（默认 0.02，即 2%）
                - cooldown_blocks: 冷却区块数（默认 5 blocks）
        """
        self.config = config or {}

        # 默认配置
        self.min_balance_ratio = self.config.get('min_balance_ratio', 0.1)
        self.trade_size_ratio = self.config.get('trade_size_ratio', 0.25)
        self.min_trade_amount = self.config.get('min_trade_amount', 10**18)  # 1 token
        self.slippage_tolerance = self.config.get('slippage_tolerance', 0.02)  # 2%
        self.cooldown_blocks = self.config.get('cooldown_blocks', 5)

        # 状态跟踪
        self.last_trade_block = 0

    def decide(self, snapshot: VaultSnapshot):
        """
        根据快照决定是否交易

        Args:
            snapshot: VaultSnapshot 实例

        Returns:
            TradingDecision 实例
        """
        print(f"\n🤔 策略决策中...")

        # 规则 1: 检查 agent 是否启用
        if not snapshot.is_agent_enabled():
            return TradingDecision("HOLD", "Agent 未启用")

        # 规则 2: 检查路由是否启用
        if not snapshot.is_route_enabled():
            return TradingDecision("HOLD", "路由未启用")

        # 规则 3: 检查子账户余额是否充足
        available_balance = snapshot.get_available_balance()
        if available_balance == 0:
            return TradingDecision("HOLD", "子账户余额为 0")

        # 规则 4: 检查是否在冷却期
        blocks_since_last_trade = snapshot.block_number - self.last_trade_block
        if blocks_since_last_trade < self.cooldown_blocks:
            return TradingDecision(
                "HOLD",
                f"冷却期中 ({blocks_since_last_trade}/{self.cooldown_blocks} blocks)"
            )

        # 规则 5: 计算交易金额
        amount_in = int(available_balance * self.trade_size_ratio)

        # 规则 6: 检查交易金额是否达到最小值
        if amount_in < self.min_trade_amount:
            return TradingDecision(
                "HOLD",
                f"交易金额过小 ({format_wei(amount_in):.4f} < {format_wei(self.min_trade_amount):.4f})"
            )

        # 规则 7: 检查交易金额是否超过限额
        max_trade_amount = snapshot.get_max_trade_amount()
        if amount_in > max_trade_amount:
            amount_in = max_trade_amount
            print(f"   ⚠️  交易金额超过限额，调整为: {format_wei(amount_in):.4f}")

        # 规则 8: 检查交易后是否保留足够余额
        remaining_balance = available_balance - amount_in
        min_required_balance = int(available_balance * self.min_balance_ratio)
        if remaining_balance < min_required_balance:
            return TradingDecision(
                "HOLD",
                f"交易后余额不足 (剩余 {format_wei(remaining_balance):.4f} < 最小 {format_wei(min_required_balance):.4f})"
            )

        # 规则 9: 计算最小输出金额（考虑滑点）
        min_amount_out = int(amount_in * (1 - self.slippage_tolerance))

        # 所有规则通过，决定交易
        print(f"   ✅ 所有规则通过")
        print(f"   📊 交易参数:")
        print(f"      Amount in: {format_wei(amount_in):.4f} tokens")
        print(f"      Min out: {format_wei(min_amount_out):.4f} tokens")
        print(f"      Slippage: {self.slippage_tolerance * 100:.1f}%")

        return TradingDecision(
            "TRADE",
            "满足所有交易条件",
            amount_in=amount_in,
            min_amount_out=min_amount_out
        )

    def update_last_trade_block(self, block_number):
        """更新最后交易区块"""
        self.last_trade_block = block_number
        print(f"   📝 更新最后交易区块: #{block_number}")


class ConservativePolicy(TradingPolicy):
    """保守策略（更严格的条件）"""

    def __init__(self):
        super().__init__({
            'min_balance_ratio': 0.2,  # 保留 20% 余额
            'trade_size_ratio': 0.15,  # 每次交易 15%
            'min_trade_amount': 5 * 10**18,  # 最小 5 tokens
            'slippage_tolerance': 0.01,  # 1% 滑点
            'cooldown_blocks': 10,  # 10 blocks 冷却
        })


class AggressivePolicy(TradingPolicy):
    """激进策略（更宽松的条件）"""

    def __init__(self):
        super().__init__({
            'min_balance_ratio': 0.05,  # 保留 5% 余额
            'trade_size_ratio': 0.4,  # 每次交易 40%
            'min_trade_amount': 1 * 10**18,  # 最小 1 token
            'slippage_tolerance': 0.05,  # 5% 滑点
            'cooldown_blocks': 2,  # 2 blocks 冷却
        })


if __name__ == '__main__':
    # 测试策略决策
    print("=== 测试策略决策 ===")

    from common import get_config

    config = get_config()
    agent_address = config.agents_config['agents'][0]['address']

    # 获取快照
    snapshot = VaultSnapshot(agent_address)
    snapshot.fetch()

    # 测试默认策略
    print("\n=== 默认策略 ===")
    policy = TradingPolicy()
    decision = policy.decide(snapshot)
    print(f"\n决策结果: {decision}")

    # 测试保守策略
    print("\n=== 保守策略 ===")
    conservative = ConservativePolicy()
    decision = conservative.decide(snapshot)
    print(f"\n决策结果: {decision}")

    # 测试激进策略
    print("\n=== 激进策略 ===")
    aggressive = AggressivePolicy()
    decision = aggressive.decide(snapshot)
    print(f"\n决策结果: {decision}")
