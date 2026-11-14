.PHONY: help init up down dev dev-down logs ps migrate seed rebuild-analytics check test test-integration build clean

-include .env
export

COMPOSE = docker compose
COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml
INFRA = mongo redis nats

HOST_ENV = NODE_ENV=development PORT=8080 \
	MONGO_URI="mongodb://$(MONGO_ROOT_USER):$(MONGO_ROOT_PASSWORD)@localhost:27017/?authSource=admin&directConnection=true" \
	MONGO_DB=$(MONGO_DB) JWT_PRIVATE_KEY_PATH=$(CURDIR)/secrets/jwt_es256.pem COOKIE_SECURE=false \
	SEED_ADMIN_EMAIL=$(SEED_ADMIN_EMAIL) SEED_ADMIN_PASSWORD=$(SEED_ADMIN_PASSWORD) \
	SEED_VIEWER_EMAIL=$(SEED_VIEWER_EMAIL) SEED_VIEWER_PASSWORD=$(SEED_VIEWER_PASSWORD) \
	REDIS_URL="redis://:$(REDIS_PASSWORD)@localhost:6379" \
	NATS_URL=nats://localhost:4222 NATS_USER=$(NATS_USER) NATS_PASSWORD=$(NATS_PASSWORD)

help: ## Show this help menu
	@echo "Doctrack commands:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(firstword $(MAKEFILE_LIST)) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

init: ## First-time setup: .env with random secrets, Mongo keyfile, dependencies
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		for key in MONGO_ROOT_PASSWORD REDIS_PASSWORD NATS_PASSWORD; do \
			sed -i "s|^$$key=.*|$$key=$$(openssl rand -hex 24)|" .env; \
		done; \
		echo ".env created with generated secrets"; \
	fi
	@mkdir -p secrets
	@test -f secrets/mongo-keyfile || (openssl rand -base64 756 > secrets/mongo-keyfile && chmod 444 secrets/mongo-keyfile && echo "secrets/mongo-keyfile created")
	@test -f secrets/jwt_es256.pem || (openssl ecparam -name prime256v1 -genkey -noout -out secrets/jwt_es256.pem && chmod 644 secrets/jwt_es256.pem && echo "secrets/jwt_es256.pem created")
	pnpm install --frozen-lockfile

up: ## Build and start the full stack
	$(COMPOSE) up --build -d --wait
	@echo "Web http://localhost:$${WEB_HOST_PORT:-3000}   API http://localhost:$${API_HOST_PORT:-8080}/docs"

down: ## Stop the stack (volumes are kept)
	$(COMPOSE) down

dev: ## Infrastructure in Docker, api + worker + web with hot reload on the host
	$(COMPOSE_DEV) up -d --wait $(INFRA)
	@trap 'kill 0' INT TERM; \
	( $(HOST_ENV) pnpm --filter @doctrack/api dev & \
	  $(HOST_ENV) pnpm --filter @doctrack/api dev:worker & \
	  $(HOST_ENV) pnpm --filter @doctrack/web dev & \
	  wait )

dev-down: ## Stop the development infrastructure
	$(COMPOSE_DEV) down

logs: ## Tail api, worker and web logs
	$(COMPOSE) logs -f api worker web

ps: ## Show service status
	$(COMPOSE) ps

migrate: ## Ensure MongoDB indexes
	$(COMPOSE_DEV) up -d --wait $(INFRA)
	@$(HOST_ENV) pnpm --filter @doctrack/api migrate

seed: ## Create the demo admin and viewer accounts (stack must be up)
	$(COMPOSE) run --rm api node dist/seed.js

rebuild-analytics: ## Recompute the dashboard read model from the data (ARGS=--check only verifies)
	$(COMPOSE) run --rm worker node dist/rebuild-analytics.js $(ARGS)

check: ## Full quality gate: lint, format, typecheck, architecture, unit tests, build
	pnpm check

test: ## Unit tests
	pnpm test

test-integration: ## Integration tests against real MongoDB, Redis and NATS
	$(COMPOSE_DEV) up -d --wait $(INFRA)
	@$(HOST_ENV) NODE_ENV=test pnpm test:integration $(TEST)

build: ## Build every workspace
	pnpm build

clean: ## Remove containers, volumes and build output
	$(COMPOSE_DEV) down -v
	rm -rf apps/*/dist apps/web/.next
