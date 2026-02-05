"""
loop.py - 主循环控制器

功能：
- 每 2 秒执行一次循环
- 执行流程：snapshot → policy → trader
- 更新 state.json 状态文件
- 异常处理和日志记录
- 优雅退出（Ctrl+C）
"""

import time
import json
import signal
import sys
from datetime import datetime
from pathlib import Path

from common import get_config, format_wei
from snapshot import VaultSnapshot
from policy import TradingPolicy, ConservativePolicy, AggressivePolicy
from trader import Trader


class AgentLoop:
    """Agent 主循环控制器"""

    def __init__(self, agent_address, strategy='default'):
        """
        初始化主循环

        Args:
            agent_address: Agent 地址
            strategy: 策略类型 ('default', 'conservative', 'aggressive')
        """
        self.config = get_config()
        self.agent_address = agent_address

        # 获取 agent 配置
        self.agent_config = self.config.get_agent_config(agent_address)
        if not self.agent_config:
            raise ValueError(f"未找到 agent 配置: {agent_address}")

        # 获取私钥
        private_key = self.config.get_agent_private_key(agent_address)
        if not private_key:
            raise ValueError(f"未找到 agent 私钥: {agent_address}")

        # 初始化组件
        self.snapshot = VaultSnapshot(agent_address)
        self.policy = self._create_policy(strategy)
        self.trader = Trader(agent_address, private_key)

        # 状态文件路径
        self.state_file = Path(__file__).parent / 'state.json'

        # 循环控制
        self.running = False
        self.loop_interval = 2  # 秒
        self.loop_count = 0
        self.last_trade_time = None
        self.total_trades = 0

        # 注册信号处理
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        print(f"\n{'='*60}")
        print(f"🤖 Agent 自动交易系统启动")
        print(f"{'='*60}")
        print(f"Agent: {self.agent_config['ensName']} ({self.agent_address})")
        print(f"Strategy: {strategy}")
        print(f"Loop interval: {self.loop_interval}s")
        print(f"State file: {self.state_file}")
        print(f"{'='*60}\n")

    def _create_policy(self, strategy):
        """创建策略实例"""
        if strategy == 'conservative':
            return ConservativePolicy()
        elif strategy == 'aggressive':
            return AggressivePolicy()
        else:
            return TradingPolicy()

    def _signal_handler(self, signum, frame):
        """信号处理器（Ctrl+C）"""
        print(f"\n\n⚠️  收到退出信号，正在优雅退出...")
        self.running = False

    def run(self):
        """启动主循环"""
        self.running = True

        try:
            while self.running:
                self.loop_count += 1
                print(f"\n{'─'*60}")
                print(f"🔄 Loop #{self.loop_count} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"{'─'*60}")

                try:
                    # 步骤 1: 获取快照
                    self.snapshot.fetch()

                    # 步骤 2: 策略决策
                    decision = self.policy.decide(self.snapshot)
                    print(f"\n💡 决策: {decision}")

                    # 步骤 3: 执行交易（如果决策为 TRADE）
                    trade_result = None
                    if decision.should_trade():
                        trade_result = self.trader.execute_swap(decision, self.snapshot)

                        if trade_result.success:
                            self.total_trades += 1
                            self.last_trade_time = datetime.now()
                            self.policy.update_last_trade_block(self.snapshot.block_number)
                            print(f"\n✅ 交易成功！总交易次数: {self.total_trades}")
                        else:
                            print(f"\n❌ 交易失败: {trade_result.error}")

                    # 步骤 4: 更新状态文件
                    self._update_state(decision, trade_result)

                except Exception as e:
                    print(f"\n❌ 循环执行出错: {str(e)}")
                    import traceback
                    traceback.print_exc()

                    # 更新错误状态
                    self._update_state_error(str(e))

                # 等待下一次循环
                if self.running:
                    print(f"\n⏳ 等待 {self.loop_interval}s 后继续...")
                    time.sleep(self.loop_interval)

        except KeyboardInterrupt:
            print(f"\n\n⚠️  用户中断")
        finally:
            self._cleanup()

    def _update_state(self, decision, trade_result):
        """更新状态文件"""
        state = {
            'agent': {
                'address': self.agent_address,
                'ensName': self.agent_config['ensName'],
                'label': self.agent_config['label'],
                'strategy': self.agent_config['strategy'],
            },
            'status': 'running',
            'loop_count': self.loop_count,
            'total_trades': self.total_trades,
            'last_update': datetime.now().isoformat(),
            'last_trade_time': self.last_trade_time.isoformat() if self.last_trade_time else None,
            'snapshot': self.snapshot.to_dict(),
            'decision': {
                'action': decision.action,
                'reason': decision.reason,
                'amount_in': str(decision.amount_in) if decision.should_trade() else None,
                'min_amount_out': str(decision.min_amount_out) if decision.should_trade() else None,
            },
            'last_trade': None,
            'last_error': None,
        }

        # 添加交易结果
        if trade_result:
            if trade_result.success:
                state['last_trade'] = {
                    'tx_hash': trade_result.tx_hash.hex(),
                    'block_number': trade_result.receipt['blockNumber'],
                    'gas_used': trade_result.receipt['gasUsed'],
                    'event': trade_result.event_data,
                    'timestamp': datetime.now().isoformat(),
                }
            else:
                state['last_error'] = {
                    'message': trade_result.error,
                    'timestamp': datetime.now().isoformat(),
                }

        # 写入文件
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2, ensure_ascii=False)

    def _update_state_error(self, error_message):
        """更新错误状态"""
        try:
            # 尝试读取现有状态
            if self.state_file.exists():
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    state = json.load(f)
            else:
                state = {}

            state['status'] = 'error'
            state['last_error'] = {
                'message': error_message,
                'timestamp': datetime.now().isoformat(),
            }
            state['last_update'] = datetime.now().isoformat()

            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(state, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️  无法更新错误状态: {str(e)}")

    def _cleanup(self):
        """清理资源"""
        print(f"\n{'='*60}")
        print(f"📊 运行统计")
        print(f"{'='*60}")
        print(f"总循环次数: {self.loop_count}")
        print(f"总交易次数: {self.total_trades}")
        if self.last_trade_time:
            print(f"最后交易时间: {self.last_trade_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        print(f"\n👋 Agent 已停止\n")


def main():
    """主入口"""
    import argparse

    parser = argparse.ArgumentParser(description='SafeAgentVault 自动交易 Agent')
    parser.add_argument(
        '--agent',
        type=int,
        default=0,
        help='Agent 索引（默认 0，即第一个 agent）'
    )
    parser.add_argument(
        '--strategy',
        choices=['default', 'conservative', 'aggressive'],
        default='default',
        help='交易策略（default/conservative/aggressive）'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=2,
        help='循环间隔（秒，默认 2）'
    )

    args = parser.parse_args()

    # 加载配置
    config = get_config()
    agents = config.agents_config['agents']

    if args.agent >= len(agents):
        print(f"❌ Agent 索引超出范围: {args.agent} (总共 {len(agents)} 个 agents)")
        sys.exit(1)

    agent_config = agents[args.agent]
    agent_address = agent_config['address']

    # 创建并运行循环
    loop = AgentLoop(agent_address, strategy=args.strategy)
    loop.loop_interval = args.interval
    loop.run()


if __name__ == '__main__':
    main()
