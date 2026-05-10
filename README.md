# TimeBlock

A tactile, zero-sum time blocking application built with React Native (Expo) and FastAPI.

## Project Structure

- `frontend/`: React Native mobile application using Expo.
- `backend/`: FastAPI Python server.
- `infra/`: Terraform infrastructure (AWS Lambda, DynamoDB).
- `docs/`: Design specifications and implementation plans.

## Getting Started

### Backend (FastAPI)

1.  **Navigate to backend:**
    ```bash
    cd backend
    ```
2.  **Set up virtual environment:**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Run the server:**
    ```bash
    uvicorn src.main:app --reload
    ```
    The API will be available at `http://localhost:8000`.

### Frontend (Expo)

1.  **Navigate to frontend:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the development server:**
    ```bash
    npm start
    ```
4.  **Run on device/simulator:**
    - Use the **Expo Go** app on your phone to scan the QR code.
    - Press `i` for iOS simulator.
    - Press `a` for Android emulator.

## Features

- **Tactile Stack UI:** Vertical timeline where task height represents duration.
- **Zero-Sum Dragging:** Resizing one task automatically adjusts the adjacent task or the buffer.
- **5-Minute Snapping:** Intuitive drag interactions that snap to 5-minute increments.
- **Unallocated Time:** Visual gaps showing exactly how much time remains in a block.
- **Debounced Sync:** High-frequency UI interactions are synced to the backend with efficient debouncing.

## Development

- **Tests:** Run `npm test` in the `frontend` directory or `pytest` in the `backend` directory.
- **Architecture:** Decoupled UI logic (Reanimated) from the logic layer (`dragMath`) and API layer (`ApiClient`).
