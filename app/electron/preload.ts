import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";

type DownloadRequest = {
  url: string;
};

type DownloadProgressEvent = {
  id: number;
  percent?: number;
  progress?: number;
  status?: string;
  title?: string;
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

contextBridge.exposeInMainWorld("electronApp", {
  ping() {
    return ipcRenderer.invoke("app:ping");
  },
  getHistory() {
    return ipcRenderer.invoke("history:list");
  },
  startDownload(request: DownloadRequest) {
    return ipcRenderer.invoke("download:start", request);
  },
  onDownloadProgress(callback: (event: DownloadProgressEvent) => void) {
    const listener = (_event: IpcRendererEvent, value: unknown) => {
      callback(value as DownloadProgressEvent);
    };

    ipcRenderer.on("download:progress", listener);
    return () => ipcRenderer.removeListener("download:progress", listener);
  },
  onDownloadComplete(callback: (event: DownloadCompleteEvent) => void) {
    const listener = (_event: IpcRendererEvent, value: unknown) => {
      callback(value as DownloadCompleteEvent);
    };

    ipcRenderer.on("download:complete", listener);
    return () => ipcRenderer.removeListener("download:complete", listener);
  },
  onDownloadError(callback: (event: DownloadErrorEvent) => void) {
    const listener = (_event: IpcRendererEvent, value: unknown) => {
      callback(value as DownloadErrorEvent);
    };

    ipcRenderer.on("download:error", listener);
    return () => ipcRenderer.removeListener("download:error", listener);
  },
});
