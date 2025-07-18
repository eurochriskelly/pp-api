.PHONY: help start mocks logs backup clean

DEFAULT_GOAL := help

help:  ## Show this help menu
	@echo "Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

mocks:  ## Start server in mock mode (usage: make mocks [port=NUMBER])
	port=$${port:-4000}; \
	PP_DBN=MockTourno ./scripts/start-server.sh $$port mobile true MockTourno

start:  ## Start server with auto-restart (usage: make start [env=production|acceptance] [port=NUMBER])
	@if [ -z "$(env)" ]; then \
		read -p "Which environment? [production/acceptance]: " env; \
	fi; \
	port=$${port:-4000}; \
	if [ "$(env)" = "production" ]; then \
		while true; do \
			PP_DBN=EuroTourno ./scripts/start-server.sh $$port production/mobile false EuroTourno || \
			(echo "Server crashed, restarting in 5 seconds..." && sleep 5); \
		done; \
	elif [ "$(env)" = "acceptance" ]; then \
		while true; do \
			PP_DBN=AccTourno ./scripts/start-server.sh $$port acceptance/mobile false AccTourno || \
			(echo "Server crashed, restarting in 5 seconds..." && sleep 5); \
		done; \
	else \
		echo "Invalid environment. Use 'production' or 'acceptance'"; \
		exit 1; \
	fi

backup:  ## Create a database backup
	npm run backup

clean: ## Remove cache directory
	@echo "Removing cache directory..."
	@rm -rf ./cache

logs:  ## Tail latest log (usage: make logs [env=production|acceptance])
	@if [ -z "$(env)" ]; then \
		read -p "Which environment? [production/acceptance]: " env; \
	fi; \
	if [ "$(env)" = "production" ]; then \
		latest=$$(ls -t ./logs/EuroTourno/*.log | head -n 1); \
		tail -f "$$latest"; \
	elif [ "$(env)" = "acceptance" ]; then \
		latest=$$(ls -t ./logs/AccTourno/*.log | head -n 1); \
		tail -f "$$latest"; \
	else \
		echo "Invalid environment. Use 'production' or 'acceptance'"; \
		exit 1; \
	fi
