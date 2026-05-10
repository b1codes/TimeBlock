# TimeBlock Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the FastAPI backend for TimeBlock, providing REST endpoints for retrieving, creating, and updating time chunks and their tasks in DynamoDB.

**Architecture:** A serverless FastAPI application wrapped in Mangum for AWS Lambda deployment. Uses Boto3 for DynamoDB interactions and Pydantic for strict data validation. The database design uses an embedded document structure (List of Maps) for tasks to ensure single-RCU reads and atomic updates.

**Tech Stack:** Python 3.11+, FastAPI, Mangum, Boto3, Pydantic, Pytest, Moto.

*Note: The spec covers Frontend, Backend, and Infrastructure. Following best practices, this plan focuses exclusively on the Backend subsystem. Frontend and Infrastructure plans should be generated separately.*

---

### Task 1: Project Setup and Test Fixtures

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/src/__init__.py`
- Create: `backend/src/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_main.py`

- [ ] **Step 1: Write requirements and pytest config**

```text
# backend/requirements.txt
fastapi>=0.103.0
uvicorn>=0.23.0
pydantic>=2.3.0
boto3>=1.28.0
mangum>=0.17.0
pytest>=7.4.0
httpx>=0.24.0
moto[dynamodb]>=4.2.0
```

```ini
# backend/pytest.ini
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 2: Write test fixtures for mocked DynamoDB**

```python
# backend/tests/conftest.py
import pytest
import os
import boto3
from moto import mock_aws
from fastapi.testclient import TestClient

@pytest.fixture
def aws_credentials():
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["DYNAMODB_TABLE"] = "TimeChunks"

@pytest.fixture
def dynamodb(aws_credentials):
    with mock_aws():
        yield boto3.resource('dynamodb', region_name='us-east-1')

@pytest.fixture
def timechunk_table(dynamodb):
    table = dynamodb.create_table(
        TableName='TimeChunks',
        KeySchema=[
            {'AttributeName': 'user_id', 'KeyType': 'HASH'},
            {'AttributeName': 'chunk_id', 'KeyType': 'RANGE'}
        ],
        AttributeDefinitions=[
            {'AttributeName': 'user_id', 'AttributeType': 'S'},
            {'AttributeName': 'chunk_id', 'AttributeType': 'S'}
        ],
        ProvisionedThroughput={'ReadCapacityUnits': 1, 'WriteCapacityUnits': 1}
    )
    return table

@pytest.fixture
def client():
    # Imported inside the fixture to ensure environment variables are set before app load
    from src.main import app
    return TestClient(app)
```

- [ ] **Step 3: Write the failing test for the health check**

```python
# backend/tests/test_main.py
def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && pytest tests/test_main.py -v`
Expected: FAIL (No module named 'src.main' or similar)

- [ ] **Step 5: Write minimal implementation**

```python
# backend/src/main.py
from fastapi import FastAPI
from mangum import Mangum

app = FastAPI(title="TimeBlock API")

@app.get("/health")
def health_check():
    return {"status": "ok"}

handler = Mangum(app)
```
*Note: Also create `backend/src/__init__.py` and `backend/tests/__init__.py` as empty files.*

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/test_main.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "chore: setup backend project structure, requirements, and test fixtures"
```

---

### Task 2: Data Models (Pydantic)

**Files:**
- Create: `backend/src/models.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models.py
from src.models import Task, TimeChunkCreate, TimeChunkResponse
from datetime import datetime

def test_task_model():
    task = Task(title="Morning Run", duration_minutes=30, min_duration=10)
    assert task.title == "Morning Run"
    assert task.task_id is not None

def test_timechunk_create_model():
    chunk = TimeChunkCreate(
        title="Morning Routine",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=False,
        tasks=[]
    )
    assert chunk.title == "Morning Routine"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_models.py -v`
Expected: FAIL (ModuleNotFoundError for 'src.models')

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/models.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/models.py backend/tests/test_models.py
git commit -m "feat: implement pydantic data models for time chunks and tasks"
```

