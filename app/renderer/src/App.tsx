import { type FormEvent, useState } from "react";

type DownloadStatus = "done" | "downloading" | "failed";

type DownloadRequest = {
  url: string;
};

type HistoryItem = {
  id: number;
  title: string;
  url: string;
  status: DownloadStatus;
  progress: number;
  savedAt: string;
};

const currentDownload = {
  title: "Sample video download",
  status: "Waiting for backend connection",
  progress: 42,
};

const historyItems: HistoryItem[] = [
  {
    id: 1,
    title: "Building a quiet desktop downloader",
    url: "https://www.youtube.com/watch?v=demo-1",
    status: "done",
    progress: 100,
    savedAt: "2026-04-27 01:42",
  },
  {
    id: 2,
    title: "FFmpeg packaging notes",
    url: "https://www.youtube.com/watch?v=demo-2",
    status: "downloading",
    progress: 64,
    savedAt: "2026-04-27 02:10",
  },
  {
    id: 3,
    title: "Playlist export trial",
    url: "https://www.youtube.com/watch?v=demo-3",
    status: "failed",
    progress: 0,
    savedAt: "2026-04-26 23:58",
  },
];

function createDownloadRequest(urlInput: string): DownloadRequest {
  const url = urlInput.trim();

  if (!url) {
    throw new Error("URL is required.");
  }

  if (!isHttpUrl(url)) {
    throw new Error("URL must start with http:// or https://.");
  }

  return { url };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function App() {
  const [url, setUrl] = useState("");
  const [requestPreview, setRequestPreview] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsStarting(true);
      const request = createDownloadRequest(url);
      const started = await window.electronApp.startDownload(request);
      setRequestPreview(JSON.stringify({ request, started }, null, 2));
      setErrorMessage("");
    } catch (error) {
      setRequestPreview("");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="app-title">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">yt-dlp desktop</p>
            <h1 id="app-title">Downloader</h1>
          </div>
          <span className="connection-status">Local tools ready</span>
        </header>

        <section className="download-panel" aria-labelledby="download-title">
          <div className="section-heading">
            <div>
              <h2 id="download-title">New download</h2>
              <p>Paste a URL and start a local yt-dlp job.</p>
            </div>
            <span className="progress-value">{currentDownload.progress}%</span>
          </div>

          <form className="download-form" onSubmit={handleSubmit}>
            <label className="field" htmlFor="download-url">
              <span className="field-label">Video URL</span>
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
              disabled={!url.trim() || isStarting}
            >
              {isStarting ? "Starting..." : "Download"}
            </button>
          </form>

          {(errorMessage || requestPreview) && (
            <div className="request-feedback" aria-live="polite">
              {errorMessage ? (
                <p className="request-error">{errorMessage}</p>
              ) : (
                <pre className="request-preview">{requestPreview}</pre>
              )}
            </div>
          )}

          <div className="progress-block">
            <div className="progress-meta">
              <span>{currentDownload.title}</span>
              <span>{currentDownload.status}</span>
            </div>
            <progress
              className="progress-track"
              aria-label="Download progress"
              max="100"
              value={currentDownload.progress}
            />
          </div>
        </section>

        <section className="history-panel" aria-labelledby="history-title">
          <div className="section-heading">
            <div>
              <h2 id="history-title">History</h2>
              <p>SQLite-backed downloads will appear here.</p>
            </div>
            <span className="history-count">{historyItems.length} items</span>
          </div>

          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Status</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Saved</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="history-title">{item.title}</div>
                      <div className="history-url">{item.url}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>{item.progress}%</td>
                    <td>{item.savedAt}</td>
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
