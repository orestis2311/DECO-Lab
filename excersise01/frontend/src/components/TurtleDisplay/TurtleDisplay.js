import React from "react";
import "./TurtleDisplay.css";

export default function TurtleDisplay({
  ttlText,             // string (empty -> black box only)
  loading = false,     // boolean (shows “Converting…”)
  downloadUrl,         // optional: blob URL for Download button
  downloadName = "output.ttl",
}) {
  const isEmpty = !ttlText;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(ttlText || "");
    } catch {}
  };

  return (
    <section className="td-card">
      {/* header */}
      <header className="td-card-header">
        <div className="td-title">
          {/* simple </> icon */}
          <svg viewBox="0 0 24 24" className="td-code-icon" aria-hidden="true">
            <path d="M8.2 16.6l-4.8-4.6 4.8-4.6 1.3 1.4-3.3 3.2 3.3 3.2-1.3 1.4zm7.6 0l-1.3-1.4 3.3-3.2-3.3-3.2 1.3-1.4 4.8 4.6-4.8 4.6zM14.3 4l1.6.5-6.2 16-1.6-.5L14.3 4z"/>
          </svg>
          <span>Generated Turtle File</span>
        </div>

        <div className="td-actions">
          <button
            className="td-btn td-secondary"
            onClick={copyToClipboard}
            disabled={isEmpty || loading}
            title="Copy to clipboard"
          >
            Copy
          </button>
          {downloadUrl ? (
            <a
              className="td-btn td-primary"
              href={downloadUrl}
              download={downloadName}
            >
              Download
            </a>
          ) : null}
        </div>
      </header>

      {/* black code area */}
      <div className={isEmpty ? "td-box td-empty" : "td-box"}>
        {loading ? (
          <div className="td-loading">Converting…</div>
        ) : isEmpty ? null : (
          <pre className="td-code" aria-label="Turtle output">{ttlText}</pre>
        )}
      </div>
    </section>
  );
}
