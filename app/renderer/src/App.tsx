import { useState } from "react";

export default function App() {
  const [url, setUrl] = useState("");

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Downloader API</p>
        <h1>Video URL</h1>

        <label className="field" htmlFor="download-url">
          <span className="field-label">Type URL here</span>
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

        <div className="status-row">
          <span className="status ok">
            {url ? "Ready to send to backend" : "URL is empty"}
          </span>
        </div>

        <pre className="payload-preview">{JSON.stringify({ url }, null, 2)}</pre>
      </section>
    </main>
  );
}
