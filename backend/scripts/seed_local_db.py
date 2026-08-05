"""Populate the local Firestore emulator with sample chunks.

Firestore creates collections on first write, so unlike the DynamoDB version
this provisions no schema. The emulator is in-memory, so re-run this after
every `make down` / restart.
"""

import os
import sys
from datetime import datetime, timezone

# Make `src` importable when run as a script from the repo root.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src import database, models  # noqa: E402

SEED_USER_ID = "user123"


def _chunk(title: str, start_hour: int, end_hour: int, tasks: list[models.Task]) -> models.TimeChunkCreate:
    return models.TimeChunkCreate(
        title=title,
        start_time=datetime(2023, 1, 1, start_hour, 0, tzinfo=timezone.utc),
        end_time=datetime(2023, 1, 1, end_hour, 0, tzinfo=timezone.utc),
        is_template=False,
        tasks=tasks,
    )


def seed() -> None:
    if not os.getenv("FIRESTORE_EMULATOR_HOST"):
        print(
            "Refusing to seed: FIRESTORE_EMULATOR_HOST is not set, which would "
            "write sample data to real Firestore. Run `make seed-db`.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Seeding Firestore emulator at {os.environ['FIRESTORE_EMULATOR_HOST']}...")

    database.create_or_update_user(models.UserCreate(user_id=SEED_USER_ID, email="user123@example.com", display_name="Sample User"))

    existing = database.get_chunks(SEED_USER_ID)
    if existing:
        print(f"User {SEED_USER_ID} already has {len(existing)} chunk(s). Nothing to do.")
        return

    chunks = [
        _chunk(
            "Morning Routine",
            6,
            8,
            [
                models.Task(task_id="t1", title="Stretch", duration_minutes=15, min_duration=5),
                models.Task(
                    task_id="t2",
                    title="Read",
                    duration_minutes=45,
                    min_duration=15,
                    buffer_after_minutes=5,
                ),
            ],
        ),
        _chunk(
            "Deep Work",
            9,
            12,
            [models.Task(task_id="t3", title="Write code", duration_minutes=120, min_duration=60)],
        ),
        _chunk("Evening Wind-down", 20, 22, []),
    ]

    for chunk in chunks:
        created = database.create_chunk(SEED_USER_ID, chunk)
        print(f"  Created {created.chunk_id}: {created.title}")

    print(f"Seeded {len(chunks)} chunks for user '{SEED_USER_ID}'.")


if __name__ == "__main__":
    seed()
