from fastapi import APIRouter, Header, HTTPException
import botocore.exceptions
from typing import List
from . import models, database

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
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            raise HTTPException(status_code=404, detail="Chunk not found")
        raise

@router.delete("/chunks/{chunk_id}/", status_code=204)
def delete_chunk(chunk_id: str, x_user_id: str = Header(...)):
    try:
        database.delete_chunk(x_user_id, chunk_id)
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            raise HTTPException(status_code=404, detail="Chunk not found")
        raise
    return None
