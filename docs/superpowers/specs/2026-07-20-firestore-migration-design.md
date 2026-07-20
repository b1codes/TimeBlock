# Firestore Migration Design

ClickUp: [86bb077vx](https://app.clickup.com/t/86bb077vx) — transition local database to Google Cloud Firestore and use the Emulator

## Background & Motivation
The backend's entire data layer speaks DynamoDB through `boto3`. Local development runs the `amazon/dynamodb-local` container; tests run against `moto`'s in-process `mock_aws`. This task moves the application and its local development environment onto Google Cloud Firestore, using the Firestore emulator in place of both the DynamoDB Local container and `moto`.

Two properties of Firestore motivate the shape of this design more than the vendor change itself:

- **Firestore has no in-process mock.** `moto` reimplements DynamoDB in Python; nothing equivalent exists for Firestore, which is why the task specifies the emulator. The emulator is Google's real Firestore code path, so tests get *more* faithful — at the cost of every test run depending on a live process.
- **Firestore has native timestamps and hierarchical documents.** The current schema carries two DynamoDB workarounds — datetimes stored as ISO strings, and a flat table keyed by a `(HASH, RANGE)` pair. Both have direct, better-fitting Firestore equivalents. Porting the workarounds verbatim would be a mechanical translation that preserves constraints the new database doesn't have.

## Scope & Impact

**In scope:** the backend data layer, local development environment, tests, and CI.

| File | Change |
|---|---|
| `backend/src/database.py` | Rewritten against `google-cloud-firestore`; adds a `ChunkNotFound` domain exception |
| `backend/src/routes.py` | Catches `ChunkNotFound` instead of inspecting `botocore` error codes |
| `backend/requirements.txt` | Drop `boto3` and `moto[dynamodb]`; add `google-cloud-firestore` |
| `backend/tests/conftest.py` | `mock_aws` fixtures replaced by emulator fixtures |
| `backend/tests/test_database.py`, `test_routes.py` | Setup/teardown reworked; assertions preserved |
| `backend/scripts/init_local_db.py` | Becomes `seed_local_db.py` |
| `docker-compose.yml` | `dynamodb-local` service replaced by `firestore-emulator` |
| `Makefile` | `DYNAMODB_*` env vars replaced throughout |
| `.github/workflows/ci.yml` | Backend job boots the emulator before `pytest` |
| `README.md` | DynamoDB references updated |

**Explicitly out of scope:** `infra/*.tf` and all of `frontend/`.

### Consequence of the infra deferral
`database.py` cannot speak both dialects. Once it is Firestore-only, the deployed AWS Lambda will attempt to reach Firestore with no credentials and fail. **After this change, local development and CI are fully functional; the AWS deployment is not.** This is accepted deliberately — production deployment is not currently blocking local development, and the AWS-to-GCP infrastructure migration is tracked as separate follow-up work.

## Data Model

The DynamoDB composite key `(user_id HASH, chunk_id RANGE)` maps to a Firestore subcollection:

```
users/{user_id}
  └─ chunks/{chunk_id}
       title:       string
       start_time:  timestamp (UTC)
       end_time:    timestamp (UTC)
       is_template: bool
       tasks:       array<map>
```

`user_id` and `chunk_id` are **not** stored as document fields. They are recoverable from the document path and are reconstructed when building a `TimeChunkResponse`, keeping a single source of truth for identity.

This mirrors partition/sort-key semantics directly: listing a user's chunks is an unfiltered collection stream requiring no composite index, and ownership becomes structural — a chunk cannot be read through another user's path.

### Timestamps
Incoming datetimes are normalized to UTC-aware before writing; naive datetimes are assumed to be UTC. Firestore returns tz-aware `DatetimeWithNanoseconds` values, which Pydantic v2 serializes with a trailing `Z`.

This changes the wire format: `"2026-07-20T14:00:00"` becomes `"2026-07-20T14:00:00Z"` (Pydantic v2 serializes UTC-aware datetimes with the compact `Z` designator, not a `+00:00` offset — verified against the built models). The frontend parses `start_time`/`end_time` with date-fns `parseISO` (`ChunkListScreen.tsx:188`), which handles offsets natively, and `ApiClient` already sends `Z`-suffixed values — so no frontend change is required.

The change is nonetheless real and worth stating: `parseISO` reads an offsetless string as *local* time and a `Z`-suffixed string as UTC. Applied to existing production data this would shift every rendered time by the viewer's UTC offset. It is safe here only because the affected data lives exclusively in an ephemeral local emulator.

## Backend Design

### Client lifecycle
`get_table()` constructs a `boto3` resource on every call. Its Firestore replacement is a lazily-initialized module-level singleton: the Firestore client holds a long-lived gRPC channel and is designed to be reused. This also matters under Mangum/Lambda, where warm containers reuse module state across invocations.

The client reads `FIRESTORE_EMULATOR_HOST` (honored automatically by `google-cloud-firestore`) and `GOOGLE_CLOUD_PROJECT`.

### Error handling
`routes.py` currently imports `botocore` and branches on `e.response['Error']['Code'] == 'ConditionalCheckFailedException'` — the HTTP layer knows the storage vendor's error taxonomy. That trick relies on DynamoDB's `ConditionExpression="attribute_exists(chunk_id)"`, which has no Firestore equivalent.

`database.py` will define and raise `ChunkNotFound`; `routes.py` will catch it and return 404. This is not gratuitous refactoring — the existing coupling cannot survive the migration — and it leaves the HTTP layer independent of the storage backend.

### Operation mapping

| Operation | Today | After |
|---|---|---|
| `get_chunks` | `query` + manual `LastEvaluatedKey` pagination loop | `.stream()`; the pagination loop is deleted |
| `create_chunk` | `put_item` | `.document(chunk_id).set(...)` |
| `update_chunk` | Builds an `UpdateExpression` string + `ExpressionAttributeValues` | Dict of changed fields passed to `.update()` |
| `update_chunk`, no fields set | Special-cased `get_item` that raises a *synthetic* `ClientError` so routes keep one 404 handler | Plain `.get()`, raises `ChunkNotFound`; the synthetic-error workaround is removed |
| `delete_chunk`, missing doc | `ConditionExpression` fails → 404 | **`.delete()` succeeds silently** — requires an explicit existence check to preserve the 404 |

The `delete_chunk` row is the migration's principal behavioral trap: Firestore deletes are idempotent, so a direct port would silently turn `DELETE /chunks/{unknown}/` from 404 into 204.

Function signatures are otherwise unchanged, so `routes.py` needs no other modification and response models are untouched.

## Local Development

### Emulator service
`docker-compose.yml` replaces `dynamodb-local` with:

- **Image:** `google/cloud-sdk:emulators`
- **Command:** `gcloud beta emulators firestore start --host-port=0.0.0.0:8081`
- **Port:** `8081:8081`

Port 8081 is used rather than the emulator's conventional 8080, which the backend already occupies.

### Data is ephemeral
The DynamoDB Local service mounted `./docker/dynamodb` so local data survived restarts. **The `gcloud` Firestore emulator is in-memory only** and offers no equivalent persistence flag; all local data is lost when the container stops.

This raises the importance of seeding. `backend/scripts/init_local_db.py` becomes `backend/scripts/seed_local_db.py`: Firestore creates collections implicitly on first write, so there is no schema to provision, and the script's purpose shifts from *required setup* to *populating sample chunks for manual and frontend testing*. The `make init-db` target is renamed `make seed-db` accordingly.

### Environment variables
`DYNAMODB_ENDPOINT_URL`, `DYNAMODB_TABLE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION` are replaced everywhere by:

- `FIRESTORE_EMULATOR_HOST=localhost:8081`
- `GOOGLE_CLOUD_PROJECT=timeblock-local`

## Testing

`conftest.py` drops `boto3`, `moto`, and the `aws_credentials`/`dynamodb`/`timechunk_table` fixtures entirely. It gains:

- A **session-scoped client** fixture bound to the emulator.
- A **function-scoped autouse reset** fixture that clears all data between tests via the emulator's `DELETE /emulator/v1/projects/{project}/databases/(default)/documents` endpoint — one HTTP call, substantially faster than recursive document deletion.
- A **safety guard** that fails the run immediately if `FIRESTORE_EMULATOR_HOST` is unset, so a misconfigured environment can never write to real Firestore.

Existing test *assertions* are preserved wherever they encode API behavior — particularly the 404 cases, which are the migration's highest-risk area. Only fixture wiring changes. Preserving the assertions is how this change is verified to have kept behavior rather than quietly redefined it.

### CI
The backend job gains `docker compose up -d firestore-emulator` and a readiness wait before `pytest`, with the two Firestore env vars set on the test step. The `DYNAMODB_ENDPOINT_URL: ""` env entry is removed. The frontend and Terraform jobs are unchanged.

## Alternatives Considered

- **`mock-firestore` (in-process fake) for CI, emulator only for manual dev.** Keeps CI dependency-free and fast, but the fake drifts from real Firestore precisely where this migration is riskiest — `NotFound` semantics, idempotent deletes, timestamp coercion. Rejected: it would mock away the exact behaviors that need verifying.
- **`gcloud` CLI on the CI runner instead of a container.** Avoids Docker in CI, but adds a JDK and SDK install step and makes local and CI environments diverge. Rejected in favor of one consistent emulator definition in `docker-compose.yml`.
- **Flat `chunks/{chunk_id}` collection with a `user_id` field.** Permits cross-user queries later, but needs a composite index for any second filter and makes ownership an assertion to remember on every read rather than a structural guarantee. Rejected; no cross-user query requirement exists.
- **Retaining ISO-string timestamps.** Would guarantee a byte-identical wire format, but carries a DynamoDB workaround into a database with native timestamp support, foreclosing server-side date range queries. Rejected as the wire-format change was verified safe for the frontend.

## Verification

- `docker compose up -d firestore-emulator` starts cleanly and the emulator answers on 8081.
- `make test-backend` passes with all existing assertions intact, including both 404 cases.
- `make seed-db` populates sample chunks; `make dev-backend` serves them via `GET /chunks/`.
- The Expo frontend loads, renders, and edits chunks against the local backend with no frontend code changes.
- CI passes on all three jobs.

## Follow-Up Work (not this task)

- Migrate `infra/` from AWS (Lambda, API Gateway, DynamoDB) to GCP (Cloud Run or Cloud Functions, Firestore, IAM service accounts). **The deployed backend is non-functional until this lands.**
- Unrelated pre-existing gap noticed during design: `frontend/src/api/client.ts` calls a `/templates/` endpoint and sends `template_id` on chunk creation; neither exists in `routes.py` or `models.py`.
