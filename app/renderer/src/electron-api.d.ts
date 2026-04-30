type DownloadRequest = {
  url: string;
};

type StartedDownloadResponse = {
  id: number;
  pid?: number;
  outputDir: string;
};

type DownloadProgressEvent = {
  id: number;
  percent: number;
};

type DownloadCompleteEvent = {
  filename?: string;
  id: number;
  url: string;
};

type DownloadErrorEvent = {
  id: number;
  message: string;
};

declare global {
  interface Window {
    electronApp: {
      ping(): Promise<unknown>;
      startDownload(request: DownloadRequest): Promise<StartedDownloadResponse>;
      onDownloadProgress(
        callback: (event: DownloadProgressEvent) => void,
      ): () => void;
      onDownloadComplete(
        callback: (event: DownloadCompleteEvent) => void,
      ): () => void;
      onDownloadError(
        callback: (event: DownloadErrorEvent) => void,
      ): () => void;
    };
  }
}

export {};
