def test_get_user_chunks(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    response = client.get("/chunks/", headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["chunk_id"] == "chunk1"


def test_get_user_chunks_excludes_other_users(client, seed_chunk):
    seed_chunk("user123", "chunk1")
    seed_chunk("other_user", "chunk2")

    response = client.get("/chunks/", headers={"x-user-id": "user123"})
    assert response.status_code == 200
    assert [c["chunk_id"] for c in response.json()] == ["chunk1"]


def test_create_chunk(client):
    payload = {
        "title": "Evening Routine",
        "start_time": "2023-01-01T18:00:00",
        "end_time": "2023-01-01T20:00:00",
        "is_template": True,
        "tasks": [],
    }
    response = client.post("/chunks/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Evening Routine"
    assert data["chunk_id"] is not None


def test_update_chunk_tasks(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    payload = {
        "tasks": [
            {"task_id": "t1", "title": "Read", "duration_minutes": 20, "min_duration": 10}
        ]
    }
    response = client.patch("/chunks/chunk1", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["tasks"]) == 1
    assert data["tasks"][0]["title"] == "Read"


def test_update_missing_chunk(client):
    payload = {
        "tasks": [
            {"task_id": "t1", "title": "Read", "duration_minutes": 20, "min_duration": 10}
        ]
    }
    response = client.patch(
        "/chunks/missing_chunk", json=payload, headers={"x-user-id": "user123"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"


def test_update_chunk_times_only(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    payload = {
        "start_time": "2023-01-01T06:30:00",
        "end_time": "2023-01-01T09:00:00",
    }
    response = client.patch("/chunks/chunk1/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["start_time"].startswith("2023-01-01T06:30:00")
    assert data["end_time"].startswith("2023-01-01T09:00:00")
    assert data["tasks"] == []


def test_update_chunk_both_tasks_and_times(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    payload = {
        "start_time": "2023-01-01T07:00:00",
        "end_time": "2023-01-01T08:00:00",
        "tasks": [
            {"task_id": "t1", "title": "Read", "duration_minutes": 30, "min_duration": 10}
        ],
    }
    response = client.patch("/chunks/chunk1/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["start_time"].startswith("2023-01-01T07:00:00")
    assert len(data["tasks"]) == 1
    assert data["tasks"][0]["title"] == "Read"


def test_update_chunk_empty_payload_is_noop(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    response = client.patch("/chunks/chunk1/", json={}, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data["start_time"].startswith("2023-01-01T06:00:00")
    assert data["end_time"].startswith("2023-01-01T08:00:00")
    assert data["tasks"] == []


def test_update_chunk_empty_payload_missing(client):
    response = client.patch("/chunks/missing_chunk/", json={}, headers={"x-user-id": "user123"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"


def test_delete_chunk(client, seed_chunk):
    seed_chunk("user123", "chunk1")

    response = client.delete("/chunks/chunk1/", headers={"x-user-id": "user123"})
    assert response.status_code == 204

    remaining = client.get("/chunks/", headers={"x-user-id": "user123"}).json()
    assert remaining == []


def test_delete_missing_chunk(client):
    response = client.delete("/chunks/missing_chunk/", headers={"x-user-id": "user123"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"
