import Link from "next/link";

export default function PendingPage() {
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
          maxWidth: 820,
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
            gap: 16,
          }}
        >

          <div
            style={{
              fontSize: 30,
              fontWeight: 560,
              letterSpacing: "0.05em",
              color: "var(--text)",
            }}
          >
            Welcome to Luxe Atelier
          </div>

          <p
            className="p"
            style={{
              maxWidth: 620,
              fontSize: 16,
              lineHeight: 1.7,
              color: "rgba(29,27,24,0.70)",
            }}
          >
            Your account has been successfully created and is awaiting approval from our professional curators. 
            Once approved, you will receive full access to the atelier and the ability to trade. 
            Thank you for your patience - the exceptional awaits.
          </p>

          <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 4 }}>
            <Link className="btn" href="/login">
              Back to login
            </Link>
            <Link className="btn" href="/">
              Back to landing
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
