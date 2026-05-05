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
  const mappedProgress = 16 + rawPercent * 0.82;

  return {
    phase: snapshot.phase,
    rawProgress: rawPercent,
    progress: Math.min(Math.round(mappedProgress), 99),
  };
}
