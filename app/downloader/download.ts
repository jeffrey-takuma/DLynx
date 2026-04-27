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

export type DownloadPlan = {
  executablePath: string;
  outputDir: string;
  argv: string[];
};

export function createDownloadPlan(
  request: DownloadRequest,
  repoRoot: string,
): DownloadPlan {
  const binDir = path.join(repoRoot, "app/downloader/bin");
  const executableName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const outputDir = path.join(repoRoot, "media");

  return {
    executablePath: path.join(binDir, executableName),
    outputDir,
    argv: [
      "--ffmpeg-location",
      binDir,
      "--newline",
      "--progress-template",
      "download:%(progress._percent_str)s",
      "-P",
      outputDir,
      request.url,
    ],
  };
}

export async function startDownload(
  request: DownloadRequest,
  options: StartDownloadOptions = {},
): Promise<StartedDownload> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const plan = createDownloadPlan(request, repoRoot);

  await mkdir(plan.outputDir, { recursive: true });

  return {
    process: spawn(plan.executablePath, plan.argv, {
      stdio: ["ignore", "pipe", "pipe"],
    }),
    outputDir: plan.outputDir,
    argv: plan.argv,
  };
}
