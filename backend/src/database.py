import os
from datetime import datetime, timezone
from uuid import uuid4

from google.api_core import exceptions as google_exceptions
from google.cloud import firestore

from .models import (
    TimeChunkCreate,
    TimeChunkResponse,
    TimeChunkUpdate,
    UserCreate,
    UserResponse,
)


class ChunkNotFound(Exception):
    """Raised when a chunk does not exist for the given user."""


class UserNotFound(Exception):
    """Raised when a user document does not exist."""


class InvalidUserId(Exception):
    """Raised when a user_id is empty, whitespace, or invalid."""


_client: firestore.Client | None = None


def get_client() -> firestore.Client:
    """Return the shared Firestore client.

    The client holds a long-lived gRPC channel and is designed to be reused, so
    it is built once per process rather than per request. Under Mangum/Lambda a
    warm container reuses this across invocations.

    When FIRESTORE_EMULATOR_HOST is set, google-cloud-firestore routes to the
    emulator automatically.
    """
    global _client
    if _client is None:
        _client = firestore.Client(
            project=os.getenv("GOOGLE_CLOUD_PROJECT", "timeblock-local")
        )
    return _client


def _validate_user_id(user_id: str) -> str:
    if not user_id or not user_id.strip():
        raise InvalidUserId("user_id cannot be empty or whitespace.")
    return user_id.strip()


def _users() -> firestore.CollectionReference:
    return get_client().collection("users")


def _chunks(user_id: str) -> firestore.CollectionReference:
    valid_id = _validate_user_id(user_id)
    return get_client().collection("users", valid_id, "chunks")


def get_user(user_id: str) -> UserResponse:
    valid_id = _validate_user_id(user_id)
    snapshot = _users().document(valid_id).get()
    if not snapshot.exists:
        raise UserNotFound(valid_id)
    data = snapshot.to_dict() or {}
    created_at = data.get("created_at") or datetime.now(timezone.utc)
    return UserResponse(
        user_id=valid_id,
        email=data.get("email"),
        display_name=data.get("display_name"),
        created_at=created_at,
    )


def create_or_update_user(user: UserCreate) -> UserResponse:
    valid_id = _validate_user_id(user.user_id)
    doc_ref = _users().document(valid_id)
    snapshot = doc_ref.get()
    now = datetime.now(timezone.utc)
    if snapshot.exists:
        data = snapshot.to_dict() or {}
        created_at = data.get("created_at", now)
        doc_ref.update({
            "email": user.email,
            "display_name": user.display_name,
            "updated_at": now,
        })
    else:
        created_at = now
        doc_ref.set({
            "email": user.email,
            "display_name": user.display_name,
            "created_at": created_at,
            "updated_at": now,
        })
    return UserResponse(
        user_id=valid_id,
        email=user.email,
        display_name=user.display_name,
        created_at=created_at,
    )


def get_or_create_user(user_id: str) -> UserResponse:
    valid_id = _validate_user_id(user_id)
    try:
        return get_user(valid_id)
    except UserNotFound:
        return create_or_update_user(UserCreate(user_id=valid_id))



def _to_utc(value: datetime) -> datetime:
    """Normalize to UTC-aware. Naive values are assumed to already be UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _to_response(user_id: str, chunk_id: str, data: dict) -> TimeChunkResponse:
    # user_id and chunk_id live in the document path, not in the document body,
    # so identity has a single source of truth.
    return TimeChunkResponse(user_id=user_id, chunk_id=chunk_id, **data)


def get_chunks(user_id: str) -> list[TimeChunkResponse]:
    return [
        _to_response(user_id, doc.id, doc.to_dict())
        for doc in _chunks(user_id).stream()
    ]


def create_chunk(user_id: str, chunk: TimeChunkCreate) -> TimeChunkResponse:
    chunk_id = str(uuid4())
    data = {
        "title": chunk.title,
        "start_time": _to_utc(chunk.start_time),
        "end_time": _to_utc(chunk.end_time),
        "is_template": chunk.is_template,
        "tasks": [task.model_dump(mode="json") for task in chunk.tasks],
    }
    _chunks(user_id).document(chunk_id).set(data)
    return _to_response(user_id, chunk_id, data)


def update_chunk(user_id: str, chunk_id: str, update: TimeChunkUpdate) -> TimeChunkResponse:
    doc_ref = _chunks(user_id).document(chunk_id)

    changes: dict[str, object] = {}
    if update.tasks is not None:
        changes["tasks"] = [task.model_dump(mode="json") for task in update.tasks]
    if update.start_time is not None:
        changes["start_time"] = _to_utc(update.start_time)
    if update.end_time is not None:
        changes["end_time"] = _to_utc(update.end_time)

    if changes:
        try:
            doc_ref.update(changes)
        except google_exceptions.NotFound as exc:
            raise ChunkNotFound(chunk_id) from exc

    # Firestore's update() returns a WriteResult, not the document, so there is
    # no ReturnValues="ALL_NEW" equivalent -- the state has to be re-read. That
    # read doubles as the existence check for an empty (no-op) update.
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise ChunkNotFound(chunk_id)
    return _to_response(user_id, chunk_id, snapshot.to_dict())


def delete_chunk(user_id: str, chunk_id: str) -> None:
    doc_ref = _chunks(user_id).document(chunk_id)
    # Firestore deletes are idempotent: deleting a missing document succeeds
    # silently. The API contract promises a 404, so check first.
    if not doc_ref.get().exists:
        raise ChunkNotFound(chunk_id)
    doc_ref.delete()
