from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, cast

from yt_dlp import YoutubeDL


# 入力: downloader の起動引数を読み取り、ffmpeg location の配置を確認する
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download media through the yt-dlp Python API.",
    )
    parser.add_argument("url")
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--ffmpeg-location", required=True, type=Path)
    return parser.parse_args()


def validate_ffmpeg_location(ffmpeg_location: Path) -> None:
    executable_name = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    executable_path = ffmpeg_location / executable_name

    if not ffmpeg_location.is_dir():
        msg = f"ffmpeg location is not a directory: {ffmpeg_location}"
        raise ValueError(msg)

    if not executable_path.is_file():
        msg = f"ffmpeg executable was not found: {executable_path}"
        raise ValueError(msg)


def create_ytdlp_options(
    output_dir: Path,
    ffmpeg_location: Path,
) -> dict[str, Any]:
    return {
        "ffmpeg_location": str(ffmpeg_location),
        "paths": {"home": str(output_dir)},
        "progress_hooks": [handle_progress_hook],
    }


# 接続: 入力を yt-dlp の API 呼び出しに変換する
def main() -> int:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    ffmpeg_location = args.ffmpeg_location.resolve()

    try:
        validate_ffmpeg_location(ffmpeg_location)
        output_dir.mkdir(parents=True, exist_ok=True)

        options = create_ytdlp_options(output_dir, ffmpeg_location)

        with YoutubeDL(cast(Any, options)) as ydl:
            ydl.download([args.url])
    except Exception as error:
        print(str(error), file=sys.stderr, flush=True)
        return 1

    return 0


# 出力: yt-dlp の progress hook を処理し、DLynx 用の進捗ログを出す
def handle_progress_hook(event: dict[str, Any]) -> None:
    status = event.get("status")

    if status == "downloading":
        percent = get_percent(event)

        if percent is not None:
            print(f"download:download:{percent:.1f}%", flush=True)

    filename = event.get("filename")

    if status == "finished" and isinstance(filename, str):
        normalized_filename = filename.strip()

        if normalized_filename:
            print(
                f"[download] Destination: {Path(normalized_filename).name}",
                flush=True,
            )


def get_percent(event: dict[str, Any]) -> float | None:
    downloaded = event.get("downloaded_bytes")
    total = event.get("total_bytes") or event.get("total_bytes_estimate")

    if not isinstance(downloaded, int | float) or not isinstance(total, int | float):
        return None

    if total <= 0:
        return None

    return min(downloaded / total * 100, 100)


if __name__ == "__main__":
    raise SystemExit(main())
