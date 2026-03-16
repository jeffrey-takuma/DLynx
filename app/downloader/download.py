from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError


@dataclass(slots=True)
class DownloadRequest:
    url: str
    output_dir: str | Path
    filename_template: str = "%(title)s.%(ext)s"
    format_selector: str = "bestvideo+bestaudio/best"
    audio_only: bool = False
    extra_options: dict[str, Any] = field(default_factory=dict)


def _build_ydl_options(request: DownloadRequest) -> dict[str, Any]:
    output_dir = Path(request.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    options: dict[str, Any] = {
        "outtmpl": str(output_dir / request.filename_template),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    if request.audio_only:
        options["format"] = "bestaudio/best"
        options["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ]
    else:
        options["format"] = request.format_selector
        options["merge_output_format"] = "mp4"

    options.update(request.extra_options)
    return options


def download_video(request: DownloadRequest) -> dict[str, Any]:
    options = _build_ydl_options(request)

    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(request.url, download=True)
            downloaded_path = ydl.prepare_filename(info)

            if request.audio_only:
                downloaded_path = str(Path(downloaded_path).with_suffix(".mp3"))

            return {
                "ok": True,
                "url": request.url,
                "title": info.get("title"),
                "extractor": info.get("extractor"),
                "webpage_url": info.get("webpage_url", request.url),
                "file_path": downloaded_path,
                "duration": info.get("duration"),
            }
    except DownloadError as exc:
        return {
            "ok": False,
            "url": request.url,
            "error": str(exc),
        }


def download_from_url(
    url: str,
    output_dir: str | Path,
    *,
    audio_only: bool = False,
    format_selector: str = "bestvideo+bestaudio/best",
    filename_template: str = "%(title)s.%(ext)s",
    extra_options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    request = DownloadRequest(
        url=url,
        output_dir=output_dir,
        filename_template=filename_template,
        format_selector=format_selector,
        audio_only=audio_only,
        extra_options=extra_options or {},
    )
    return download_video(request)
