# Firestore Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the FastAPI backend's data layer from DynamoDB to Google Cloud Firestore, replacing the DynamoDB Local container and `moto` mocks with the Firestore emulator for both local development and CI.

**Architecture:** `backend/src/database.py` is rewritten against `google-cloud-firestore` using a `users/{user_id}/chunks/{chunk_id}` subcollection, keeping its existing function signatures so `routes.py` changes only in how it detects "not found". A new `ChunkNotFound` domain exception replaces the current `botocore.ClientError` inspection, decoupling the HTTP layer from the storage SDK. The Firestore emulator runs as a `docker-compose` service on port 8081 and backs every test run.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, `google-cloud-firestore` 2.28+, pytest, httpx, Docker Compose, `google/cloud-sdk:emulators`.

**Spec:** `docs/superpowers/specs/2026-07-20-firestore-migration-design.md`
**ClickUp:** [86bb077vx](https://app.clickup.com/t/86bb077vx)

## Global Constraints

- **Emulator port is 8081**, not the conventional 8080 — the backend already uses 8080.
- **Emulator project ID is `timeblock-local`** everywhere (compose, Makefile, CI, conftest, seed script).
- **Environment variables:** `FIRESTORE_EMULATOR_HOST` and `GOOGLE_CLOUD_PROJECT`. Every `DYNAMODB_*`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION` reference in `docker-compose.yml`, `Makefile`, and `.github/workflows/ci.yml` is removed.
- **Do not modify** `infra/*.tf` or anything under `frontend/`. The AWS deployment is knowingly left broken; GCP infra is separate follow-up work.
- **Do not change** `backend/src/models.py` or any `response_model` in `routes.py`. The API contract stays fixed apart from timestamps gaining a `+00:00` offset.
- **Timestamps** are normalized to UTC-aware before writing. Firestore returns `DatetimeWithNanoseconds` (a `datetime` subclass, always tz-aware).
- Run all `pytest` commands from the repo root using `backend/.venv/bin/pytest` with `backend/pytest.ini` (which sets `pythonpath = .` relative to `backend/`), i.e. `cd backend && .venv/bin/pytest tests`.

## Verified Emulator Behavior

These were confirmed empirically against `google/cloud-sdk:emulators` with `google-cloud-firestore` 2.28.0. Do not re-derive them; do not assume DynamoDB analogues.

| Behavior | Verified result |
|---|---|
| `GET http://localhost:8081/` | Returns `Ok` — use as the readiness probe |
| Emulator cold start | ~6 seconds |
| Naive `datetime` written | Silently coerced to UTC-aware on read |
| `.update()` on a missing document | Raises `google.api_core.exceptions.NotFound` |
| `.delete()` on a missing document | **Succeeds silently** — returns a timestamp, raises nothing |
| `.get()` on a missing document | Returns a snapshot with `.exists == False`, `.to_dict() is None` |
| `.update()` return value | A `WriteResult` — **no `ReturnValues="ALL_NEW"` equivalent; you must re-read** |
| Parent doc `users/{uid}` | Does not exist as a document; subcollections still stream correctly |
| `DELETE /emulator/v1/projects/{project}/databases/(default)/documents` | Returns 200 and wipes all data |

## File Structure

| File | Responsibility after this plan |
|---|---|
| `backend/src/database.py` | Firestore data access + `ChunkNotFound`. Sole file that knows the storage backend. |
| `backend/src/routes.py` | HTTP layer. Imports only `models` and `database` — no storage SDK. |
| `backend/tests/conftest.py` | Emulator connection guard, per-test data reset, shared fixtures. |
| `backend/scripts/seed_local_db.py` | Populates sample chunks for local dev (replaces `init_local_db.py`). |
| `docker-compose.yml` | Firestore emulator service (replaces `dynamodb-local`). |

---

### Task 1: Swap dependencies and stand up the emulator

Replaces the DynamoDB container and AWS SDKs with the Firestore emulator and client. After this task the emulator runs and the Firestore client imports, but `database.py` still speaks DynamoDB — the backend is intentionally broken until Task 3. Nothing in this task is testable via pytest, so it is verified by direct commands.

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `docker-compose.yml`
- Modify: `Makefile`

**Interfaces:**
- Consumes: nothing.
- Produces: a `firestore-emulator` compose service on port 8081; `make up`, `make down`; env vars `FIRESTORE_EMULATOR_HOST=localhost:8081` and `GOOGLE_CLOUD_PROJECT=timeblock-local`.

- [ ] **Step 1: Replace the AWS dependencies**

Overwrite `backend/requirements.txt`:

```
fastapi>=0.103.0
uvicorn>=0.23.0
pydantic>=2.3.0
google-cloud-firestore>=2.28.0
mangum>=0.17.0
pytest>=7.4.0
httpx>=0.24.0
```

`boto3` and `moto[dynamodb]` are removed. `httpx` stays — it backs `TestClient` and is used in Task 2 to call the emulator's reset endpoint.

- [ ] **Step 2: Create the venv and install**

```bash
make install-backend
```

Expected: creates `backend/.venv` if absent, then installs. Verify:

```bash
backend/.venv/bin/python -c "from google.cloud import firestore; print('ok')"
backend/.venv/bin/python -c "import boto3" 2>&1 | tail -1
```

Expected: `ok`, then `ModuleNotFoundError: No module named 'boto3'`.

If `boto3` still imports, the venv predates this change — run `rm -rf backend/.venv && make install-backend`.

- [ ] **Step 3: Replace the compose service**

Overwrite `docker-compose.yml`:

```yaml
services:
  firestore-emulator:
    image: "google/cloud-sdk:emulators"
    container_name: firestore-emulator
    command: gcloud beta emulators firestore start --host-port=0.0.0.0:8081
    ports:
      - "8081:8081"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - FIRESTORE_EMULATOR_HOST=firestore-emulator:8081
      - GOOGLE_CLOUD_PROJECT=timeblock-local
    depends_on:
      - firestore-emulator
```

Note the `backend` service uses the compose network hostname `firestore-emulator:8081`, while host-side commands (Makefile, CI) use `localhost:8081`. The emulator has no volume mount: it is in-memory only and cannot persist data.

- [ ] **Step 4: Verify the emulator boots**

```bash
docker compose up -d firestore-emulator
for i in $(seq 1 60); do curl -sf http://localhost:8081/ >/dev/null && echo "READY" && break; sleep 1; done
curl -s http://localhost:8081/
```

Expected: `READY` within ~10 seconds, then `Ok`.

- [ ] **Step 5: Update the Makefile**

In `Makefile`, replace the `up`, `init-db`, `dev-backend`, and `test-backend` targets and the corresponding `help` lines:

```makefile
up:
	docker compose up -d firestore-emulator
	@echo "Waiting for Firestore emulator on :8081..."
	@for i in $$(seq 1 60); do \
		if curl -sf http://localhost:8081/ > /dev/null 2>&1; then echo "Emulator ready."; exit 0; fi; \
		sleep 1; \
	done; \
	echo "Emulator failed to start."; docker compose logs firestore-emulator; exit 1

down:
	docker compose down

seed-db: up
	@echo "Seeding local Firestore emulator..."
	@export FIRESTORE_EMULATOR_HOST=localhost:8081 && \
	 export GOOGLE_CLOUD_PROJECT=timeblock-local && \
	 $(PYTHON) backend/scripts/seed_local_db.py

dev-backend: up
	@echo "Starting FastAPI backend..."
	@export FIRESTORE_EMULATOR_HOST=localhost:8081 && \
	 export GOOGLE_CLOUD_PROJECT=timeblock-local && \
	 cd backend && ../$(PYTHON) -m uvicorn src.main:app --reload --port 8080

test-backend: up
	@echo "Running backend tests..."
	@export FIRESTORE_EMULATOR_HOST=localhost:8081 && \
	 export GOOGLE_CLOUD_PROJECT=timeblock-local && \
	 cd backend && ../$(PYTEST) tests
```

Also update `.PHONY` (replace `init-db` with `seed-db`) and these two `help` lines:

```makefile
	@echo "    up             Start the local Firestore emulator"
	@echo "    seed-db        Populate the emulator with sample data (requires 'up')"
```

`test-backend` now depends on `up` so tests can never run against a cold emulator. `seed-db` references a script created in Task 4 and will fail until then — that is expected.

- [ ] **Step 6: Verify the Makefile target**

```bash
docker compose down && make up
```

Expected: container starts, then `Emulator ready.`

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt docker-compose.yml Makefile
git commit -m "build: replace DynamoDB Local with the Firestore emulator

Swap boto3/moto for google-cloud-firestore and run the Firestore
emulator on port 8081 (8080 is taken by the backend). The emulator is
in-memory only, so no volume mount replaces the old docker/dynamodb one."
```

---

### Task 2: Emulator-backed test fixtures

Rewrites `conftest.py` to talk to the emulator instead of `moto`. Verified with a smoke test that is deleted at the end of the task — its only job is to prove the fixtures work before any production code depends on them.

**Files:**
- Modify: `backend/tests/conftest.py` (full rewrite)
- Create then delete: `backend/tests/test_conftest_smoke.py`

**Interfaces:**
- Consumes: `FIRESTORE_EMULATOR_HOST`, `GOOGLE_CLOUD_PROJECT` from Task 1.
- Produces four fixtures used by Task 3:
  - `emulator_host: str` — session-scoped, autouse; aborts the run if the emulator is not configured.
  - `reset_firestore` — function-scoped, autouse; wipes all data before each test.
  - `firestore_client: google.cloud.firestore.Client` — a client bound to the emulator.
  - `seed_chunk(user_id: str, chunk_id: str, **overrides) -> dict` — writes one chunk document directly and returns the written dict.
  - `client: fastapi.testclient.TestClient`.

- [ ] **Step 1: Rewrite conftest.py**

Overwrite `backend/tests/conftest.py`:

```python
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
```

`firestore_client` deliberately reuses `src.database.get_client()` rather than constructing its own — if the production client is misconfigured, the fixtures fail too, instead of masking it.

- [ ] **Step 2: Write the smoke test**

Create `backend/tests/test_conftest_smoke.py`:

```python
def test_emulator_is_reachable_and_reset_between_tests(firestore_client, seed_chunk):
    seed_chunk("user123", "chunk1")
    docs = list(firestore_client.collection("users", "user123", "chunks").stream())
    assert [d.id for d in docs] == ["chunk1"]


def test_previous_test_data_does_not_leak(firestore_client):
    docs = list(firestore_client.collection("users", "user123", "chunks").stream())
    assert docs == []
```

The second test is the important one: it proves `reset_firestore` actually runs between tests. Without it, a working-looking suite could be sharing state.

- [ ] **Step 3: Run the smoke test**

```bash
make up && cd backend && FIRESTORE_EMULATOR_HOST=localhost:8081 GOOGLE_CLOUD_PROJECT=timeblock-local .venv/bin/pytest tests/test_conftest_smoke.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'boto3'`.

This is the honest pre-edit state and is worth understanding rather than working around. Task 1 rebuilt the venv without `boto3`, but `database.py` still has `import boto3` on line 1. Python executes a module top-down, so the import fails there — it never reaches the missing `get_client`. Step 4 fixes both problems at once.

- [ ] **Step 4: Swap the imports and add a temporary `get_client`**

In `backend/src/database.py`, replace the first two lines:

```python
import boto3
import botocore.exceptions
```

with:

```python
from google.cloud import firestore
```

Then append to the same file:

```python
_client = None


def get_client():
    global _client
    if _client is None:
        _client = firestore.Client(
            project=os.getenv("GOOGLE_CLOUD_PROJECT", "timeblock-local")
        )
    return _client
```

The existing DynamoDB functions still *reference* `boto3` and `botocore`, but only inside function bodies, which Python does not evaluate at import time. Nothing calls them before Task 3 overwrites the file, so the module now imports cleanly despite being temporarily inconsistent. `os` is already imported at the top of the file.

`routes.py` still has `import botocore.exceptions` and will fail the same way — that is fine, because nothing imports `routes` until Task 3 Step 7, after Step 5 has rewritten it.

- [ ] **Step 5: Run the smoke test again**

```bash
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8081 GOOGLE_CLOUD_PROJECT=timeblock-local .venv/bin/pytest tests/test_conftest_smoke.py -v
```

Expected: 2 passed.

- [ ] **Step 6: Verify the safety guard fires**

```bash
cd backend && env -u FIRESTORE_EMULATOR_HOST .venv/bin/pytest tests/test_conftest_smoke.py -v
```

Expected: the run aborts with `FIRESTORE_EMULATOR_HOST is not set`. This is the guard that prevents a stray run from writing to real Firestore — confirm it before trusting the suite.

- [ ] **Step 7: Delete the smoke test and commit**

```bash
rm backend/tests/test_conftest_smoke.py
git add backend/tests/conftest.py backend/src/database.py
git commit -m "test: back pytest fixtures with the Firestore emulator

Replace the moto mock_aws fixtures with an emulator connection guard, a
per-test bulk-delete reset, and a seed_chunk helper. Guard aborts the run
if FIRESTORE_EMULATOR_HOST is unset so tests can never hit real Firestore."
```

---

### Task 3: Rewrite the data layer

The core of the migration. `database.py` cannot be partially migrated — the whole file and both test modules change together, and the suite is red until the task completes.

**Files:**
- Modify: `backend/src/database.py` (full rewrite)
- Modify: `backend/src/routes.py`
- Modify: `backend/tests/test_database.py`
- Modify: `backend/tests/test_routes.py`

**Interfaces:**
- Consumes: fixtures `client`, `firestore_client`, `seed_chunk` from Task 2.
- Produces:
  - `ChunkNotFound(Exception)` in `src.database`
  - `get_client() -> firestore.Client`
  - `get_chunks(user_id: str) -> list[TimeChunkResponse]`
  - `create_chunk(user_id: str, chunk: TimeChunkCreate) -> TimeChunkResponse`
  - `update_chunk(user_id: str, chunk_id: str, update: TimeChunkUpdate) -> TimeChunkResponse` — raises `ChunkNotFound`
  - `delete_chunk(user_id: str, chunk_id: str) -> None` — raises `ChunkNotFound`

- [ ] **Step 1: Update the data-layer tests to expect Firestore behavior**

Overwrite `backend/tests/test_database.py`:

```python
from datetime import datetime, timezone

import pytest

from src import database, models


def _chunk_data(**overrides) -> models.TimeChunkCreate:
    defaults = dict(
        title="Test Chunk",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=True,
        tasks=[],
    )
    defaults.update(overrides)
    return models.TimeChunkCreate(**defaults)


def test_create_and_get_chunk():
    user_id = "user123"

    created = database.create_chunk(user_id, _chunk_data())
    assert created.user_id == user_id
    assert created.chunk_id is not None
    assert created.title == "Test Chunk"

    chunks = database.get_chunks(user_id)
    assert len(chunks) == 1
    assert chunks[0].chunk_id == created.chunk_id


def test_get_chunks_is_scoped_to_the_user():
    database.create_chunk("user123", _chunk_data(title="Mine"))
    database.create_chunk("other_user", _chunk_data(title="Theirs"))

    chunks = database.get_chunks("user123")
    assert [c.title for c in chunks] == ["Mine"]


def test_update_chunk_tasks():
    user_id = "user123"
    created = database.create_chunk(user_id, _chunk_data())

    new_task = models.Task(task_id="t1", title="Reading", duration_minutes=30, min_duration=10)
    updated = database.update_chunk(
        user_id,
        created.chunk_id,
        models.TimeChunkUpdate(tasks=[new_task]),
    )

    assert len(updated.tasks) == 1
    assert updated.tasks[0].title == "Reading"


def test_update_chunk_times_only():
    user_id = "user123"
    created = database.create_chunk(user_id, _chunk_data(is_template=True))

    updated = database.update_chunk(
        user_id,
        created.chunk_id,
        models.TimeChunkUpdate(
            start_time=datetime(2023, 1, 1, 7, 0),
            end_time=datetime(2023, 1, 1, 9, 0),
        ),
    )

    # Firestore always returns tz-aware timestamps; naive input is stored as UTC.
    assert updated.start_time == datetime(2023, 1, 1, 7, 0, tzinfo=timezone.utc)
    assert updated.end_time == datetime(2023, 1, 1, 9, 0, tzinfo=timezone.utc)
    assert updated.tasks == []


def test_update_chunk_empty_payload_returns_current_state():
    user_id = "user123"
    created = database.create_chunk(user_id, _chunk_data(is_template=False))

    result = database.update_chunk(user_id, created.chunk_id, models.TimeChunkUpdate())

    assert result.chunk_id == created.chunk_id
    assert result.start_time == datetime(2023, 1, 1, 6, 0, tzinfo=timezone.utc)


def test_update_missing_chunk_raises():
    with pytest.raises(database.ChunkNotFound):
        database.update_chunk(
            "user123",
            "missing",
            models.TimeChunkUpdate(start_time=datetime(2023, 1, 1, 7, 0)),
        )


def test_update_missing_chunk_empty_payload_raises():
    with pytest.raises(database.ChunkNotFound):
        database.update_chunk("user123", "missing", models.TimeChunkUpdate())


def test_delete_chunk():
    user_id = "user123"
    created = database.create_chunk(user_id, _chunk_data())

    database.delete_chunk(user_id, created.chunk_id)

    assert database.get_chunks(user_id) == []


def test_delete_missing_chunk_raises():
    # Firestore deletes are idempotent and raise nothing on their own, so this
    # asserts the explicit existence check that preserves the API's 404.
    with pytest.raises(database.ChunkNotFound):
        database.delete_chunk("user123", "missing")


# The next two tests are a pair and must stay adjacent and in this order. They
# guard the reset_firestore fixture staying autouse: if isolation ever breaks,
# the second one fails here rather than surfacing as order-dependent failures
# scattered across unrelated tests.
def test_isolation_probe_writes_data(firestore_client, seed_chunk):
    seed_chunk("leak_probe", "c1")

    docs = list(firestore_client.collection("users", "leak_probe", "chunks").stream())
    assert [d.id for d in docs] == ["c1"]


def test_isolation_probe_data_does_not_leak(firestore_client):
    docs = list(firestore_client.collection("users", "leak_probe", "chunks").stream())
    assert docs == []
```

Changes from the previous version: the `timechunk_table` fixture argument is gone (data reset is autouse now); datetime assertions gained `tzinfo=timezone.utc`; and seven tests were added: user scoping, deletion, the three not-found paths, and the isolation probe pair. The delete-missing case is the migration's specific regression risk and previously had no data-layer test at all. The isolation pair is a standing guard on `reset_firestore` remaining autouse.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8081 GOOGLE_CLOUD_PROJECT=timeblock-local .venv/bin/pytest tests/test_database.py -v
```

Expected: FAIL — `AttributeError: module 'src.database' has no attribute 'ChunkNotFound'` (collection errors on the `pytest.raises` tests, failures elsewhere).

- [ ] **Step 3: Rewrite database.py**

Overwrite `backend/src/database.py` entirely:

```python
import os
from datetime import datetime, timezone
from uuid import uuid4

from google.api_core import exceptions as google_exceptions
from google.cloud import firestore

from .models import TimeChunkCreate, TimeChunkResponse, TimeChunkUpdate


class ChunkNotFound(Exception):
    """Raised when a chunk does not exist for the given user.

    Keeps the HTTP layer independent of the storage backend: routes catch this
    rather than inspecting Firestore's exception types.
    """


_client: firestore.Client | None = None


def get_client() -> firestore.Client:
    """Return the shared Firestore client.

    The client holds a long-lived gRPC channel and is designed to be reused, so
    it is built once per process rather than per request. Under Mangum/Lambda a
    warm container reuses this across invocations.

    When FIRESTORE_EMULATOR_HOST is set, google-cloud-firestore routes to the
    emulator automatically.
    """
    global _client
    if _client is None:
        _client = firestore.Client(
            project=os.getenv("GOOGLE_CLOUD_PROJECT", "timeblock-local")
        )
    return _client


def _chunks(user_id: str) -> firestore.CollectionReference:
    # Path segments are passed separately rather than interpolated, so a user_id
    # cannot inject extra path components.
    return get_client().collection("users", user_id, "chunks")


def _to_utc(value: datetime) -> datetime:
    """Normalize to UTC-aware. Naive values are assumed to already be UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _to_response(user_id: str, chunk_id: str, data: dict) -> TimeChunkResponse:
    # user_id and chunk_id live in the document path, not in the document body,
    # so identity has a single source of truth.
    return TimeChunkResponse(user_id=user_id, chunk_id=chunk_id, **data)


def get_chunks(user_id: str) -> list[TimeChunkResponse]:
    return [
        _to_response(user_id, doc.id, doc.to_dict())
        for doc in _chunks(user_id).stream()
    ]


def create_chunk(user_id: str, chunk: TimeChunkCreate) -> TimeChunkResponse:
    chunk_id = str(uuid4())
    data = {
        "title": chunk.title,
        "start_time": _to_utc(chunk.start_time),
        "end_time": _to_utc(chunk.end_time),
        "is_template": chunk.is_template,
        "tasks": [task.model_dump(mode="json") for task in chunk.tasks],
    }
    _chunks(user_id).document(chunk_id).set(data)
    return _to_response(user_id, chunk_id, data)


def update_chunk(user_id: str, chunk_id: str, update: TimeChunkUpdate) -> TimeChunkResponse:
    doc_ref = _chunks(user_id).document(chunk_id)

    changes: dict[str, object] = {}
    if update.tasks is not None:
        changes["tasks"] = [task.model_dump(mode="json") for task in update.tasks]
    if update.start_time is not None:
        changes["start_time"] = _to_utc(update.start_time)
    if update.end_time is not None:
        changes["end_time"] = _to_utc(update.end_time)

    if changes:
        try:
            doc_ref.update(changes)
        except google_exceptions.NotFound as exc:
            raise ChunkNotFound(chunk_id) from exc

    # Firestore's update() returns a WriteResult, not the document, so there is
    # no ReturnValues="ALL_NEW" equivalent -- the state has to be re-read. That
    # read doubles as the existence check for an empty (no-op) update.
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise ChunkNotFound(chunk_id)
    return _to_response(user_id, chunk_id, snapshot.to_dict())


def delete_chunk(user_id: str, chunk_id: str) -> None:
    doc_ref = _chunks(user_id).document(chunk_id)
    # Firestore deletes are idempotent: deleting a missing document succeeds
    # silently. The API contract promises a 404, so check first.
    if not doc_ref.get().exists:
        raise ChunkNotFound(chunk_id)
    doc_ref.delete()
```

- [ ] **Step 4: Run the data-layer tests**

```bash
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8081 GOOGLE_CLOUD_PROJECT=timeblock-local .venv/bin/pytest tests/test_database.py -v
```

Expected: 11 passed.

- [ ] **Step 5: Update routes.py**

In `backend/src/routes.py`, replace the `botocore` import and both exception handlers. The new file:

```python
from typing import List

from fastapi import APIRouter, Header, HTTPException

from . import database, models

router = APIRouter()


@router.get("/chunks/", response_model=List[models.TimeChunkResponse])
def get_user_chunks(x_user_id: str = Header(...)):
    return database.get_chunks(x_user_id)


@router.post("/chunks/", response_model=models.TimeChunkResponse)
def create_chunk(chunk: models.TimeChunkCreate, x_user_id: str = Header(...)):
    return database.create_chunk(x_user_id, chunk)


@router.patch("/chunks/{chunk_id}/", response_model=models.TimeChunkResponse)
def update_chunk(chunk_id: str, update_data: models.TimeChunkUpdate, x_user_id: str = Header(...)):
    try:
        return database.update_chunk(x_user_id, chunk_id, update_data)
    except database.ChunkNotFound:
        raise HTTPException(status_code=404, detail="Chunk not found")


@router.delete("/chunks/{chunk_id}/", status_code=204)
def delete_chunk(chunk_id: str, x_user_id: str = Header(...)):
    try:
        database.delete_chunk(x_user_id, chunk_id)
    except database.ChunkNotFound:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return None
```

`import botocore.exceptions` is gone — the HTTP layer no longer references any storage SDK.

- [ ] **Step 6: Update the route tests**

Overwrite `backend/tests/test_routes.py`. Every `timechunk_table.put_item(...)` block becomes a `seed_chunk(...)` call, and the local `client` fixture is dropped in favour of conftest's:

```python
def test_get_user_chunks(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    response = client.get("/chunks/", headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["chunk_id"] == "chunk1"


def test_get_user_chunks_excludes_other_users(client, seed_chunk):
    seed_chunk("user123", "chunk1")
    seed_chunk("other_user", "chunk2")

    response = client.get("/chunks/", headers={"x-user-id": "user123"})
    assert response.status_code == 200
    assert [c["chunk_id"] for c in response.json()] == ["chunk1"]


def test_create_chunk(client):
    payload = {
        "title": "Evening Routine",
        "start_time": "2023-01-01T18:00:00",
        "end_time": "2023-01-01T20:00:00",
        "is_template": True,
        "tasks": [],
    }
    response = client.post("/chunks/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Evening Routine"
    assert data["chunk_id"] is not None


def test_update_chunk_tasks(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    payload = {
        "tasks": [
            {"task_id": "t1", "title": "Read", "duration_minutes": 20, "min_duration": 10}
        ]
    }
    response = client.patch("/chunks/chunk1", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["tasks"]) == 1
    assert data["tasks"][0]["title"] == "Read"


def test_update_missing_chunk(client):
    payload = {
        "tasks": [
            {"task_id": "t1", "title": "Read", "duration_minutes": 20, "min_duration": 10}
        ]
    }
    response = client.patch(
        "/chunks/missing_chunk", json=payload, headers={"x-user-id": "user123"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"


def test_update_chunk_times_only(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    payload = {
        "start_time": "2023-01-01T06:30:00",
        "end_time": "2023-01-01T09:00:00",
    }
    response = client.patch("/chunks/chunk1/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["start_time"].startswith("2023-01-01T06:30:00")
    assert data["end_time"].startswith("2023-01-01T09:00:00")
    assert data["tasks"] == []


def test_update_chunk_both_tasks_and_times(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    payload = {
        "start_time": "2023-01-01T07:00:00",
        "end_time": "2023-01-01T08:00:00",
        "tasks": [
            {"task_id": "t1", "title": "Read", "duration_minutes": 30, "min_duration": 10}
        ],
    }
    response = client.patch("/chunks/chunk1/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["start_time"].startswith("2023-01-01T07:00:00")
    assert len(data["tasks"]) == 1
    assert data["tasks"][0]["title"] == "Read"


def test_update_chunk_empty_payload_is_noop(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    response = client.patch("/chunks/chunk1/", json={}, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["start_time"].startswith("2023-01-01T06:00:00")
    assert data["end_time"].startswith("2023-01-01T08:00:00")
    assert data["tasks"] == []


def test_update_chunk_empty_payload_missing(client):
    response = client.patch("/chunks/missing_chunk/", json={}, headers={"x-user-id": "user123"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"


def test_delete_chunk(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    response = client.delete("/chunks/chunk1/", headers={"x-user-id": "user123"})
    assert response.status_code == 204

    remaining = client.get("/chunks/", headers={"x-user-id": "user123"}).json()
    assert remaining == []


def test_delete_missing_chunk(client):
    response = client.delete("/chunks/missing_chunk/", headers={"x-user-id": "user123"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"
```

The `.startswith(...)` timestamp assertions are unchanged and still pass — they tolerate the new `+00:00` suffix. The last two tests are new: `DELETE` had no route-level coverage at all, and `test_delete_missing_chunk` is what would catch a silent 404-to-204 regression.

- [ ] **Step 7: Run the full backend suite**

```bash
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8081 GOOGLE_CLOUD_PROJECT=timeblock-local .venv/bin/pytest tests -v
```

Expected: all tests pass across `test_database.py` (11), `test_routes.py` (11), `test_main.py` (1), `test_models.py` (2).

- [ ] **Step 8: Confirm no AWS references remain in the backend source**

```bash
grep -rn "boto3\|botocore\|moto\|dynamodb\|DYNAMODB\|AWS_" backend/src backend/tests
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add backend/src/database.py backend/src/routes.py backend/tests/test_database.py backend/tests/test_routes.py
git commit -m "feat: move the data layer from DynamoDB to Firestore

Rewrite database.py against google-cloud-firestore using a
users/{user_id}/chunks/{chunk_id} subcollection. Timestamps are stored
as native UTC values instead of ISO strings, and the manual
LastEvaluatedKey pagination loop is gone.

Introduce a ChunkNotFound domain exception so routes.py no longer
inspects botocore error codes. This is forced by the migration: the
ConditionExpression trick has no Firestore equivalent, and Firestore
deletes are idempotent, so delete_chunk needs an explicit existence
check to keep returning 404. Adds test coverage for that path."
```

---

### Task 4: Replace the init script with a seed script

Firestore creates collections implicitly, so there is no table to provision. Since the emulator is in-memory and loses everything on restart, the script's purpose becomes repopulating sample data.

**Files:**
- Delete: `backend/scripts/init_local_db.py`
- Create: `backend/scripts/seed_local_db.py`

**Interfaces:**
- Consumes: `create_chunk`, `get_chunks` from `src.database` (Task 3).
- Produces: `make seed-db` (target added in Task 1).

- [ ] **Step 1: Create the seed script**

Create `backend/scripts/seed_local_db.py`:

```python
"""Populate the local Firestore emulator with sample chunks.

Firestore creates collections on first write, so unlike the DynamoDB version
this provisions no schema. The emulator is in-memory, so re-run this after
every `make down` / restart.
"""

import os
import sys
from datetime import datetime, timezone

# Make `src` importable when run as a script from the repo root.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src import database, models  # noqa: E402

SEED_USER_ID = "user123"


def _chunk(title: str, start_hour: int, end_hour: int, tasks: list[models.Task]) -> models.TimeChunkCreate:
    return models.TimeChunkCreate(
        title=title,
        start_time=datetime(2023, 1, 1, start_hour, 0, tzinfo=timezone.utc),
        end_time=datetime(2023, 1, 1, end_hour, 0, tzinfo=timezone.utc),
        is_template=False,
        tasks=tasks,
    )


def seed() -> None:
    if not os.getenv("FIRESTORE_EMULATOR_HOST"):
        print(
            "Refusing to seed: FIRESTORE_EMULATOR_HOST is not set, which would "
            "write sample data to real Firestore. Run `make seed-db`.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Seeding Firestore emulator at {os.environ['FIRESTORE_EMULATOR_HOST']}...")

    existing = database.get_chunks(SEED_USER_ID)
    if existing:
        print(f"User {SEED_USER_ID} already has {len(existing)} chunk(s). Nothing to do.")
        return

    chunks = [
        _chunk(
            "Morning Routine",
            6,
            8,
            [
                models.Task(task_id="t1", title="Stretch", duration_minutes=15, min_duration=5),
                models.Task(
                    task_id="t2",
                    title="Read",
                    duration_minutes=45,
                    min_duration=15,
                    buffer_after_minutes=5,
                ),
            ],
        ),
        _chunk(
            "Deep Work",
            9,
            12,
            [models.Task(task_id="t3", title="Write code", duration_minutes=120, min_duration=60)],
        ),
        _chunk("Evening Wind-down", 20, 22, []),
    ]

    for chunk in chunks:
        created = database.create_chunk(SEED_USER_ID, chunk)
        print(f"  Created {created.chunk_id}: {created.title}")

    print(f"Seeded {len(chunks)} chunks for user '{SEED_USER_ID}'.")


if __name__ == "__main__":
    seed()
```

The script goes through `database.create_chunk` rather than writing raw documents, so seeded data can never drift from the shape the application produces. It is idempotent by checking for existing chunks first.

- [ ] **Step 2: Delete the old script**

```bash
git rm backend/scripts/init_local_db.py
```

- [ ] **Step 3: Verify seeding works end to end**

```bash
make down && make up && make seed-db
```

Expected: three `Created <uuid>: <title>` lines, then `Seeded 3 chunks for user 'user123'.`

- [ ] **Step 4: Verify idempotency and the safety guard**

```bash
make seed-db
```

Expected: `User user123 already has 3 chunk(s). Nothing to do.`

```bash
cd backend && .venv/bin/python scripts/seed_local_db.py
```

Expected: exits 1 with `Refusing to seed: FIRESTORE_EMULATOR_HOST is not set`.

- [ ] **Step 5: Verify the API serves the seeded data**

In one terminal: `make dev-backend`. In another:

```bash
curl -s -H "x-user-id: user123" http://localhost:8080/chunks/ | head -c 400
```

Expected: a JSON array of three chunks with `start_time` values ending in `+00:00`.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/seed_local_db.py
git commit -m "feat(dx): replace init_local_db with seed_local_db

Firestore needs no table provisioning, so the script's job changes from
required setup to populating sample data. That matters more than it did
before: the emulator is in-memory, so local data is lost on restart.

Seeds through database.create_chunk so sample data cannot drift from the
shape the app writes, and refuses to run without FIRESTORE_EMULATOR_HOST."
```

---

### Task 5: Update CI and documentation

The final task: CI boots the emulator, and the docs stop describing a DynamoDB project.

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the `firestore-emulator` compose service (Task 1) and the passing suite (Task 3).
- Produces: a green CI pipeline.

- [ ] **Step 1: Update the CI backend job**

In `.github/workflows/ci.yml`, replace the `backend-test` job's `Run Tests` step with these three steps (leave `Checkout`, `Setup Python`, and `Install Dependencies` as they are):

```yaml
      - name: Start Firestore Emulator
        run: docker compose up -d firestore-emulator

      - name: Wait for Firestore Emulator
        run: |
          for i in $(seq 1 60); do
            if curl -sf http://localhost:8081/ > /dev/null 2>&1; then
              echo "Emulator ready after ${i}s."
              exit 0
            fi
            sleep 1
          done
          echo "Emulator failed to start within 60s."
          docker compose logs firestore-emulator
          exit 1

      - name: Run Tests
        env:
          FIRESTORE_EMULATOR_HOST: localhost:8081
          GOOGLE_CLOUD_PROJECT: timeblock-local
        run: |
          cd backend
          pytest tests
```

The `DYNAMODB_ENDPOINT_URL: ""` env entry is removed. `ubuntu-latest` runners ship with Docker Compose v2, so no setup action is needed. The emulator takes roughly 6 seconds to start; the 60-second ceiling is headroom, and the failure branch dumps logs rather than timing out silently. The `frontend-test` and `infra-check` jobs are unchanged.

Expect this job to get slower. `moto` was a pip install; `google/cloud-sdk:emulators` is a ~1 GB image that a cold runner must pull on every run. That is the price of testing against real Firestore semantics instead of a reimplementation. If it becomes annoying, the fix is caching the image layer or switching to a slimmer emulator image — not reverting to a mock.

- [ ] **Step 2: Update the README**

In `README.md`, make three changes:

Replace the `infra/` bullet under Project Structure:

```markdown
- `infra/`: Terraform infrastructure (AWS Lambda — Firestore migration pending).
```

Replace the backend "Run the server" step (step 4) with:

```markdown
4.  **Start the Firestore emulator and run the server:**
    ```bash
    make up        # starts the Firestore emulator on :8081
    make seed-db   # optional: populate sample data
    make dev-backend
    ```
    The API will be available at `http://localhost:8080`.

    The emulator is in-memory: local data is lost when the container stops,
    so re-run `make seed-db` after `make down`.
```

Replace the Tests bullet under Development:

```markdown
- **Tests:** Run `pnpm test` in the `frontend` directory, or `make test-backend` from the repo root (this starts the Firestore emulator automatically — backend tests require it).
```

- [ ] **Step 3: Update .gitignore**

Replace lines 116-117 of `.gitignore`:

```
# DynamoDB Local files
.dynamodb/
```

with:

```
# Firestore emulator files
.firestore/
firestore-debug.log
```

Leave the `# Local Docker data` / `docker/` entries at lines 162-163 as they are.

- [ ] **Step 4: Remove the orphaned DynamoDB data directory**

```bash
rm -rf docker/dynamodb
```

This held the old container's persisted data. It is gitignored, so this only affects the working tree.

- [ ] **Step 5: Verify no DynamoDB references remain outside infra/**

```bash
grep -rn "dynamodb\|DYNAMODB\|boto3\|moto\[" \
  --include="*.py" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.txt" \
  . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.venv --exclude-dir=infra \
  --exclude-dir=docs
```

Expected: no output. (`docs/` is excluded because the historical specs and plans legitimately describe the DynamoDB era, and `infra/` is out of scope by design.)

- [ ] **Step 6: Run the full verification pass**

```bash
make down && make up && make test-backend
```

Expected: emulator starts, then all 25 backend tests pass.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml README.md .gitignore
git commit -m "ci: run backend tests against the Firestore emulator

Boot the emulator via docker compose and wait for its readiness endpoint
before pytest, since Firestore has no in-process mock the way moto served
DynamoDB. Update the README for the new local workflow and note that
emulator data is ephemeral."
```

---

## Verification Checklist

Run after all five tasks:

- [ ] `make down && make up` — emulator starts and reports ready
- [ ] `make test-backend` — 25 tests pass
- [ ] `cd backend && env -u FIRESTORE_EMULATOR_HOST .venv/bin/pytest tests` — aborts with the guard message
- [ ] `make seed-db && make dev-backend`, then `curl -H "x-user-id: user123" http://localhost:8080/chunks/` returns three chunks
- [ ] `curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "x-user-id: user123" http://localhost:8080/chunks/nope/` returns `404` (not `204` — the migration's key regression risk)
- [ ] Expo frontend loads and edits chunks against the local backend with no frontend changes
- [ ] `git diff --stat main -- infra/ frontend/` is empty

## Known Post-Migration State

The deployed AWS Lambda is **non-functional** after this plan: it will try to reach Firestore with no credentials. This is accepted and tracked as separate GCP infrastructure work. Local development and CI are fully functional.
