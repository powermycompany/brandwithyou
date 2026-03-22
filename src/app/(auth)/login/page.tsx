"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithPassword } from "@/features/auth";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    const { error } = await signInWithPassword(email, password);

    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }

    const supabase = supabaseBrowser();
    const { data: u } = await supabase.auth.getUser();
    const id = u.user?.id;

    if (!id) {
      setBusy(false);
      router.push("/pending");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("status,role")
      .eq("id", id)
      .maybeSingle();

    setBusy(false);

    if (!profile || profile.status === "pending") {
      router.push("/pending");
      return;
    }

    if (profile.role === "admin") router.push("/admin/dashboard");
    else if (profile.role === "supplier") router.push("/supplier/dashboard");
    else router.push("/luxe-atelier");
  }

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
            gap: 18,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 560,
                letterSpacing: "0.05em",
                color: "var(--text)",
              }}
            >
              Welcome back
            </div>
            <div
              className="p"
              style={{
                marginTop: 8,
                fontSize: 14,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: "rgba(29,27,24,0.56)",
              }}
            >
              Brandwithyou · Luxe Atelier
            </div>
          </div>

          <form onSubmit={onSubmit}>
            <div className="row" style={{ flexDirection: "column", gap: 14 }}>
              <div>
                <label className="p" htmlFor="email">
                  Email
                </label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  id="email"
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="p" htmlFor="password">
                  Password
                </label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  id="password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="spacer" />

            {err ? (
              <>
                <div
                  className="badge"
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                  }}
                >
                  <span>Login failed</span>
                  <span className="kbd">{err}</span>
                </div>
                <div className="spacer" />
              </>
            ) : null}

            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <button
                className="btn btnPrimary"
                type="submit"
                disabled={busy}
                style={{ minWidth: 150 }}
              >
                {busy ? "Logging in…" : "Login"}
              </button>

              <Link className="p" href="/signup">
                Need an account? Create one
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
