import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const appName = "DLynx";
const historyDbPath = path.join(getUserDataDir(appName), "history.db");

await rm(historyDbPath, { force: true });

console.log(`Deleted ${historyDbPath}`);

function getUserDataDir(appName) {
  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Application Support", appName);
  }

  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"),
      appName,
    );
  }

  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config"),
    appName,
  );
}
