"""
trader.py - 交易执行模块

功能：
- 构建 executeSwap 交易
- 签名并发送交易
- 等待交易确认
- 解析 AgentSwapExecuted 事件
- 返回交易结果
"""

from web3 import Web3
from eth_account.signers.local import LocalAccount
from common import get_config, get_web3_manager, format_wei, format_address
from policy import TradingDecision
from snapshot import VaultSnapshot


class TradeResult:
    """交易结果"""

    def __init__(self, success, tx_hash=None, receipt=None, event_data=None, error=None):
        self.success = success
        self.tx_hash = tx_hash
        self.receipt = receipt
        self.event_data = event_data
        self.error = error

    def __str__(self):
        if self.success:
            return f"✅ 交易成功: {self.tx_hash.hex()}"
        return f"❌ 交易失败: {self.error}"


class Trader:
    """交易执行器"""

    def __init__(self, agent_address, private_key):
        self.config = get_config()
        self.w3m = get_web3_manager()
        self.vault = self.w3m.get_vault_contract()

        self.agent_address = Web3.to_checksum_address(agent_address)
        self.user_address = Web3.to_checksum_address(self.config.user_address)
        self.account: LocalAccount = self.w3m.get_account(private_key)

        # 验证账户地址匹配
        if self.account.address != self.agent_address:
            raise ValueError(
                f"私钥对应的地址 ({self.account.address}) 与 agent 地址 ({self.agent_address}) 不匹配"
            )

        print(f"🔑 Trader 初始化完成")
        print(f"   Agent: {self.agent_address}")
        print(f"   User: {self.user_address}")

    def execute_swap(self, decision: TradingDecision, snapshot: VaultSnapshot):
        """
        执行交易

        Args:
            decision: TradingDecision 实例
            snapshot: VaultSnapshot 实例

        Returns:
            TradeResult 实例
        """
        if not decision.should_trade():
            return TradeResult(False, error="决策为 HOLD，不执行交易")

        print(f"\n🚀 执行交易...")
        print(f"   Amount in: {format_wei(decision.amount_in):.4f} tokens")
        print(f"   Min out: {format_wei(decision.min_amount_out):.4f} tokens")

        try:
            # 构建交易
            tx = self._build_transaction(decision, snapshot)

            # 签名交易
            signed_tx = self.account.sign_transaction(tx)
            print(f"   ✍️  交易已签名")

            # 发送交易
            tx_hash = self.w3m.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            print(f"   📤 交易已发送: {tx_hash.hex()}")

            # 等待确认
            receipt = self.w3m.wait_for_transaction(tx_hash)

            # 检查交易状态
            if receipt['status'] == 0:
                return TradeResult(
                    False,
                    tx_hash=tx_hash,
                    receipt=receipt,
                    error="交易被 revert"
                )

            print(f"   ✅ 交易确认成功")
            print(f"      Block: #{receipt['blockNumber']}")
            print(f"      Gas used: {receipt['gasUsed']}")

            # 解析事件
            event_data = self._parse_swap_event(receipt)

            return TradeResult(
                True,
                tx_hash=tx_hash,
                receipt=receipt,
                event_data=event_data
            )

        except Exception as e:
            print(f"   ❌ 交易失败: {str(e)}")
            return TradeResult(False, error=str(e))

    def _build_transaction(self, decision: TradingDecision, snapshot: VaultSnapshot):
        """构建交易"""
        # 获取 nonce
        nonce = self.w3m.w3.eth.get_transaction_count(self.agent_address)

        # 获取 gas price
        gas_price = self.w3m.w3.eth.gas_price

        # 构建交易参数
        tx = self.vault.functions.executeSwap(
            self.user_address,
            snapshot.default_route_id,
            True,  # zeroForOne
            decision.amount_in,
            decision.min_amount_out
        ).build_transaction({
            'from': self.agent_address,
            'nonce': nonce,
            'gas': 500000,  # 预估 gas limit
            'gasPrice': gas_price,
        })

        print(f"   📝 交易构建完成")
        print(f"      Nonce: {nonce}")
        print(f"      Gas price: {Web3.from_wei(gas_price, 'gwei'):.2f} gwei")

        return tx

    def _parse_swap_event(self, receipt):
        """解析 AgentSwapExecuted 事件"""
        print(f"\n📋 解析事件...")

        # 获取事件
        events = self.vault.events.AgentSwapExecuted().process_receipt(receipt)

        if not events:
            print(f"   ⚠️  未找到 AgentSwapExecuted 事件")
            return None

        event = events[0]
        args = event['args']

        event_data = {
            'agent': args['agent'],
            'user': args['user'],
            'ensNode': args['ensNode'].hex(),
            'routeId': args['routeId'].hex(),
            'pool': args['pool'],
            'zeroForOne': args['zeroForOne'],
            'amountIn': args['amountIn'],
            'amountOut': args['amountOut'],
            'blockNumber': event['blockNumber'],
            'transactionHash': event['transactionHash'].hex(),
        }

        print(f"   ✅ AgentSwapExecuted 事件:")
        print(f"      Agent: {format_address(event_data['agent'])}")
        print(f"      User: {format_address(event_data['user'])}")
        print(f"      ENS Node: {format_address(event_data['ensNode'])}")
        print(f"      Route ID: {format_address(event_data['routeId'])}")
        print(f"      Pool: {format_address(event_data['pool'])}")
        print(f"      Direction: {'0→1' if event_data['zeroForOne'] else '1→0'}")
        print(f"      Amount In: {format_wei(event_data['amountIn']):.6f} tokens")
        print(f"      Amount Out: {format_wei(event_data['amountOut']):.6f} tokens")
        print(f"      Block: #{event_data['blockNumber']}")
        print(f"      TX Hash: {event_data['transactionHash']}")

        return event_data


if __name__ == '__main__':
    # 测试交易执行（需要本地节点运行）
    print("=== 测试交易执行 ===")

    from policy import TradingPolicy

    config = get_config()
    agent_config = config.agents_config['agents'][0]
    agent_address = agent_config['address']
    private_key = config.get_agent_private_key(agent_address)

    if not private_key:
        print("❌ 未找到 agent 私钥")
        exit(1)

    # 创建 trader
    trader = Trader(agent_address, private_key)

    # 获取快照
    snapshot = VaultSnapshot(agent_address)
    snapshot.fetch()

    # 获取决策
    policy = TradingPolicy()
    decision = policy.decide(snapshot)

    print(f"\n决策结果: {decision}")

    if decision.should_trade():
        # 执行交易
        result = trader.execute_swap(decision, snapshot)
        print(f"\n{result}")

        if result.success:
            print(f"\n🎉 交易执行成功！")
    else:
        print(f"\n⏸️  不执行交易")
