# Downloader

## Setup

- Create venv: `python3 -m venv app/downloader/.venv`
- Upgrade pip: `app/downloader/.venv/bin/pip install -U pip`
- Install Python deps: `app/downloader/.venv/bin/pip install ruff yt-dlp`

## System dependency

- macOS: `brew install ffmpeg`
- Windows: `winget install Gyan.FFmpeg`

## Check

- Lint: `pnpm lint`
