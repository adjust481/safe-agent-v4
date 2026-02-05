"""
snapshot.py - 读取链上状态

功能：
- 读取 vault 状态（用户余额、agent 子账户余额、已消费额度）
- 读取 agent 配置（enabled, ensNode, maxNotionalPerTrade）
- 读取默认路由信息
- 获取最新区块信息
"""

from web3 import Web3
from common import get_config, get_web3_manager, format_wei, format_address


class VaultSnapshot:
    """Vault 状态快照"""

    def __init__(self, agent_address):
        self.config = get_config()
        self.w3m = get_web3_manager()
        self.vault = self.w3m.get_vault_contract()
        self.agent_address = Web3.to_checksum_address(agent_address)
        self.user_address = Web3.to_checksum_address(self.config.user_address)

        # 状态数据
        self.block_number = None
        self.timestamp = None
        self.user_balance = None
        self.agent_sub_balance = None
        self.agent_spent = None
        self.agent_config = None
        self.default_route_id = None
        self.default_route = None

    def fetch(self):
        """获取所有状态"""
        print(f"\n📸 获取链上状态快照...")

        # 获取区块信息
        latest_block = self.w3m.w3.eth.get_block('latest')
        self.block_number = latest_block['number']
        self.timestamp = latest_block['timestamp']

        # 获取余额信息
        self.user_balance = self.vault.functions.balances(self.user_address).call()
        self.agent_sub_balance = self.vault.functions.agentBalances(
            self.user_address,
            self.agent_address
        ).call()
        self.agent_spent = self.vault.functions.agentSpent(
            self.user_address,
            self.agent_address
        ).call()

        # 获取 agent 配置（只读取前3个字段，避免动态数组问题）
        cfg = self.vault.functions.agentConfigs(self.agent_address).call()
        self.agent_config = {
            'enabled': cfg[0] if len(cfg) > 0 else False,
            'ensNode': cfg[1].hex() if len(cfg) > 1 else '0x' + '0' * 64,
            'maxNotionalPerTrade': cfg[2] if len(cfg) > 2 else 0,
        }

        # 获取默认路由
        self.default_route_id = self.vault.functions.defaultRouteId().call()
        route = self.vault.functions.routes(self.default_route_id).call()
        self.default_route = {
            'token0': route[0] if len(route) > 0 else None,
            'token1': route[1] if len(route) > 1 else None,
            'fee': route[2] if len(route) > 2 else 0,
            'pool': route[3] if len(route) > 3 else None,
            'enabled': route[4] if len(route) > 4 else False,
        }

        print(f"   Block: #{self.block_number}")
        print(f"   Timestamp: {self.timestamp}")
        self._print_summary()

        return self

    def _print_summary(self):
        """打印状态摘要"""
        print(f"\n💰 余额状态:")
        print(f"   User main balance: {format_wei(self.user_balance):.4f} tokens")
        print(f"   Agent sub-balance: {format_wei(self.agent_sub_balance):.4f} tokens")
        print(f"   Agent spent:       {format_wei(self.agent_spent):.4f} tokens")

        print(f"\n⚙️  Agent 配置:")
        print(f"   Enabled: {self.agent_config['enabled']}")
        print(f"   ENS Node: {format_address(self.agent_config['ensNode'])}")
        print(f"   Max per trade: {format_wei(self.agent_config['maxNotionalPerTrade']):.4f} tokens")

        print(f"\n🛣️  默认路由:")
        print(f"   Route ID: {format_address(self.default_route_id.hex())}")
        print(f"   Token0: {format_address(self.default_route['token0'])}")
        print(f"   Token1: {format_address(self.default_route['token1'])}")
        print(f"   Fee: {self.default_route['fee']}")
        print(f"   Enabled: {self.default_route['enabled']}")

    def to_dict(self):
        """转换为字典格式"""
        return {
            'block_number': self.block_number,
            'timestamp': self.timestamp,
            'user_balance': str(self.user_balance),
            'agent_sub_balance': str(self.agent_sub_balance),
            'agent_spent': str(self.agent_spent),
            'agent_config': {
                'enabled': self.agent_config['enabled'],
                'ensNode': self.agent_config['ensNode'],
                'maxNotionalPerTrade': str(self.agent_config['maxNotionalPerTrade']),
            },
            'default_route_id': self.default_route_id.hex(),
            'default_route': {
                'token0': self.default_route['token0'],
                'token1': self.default_route['token1'],
                'fee': self.default_route['fee'],
                'pool': self.default_route['pool'],
                'enabled': self.default_route['enabled'],
            }
        }

    def get_available_balance(self):
        """获取可用余额（agent 子账户余额）"""
        return self.agent_sub_balance

    def get_max_trade_amount(self):
        """获取最大交易额度"""
        return self.agent_config['maxNotionalPerTrade']

    def is_agent_enabled(self):
        """检查 agent 是否启用"""
        return self.agent_config['enabled']

    def is_route_enabled(self):
        """检查路由是否启用"""
        return self.default_route['enabled']


if __name__ == '__main__':
    # 测试快照功能
    print("=== 测试 Vault 状态快照 ===")

    config = get_config()
    agent_address = config.agents_config['agents'][0]['address']

    snapshot = VaultSnapshot(agent_address)
    snapshot.fetch()

    print(f"\n=== 状态检查 ===")
    print(f"Agent enabled: {snapshot.is_agent_enabled()}")
    print(f"Route enabled: {snapshot.is_route_enabled()}")
    print(f"Available balance: {format_wei(snapshot.get_available_balance()):.4f} tokens")
    print(f"Max trade amount: {format_wei(snapshot.get_max_trade_amount()):.4f} tokens")
