"""
Python Agent Status Server

Provides a simple HTTP API for the frontend to query agent status.

Usage:
    pip install fastapi uvicorn
    uvicorn agent_py.status_server:app --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import time

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
STATE = {
    "status": "polling",
    "lastDecision": "HOLD",
    "lastTxHash": None,
    "lastError": None,
    "updatedAt": time.time(),
}

@app.get("/status")
def get_status():
    """Get current agent status."""
    return STATE

def update_state(**kwargs):
    """Update agent state (call this from your agent loop)."""
    STATE.update(kwargs)
    STATE["updatedAt"] = time.time()

# Example usage from agent code:
# from agent_py.status_server import update_state
# update_state(status="trading", lastDecision="SWAP", lastTxHash="0x...")
