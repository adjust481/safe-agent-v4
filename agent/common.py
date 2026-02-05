"""
common.py - Web3 连接 + 配置加载 + ABI 管理

提供：
- Web3 连接实例
- 配置文件加载（deployments/*.json）
- 合约 ABI 加载
- 合约实例创建
"""

import json
import os
from pathlib import Path
from web3 import Web3
from eth_account import Account

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent


class Config:
    """配置管理类"""

    def __init__(self):
        self.deployment = self._load_json('deployments/localhost.json')
        self.agents_config = self._load_json('deployments/agents.local.json')
        self.keys = self._load_json('deployments/keys.local.json')
        self.vault_abi = self._load_json('artifacts/contracts/SafeAgentVault.sol/SafeAgentVault.json')['abi']

    def _load_json(self, relative_path):
        """加载 JSON 文件"""
        file_path = PROJECT_ROOT / relative_path
        if not file_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {file_path}")

        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def get_agent_config(self, agent_address):
        """获取指定 agent 的配置"""
        for agent in self.agents_config['agents']:
            if agent['address'].lower() == agent_address.lower():
                return agent
        return None

    def get_agent_private_key(self, agent_address):
        """获取指定 agent 的私钥"""
        return self.keys['agentPrivateKeys'].get(agent_address)

    @property
    def rpc_url(self):
        """获取 RPC URL（优先使用 keys.local.json 中的配置）"""
        return self.keys.get('rpcUrl') or self.deployment.get('rpcUrl')

    @property
    def vault_address(self):
        """获取 Vault 合约地址"""
        return self.deployment['addresses']['vault']

    @property
    def user_address(self):
        """获取用户地址"""
        return self.deployment['actors']['user']


class Web3Manager:
    """Web3 连接管理类"""

    def __init__(self, config: Config):
        self.config = config
        self.w3 = Web3(Web3.HTTPProvider(config.rpc_url))

        # 验证连接
        if not self.w3.is_connected():
            raise ConnectionError(f"无法连接到 RPC: {config.rpc_url}")

        print(f"✅ 已连接到网络: {config.deployment['network']}")
        print(f"   Chain ID: {self.w3.eth.chain_id}")
        print(f"   Latest block: {self.w3.eth.block_number}")

    def get_vault_contract(self):
        """获取 Vault 合约实例"""
        return self.w3.eth.contract(
            address=Web3.to_checksum_address(self.config.vault_address),
            abi=self.config.vault_abi
        )

    def get_account(self, private_key):
        """从私钥创建账户"""
        return Account.from_key(private_key)

    def wait_for_transaction(self, tx_hash, timeout=120):
        """等待交易确认"""
        print(f"⏳ 等待交易确认: {tx_hash.hex()}")
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
        return receipt

    def get_balance(self, address):
        """获取地址的 ETH 余额"""
        return self.w3.eth.get_balance(Web3.to_checksum_address(address))


def format_wei(amount_wei, decimals=18):
    """格式化 wei 为可读格式"""
    return float(Web3.from_wei(amount_wei, 'ether'))


def format_address(address):
    """格式化地址（显示前6位和后4位）"""
    if not address:
        return "0x0000...0000"
    return f"{address[:6]}...{address[-4:]}"


# 全局实例（单例模式）
_config = None
_web3_manager = None


def get_config():
    """获取配置实例（单例）"""
    global _config
    if _config is None:
        _config = Config()
    return _config


def get_web3_manager():
    """获取 Web3 管理器实例（单例）"""
    global _web3_manager
    if _web3_manager is None:
        config = get_config()
        _web3_manager = Web3Manager(config)
    return _web3_manager


if __name__ == '__main__':
    # 测试配置加载
    print("=== 测试配置加载 ===\n")

    config = get_config()
    print(f"Network: {config.deployment['network']}")
    print(f"Chain ID: {config.deployment['chainId']}")
    print(f"Vault: {config.vault_address}")
    print(f"User: {config.user_address}")

    print(f"\n=== Agents 配置 ===")
    for agent in config.agents_config['agents']:
        print(f"  {agent['ensName']}: {agent['address']}")
        print(f"    Enabled: {agent['enabled']}")
        print(f"    Max per trade: {format_wei(int(agent['maxNotionalPerTrade']))} ETH")

    print(f"\n=== Web3 连接测试 ===")
    w3m = get_web3_manager()
    vault = w3m.get_vault_contract()
    print(f"Vault contract loaded: {vault.address}")
