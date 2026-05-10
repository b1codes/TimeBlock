# SPEC.md - TimeBlock

## 1. Overview

**Name:** TimeBlock

**Concept:** A mobile application to break up predefined time chunks and dynamically allocate time to sequential tasks using fluid drag mechanics.
**Primary Use Case:** Morning/Night routine optimization and template-based schedule visualization.

## 2. Core Mechanics

* **The "Chunk" View:** A fixed timeline (e.g., 6:00 AM - 8:00 AM).
* **Zero-Sum Dragging:** Adjusting one task's duration automatically shrinks/grows the adjacent task to keep the total chunk time constant.
* **Templates vs. Instances:** Users can save "Master Templates" (e.g., "Standard Morning") and instantiate them for specific days.

## 3. Tech Stack

* **Frontend:** React Native (`react-native-gesture-handler`, `react-native-reanimated`).
* **Backend:** FastAPI hosted on **AWS Lambda** (via Mangum).
* **Database:** **Amazon DynamoDB** (Serverless NoSQL).
* **Infrastructure:** AWS provisioned via **Terraform**.

## 4. Data Models (DynamoDB Attributes)

**TimeChunk (PK: `user_id`, SK: `chunk_id`)**

* `title`: String (e.g., "Morning Routine")
* `start_time`: ISO String
* `end_time`: ISO String
* `is_template`: Boolean
* `tasks`: List of Maps (Embedded for atomic updates)
* `task_id`: UUID
* `title`: String
* `duration_minutes`: Number
* `min_duration`: Number



## 5. Interaction Specification

* **UI Thread Logic:** Dragging a divider handles the calculation of $\Delta t$ locally entirely within Reanimated, preventing bridge congestion.
* **Backend Strategy:** Since Lambda is ephemeral, the frontend performs a "Finalize" update. When the user stops dragging, the app sends a single `PATCH` request to update the entire task list for that chunk in DynamoDB.

## 6. API Endpoints (FastAPI)

* `GET /chunks/{user_id}`: Retrieve all templates and active chunks.
* `POST /chunks/`: Create a new template or instance.
* `PATCH /chunks/{chunk_id}`: Update task durations (validated against total chunk duration).

## 7. Efficiency & Cost Optimization (Serverless Safeguards)

To ensure the AWS Lambda and DynamoDB architecture remains within the Free Tier and prevents accidental runaway billing, the following network and data constraints must be strictly implemented:

**7.1. Frontend Network Throttling (Debouncing & Batching)**

* **Zero Intra-Drag Requests:** Absolutely no API calls may be fired *during* a drag gesture. All mathematical adjustments to task durations exist solely in local memory until the `onResponderRelease` / `onEnd` event fires.
* **Debounced Syncing:** If a user makes multiple rapid adjustments in sequence (e.g., dragging, dropping, immediately dragging another divider), the API payload dispatch must be debounced by a minimum of 750ms.
* **Batch Payload:** Updates must never be sent as individual task requests. The `PATCH /chunks/{chunk_id}` endpoint expects the entire modified array of tasks in a single JSON payload.

**7.2. Database Read/Write Optimization**

* **Embedded Document Structure:** By structuring `tasks` as a List of Maps embedded directly inside the `TimeChunk` DynamoDB item (as outlined in Section 4), retrieving a user's entire morning routine consumes exactly **1 Read Capacity Unit (RCU)**. This avoids the costly N+1 query problem associated with fetching relational row data in NoSQL.
* **Targeted Writes:** When updating the task durations, use DynamoDB's `UpdateItem` operation targeting only the `tasks` attribute, minimizing the **Write Capacity Units (WCU)** consumed per API call.

**7.3. Infrastructure Rate Limiting**

* **API Gateway Throttling:** The AWS API Gateway triggering the FastAPI Lambda must be configured with a strict Usage Plan.
* *Limit:* Throttle requests to a maximum of 5 requests per second per user IP. This guarantees that even if a frontend bug causes an infinite loop, the API Gateway will block the requests (returning a `429 Too Many Requests`) before they invoke Lambda or hit DynamoDB, completely neutralizing the risk of a ballooning AWS bill.