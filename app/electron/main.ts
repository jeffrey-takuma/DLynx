import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";

import {
  type DownloadRequest,
  type StartedDownload,
  startDownload,
} from "../downloader/download.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const activeDownloads = new Map<number, StartedDownload>();

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const rendererEntry = path.resolve(__dirname, "../renderer/index.html");
  void win.loadFile(rendererEntry);
}

app.whenReady().then(() => {
  ipcMain.handle("app:ping", () => {
    return { ok: true, source: "electron-main" };
  });

  ipcMain.handle("download:start", async (event, request: unknown) => {
    const downloadRequest = parseDownloadRequest(request);
    const started = await startDownload(downloadRequest, {
      repoRoot: path.resolve(__dirname, "../.."),
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
      activeDownloads.delete(downloadId);

      if (code === 0) {
        event.sender.send("download:complete", {
          id: downloadId,
          filename: destinationFilename,
          url: downloadRequest.url,
        });
        return;
      }

      event.sender.send("download:error", {
        id: downloadId,
        message: `yt-dlp exited with code ${code ?? "unknown"}.`,
      });
    });

    return {
      id: downloadId,
      pid: started.process.pid,
      outputDir: started.outputDir,
    };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

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