---

### Task 3: Database Layer (DynamoDB)

**Files:**
- Create: `backend/src/database.py`
- Create: `backend/tests/test_database.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_database.py
import pytest
from src import database, models
from datetime import datetime

def test_create_and_get_chunk(timechunk_table):
    user_id = "user123"
    chunk_data = models.TimeChunkCreate(
        title="Test Chunk",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=True,
        tasks=[]
    )
    
    # Create chunk
    created = database.create_chunk(user_id, chunk_data)
    assert created.user_id == user_id
    assert created.chunk_id is not None
    assert created.title == "Test Chunk"
    
    # Get chunks
    chunks = database.get_chunks(user_id)
    assert len(chunks) == 1
    assert chunks[0].chunk_id == created.chunk_id

def test_update_chunk_tasks(timechunk_table):
    user_id = "user123"
    chunk_data = models.TimeChunkCreate(
        title="Test Chunk",
        start_time=datetime(2023, 1, 1, 6, 0),
        end_time=datetime(2023, 1, 1, 8, 0),
        is_template=True,
        tasks=[]
    )
    created = database.create_chunk(user_id, chunk_data)
    
    # Update tasks
    new_task = models.Task(title="Reading", duration_minutes=30, min_duration=10)
    updated = database.update_chunk_tasks(user_id, created.chunk_id, [new_task])
    
    assert len(updated.tasks) == 1
    assert updated.tasks[0].title == "Reading"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_database.py -v`
Expected: FAIL (ModuleNotFoundError for 'src.database')

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/database.py
import boto3
import os
from boto3.dynamodb.conditions import Key
from uuid import uuid4
from .models import TimeChunkResponse, TimeChunkCreate, Task

def get_table():
    dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1'))
    return dynamodb.Table(os.getenv('DYNAMODB_TABLE', 'TimeChunks'))

def get_chunks(user_id: str) -> list[TimeChunkResponse]:
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('user_id').eq(user_id)
    )
    return [TimeChunkResponse(**item) for item in response.get('Items', [])]

def create_chunk(user_id: str, chunk: TimeChunkCreate) -> TimeChunkResponse:
    table = get_table()
    chunk_id = str(uuid4())
    item = {
        'user_id': user_id,
        'chunk_id': chunk_id,
        'title': chunk.title,
        'start_time': chunk.start_time.isoformat(),
        'end_time': chunk.end_time.isoformat(),
        'is_template': chunk.is_template,
        'tasks': [task.model_dump(mode='json') for task in chunk.tasks]
    }
    table.put_item(Item=item)
    return TimeChunkResponse(**item)

def update_chunk_tasks(user_id: str, chunk_id: str, tasks: list[Task]) -> TimeChunkResponse:
    table = get_table()
    tasks_dict = [task.model_dump(mode='json') for task in tasks]
    response = table.update_item(
        Key={'user_id': user_id, 'chunk_id': chunk_id},
        UpdateExpression="SET tasks = :tasks",
        ExpressionAttributeValues={':tasks': tasks_dict},
        ReturnValues="ALL_NEW"
    )
    return TimeChunkResponse(**response.get('Attributes', {}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_database.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/database.py backend/tests/test_database.py
git commit -m "feat: implement dynamodb interaction layer for chunks and tasks"
```

---

### Task 4: API Routes

**Files:**
- Create: `backend/src/routes.py`
- Modify: `backend/src/main.py`
- Create: `backend/tests/test_routes.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_routes.py
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
    
    response = client.get("/chunks/user123")
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_routes.py -v`
Expected: FAIL (404 Not Found for `/chunks/`)

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/routes.py
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
```

Modify `backend/src/main.py`:
```python
# backend/src/main.py
from fastapi import FastAPI
from mangum import Mangum
from .routes import router

app = FastAPI(title="TimeBlock API")
app.include_router(router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

handler = Mangum(app)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_routes.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes.py backend/src/main.py backend/tests/test_routes.py
git commit -m "feat: add chunk REST API endpoints and integrate router"
```
