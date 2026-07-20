# TimeBlock Project Makefile

.PHONY: help install install-backend install-frontend up down seed-db dev test-backend test-frontend

# Backend configuration
VENV = backend/.venv
PYTHON = $(VENV)/bin/python3
PIP = $(VENV)/bin/pip
PYTEST = $(VENV)/bin/pytest

# Default target
help:
	@echo "Available commands:"
	@echo "  Infrastructure:"
	@echo "    up             Start the local Firestore emulator"
	@echo "    down           Stop and remove containers"
	@echo "    seed-db        Populate the emulator with sample data (requires 'up')"
	@echo ""
	@echo "  Setup:"
	@echo "    install        Install all dependencies (backend & frontend)"
	@echo "    install-backend  Install Python dependencies"
	@echo "    install-frontend Install Node dependencies via pnpm"
	@echo ""
	@echo "  Development:"
	@echo "    dev-backend    Run FastAPI backend locally with reload"
	@echo "    dev-frontend   Start Expo development server"
	@echo ""
	@echo "  Testing:"
	@echo "    test-backend   Run backend tests (unit & integration)"
	@echo "    test-frontend  Run frontend tests"

# Installation
install: install-backend install-frontend

install-backend:
	@echo "Setting up Python virtual environment and dependencies..."
	@if [ ! -d $(VENV) ]; then python3 -m venv $(VENV); fi
	$(PIP) install -r backend/requirements.txt

install-frontend:
	@echo "Installing frontend dependencies with pnpm..."
	cd frontend && pnpm install

# Docker Infrastructure
up:
	docker compose up -d firestore-emulator
	@echo "Waiting for Firestore emulator on :8082..."
	@for i in $$(seq 1 60); do \
		if curl -sf http://localhost:8082/ > /dev/null 2>&1; then echo "Emulator ready."; exit 0; fi; \
		sleep 1; \
	done; \
	echo "Emulator failed to start."; docker compose logs firestore-emulator; exit 1

down:
	docker compose down

# Database
seed-db: up
	@echo "Seeding local Firestore emulator..."
	@export FIRESTORE_EMULATOR_HOST=localhost:8082 && \
	 export GOOGLE_CLOUD_PROJECT=timeblock-local && \
	 $(PYTHON) backend/scripts/seed_local_db.py

# Running locally
dev-backend: up
	@echo "Starting FastAPI backend..."
	@export FIRESTORE_EMULATOR_HOST=localhost:8082 && \
	 export GOOGLE_CLOUD_PROJECT=timeblock-local && \
	 cd backend && ../$(PYTHON) -m uvicorn src.main:app --reload --port 8080

dev-frontend:
	@echo "Starting Expo..."
	cd frontend && pnpm start

# Testing
test-backend: up
	@echo "Running backend tests..."
	@export FIRESTORE_EMULATOR_HOST=localhost:8082 && \
	 export GOOGLE_CLOUD_PROJECT=timeblock-local && \
	 cd backend && ../$(PYTEST) tests

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && pnpm test
