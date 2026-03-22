import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container">
      <div className="card">
        <div className="cardInner">
          <div className="badge">
            <span>Brandwithyou</span>
            <span className="kbd">404</span>
          </div>
          <div className="spacer" />
          <h1 className="h1">Page not found</h1>
          <p className="p">This page does not exist.</p>
          <div className="spacer" />
          <div className="row">
            <Link className="btn btnPrimary" href="/">Go to landing</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
