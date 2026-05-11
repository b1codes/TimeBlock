# Local Database Setup Design

## Background & Motivation
Currently, local development relies on `moto` for mocking the DynamoDB layer, which works well for unit tests but falls short for end-to-end development, especially when dealing with the frontend. A persistent local database is required to replace mock data and enable realistic local testing.

## Scope & Impact
This design focuses on implementing a local DynamoDB instance using Docker. The changes will be contained to infrastructure files (adding a `docker-compose.yml`), the database connection logic in the FastAPI backend, and the creation of a developer utility script.

## Proposed Solution: DynamoDB Local via Docker
The recommended approach is to utilize the official `amazon/dynamodb-local` Docker image.

### 1. Docker Configuration
A `docker-compose.yml` file will be created at the project root to define the `dynamodb-local` service.
- **Image:** `amazon/dynamodb-local:latest`
- **Ports:** `8000:8000`
- **Command:** `-jar DynamoDBLocal.jar -sharedDb -dbPath ./data`
- **Volumes:** `./docker/dynamodb:/home/dynamodblocal/data` (ensures persistence across restarts)

### 2. Backend Connection Updates
The `get_table()` function in `backend/src/database.py` will be modified to support local connections.
- It will check for an environment variable, e.g., `DYNAMODB_ENDPOINT_URL`.
- If present, the `boto3` resource will be instantiated with `endpoint_url=os.getenv('DYNAMODB_ENDPOINT_URL')`.
- This allows seamless switching between the local Docker instance (`http://localhost:8000`) and the AWS production environment.

### 3. Database Initialization Script
Since the local container starts empty, a script is needed to create the necessary tables.
- **File:** `backend/scripts/init_local_db.py`
- **Functionality:** Uses `boto3` to create the `TimeChunks` table, mirroring the production schema defined in the tests/spec (`user_id` as HASH key, `chunk_id` as RANGE key).

## ClickUp Tasks Strategy
The implementation will be tracked in ClickUp under a single parent task with three subtasks:
- **Parent Task:** Implement Local DynamoDB Solution
- **Subtask 1:** Add DynamoDB Local Docker Configuration
- **Subtask 2:** Update FastAPI Database Connection for Local Dev
- **Subtask 3:** Create Local Database Initialization Script

## Alternatives Considered
- **LocalStack:** Heavier resource footprint. While it provides comprehensive AWS emulation, only DynamoDB is strictly necessary for this task, making DynamoDB Local a more focused and lightweight choice.
- **NoSQL Workbench:** Great for visualization but less ideal for automated backend integration and scripting compared to a standard Docker service.

## Verification
- Run `docker-compose up` and verify the container starts without errors.
- Run the initialization script and ensure the table is created successfully.
- Start the FastAPI server locally, configure the `DYNAMODB_ENDPOINT_URL`, and verify that the API routes can create and retrieve chunks from the local database.