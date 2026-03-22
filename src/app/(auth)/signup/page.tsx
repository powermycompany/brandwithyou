"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpWithProfile } from "@/features/auth";
import CountryPhoneFields from "@/components/forms/CountryPhoneFields";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    const form = new FormData(e.currentTarget);

    const selectedCountry = String(form.get("country") ?? "");
    const fullPhone = String(form.get("phone") ?? "");

    setCountry(selectedCountry);
    setPhone(fullPhone);

    const { error } = await signUpWithProfile({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      full_name: String(form.get("full_name") ?? ""),
      account_name: String(form.get("account_name") ?? ""),
      phone: fullPhone,
      country: selectedCountry,
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.push("/pending");
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
          maxWidth: 860,
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
              Create account
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
            <div className="row" style={{ gap: 14 }}>
              <div style={{ flex: "1 1 320px" }}>
                <label className="p" htmlFor="fullName">
                  Full name
                </label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  id="fullName"
                  className="input"
                  name="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  required
                  autoComplete="name"
                />
              </div>

              <div style={{ flex: "1 1 320px" }}>
                <label className="p" htmlFor="accountName">
                  Account name
                </label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  id="accountName"
                  className="input"
                  name="account_name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Displayed name"
                  required
                />
              </div>
            </div>

            <div className="spacer" />

            <CountryPhoneFields defaultCountry={country} defaultPhone={phone} />

            <div className="spacer" />

            <div className="row" style={{ gap: 14 }}>
              <div style={{ flex: "1 1 320px" }}>
                <label className="p" htmlFor="email">
                  Email
                </label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  id="email"
                  className="input"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div style={{ flex: "1 1 260px" }}>
                <label className="p" htmlFor="password">
                  Password
                </label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  id="password"
                  className="input"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
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
                  <span>Signup failed</span>
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
                style={{ minWidth: 170 }}
              >
                {busy ? "Creating…" : "Create account"}
              </button>

              <Link className="p" href="/login">
                Already a member? Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
