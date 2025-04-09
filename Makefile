.PHONY: help start logs

DEFAULT_GOAL := help

help:  ## Show this help menu
	@echo "Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

start:  ## Start server (usage: make start [env=production|acceptance])
	@if [ -z "$(env)" ]; then \
		read -p "Which environment? [production/acceptance]: " env; \
	fi; \
	if [ "$(env)" = "production" ]; then \
		GG_DBN=EuroTourno ./scripts/start-server.sh 4000 mobile false EuroTourno; \
	elif [ "$(env)" = "acceptance" ]; then \
		GG_DBN=AccTourno ./scripts/start-server.sh 4010 mobile false AccTourno; \
	else \
		echo "Invalid environment. Use 'production' or 'acceptance'"; \
		exit 1; \
	fi

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
