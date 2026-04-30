import { LoaderCircle, Menu, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import {
  createDownloadRequest,
  mapDownloadProgress,
} from "./download-utils.js";

type Theme = "dark" | "light";

type DownloadState = "done" | "downloading" | "failed" | "idle" | "preparing";

type CurrentDownload = {
  id: number | null;
  phase: number;
  rawProgress: number;
  title: string;
  status: string;
  progress: number;
  state: DownloadState;
  url: string;
};

type HistoryItem = {
  id: number;
  title: string;
  url: string;
  savedAt: string;
};

const emptyDownload: CurrentDownload = {
  id: null,
  phase: 0,
  rawProgress: 0,
  title: "No active download",
  status: "Waiting for URL",
  progress: 0,
  state: "idle",
  url: "",
};

export default function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isDownloadLocked, setIsDownloadLocked] = useState(false);
  const [currentDownload, setCurrentDownload] =
    useState<CurrentDownload>(emptyDownload);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const isDarkMode = theme === "dark";
  const isDownloadActive =
    currentDownload.state === "preparing" ||
    currentDownload.state === "downloading";
  const isDownloadDisabled =
    !url.trim() || isStarting || isDownloadLocked || isDownloadActive;

  useEffect(() => {
    let resetTimer: number | undefined;
    const removeProgress = window.electronApp.onDownloadProgress((event) => {
      setCurrentDownload((download) => {
        if (download.id !== event.id) {
          return download;
        }

        return {
          ...download,
          ...mapDownloadProgress(download, event.percent),
          state: "downloading",
          status: "Downloading",
          title: "Active download",
        };
      });
    });
    const removeComplete = window.electronApp.onDownloadComplete((event) => {
      setCurrentDownload((download) => {
        if (download.id !== event.id) {
          return download;
        }

        return {
          ...download,
          phase: 1,
          rawProgress: 100,
          progress: 100,
          state: "done",
          status: "Completed",
          title: "Download complete",
        };
      });
      setHistoryItems((items) =>
        [
          {
            id: event.id,
            title: event.filename ?? event.url,
            url: event.url,
            savedAt: formatSavedAt(new Date()),
          },
          ...items,
        ].slice(0, 10),
      );
      resetTimer = window.setTimeout(() => {
        setCurrentDownload(emptyDownload);
      }, 1200);
    });
    const removeError = window.electronApp.onDownloadError((event) => {
      setCurrentDownload((download) => {
        if (download.id !== event.id) {
          return download;
        }

        return {
          ...download,
          state: "failed",
          status: "Failed",
          title: "Download failed",
        };
      });
      setErrorMessage(event.message);
    });

    return () => {
      removeProgress();
      removeComplete();
      removeError();
      window.clearTimeout(resetTimer);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDownloadDisabled) {
      return;
    }

    setIsDownloadLocked(true);
    window.setTimeout(() => {
      setIsDownloadLocked(false);
    }, 3000);

    try {
      setIsStarting(true);
      const request = createDownloadRequest(url);
      setUrl("");
      setCurrentDownload({
        id: null,
        phase: 0,
        rawProgress: 0,
        title: "Preparing yt-dlp",
        status: "Starting local process",
        progress: 0,
        state: "preparing",
        url: request.url,
      });
      setErrorMessage("");
      const started = await window.electronApp.startDownload(request);
      setCurrentDownload((download) => ({
        ...download,
        id: started.id,
        title: "Active download",
        status: "Waiting for yt-dlp output",
        state: "downloading",
      }));
    } catch (error) {
      setCurrentDownload((download) => ({
        ...download,
        state: "failed",
        status: "Failed",
        title: "Download failed",
      }));
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main className={`app-shell ${theme}`}>
      <section className="workspace" aria-labelledby="app-title">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Download Manager</p>
            <h1 id="app-title">DLynx</h1>
          </div>
          <button
            className="menu-button"
            type="button"
            aria-label="Open settings"
            aria-expanded={isDrawerOpen}
            onClick={() => setIsDrawerOpen(true)}
          >
            <Menu size={20} strokeWidth={2.4} />
          </button>
        </header>

        <div
          className={`drawer-overlay ${isDrawerOpen ? "open" : ""}`}
          aria-hidden={!isDrawerOpen}
          onClick={() => setIsDrawerOpen(false)}
        />
        <aside
          className={`settings-drawer ${isDrawerOpen ? "open" : ""}`}
          aria-hidden={!isDrawerOpen}
          aria-labelledby="settings-title"
        >
          <div className="drawer-header">
            <div>
              <p className="eyebrow">Preferences</p>
              <h2 id="settings-title">Settings</h2>
            </div>
            <button
              className="drawer-close"
              type="button"
              aria-label="Close settings"
              onClick={() => setIsDrawerOpen(false)}
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>

          <div className="settings-group">
            <div className="settings-row">
              <div>
                <h3>Theme</h3>
                <p>Switch the interface appearance.</p>
              </div>
              <button
                className="theme-switch"
                type="button"
                role="switch"
                aria-checked={isDarkMode}
                aria-label="Toggle dark mode"
                onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              >
                <span className="theme-switch-track">
                  <span className="theme-switch-thumb" />
                </span>
                <span className="theme-switch-text">
                  {isDarkMode ? "Dark" : "Light"}
                </span>
              </button>
            </div>

            <div className="settings-row">
              <div>
                <h3>Tools</h3>
                <p>yt-dlp and FFmpeg are prepared locally.</p>
              </div>
              <span className="settings-badge">Ready</span>
            </div>
          </div>
        </aside>

        <section className="download-panel" aria-labelledby="download-title">
          <div className="section-heading">
            <div>
              <h2 id="download-title">Video URL</h2>
            </div>
            <span className="progress-value">{currentDownload.progress}%</span>
          </div>

          <form className="download-form" onSubmit={handleSubmit}>
            <label className="field" htmlFor="download-url">
              <span className="field-hint">Paste a URL and start.</span>
              <input
                id="download-url"
                name="download-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
            <button
              className="primary-action"
              type="submit"
              disabled={isDownloadDisabled}
            >
              {(isStarting || isDownloadLocked || isDownloadActive) && (
                <LoaderCircle
                  className="button-spinner"
                  size={16}
                  strokeWidth={2.4}
                />
              )}
              {isStarting || isDownloadLocked
                ? "Starting..."
                : isDownloadActive
                  ? "Downloading..."
                  : "Download"}
            </button>
          </form>

          {errorMessage && (
            <div className="request-feedback" aria-live="polite">
              <p className="request-error">{errorMessage}</p>
            </div>
          )}

          <div className="progress-block">
            <div className="progress-meta">
              <span>{currentDownload.title}</span>
              <span>{currentDownload.status}</span>
            </div>
            {currentDownload.url && (
              <div className="progress-url">{currentDownload.url}</div>
            )}
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Download progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={currentDownload.progress}
            >
              <div
                className="progress-fill"
                style={{
                  transform: `scaleX(${currentDownload.progress / 100})`,
                }}
              />
            </div>
          </div>
        </section>

        <section className="history-panel" aria-labelledby="history-title">
          <div className="section-heading">
            <div>
              <h2 id="history-title">History</h2>
            </div>
          </div>

          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th className="history-title-column" scope="col">
                    Title
                  </th>
                  <th className="history-saved" scope="col">
                    Saved
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={item.id}>
                    <td className="history-title-column">
                      <div className="history-title">{item.title}</div>
                      <div className="history-url">{item.url}</div>
                    </td>
                    <td className="history-saved">{item.savedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function formatSavedAt(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
