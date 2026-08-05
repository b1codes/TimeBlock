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


def test_missing_or_empty_x_user_id_header(client):
    # Missing header returns 422
    response = client.get("/chunks/")
    assert response.status_code == 422

    # Empty header returns 400
    response = client.get("/chunks/", headers={"x-user-id": ""})
    assert response.status_code == 400

    response = client.get("/chunks/", headers={"x-user-id": "   "})
    assert response.status_code == 400


def test_user_endpoints(client):
    # GET /users/me auto-creates user
    response = client.get("/users/me", headers={"x-user-id": "user_me"})
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "user_me"

    # POST /users/ sets profile
    payload = {"user_id": "user_me", "email": "me@example.com", "display_name": "Me Myself"}
    response = client.post("/users/", json=payload, headers={"x-user-id": "user_me"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["display_name"] == "Me Myself"

    # GET /users/{user_id}
    response = client.get("/users/user_me", headers={"x-user-id": "user_me"})
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"

    # GET /users/nonexistent returns 404
    response = client.get("/users/nobody", headers={"x-user-id": "user_me"})
    assert response.status_code == 404


def test_cross_user_patch_and_delete_isolation(client, seed_chunk):
    seed_chunk("user_owner", "chunk_private")

    # Other user trying to PATCH owner's chunk gets 404
    payload = {
        "tasks": [
            {"task_id": "t1", "title": "Tamper", "duration_minutes": 20, "min_duration": 10}
        ]
    }
    response = client.patch(
        "/chunks/chunk_private/", json=payload, headers={"x-user-id": "user_attacker"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"

    # Other user trying to DELETE owner's chunk gets 404
    response = client.delete("/chunks/chunk_private/", headers={"x-user-id": "user_attacker"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"

    # Owner can still fetch their chunk
    response = client.get("/chunks/", headers={"x-user-id": "user_owner"})
    assert response.status_code == 200
    assert len(response.json()) == 1

