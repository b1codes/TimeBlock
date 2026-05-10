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
    
    # Update tasks
    new_task = models.Task(title="Reading", duration_minutes=30, min_duration=10)
    updated = database.update_chunk_tasks(user_id, created.chunk_id, [new_task])
    
    assert len(updated.tasks) == 1
    assert updated.tasks[0].title == "Reading"
