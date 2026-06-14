from src.models import Task, TimeChunkCreate, TimeChunkResponse
from datetime import datetime

def test_task_model():
    task = Task(task_id="t1", title="Morning Run", duration_minutes=30, min_duration=10)
    assert task.title == "Morning Run"
    assert task.task_id is not None

def test_timechunk_create_model():
    chunk = TimeChunkCreate(
        title="Morning Routine",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=False,
        tasks=[]
    )
    assert chunk.title == "Morning Routine"
