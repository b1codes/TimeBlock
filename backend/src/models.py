from pydantic import BaseModel, Field
from typing import List
from uuid import UUID, uuid4
from datetime import datetime

class UserBase(BaseModel):
    email: str | None = None
    display_name: str | None = None

class UserCreate(UserBase):
    user_id: str

class UserResponse(UserBase):
    user_id: str
    email: str | None = None
    display_name: str | None = None
    created_at: datetime

class Task(BaseModel):
    task_id: str
    title: str
    duration_minutes: int
    min_duration: int
    buffer_after_minutes: int = 0

class TimeChunkBase(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    is_template: bool = False
    tasks: List[Task] = Field(default_factory=list)

class TimeChunkCreate(TimeChunkBase):
    pass

class TimeChunkResponse(TimeChunkBase):
    user_id: str
    chunk_id: str

class TimeChunkUpdate(BaseModel):
    tasks: List[Task] | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None

