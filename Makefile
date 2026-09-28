# rag — central Makefile (demo-maker layout)
#
# One entry point to run this demo in production: status, deploy, stop/start,
# access tokens, the on-demand Telegram bot and the admin key. The Makefile
# only wraps scripts/demo.sh, which reuses demo-maker's scripts/lib.sh for
# config and helpers; nothing here re-implements the platform.
#
# This project predates demo-maker's naming, so the resources keep their own
# names: the Railway service `rag-api` in the shared `portfolio` project and
# the Cloudflare Pages project `rag-explorer`. The CI pipeline lives in
# main-portfolio (.github/workflows/deploy-tg-ai-rag-assistant-bot.yml); the
# deploy targets here are the manual equivalent.
#
# Every target prints the command it runs (">> ...") before running it, so a
# run can always be copied and repeated by hand.
#
#   make help                      list targets
#   make status                    what is live, what is broken
#   make <target> INTERACTIVE=1    ask for that target's parameters step by step
#
# Access is token based: `make token-create` mints a demo token that expires on
# its own (optionally after N queries). There is no self-service sign-up.
#
# Destructive targets (stop, token-revoke, token-revoke-all, bot-stop,
# admin-key-rotate) refuse to run without YES=1; INTERACTIVE=1 asks instead.
SHELL := /bin/bash
.DEFAULT_GOAL := help

# ------------------------------------------------------------ project settings
SLUG           ?= rag
DOMAIN_KIND    ?= personal
SERVICE        ?= rag-api
PAGES_PROJECT  ?= rag-explorer
FRONTEND_DIR   ?= frontend
FRONTEND_OUT   ?= $(FRONTEND_DIR)/out
HEALTH_PATH    ?= /api/health/
PROTECTED_PATH ?= /api/me/
DEMO_MAKER     ?= $(HOME)/dotfiles/ai-tools/skills/demo-maker

# Parameters read by individual targets (see `make help`).
LABEL ?=
DAYS ?=
LIMIT ?=
ID ?=
MINUTES ?=
LOG_LINES ?=
YES ?=
SHOW ?=
COPY ?=

export SLUG DOMAIN_KIND SERVICE PAGES_PROJECT FRONTEND_DIR FRONTEND_OUT HEALTH_PATH \
  PROTECTED_PATH DEMO_MAKER LABEL DAYS LIMIT ID MINUTES LOG_LINES YES SHOW COPY

DEMO := scripts/demo.sh

# RUN prints the exact command, then runs it. After an INTERACTIVE=1 run the
# one-line replay command is printed again, success or failure.
define RUN
	@echo ""
	@echo ">> $(1)"
	@if [ "$(INTERACTIVE)" = "1" ] && [ -f "$(INTERACTIVE_REPLAY_FILE)" ]; then \
	  trap 'status=$$?; bash scripts/interactive/print_replay_hint.sh "$(INTERACTIVE_REPLAY_FILE)"; exit $$status' EXIT; \
	  $(1); \
	else \
	  $(1); \
	fi
endef

# ------------------------------------------------------------ INTERACTIVE=1
# Optional human front door: asks, on the terminal, for the parameters the
# requested goal reads (token id from a live menu, label, days, confirmation)
# and feeds the answers back as ordinary make variables. Without it nothing
# is ever prompted, so agents and CI keep the classic command line.
INTERACTIVE ?= 0
INTERACTIVE_MK := /tmp/$(SLUG)-demo-interactive.mk
ifeq ($(INTERACTIVE),1)
$(shell bash scripts/interactive/prompt.sh $(INTERACTIVE_MK) $(or $(MAKECMDGOALS),$(.DEFAULT_GOAL)) >/dev/null)
include $(INTERACTIVE_MK)
endif
INTERACTIVE_REPLAY_FILE ?= /tmp/$(SLUG)-demo-interactive.cmd

.PHONY: help info open admin
help: ## list targets
	@echo "$(SLUG) — demo operations  (make <target> INTERACTIVE=1 asks for parameters)"
	@awk 'BEGIN {FS = ":.*## "} /^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next} /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

##@ Status
info: ## URLs, resource names and where the settings come from
	$(call RUN,$(DEMO) info)

status: ## frontend, backend deployment, health, cap, bot and token summary
	$(call RUN,$(DEMO) status)

verify: ## end-to-end checks: frontend, health, 401 without token, admin gate 403, token round trip
	$(call RUN,$(DEMO) verify)

logs: ## backend logs from Railway (LOG_LINES=100)
	$(call RUN,$(DEMO) logs)

open: ## open the demo in the browser
	$(call RUN,$(DEMO) open /)

admin: ## open /secret-admin in the browser
	$(call RUN,$(DEMO) open /secret-admin)

##@ Deploy
deploy: ## backend, then frontend
	$(call RUN,$(DEMO) deploy)

deploy-backend: ## enforce the Railway cap, then upload and build the API + bot container
	$(call RUN,$(DEMO) deploy-backend)

deploy-frontend: ## build the static frontend and publish it to Cloudflare Pages
	$(call RUN,$(DEMO) deploy-frontend)

build: ## build the static frontend only
	$(call RUN,$(DEMO) build)

redeploy: ## restart the latest backend build without uploading
	$(call RUN,$(DEMO) redeploy)

##@ Stop / start
stop: ## remove the active backend deployment; database and variables stay (YES=1)
	$(call RUN,$(DEMO) stop)

start: ## bring a stopped backend back and wait for health
	$(call RUN,$(DEMO) start)

##@ Access: demo tokens
tokens: ## list demo tokens with state, expiry and usage
	$(call RUN,$(DEMO) tokens)

token-create: ## mint a token and print its share link (LABEL=, DAYS=7, LIMIT=, COPY=1)
	$(call RUN,$(DEMO) token-create)

token-revoke: ## deactivate a token (ID=, YES=1)
	$(call RUN,$(DEMO) token-revoke)

token-revoke-all: ## deactivate every active token (YES=1)
	$(call RUN,$(DEMO) token-revoke-all)

##@ Telegram bot (on demand)
bot-status: ## is the bot polling, and until when
	$(call RUN,$(DEMO) bot-status)

bot-start: ## start polling for a while (MINUTES=60)
	$(call RUN,$(DEMO) bot-start)

bot-stop: ## stop polling now (YES=1)
	$(call RUN,$(DEMO) bot-stop)

##@ Access: admin
admin-key: ## show where the admin key comes from, masked (SHOW=1 prints it)
	$(call RUN,$(DEMO) admin-key)

admin-key-rotate: ## new admin key on Railway and in pass (YES=1)
	$(call RUN,$(DEMO) admin-key-rotate)

.PHONY: status verify logs deploy deploy-backend deploy-frontend build redeploy stop start \
  tokens token-create token-revoke token-revoke-all bot-status bot-start bot-stop \
  admin-key admin-key-rotate
