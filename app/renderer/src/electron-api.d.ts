type DownloadRequest = {
  url: string;
};

type StartedDownloadResponse = {
  id: number;
  pid?: number;
  outputDir: string;
};

declare global {
  interface Window {
    electronApp: {
      ping(): Promise<unknown>;
      startDownload(request: DownloadRequest): Promise<StartedDownloadResponse>;
    };
  }
}

export {};
