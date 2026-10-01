"use client";

/**
 * Catches the failure `app/error.tsx` cannot: an error thrown by the root
 * layout itself, which replaces the whole document. It has to render its own
 * <html> and <body> because nothing above it survived.
 *
 * Deliberately unstyled and dependency-free. If the root layout is broken the
 * stylesheet may be the reason, so this page assumes nothing is available
 * beyond the inline styles below.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            AIMBENCH could not start
          </h1>

          <p
            style={{
              marginTop: "1rem",
              color: "#a1a1aa",
              fontSize: "0.875rem",
              lineHeight: 1.6,
            }}
          >
            Something failed outside of any single page, so there is nothing to
            go back to. The failure has been logged.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              background: "#ffffff",
              color: "#000000",
              border: 0,
              borderRadius: "0.5rem",
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
