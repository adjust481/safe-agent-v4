# Python Agent Demo

Python-based agent demo for SafeAgentVault using web3.py.

## Setup

1. Create virtual environment:
```bash
cd agent_py
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env and set AGENT_PRIVATE_KEY
```

## Usage

### 1. Deploy contracts (from project root)
```bash
cd ..
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js
```

This will create `deployments/localhost.json` with all contract addresses.

### 2. Query vault state
```bash
python snapshot.py
```

### 3. Manual swap execution
```bash
python manual_swap.py
```

### 4. Run agent loop
```bash
# Dry run mode (no actual transactions)
DRY_RUN=1 python loop_agent.py

# Live mode with trade limit
STOP_AFTER_N_TRADES=3 python loop_agent.py
```

## Modules

- `utils.py` - Common utilities (load deployment info, create web3 instance)
- `snapshot.py` - Query and display vault state
- `policy.py` - Rule-based decision logic (conservative "HOLD by default")
- `manual_swap.py` - Execute single swap transaction
- `loop_agent.py` - Main polling loop with policy-based decisions
