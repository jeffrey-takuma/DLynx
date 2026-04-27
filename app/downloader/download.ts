import { type ChildProcessByStdio, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

export type DownloadRequest = {
  url: string;
};

export type StartDownloadOptions = {
  repoRoot?: string;
};

export type StartedDownload = {
  process: ChildProcessByStdio<null, Readable, Readable>;
  outputDir: string;
  argv: string[];
};

type BuildYtDlpArgvOptions = {
  url: string;
  binDir: string;
  outputDir: string;
};

function buildYtDlpArgv(options: BuildYtDlpArgvOptions): string[] {
  return [
    "--ffmpeg-location",
    options.binDir,
    "--newline",
    "--progress-template",
    "download:%(progress._percent_str)s",
    "-P",
    options.outputDir,
    options.url,
  ];
}

export async function startDownload(
  request: DownloadRequest,
  options: StartDownloadOptions = {},
): Promise<StartedDownload> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const binDir = path.join(repoRoot, "app/downloader/bin");
  const outputDir = getManagedMediaDir(repoRoot);

  await mkdir(outputDir, { recursive: true });

  const argv = buildYtDlpArgv({
    url: request.url,
    binDir,
    outputDir,
  });

  return {
    process: spawn(path.join(binDir, getYtDlpExecutableName()), argv, {
      stdio: ["ignore", "pipe", "pipe"],
    }),
    outputDir,
    argv,
  };
}

export function getManagedMediaDir(repoRoot: string): string {
  return path.join(repoRoot, "media");
}

function getYtDlpExecutableName(): string {
  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}
