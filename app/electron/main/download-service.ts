import { type ChildProcessByStdio, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { ipcMain, type WebContents } from "electron";

import type { SavedHistoryItem } from "./history-db.js";
import { addHistoryItem } from "./history-db.js";

type DownloadRequest = {
  url: string;
};

type StartedDownload = {
  process: ChildProcessByStdio<null, Readable, Readable>;
  outputDir: string;
  argv: string[];
};

type DownloadPlan = {
  executablePath: string;
  outputDir: string;
  argv: string[];
};

type RegisterDownloadHandlersOptions = {
  repoRoot: string;
};

const activeDownloads = new Map<number, StartedDownload>();

export function registerDownloadHandlers({
  repoRoot,
}: RegisterDownloadHandlersOptions): void {
  ipcMain.handle("download:start", async (event, request: unknown) => {
    const downloadRequest = parseDownloadRequest(request);
    const started = await startDownload(downloadRequest, {
      repoRoot,
    });
    const downloadId = Date.now();
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let destinationFilename: string | undefined;

    activeDownloads.set(downloadId, started);

    function handleProcessOutput(source: "stderr" | "stdout", chunk: Buffer) {
      const text = chunk.toString();
      const nextBuffer = source === "stdout" ? stdoutBuffer : stderrBuffer;
      const parts = `${nextBuffer}${text}`.split(/\r|\n/);
      const rest = parts.pop() ?? "";

      if (source === "stdout") {
        stdoutBuffer = rest;
      } else {
        stderrBuffer = rest;
      }

      for (const line of parts) {
        if (!line.trim()) {
          continue;
        }

        if (source === "stdout") {
          console.log(`yt-dlp stdout: ${line}`);
        } else {
          console.error(`yt-dlp stderr: ${line}`);
        }

        const percent = parseDownloadPercent(line);
        const parsedFilename = parseOutputFilename(line);

        if (parsedFilename) {
          destinationFilename = parsedFilename;
        }

        if (percent !== null) {
          event.sender.send("download:progress", {
            id: downloadId,
            percent,
          });
        }
      }
    }

    started.process.stdout.on("data", (chunk: Buffer) => {
      handleProcessOutput("stdout", chunk);
    });

    started.process.stderr.on("data", (chunk: Buffer) => {
      handleProcessOutput("stderr", chunk);
    });

    started.process.on("error", (error) => {
      activeDownloads.delete(downloadId);
      event.sender.send("download:error", {
        id: downloadId,
        message: error.message,
      });
    });

    started.process.on("close", (code) => {
      void handleDownloadClose({
        code,
        downloadId,
        downloadRequest,
        sender: event.sender,
        started,
        destinationFilename,
      });
    });

    return {
      id: downloadId,
      pid: started.process.pid,
      outputDir: started.outputDir,
    };
  });
}

function createDownloadPlan(
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
      "download:download:%(progress._percent_str)s",
      "-P",
      outputDir,
      request.url,
    ],
  };
}

async function startDownload(
  request: DownloadRequest,
  options: { repoRoot: string },
): Promise<StartedDownload> {
  const plan = createDownloadPlan(request, options.repoRoot);

  await mkdir(plan.outputDir, { recursive: true });

  return {
    process: spawn(plan.executablePath, plan.argv, {
      stdio: ["ignore", "pipe", "pipe"],
    }),
    outputDir: plan.outputDir,
    argv: plan.argv,
  };
}

async function handleDownloadClose({
  code,
  downloadId,
  downloadRequest,
  sender,
  started,
  destinationFilename,
}: {
  code: number | null;
  downloadId: number;
  downloadRequest: DownloadRequest;
  sender: WebContents;
  started: StartedDownload;
  destinationFilename: string | undefined;
}): Promise<void> {
  activeDownloads.delete(downloadId);

  if (code === 0) {
    let historyItem: SavedHistoryItem | undefined;

    if (destinationFilename) {
      try {
        historyItem = await addHistoryItem({
          title: destinationFilename,
          url: downloadRequest.url,
          filePath: path.resolve(started.outputDir, destinationFilename),
          savedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Failed to save download history:", error);
      }
    }

    sender.send("download:complete", {
      id: downloadId,
      filename: destinationFilename,
      historyItem,
      url: downloadRequest.url,
    });
    return;
  }

  sender.send("download:error", {
    id: downloadId,
    message: `yt-dlp exited with code ${code ?? "unknown"}.`,
  });
}

function parseDownloadRequest(value: unknown): DownloadRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Download request must be an object.");
  }

  const { url } = value as { url?: unknown };

  if (typeof url !== "string" || !url.trim()) {
    throw new Error("Download request URL is required.");
  }

  return { url: url.trim() };
}

function parseDownloadPercent(line: string): number | null {
  const match = line.match(/(?:download:)?\s*([0-9]+(?:\.[0-9]+)?)%/);

  if (!match) {
    return null;
  }

  return Math.min(Number(match[1]), 100);
}

function parseOutputFilename(line: string): string | undefined {
  const mergerMatch = line.match(/\[Merger\]\s+Merging formats into "(.+)"$/);

  if (mergerMatch) {
    return path.basename(mergerMatch[1]);
  }

  const destinationPrefix = "[download] Destination:";

  if (line.startsWith(destinationPrefix)) {
    return path.basename(line.slice(destinationPrefix.length).trim());
  }

  return undefined;
}
