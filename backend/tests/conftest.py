import os
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

DEFAULT_PROJECT_ID = "timeblock-local"


@pytest.fixture(scope="session", autouse=True)
def emulator_host() -> str:
    """Fail loudly rather than let a misconfigured run reach real Firestore."""
    host = os.getenv("FIRESTORE_EMULATOR_HOST")
    if not host:
        pytest.exit(
            "FIRESTORE_EMULATOR_HOST is not set. Start the emulator with `make up` "
            "and run tests via `make test-backend`.",
            returncode=1,
        )
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", DEFAULT_PROJECT_ID)
    return host


@pytest.fixture(autouse=True)
def reset_firestore(emulator_host: str):
    """Wipe every document between tests via the emulator's bulk-delete endpoint.

    One HTTP call, versus recursively deleting documents through the client.
    """
    project = os.environ["GOOGLE_CLOUD_PROJECT"]
    url = (
        f"http://{emulator_host}/emulator/v1/projects/{project}"
        "/databases/(default)/documents"
    )
    response = httpx.delete(url)
    response.raise_for_status()
    yield


@pytest.fixture
def firestore_client(emulator_host: str):
    # Imported inside the fixture so the emulator env vars are set before the
    # module-level client in src.database is constructed.
    from src.database import get_client

    return get_client()


@pytest.fixture
def seed_chunk(firestore_client):
    """Write a chunk document directly, bypassing the data layer under test."""

    def _seed(user_id: str, chunk_id: str, **overrides) -> dict:
        data = {
            "title": "Morning",
            "start_time": datetime(2023, 1, 1, 6, 0, tzinfo=timezone.utc),
            "end_time": datetime(2023, 1, 1, 8, 0, tzinfo=timezone.utc),
            "is_template": False,
            "tasks": [],
        }
        data.update(overrides)
        firestore_client.collection("users", user_id, "chunks").document(chunk_id).set(data)
        return data

    return _seed


@pytest.fixture
def client() -> TestClient:
    # Imported inside the fixture to ensure environment variables are set before app load
    from src.main import app

    return TestClient(app)
