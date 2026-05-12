import pytest
from fastapi.testclient import TestClient
from src.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_get_user_chunks(client, timechunk_table):
    # Setup
    timechunk_table.put_item(Item={
        'user_id': 'user123',
        'chunk_id': 'chunk1',
        'title': 'Morning',
        'start_time': '2023-01-01T06:00:00',
        'end_time': '2023-01-01T08:00:00',
        'is_template': False,
        'tasks': []
    })
    
    response = client.get("/chunks/", headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['chunk_id'] == 'chunk1'

def test_create_chunk(client, timechunk_table):
    payload = {
        "title": "Evening Routine",
        "start_time": "2023-01-01T18:00:00",
        "end_time": "2023-01-01T20:00:00",
        "is_template": True,
        "tasks": []
    }
    response = client.post("/chunks/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data['title'] == "Evening Routine"
    assert data['chunk_id'] is not None

def test_update_chunk_tasks(client, timechunk_table):
    # Setup
    timechunk_table.put_item(Item={
        'user_id': 'user123',
        'chunk_id': 'chunk1',
        'title': 'Morning',
        'start_time': '2023-01-01T06:00:00',
        'end_time': '2023-01-01T08:00:00',
        'is_template': False,
        'tasks': []
    })
    
    payload = {
        "tasks": [
            {
                "title": "Read",
                "duration_minutes": 20,
                "min_duration": 10
            }
        ]
    }
    response = client.patch("/chunks/chunk1", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert len(data['tasks']) == 1
    assert data['tasks'][0]['title'] == "Read"

def test_update_missing_chunk(client, timechunk_table):
    payload = {
        "tasks": [
            {
                "title": "Read",
                "duration_minutes": 20,
                "min_duration": 10
            }
        ]
    }
    response = client.patch("/chunks/missing_chunk", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Chunk not found"


def test_update_chunk_times_only(client, timechunk_table):
    timechunk_table.put_item(Item={
        'user_id': 'user123',
        'chunk_id': 'chunk1',
        'title': 'Morning',
        'start_time': '2023-01-01T06:00:00',
        'end_time': '2023-01-01T08:00:00',
        'is_template': False,
        'tasks': []
    })

    payload = {
        "start_time": "2023-01-01T06:30:00",
        "end_time": "2023-01-01T09:00:00",
    }
    response = client.patch("/chunks/chunk1/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data['start_time'].startswith('2023-01-01T06:30:00')
    assert data['end_time'].startswith('2023-01-01T09:00:00')
    assert data['tasks'] == []


def test_update_chunk_both_tasks_and_times(client, timechunk_table):
    timechunk_table.put_item(Item={
        'user_id': 'user123',
        'chunk_id': 'chunk1',
        'title': 'Morning',
        'start_time': '2023-01-01T06:00:00',
        'end_time': '2023-01-01T08:00:00',
        'is_template': False,
        'tasks': []
    })

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
    assert data['start_time'].startswith('2023-01-01T07:00:00')
    assert len(data['tasks']) == 1
    assert data['tasks'][0]['title'] == "Read"


def test_update_chunk_empty_payload_is_noop(client, timechunk_table):
    timechunk_table.put_item(Item={
        'user_id': 'user123',
        'chunk_id': 'chunk1',
        'title': 'Morning',
        'start_time': '2023-01-01T06:00:00',
        'end_time': '2023-01-01T08:00:00',
        'is_template': False,
        'tasks': []
    })

    response = client.patch("/chunks/chunk1/", json={}, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data['start_time'].startswith('2023-01-01T06:00:00')
    assert data['end_time'].startswith('2023-01-01T08:00:00')
    assert data['tasks'] == []
