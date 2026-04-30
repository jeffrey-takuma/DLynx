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
  historyItem?: HistoryItem;
  id: number;
  url: string;
};

type DownloadErrorEvent = {
  id: number;
  message: string;
};

type HistoryItem = {
  _id: string;
  title: string;
  url: string;
  filePath: string;
  savedAt: string;
};

declare global {
  interface Window {
    electronApp: {
      ping(): Promise<unknown>;
      getHistory(): Promise<HistoryItem[]>;
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
