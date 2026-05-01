import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";

import { registerDownloadHandlers } from "./download-service.js";
import { listHistoryItems } from "./history-db.js";

app.setName("DLynx");

const repoRoot = path.resolve(__dirname, "../..");
const dockIconPath = path.resolve(
  repoRoot,
  "assets/AppIcon.iconset/icon_512x512@2x.png",
);

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const rendererEntry = path.resolve(__dirname, "../renderer/index.html");
  void win.loadFile(rendererEntry);
}

app.whenReady().then(() => {
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(dockIconPath);
  }

  ipcMain.handle("app:ping", () => {
    return { ok: true, source: "electron-main" };
  });

  ipcMain.handle("history:list", () => {
    return listHistoryItems();
  });

  registerDownloadHandlers({ repoRoot });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
