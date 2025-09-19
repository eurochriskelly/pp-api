.PHONY: help start mocks logs backup clean follow kill diagnostics-sql-on diagnostics-sql-off

DEFAULT_GOAL := help

help:  ## Show this help menu
	@echo "Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

mocks:  ## Start server in mock mode (usage: make mocks [port=NUMBER])
	./scripts/make/mocks.sh $(port)

start:  ## Start server with auto-restart (usage: make start [env=production|acceptance] [port=NUMBER])
	./scripts/make/start.sh $(env) $(port)

backup:  ## Create a database backup
	npm run backup

clean: ## Remove cache directory
	@echo "Removing cache directory..."
	@rm -rf ./cache

logs:  ## Tail latest log (usage: make logs [env=production|acceptance])
	./scripts/make/logs.sh $(env)

follow:  ## Follow the server log (always follows ./logs/server.log)
	@mkdir -p ./logs
	@touch ./logs/server.log
	@echo "Following ./logs/server.log (press Ctrl+C to exit)"
	@tail -f "./logs/server.log" | awk '{print} /\[EXIT\] Server stopped\./ {print "Server stopped detected, exiting..."; exit}'

kill:  ## Kill running server instances
	./scripts/make/kill.sh

diagnostics-sql-on: ## Enable SQL statement printing (usage: make diagnostics-sql-on port=NUMBER)
	@if [ -z "$(port)" ]; then \
		echo "Usage: make diagnostics-sql-on port=NUMBER"; \
		exit 1; \
	fi
	@curl -X PUT http://localhost:$(port)/api/system/diagnostics/print-sql-statements

diagnostics-sql-off: ## Disable SQL statement printing (usage: make diagnostics-sql-off port=NUMBER)
	@if [ -z "$(port)" ]; then \
		echo "Usage: make diagnostics-sql-off port=NUMBER"; \
		exit 1; \
	fi
	@curl -X DELETE http://localhost:$(port)/api/system/diagnostics/print-sql-statements

%:
	@:
