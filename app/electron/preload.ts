import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronApp", {
  ping() {
    return ipcRenderer.invoke("app:ping");
  },
});
