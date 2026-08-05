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


def test_user_database_operations():
    user = database.create_or_update_user(
        models.UserCreate(user_id="user_a", email="a@example.com", display_name="User A")
    )
    assert user.user_id == "user_a"
    assert user.email == "a@example.com"
    assert user.display_name == "User A"

    fetched = database.get_user("user_a")
    assert fetched.user_id == "user_a"
    assert fetched.email == "a@example.com"

    auto_user = database.get_or_create_user("user_b")
    assert auto_user.user_id == "user_b"

    fetched_auto = database.get_user("user_b")
    assert fetched_auto.user_id == "user_b"


def test_user_not_found_raises():
    with pytest.raises(database.UserNotFound):
        database.get_user("nonexistent_user")


def test_invalid_user_id_raises():
    with pytest.raises(database.InvalidUserId):
        database.get_chunks("")

    with pytest.raises(database.InvalidUserId):
        database.create_chunk("   ", _chunk_data())

    with pytest.raises(database.InvalidUserId):
        database.get_user("")


def test_update_chunk_cross_user_isolation():
    user_a_chunk = database.create_chunk("user_a", _chunk_data(title="User A Chunk"))

    with pytest.raises(database.ChunkNotFound):
        database.update_chunk(
            "user_b",
            user_a_chunk.chunk_id,
            models.TimeChunkUpdate(title="Hacked"),
        )


def test_delete_chunk_cross_user_isolation():
    user_a_chunk = database.create_chunk("user_a", _chunk_data(title="User A Chunk"))

    with pytest.raises(database.ChunkNotFound):
        database.delete_chunk("user_b", user_a_chunk.chunk_id)

    # Confirm user_a's chunk remains intact
    assert len(database.get_chunks("user_a")) == 1



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
