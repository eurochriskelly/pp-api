.PHONY: help start mocks logs backup clean follow

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

follow:  ## Follow logs for a specific trace (usage: make follow --trace=XXXX)
	@trace=$(subst --trace=,,$(filter --trace=%,$(MAKECMDGOALS))); \
	if [ -z "$$trace" ]; then \
		echo "Usage: make follow --trace=XXXX"; \
		exit 1; \
	fi; \
	if [ -f "./logs/temp/start-$$trace.log" ]; then \
		tail -f "./logs/temp/start-$$trace.log"; \
	else \
		echo "Log file for trace $$trace not found."; \
		exit 1; \
	fi

%:
	@:
