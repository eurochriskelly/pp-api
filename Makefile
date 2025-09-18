.PHONY: help start mocks logs backup clean follow kill

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

follow:  ## Follow logs for a specific trace or the latest via symlink (usage: make follow [TRACE=XXXX])
	@if [ -z "$(TRACE)" ]; then \
		# Update the symlink to point to the latest log file \
		latest_log=$$(ls -t ./logs/temp/start-*.log 2>/dev/null | head -n 1); \
		if [ -z "$$latest_log" ]; then \
			echo "No log files found in ./logs/temp/"; \
			exit 1; \
		fi; \
		# Remove any existing symlink and create a new one pointing to the latest log \
		rm -f ./logs/temp/start.log; \
		ln -s "$$(basename "$$latest_log")" ./logs/temp/start.log; \
		echo "Following latest log: $$latest_log"; \
		# Use tail -F to follow the filename, which works even if the file is recreated \
		tail -F "$$latest_log"; \
	else \
		if [ -f "./logs/temp/start-$(TRACE).log" ]; then \
			tail -f "./logs/temp/start-$(TRACE).log"; \
		else \
			echo "Log file for trace $(TRACE) not found."; \
			exit 1; \
		fi; \
	fi

kill:  ## Kill running server instances
	./scripts/make/kill.sh

%:
	@:
