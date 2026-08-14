.PHONY: task-required

.DEFAULT_GOAL := task-required

task-required:
	@if command -v task >/dev/null 2>&1; then \
		echo "This repository uses Task. Run 'task' and choose the grouped command instead."; \
	else \
		echo "This repository uses Task, but it is not installed."; \
		echo "Install go-task: https://taskfile.dev/installation/"; \
	fi
	@exit 1

%: task-required
	@:
