"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container">
      <div className="card">
        <div className="cardInner">
          <div className="badge">
            <span>System</span>
            <span className="kbd">Error</span>
          </div>

          <div className="spacer" />
          <h1 className="h1">Something went wrong</h1>
          <p className="p">{error?.message || "Unexpected error."}</p>

          <div className="spacer" />
          <div className="row">
            <button className="btn btnPrimary" onClick={() => reset()}>
              Try again
            </button>
            <a className="btn" href="/">
              Go to landing
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
