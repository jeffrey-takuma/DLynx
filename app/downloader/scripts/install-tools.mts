import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { get } from "node:https";
import { arch, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ArchiveType = "file" | "tar" | "zip";

type Tool = {
  name: string;
  outputName: string;
  url: string;
  archiveType: ArchiveType;
};

const repoRoot = getRepoRoot();
const binDir = path.join(repoRoot, "app/downloader/bin");
const force = process.argv.includes("--force");

const tools: Tool[] = [
  {
    name: "yt-dlp",
    outputName: process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
    url: getYtDlpUrl(),
    archiveType: "file",
  },
  {
    name: "ffmpeg",
    outputName: process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
    url: getFfmpegUrl(),
    archiveType: process.platform === "win32" ? "zip" : "tar",
  },
];

await mkdir(binDir, { recursive: true });

for (const tool of tools) {
  await installTool(tool);
}

function getYtDlpUrl(): string {
  if (process.platform === "darwin") {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
  }

  if (process.platform === "linux") {
    return arch() === "arm64"
      ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"
      : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
  }

  if (process.platform === "win32") {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
  }

  throw new Error(`Unsupported platform for yt-dlp: ${process.platform}`);
}

function getFfmpegUrl(): string {
  if (process.platform === "darwin") {
    const target = arch() === "arm64" ? "macosarm64" : "macos64";
    return `https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-${target}-gpl.tar.xz`;
  }

  if (process.platform === "linux") {
    const target = arch() === "arm64" ? "linuxarm64" : "linux64";
    return `https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-${target}-gpl.tar.xz`;
  }

  if (process.platform === "win32") {
    return "https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip";
  }

  throw new Error(`Unsupported platform for bundled ffmpeg: ${process.platform}`);
}

async function installTool(tool: Tool): Promise<void> {
  const outputPath = path.join(binDir, tool.outputName);

  if (!force && (await exists(outputPath))) {
    await chmodExecutable(outputPath);
    console.log(`${tool.name}: already installed`);
    return;
  }

  const tempPath = path.join(tmpdir(), `${tool.name}-${process.pid}-${Date.now()}`);
  const downloadPath = getDownloadPath(tempPath, tool.archiveType);

  console.log(`${tool.name}: downloading`);
  await download(tool.url, downloadPath);

  if (tool.archiveType === "tar") {
    await extractExecutableFromArchive("tar", downloadPath, tool.outputName, outputPath);
  } else if (tool.archiveType === "zip") {
    await extractExecutableFromArchive("zip", downloadPath, tool.outputName, outputPath);
  } else {
    await copyFile(downloadPath, outputPath);
  }

  await rm(downloadPath, { force: true });
  await chmodExecutable(outputPath);
  console.log(`${tool.name}: installed to ${path.relative(repoRoot, outputPath)}`);
}

function getDownloadPath(tempPath: string, archiveType: ArchiveType): string {
  if (archiveType === "tar") {
    return `${tempPath}.tar.xz`;
  }

  if (archiveType === "zip") {
    return `${tempPath}.zip`;
  }

  return tempPath;
}

async function download(
  url: string,
  destination: string,
  redirects = 0,
  attempts = 0,
): Promise<void> {
  if (redirects > 5) {
    throw new Error(`Too many redirects while downloading ${url}`);
  }

  await new Promise<void>((resolve, reject) => {
    const request = get(url, { headers: { "User-Agent": "yt-dlp-app-installer" } }, (response) => {
      const location = response.headers.location;

      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        location
      ) {
        response.resume();
        const nextUrl = new URL(location, url).toString();
        download(nextUrl, destination, redirects + 1, attempts).then(resolve, reject);
        return;
      }

      if (response.statusCode && response.statusCode >= 500 && attempts < 2) {
        response.resume();
        delay(1000 * (attempts + 1))
          .then(() => download(url, destination, redirects, attempts + 1))
          .then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed (${response.statusCode}) for ${url}`));
        return;
      }

      const file = createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => {
        file.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

async function extractExecutableFromArchive(
  archiveType: Exclude<ArchiveType, "file">,
  archivePath: string,
  executableName: string,
  outputPath: string,
): Promise<void> {
  const extractDir = path.join(tmpdir(), `extract-${path.basename(archivePath)}`);

  await rm(extractDir, { recursive: true, force: true });
  await mkdir(extractDir, { recursive: true });

  try {
    if (archiveType === "tar") {
      await execFileAsync("tar", ["-xf", archivePath, "-C", extractDir]);
    } else {
      await execFileAsync("unzip", ["-q", archivePath, "-d", extractDir]);
    }

    const executablePath = await findFile(extractDir, executableName);

    if (!executablePath) {
      throw new Error(`Could not find ${executableName} inside ${archivePath}`);
    }

    await copyFile(executablePath, outputPath);
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

async function findFile(directory: string, fileName: string): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }

    if (entry.isDirectory()) {
      const found = await findFile(entryPath, fileName);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

async function chmodExecutable(filePath: string): Promise<void> {
  if (process.platform !== "win32") {
    await chmod(filePath, 0o755);
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function getRepoRoot(): string {
  const cwd = process.cwd();

  if (path.basename(cwd) === "downloader" && path.basename(path.dirname(cwd)) === "app") {
    return path.resolve(cwd, "../..");
  }

  return cwd;
}
