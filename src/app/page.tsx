import Link from "next/link";

export default function LandingPage() {
  return (
    <main
      className="container"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 760,
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        <div
          className="cardInner"
          style={{
            padding: 34,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 560,
              letterSpacing: "0.06em",
              color: "var(--text)",
            }}
          >
            Brandwithyou
          </div>

          <div
            className="p"
            style={{
              fontSize: 15,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(29,27,24,0.58)",
            }}
          >
            brings you Luxe Atelier
          </div>

          <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 6 }}>
            <Link className="btn" href="/login">
              Login
            </Link>
            <Link className="btn btnPrimary" href="/signup">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
