.DEFAULT_GOAL := help
PY ?= python3.11   # API needs Python 3.10+ (uses str | None unions)

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n",$$1,$$2}'

# ── Setup ──────────────────────────────────────────────────

install: install-api install-frontend ## Install all dependencies

install-api: ## Create the API venv and install deps
	cd api && $(PY) -m venv .venv && . .venv/bin/activate && pip install -q -r requirements.txt

install-frontend: ## Install frontend deps
	cd frontend && npm install

env: ## Create .env files from examples (won't overwrite existing)
	@test -f api/.env || cp api/.env.example api/.env
	@test -f frontend/.env || cp frontend/.env.example frontend/.env
	@echo "Created api/.env and frontend/.env — fill them from 'make infra-output'."

# ── Run ────────────────────────────────────────────────────

api: ## Run the API locally (uvicorn on :8000)
	cd api && . .venv/bin/activate && uvicorn app.main:app --reload

frontend: ## Run the frontend dev server (:5173)
	cd frontend && npm run dev

build: ## Build the frontend for production
	cd frontend && npm run build

# ── Infra ──────────────────────────────────────────────────

infra-init: ## terraform init
	cd infra && terraform init

infra-plan: ## terraform plan
	cd infra && terraform plan

infra-apply: ## terraform apply (provisions AWS)
	cd infra && terraform apply

infra-output: ## Show terraform outputs (bucket/table/CloudFront/WebSocket)
	cd infra && terraform output

fmt: ## Format Terraform
	cd infra && terraform fmt -recursive

worker-push: ## Build + push the worker image to ECR
	./scripts/push-worker.sh

# ── Quality ────────────────────────────────────────────────

check: ## Validate everything locally (no AWS needed)
	cd infra && terraform fmt -check -recursive && terraform init -backend=false && terraform validate
	cd frontend && npm run build
	@$(PY) -c "import ast,glob; [ast.parse(open(f).read()) for f in glob.glob('api/**/*.py',recursive=True)+glob.glob('worker/**/*.py',recursive=True)+glob.glob('lambdas/**/*.py',recursive=True)]; print('python OK')"

clean: ## Remove build artifacts, deps, and Terraform cache
	rm -rf frontend/dist frontend/node_modules api/.venv infra/.terraform infra/build/*.zip
	find . -name '*.tsbuildinfo' -delete

.PHONY: help install install-api install-frontend env api frontend build \
	infra-init infra-plan infra-apply infra-output fmt worker-push check clean
