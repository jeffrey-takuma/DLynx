export type DownloadRequest = {
  url: string;
};

export type ProgressSnapshot = {
  phase: number;
  rawProgress: number;
};

export type MappedProgress = ProgressSnapshot & {
  progress: number;
};

export function createDownloadRequest(urlInput: string): DownloadRequest {
  const url = urlInput.trim();

  if (!url) {
    throw new Error("URL is required.");
  }

  if (!isHttpUrl(url)) {
    throw new Error("URL must start with http:// or https://.");
  }

  return { url };
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function mapDownloadProgress(
  snapshot: ProgressSnapshot,
  rawPercent: number,
): MappedProgress {
  const nextPhase =
    rawPercent < snapshot.rawProgress - 20
      ? Math.min(snapshot.phase + 1, 1)
      : snapshot.phase;
  const phaseOffset = nextPhase * 50;
  const mappedProgress = phaseOffset + rawPercent * 0.5;

  return {
    phase: nextPhase,
    rawProgress: rawPercent,
    progress: Math.min(Math.round(mappedProgress), 99),
  };
}
