.PHONY: sync lint format typecheck run build clean check test

sync:
	uv sync

lint:
	uv run ruff check src
	uv run ruff format --check src

format:
	uv run ruff check --fix src
	uv run ruff format src

typecheck:
	uv run pyright src

run:
	uv run python src/yt_dlp_api.py

build:
	uv run pyinstaller --onedir --name dlynx-downloader src/yt_dlp_api.py

clean:
	rm -rf .pytest_cache .ruff_cache src/__pycache__ ../../.ruff_cache build dist *.spec

check: lint typecheck

test:
	uv run pytest
