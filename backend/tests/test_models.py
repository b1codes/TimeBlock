from src.models import Task, TimeChunkCreate, TimeChunkResponse, UserCreate, UserResponse
from datetime import datetime, timezone

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

def test_user_models():
    user_create = UserCreate(user_id="u123", email="test@example.com", display_name="Test User")
    assert user_create.user_id == "u123"
    assert user_create.email == "test@example.com"
    assert user_create.display_name == "Test User"

    now = datetime.now(timezone.utc)
    user_resp = UserResponse(user_id="u123", email="test@example.com", display_name="Test User", created_at=now)
    assert user_resp.user_id == "u123"
    assert user_resp.created_at == now

