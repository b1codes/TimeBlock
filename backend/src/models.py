from pydantic import BaseModel, Field
from typing import List
from uuid import UUID, uuid4
from datetime import datetime

class Task(BaseModel):
    task_id: UUID = Field(default_factory=uuid4)
    title: str
    duration_minutes: int
    min_duration: int

class TimeChunkBase(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    is_template: bool
    tasks: List[Task] = Field(default_factory=list)

class TimeChunkCreate(TimeChunkBase):
    pass

class TimeChunkResponse(TimeChunkBase):
    user_id: str
    chunk_id: str

class TimeChunkUpdate(BaseModel):
    tasks: List[Task]
