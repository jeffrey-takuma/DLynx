import { contextBridge, ipcRenderer } from "electron";

type DownloadRequest = {
  url: string;
};

contextBridge.exposeInMainWorld("electronApp", {
  ping() {
    return ipcRenderer.invoke("app:ping");
  },
  startDownload(request: DownloadRequest) {
    return ipcRenderer.invoke("download:start", request);
  },
});
