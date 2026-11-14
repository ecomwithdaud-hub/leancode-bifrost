"""
Tests for LeanCode FastAPI Server Endpoints
Verifies:
- GET / and /api/health
- GET /api/status and /api/telemetry
- Action approval and denial flows
- Confidential marker toggle
- Demo seed and failover endpoints
"""

import sys
from pathlib import Path

# Ensure root directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
from server import app, state


@pytest.fixture
def client():
    return TestClient(app)


def test_health_and_dashboard_endpoints(client):
    """Test health check and dashboard HTML endpoints."""
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    res_dash = client.get("/")
    assert res_dash.status_code == 200
    assert "LeanCode" in res_dash.text
    assert "Bifrost Gateway" in res_dash.text


def test_status_and_telemetry_endpoints(client):
    """Test status and telemetry reporting."""
    res_status = client.get("/api/status")
    assert res_status.status_code == 200
    data = res_status.json()
    assert "bifrost_base_url" in data
    assert "candidate_models" in data
    assert "user_budget_usd" in data

    res_telem = client.get("/api/telemetry")
    assert res_telem.status_code == 200
    t_data = res_telem.json()
    assert "telemetry" in t_data
    assert "pending_actions" in t_data


def test_confidential_toggle_endpoint(client):
    """Test toggling .confidential marker file via API."""
    # Ensure starting in non-confidential
    client.post("/api/confidential/toggle", json={"enable": False})
    status1 = client.get("/api/status").json()
    assert status1["confidential_locked"] is False

    # Toggle to confidential
    res = client.post("/api/confidential/toggle", json={"enable": True})
    assert res.status_code == 200
    status2 = client.get("/api/status").json()
    assert status2["confidential_locked"] is True
    assert status2["candidate_models"] == ["ollama/qwen2.5-coder:7b"]

    # Toggle back to normal
    client.post("/api/confidential/toggle", json={"enable": False})
    status3 = client.get("/api/status").json()
    assert status3["confidential_locked"] is False


def test_demo_seed_cache_and_simulate_failover(client):
    """Test judge demo endpoints for cache hit and failover."""
    res_cache = client.post("/api/demo/seed-cache")
    assert res_cache.status_code == 200
    c_data = res_cache.json()
    assert c_data["cache_hits"] >= 1
    assert c_data["tokens_saved"] > 0
    assert "[CACHE HIT" in c_data["second_read_result"]

    res_fail = client.post("/api/demo/simulate-failover")
    assert res_fail.status_code == 200
    f_data = res_fail.json()
    assert f_data["status"] == "SIMULATED"
    assert "failed_model" in f_data["event"]
