"""
Manual swap execution script.

Execute a single swap transaction through SafeAgentVault.executeSwap().
"""
import sys
from utils import (
    create_web3_instance,
    load_deployment_info,
    get_vault_contract,
    get_agent_account,
    parse_token_amount,
    format_token_amount
)

def execute_swap(w3, vault, agent_account, user_address, route_id, zero_for_one, amount_in, min_amount_out):
    """
    Execute swap transaction.

    Args:
        w3: Web3 instance
        vault: Vault contract instance
        agent_account: Agent account object
        user_address: User address whose allocation to use
        route_id: Route identifier (bytes32)
        zero_for_one: Swap direction (bool)
        amount_in: Amount to swap (in wei)
        min_amount_out: Minimum output amount (in wei)

    Returns:
        Transaction receipt
    """
    # Build transaction
    nonce = w3.eth.get_transaction_count(agent_account.address)
    gas_price = w3.eth.gas_price

    tx = vault.functions.executeSwap(
        user_address,
        route_id,
        zero_for_one,
        amount_in,
        min_amount_out
    ).build_transaction({
        'from': agent_account.address,
        'nonce': nonce,
        'gas': 500000,  # Conservative gas limit
        'gasPrice': gas_price
    })

    # Sign transaction
    signed_tx = agent_account.sign_transaction(tx)

    # Send transaction
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    print(f"Transaction sent: {tx_hash.hex()}")

    # Wait for receipt
    print("Waiting for confirmation...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return receipt

def parse_swap_event(vault, receipt):
    """Parse AgentSwapExecuted event from receipt."""
    for log in receipt['logs']:
        try:
            event = vault.events.AgentSwapExecuted().process_log(log)
            return event['args']
        except:
            continue
    return None

def main():
    """Main entry point."""
    try:
        # Setup
        w3 = create_web3_instance()
        deployment = load_deployment_info()
        vault = get_vault_contract(w3)
        agent_account = get_agent_account(w3)

        user_address = deployment['actors']['user']
        agent_address = deployment['actors']['agent']

        print("=== Manual Swap Execution ===\n")
        print(f"Connected to network (chainId: {w3.eth.chain_id})")
        print(f"Agent address: {agent_address}")
        print(f"User address: {user_address}")
        print()

        # Get default route
        default_route_id = vault.functions.defaultRouteId().call()
        route = vault.functions.routes(default_route_id).call()

        print(f"Using default route:")
        print(f"  Route ID: {default_route_id.hex()}")
        print(f"  Token0: {route[0]}")
        print(f"  Token1: {route[1]}")
        print(f"  Fee: {route[2]}")
        print()

        # Check balances before
        agent_balance_before = vault.functions.agentBalances(user_address, agent_address).call()
        agent_spent_before = vault.functions.agentSpent(user_address, agent_address).call()

        print(f"Before swap:")
        print(f"  Agent sub-balance: {format_token_amount(agent_balance_before):.4f} tokens")
        print(f"  Agent spent: {format_token_amount(agent_spent_before):.4f} tokens")
        print()

        # Execute swap
        amount_in = parse_token_amount("50")  # 50 tokens
        min_amount_out = parse_token_amount("1")  # 1 token minimum
        zero_for_one = True

        print(f"Executing swap:")
        print(f"  Amount in: {format_token_amount(amount_in):.4f} tokens")
        print(f"  Direction: {'token0 -> token1' if zero_for_one else 'token1 -> token0'}")
        print(f"  Min amount out: {format_token_amount(min_amount_out):.4f} tokens")
        print()

        receipt = execute_swap(
            w3, vault, agent_account,
            user_address, default_route_id,
            zero_for_one, amount_in, min_amount_out
        )

        print(f"Transaction confirmed in block: {receipt['blockNumber']}")
        print(f"Gas used: {receipt['gasUsed']}")
        print()

        # Parse event
        event_args = parse_swap_event(vault, receipt)
        if event_args:
            print("AgentSwapExecuted event:")
            print(f"  Agent: {event_args['agent']}")
            print(f"  User: {event_args['user']}")
            print(f"  Route ID: {event_args['routeId'].hex()}")
            print(f"  Amount in: {format_token_amount(event_args['amountIn']):.4f} tokens")
            print(f"  Amount out: {format_token_amount(event_args['amountOut']):.4f} tokens")
            print()

        # Check balances after
        agent_balance_after = vault.functions.agentBalances(user_address, agent_address).call()
        agent_spent_after = vault.functions.agentSpent(user_address, agent_address).call()

        print(f"After swap:")
        print(f"  Agent sub-balance: {format_token_amount(agent_balance_after):.4f} tokens")
        print(f"  Agent spent: {format_token_amount(agent_spent_after):.4f} tokens")
        print()

        print("✓ Swap executed successfully!")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
