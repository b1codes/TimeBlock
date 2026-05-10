from fastapi import APIRouter, Header
from typing import List
from . import models, database

router = APIRouter()

@router.get("/chunks/{user_id}", response_model=List[models.TimeChunkResponse])
def get_user_chunks(user_id: str):
    return database.get_chunks(user_id)

@router.post("/chunks/", response_model=models.TimeChunkResponse)
def create_chunk(chunk: models.TimeChunkCreate, x_user_id: str = Header(...)):
    return database.create_chunk(x_user_id, chunk)

@router.patch("/chunks/{chunk_id}", response_model=models.TimeChunkResponse)
def update_chunk(chunk_id: str, update_data: models.TimeChunkUpdate, x_user_id: str = Header(...)):
    return database.update_chunk_tasks(x_user_id, chunk_id, update_data.tasks)
