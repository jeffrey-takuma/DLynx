import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDownloadPlan } from "./download-service.js";

const originalPlatform = process.platform;

describe("createDownloadPlan", () => {
  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
  });

  it("creates cwd and outputDir from repoRoot", () => {
    // 計画: downloader の作業場所と保存先 path を repoRoot 配下に置く
    const repoRoot = path.join("tmp", "dlynx");

    const plan = createDownloadPlan(
      { url: "https://example.com/video" },
      repoRoot,
    );

    expect(plan.cwd).toBe(path.join(repoRoot, "app/downloader"));
    expect(plan.outputDir).toBe(path.join(repoRoot, "media"));
  });

  it("creates argv consumed by yt_dlp_api parse_args", () => {
    // 計画: Python 側 parse_args() が読む downloader 起動引数を組み立てる
    const repoRoot = path.join("tmp", "dlynx");
    const url = "https://example.com/video";
    const outputDir = path.join(repoRoot, "media");
    const ffmpegLocation = path.join(repoRoot, "app/downloader", "bin");

    const plan = createDownloadPlan({ url }, repoRoot);

    expect(plan.argv).toEqual([
      url,
      "--output-dir",
      outputDir,
      "--ffmpeg-location",
      ffmpegLocation,
    ]);
  });

  it("uses the downloader executable path for non-Windows platforms", () => {
    // 計画: Windows 以外では拡張子なしの downloader 実行ファイルを参照する
    Object.defineProperty(process, "platform", {
      value: "darwin",
    });
    const repoRoot = path.join("tmp", "dlynx");

    const plan = createDownloadPlan(
      { url: "https://example.com/video" },
      repoRoot,
    );

    expect(plan.executablePath).toBe(
      path.join(
        repoRoot,
        "app/downloader",
        "dist",
        "dlynx-downloader",
        "dlynx-downloader",
      ),
    );
  });

  it("uses the downloader exe path for Windows", () => {
    // 計画: Windows では .exe 付きの downloader 実行ファイルを参照する
    Object.defineProperty(process, "platform", {
      value: "win32",
    });
    const repoRoot = path.join("tmp", "dlynx");

    const plan = createDownloadPlan(
      { url: "https://example.com/video" },
      repoRoot,
    );

    expect(plan.executablePath).toBe(
      path.join(
        repoRoot,
        "app/downloader",
        "dist",
        "dlynx-downloader",
        "dlynx-downloader.exe",
      ),
    );
  });
});
