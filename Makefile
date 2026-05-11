# TimeBlock Project Makefile

.PHONY: help install install-backend install-frontend up down init-db dev test-backend test-frontend

# Backend configuration
VENV = backend/.venv
PYTHON = $(VENV)/bin/python3
PIP = $(VENV)/bin/pip
PYTEST = $(VENV)/bin/pytest

# Default target
help:
	@echo "Available commands:"
	@echo "  Infrastructure:"
	@echo "    up             Start local DynamoDB container"
	@echo "    down           Stop and remove containers"
	@echo "    init-db        Create local DynamoDB table (requires 'up')"
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
	docker-compose up -d dynamodb-local

down:
	docker-compose down

# Database
init-db:
	@echo "Initializing local DynamoDB table..."
	@export DYNAMODB_ENDPOINT_URL=http://localhost:8000 && $(PYTHON) backend/scripts/init_local_db.py

# Running locally
dev-backend: up
	@echo "Starting FastAPI backend..."
	@export DYNAMODB_ENDPOINT_URL=http://localhost:8000 && \
	 export AWS_ACCESS_KEY_ID=local && \
	 export AWS_SECRET_ACCESS_KEY=local && \
	 export AWS_DEFAULT_REGION=us-east-1 && \
	 cd backend && ../$(PYTHON) -m uvicorn src.main:app --reload --port 8080

dev-frontend:
	@echo "Starting Expo..."
	cd frontend && pnpm start

# Testing
test-backend:
	@echo "Running backend tests..."
	@export DYNAMODB_ENDPOINT_URL=http://localhost:8000 && \
	 export AWS_ACCESS_KEY_ID=local && \
	 export AWS_SECRET_ACCESS_KEY=local && \
	 export AWS_DEFAULT_REGION=us-east-1 && \
	 $(PYTEST) backend/tests

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && pnpm test
