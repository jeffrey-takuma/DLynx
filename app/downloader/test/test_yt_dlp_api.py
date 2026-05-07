import sys
from pathlib import Path

import pytest

from yt_dlp_api import (
    create_ytdlp_options,
    get_percent,
    handle_progress_hook,
    parse_args,
    validate_ffmpeg_location,
)


def test_parse_args_reads_downloader_arguments(monkeypatch):
    # 入力: downloader の起動引数を yt-dlp API 用の値として処理できる
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "yt_dlp_api.py",
            "https://example.com/video",
            "--output-dir",
            "/tmp/output",
            "--ffmpeg-location",
            "/tmp/bin",
        ],
    )

    args = parse_args()

    assert args.url == "https://example.com/video"
    assert args.output_dir == Path("/tmp/output")
    assert args.ffmpeg_location == Path("/tmp/bin")


def test_validate_ffmpeg_location_accepts_downloader_tool_directory(tmp_path):
    # 入力: OS に合った名前の ffmpeg 実行ファイルが配置されている
    executable = tmp_path / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    executable.touch()

    validate_ffmpeg_location(tmp_path)


def test_validate_ffmpeg_location_rejects_missing_directory(tmp_path):
    # 入力: ffmpeg location の path 上にディレクトリが存在しない
    ffmpeg_location = tmp_path / "missing"

    with pytest.raises(ValueError, match="ffmpeg location is not a directory"):
        validate_ffmpeg_location(ffmpeg_location)


def test_validate_ffmpeg_location_rejects_directory_without_ffmpeg(tmp_path):
    # 入力: ffmpeg location のディレクトリは存在するが、実行ファイルは存在しない
    with pytest.raises(ValueError, match="ffmpeg executable was not found"):
        validate_ffmpeg_location(tmp_path)


def test_create_ytdlp_options_maps_paths_to_ytdlp_options(tmp_path):
    # 接続: downloader の path を yt-dlp API が受け取る options に変換できる
    output_dir = tmp_path / "media"
    ffmpeg_location = tmp_path / "bin"

    options = create_ytdlp_options(output_dir, ffmpeg_location)

    assert options == {
        "ffmpeg_location": str(ffmpeg_location),
        "paths": {"home": str(output_dir)},
        "progress_hooks": [handle_progress_hook],
    }


def test_handle_progress_hook_writes_percent_for_downloading(capsys):
    # 出力: downloading で数値の byte 情報がある場合は進捗ログを出す
    handle_progress_hook(
        {"status": "downloading", "downloaded_bytes": 50, "total_bytes": 100},
    )

    captured = capsys.readouterr()

    assert captured.out == "download:download:50.0%\n"


def test_handle_progress_hook_writes_destination_for_finished(capsys):
    # 出力: finished で文字列の filename がある場合は完了ファイル名ログを出す
    handle_progress_hook({"status": "finished", "filename": "/tmp/movie.mp4"})

    captured = capsys.readouterr()

    assert captured.out == "[download] Destination: movie.mp4\n"


def test_handle_progress_hook_skips_downloading_with_non_numeric_bytes(capsys):
    # 出力: downloading でも byte 情報が数値ではない場合は進捗ログを出さない
    handle_progress_hook(
        {"status": "downloading", "downloaded_bytes": "50", "total_bytes": 100},
    )

    captured = capsys.readouterr()

    assert captured.out == ""


def test_handle_progress_hook_skips_finished_with_non_string_filename(capsys):
    # 出力: finished でも filename が文字列ではない場合は完了ファイル名ログを出さない
    handle_progress_hook({"status": "finished", "filename": None})

    captured = capsys.readouterr()

    assert captured.out == ""


def test_handle_progress_hook_skips_finished_with_blank_filename(capsys):
    # 出力: finished でも filename が空白のみの場合は完了ファイル名ログを出さない
    handle_progress_hook({"status": "finished", "filename": "   "})

    captured = capsys.readouterr()

    assert captured.out == ""


def test_get_percent_calculates_with_total_bytes():
    # 出力: 正確な total_bytes を持つ yt-dlp のダウンロード状況
    percent = get_percent({"downloaded_bytes": 50, "total_bytes": 100})

    assert percent == 50.0


def test_get_percent_calculates_with_total_bytes_estimate():
    # 出力: total_bytes がなく、推定値の total_bytes_estimate を持つダウンロード状況
    percent = get_percent({"downloaded_bytes": 50, "total_bytes_estimate": 200})

    assert percent == 25.0


def test_get_percent_caps_progress_at_100_when_downloaded_exceeds_total():
    # 出力: downloaded_bytes が total_bytes を超えているダウンロード状況
    percent = get_percent({"downloaded_bytes": 120, "total_bytes": 100})

    assert percent == 100


def test_get_percent_returns_none_without_usable_total():
    # 出力: total がない、または 0 以下のダウンロード状況
    assert get_percent({"downloaded_bytes": 50}) is None
    assert get_percent({"downloaded_bytes": 50, "total_bytes": 0}) is None
    assert get_percent({"downloaded_bytes": 50, "total_bytes": -1}) is None
