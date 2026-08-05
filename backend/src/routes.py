from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, status

from . import database, models

router = APIRouter()


def get_user_id(x_user_id: str = Header(...)) -> str:
    if not x_user_id or not x_user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="x-user-id header must not be empty",
        )
    return x_user_id.strip()


@router.get("/users/me", response_model=models.UserResponse)
def get_current_user(user_id: str = Depends(get_user_id)):
    return database.get_or_create_user(user_id)


@router.get("/users/{user_id}", response_model=models.UserResponse)
def get_user_by_id(user_id: str, current_user_id: str = Depends(get_user_id)):
    try:
        return database.get_user(user_id)
    except database.UserNotFound:
        raise HTTPException(status_code=404, detail="User not found")
    except database.InvalidUserId:
        raise HTTPException(status_code=400, detail="Invalid user ID")


@router.post("/users/", response_model=models.UserResponse)
def create_or_update_user(user: models.UserCreate, current_user_id: str = Depends(get_user_id)):
    try:
        return database.create_or_update_user(user)
    except database.InvalidUserId:
        raise HTTPException(status_code=400, detail="Invalid user ID")


@router.get("/chunks/", response_model=List[models.TimeChunkResponse])
def get_user_chunks(user_id: str = Depends(get_user_id)):
    try:
        return database.get_chunks(user_id)
    except database.InvalidUserId:
        raise HTTPException(status_code=400, detail="Invalid user ID")


@router.post("/chunks/", response_model=models.TimeChunkResponse)
def create_chunk(chunk: models.TimeChunkCreate, user_id: str = Depends(get_user_id)):
    try:
        return database.create_chunk(user_id, chunk)
    except database.InvalidUserId:
        raise HTTPException(status_code=400, detail="Invalid user ID")


@router.patch("/chunks/{chunk_id}/", response_model=models.TimeChunkResponse)
def update_chunk(
    chunk_id: str,
    update_data: models.TimeChunkUpdate,
    user_id: str = Depends(get_user_id),
):
    try:
        return database.update_chunk(user_id, chunk_id, update_data)
    except database.ChunkNotFound:
        raise HTTPException(status_code=404, detail="Chunk not found")
    except database.InvalidUserId:
        raise HTTPException(status_code=400, detail="Invalid user ID")


@router.delete("/chunks/{chunk_id}/", status_code=204)
def delete_chunk(chunk_id: str, user_id: str = Depends(get_user_id)):
    try:
        database.delete_chunk(user_id, chunk_id)
    except database.ChunkNotFound:
        raise HTTPException(status_code=404, detail="Chunk not found")
    except database.InvalidUserId:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    return None

