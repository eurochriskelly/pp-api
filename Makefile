.PHONY: help start start-production start-acceptance

DEFAULT_GOAL := help

help:  ## Show this help menu
	@echo "Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

start:  ## Start server (usage: make start [env=production|acceptance])
	@if [ "$(env)" = "production" ]; then \
		$(MAKE) start-production; \
	elif [ "$(env)" = "acceptance" ]; then \
		$(MAKE) start-acceptance; \
	else \
		echo "Usage: make start env={production|acceptance}"; \
		exit 1; \
	fi

start-production:  ## Start production server
	GG_DBN=EuroTourno ./scripts/start-server.sh 4000 mobile false EuroTourno

start-acceptance:  ## Start acceptance server
	GG_DBN=AccTourno ./scripts/start-server.sh 4010 mobile true AccTourno
