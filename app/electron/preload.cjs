const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronApp", {
  ping() {
    return ipcRenderer.invoke("app:ping");
  },
});
