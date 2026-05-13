import pytest
from src import database, models
from datetime import datetime

def test_create_and_get_chunk(timechunk_table):
    user_id = "user123"
    chunk_data = models.TimeChunkCreate(
        title="Test Chunk",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=True,
        tasks=[]
    )
    
    # Create chunk
    created = database.create_chunk(user_id, chunk_data)
    assert created.user_id == user_id
    assert created.chunk_id is not None
    assert created.title == "Test Chunk"
    
    # Get chunks
    chunks = database.get_chunks(user_id)
    assert len(chunks) == 1
    assert chunks[0].chunk_id == created.chunk_id

def test_update_chunk_tasks(timechunk_table):
    user_id = "user123"
    chunk_data = models.TimeChunkCreate(
        title="Test Chunk",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=True,
        tasks=[]
    )
    created = database.create_chunk(user_id, chunk_data)

    new_task = models.Task(task_id="t1", title="Reading", duration_minutes=30, min_duration=10)
    updated = database.update_chunk(
        user_id,
        created.chunk_id,
        models.TimeChunkUpdate(tasks=[new_task]),
    )

    assert len(updated.tasks) == 1
    assert updated.tasks[0].title == "Reading"


def test_update_chunk_times_only(timechunk_table):
    user_id = "user123"
    chunk_data = models.TimeChunkCreate(
        title="Test Chunk",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=True,
        tasks=[],
    )
    created = database.create_chunk(user_id, chunk_data)

    updated = database.update_chunk(
        user_id,
        created.chunk_id,
        models.TimeChunkUpdate(
            start_time=datetime(2023, 1, 1, 7, 0),
            end_time=datetime(2023, 1, 1, 9, 0),
        ),
    )

    assert updated.start_time == datetime(2023, 1, 1, 7, 0)
    assert updated.end_time == datetime(2023, 1, 1, 9, 0)
    assert updated.tasks == []


def test_update_chunk_empty_payload_returns_current_state(timechunk_table):
    user_id = "user123"
    chunk_data = models.TimeChunkCreate(
        title="Test Chunk",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=False,
        tasks=[],
    )
    created = database.create_chunk(user_id, chunk_data)

    result = database.update_chunk(user_id, created.chunk_id, models.TimeChunkUpdate())

    assert result.chunk_id == created.chunk_id
    assert result.start_time == datetime(2023, 1, 1, 6, 0)
