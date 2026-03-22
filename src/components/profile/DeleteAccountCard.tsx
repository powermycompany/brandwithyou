"use client";

import { useMemo, useState } from "react";
import { requestAccountDeletion } from "@/server/actions/requestAccountDeletion";
import { cancelAccountDeletion } from "@/server/actions/cancelAccountDeletion";

export default function DeleteAccountCard({
  scheduledExecuteAfter,
}: {
  scheduledExecuteAfter?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canConfirm = typed.trim() === "DELETE";

  const when = useMemo(() => {
    if (!scheduledExecuteAfter) return null;
    try {
      return new Date(scheduledExecuteAfter).toLocaleDateString();
    } catch {
      return scheduledExecuteAfter;
    }
  }, [scheduledExecuteAfter]);

  async function onCancelRequest() {
    setErr(null);
    setBusy(true);
    try {
      await cancelAccountDeletion();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="cardInner">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 650, fontSize: 18 }}>Delete account</div>
            <p className="p">Account deletion is scheduled for <b>30 days</b> after confirmation.</p>
            {when ? <p className="p">Scheduled deletion date: <b>{when}</b></p> : null}
          </div>

          {when ? (
            <button className="btn" type="button" disabled={busy} onClick={onCancelRequest}>
              Cancel deletion request
            </button>
          ) : (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setErr(null);
                setTyped("");
                setOpen(true);
              }}
              style={{
                borderColor: "rgba(255,80,80,0.45)",
                background: "rgba(255,80,80,0.10)",
              }}
            >
              Request deletion
            </button>
          )}
        </div>

        {err ? (
          <>
            <div className="spacer" />
            <div className="badge">
              <span>Error</span>
              <span className="kbd">{err}</span>
            </div>
          </>
        ) : null}

        {open ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: "rgba(0,0,0,0.85)", // ✅ non-transparent overlay
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
            }}
            onClick={() => setOpen(false)}
          >
            <div
              className="card"
              style={{ width: "min(720px, 100%)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cardInner">
                <div style={{ fontWeight: 700, fontSize: 22 }}>Confirm account deletion</div>
                <div className="spacer" style={{ height: 6 }} />
                <p className="p">
                  This schedules deletion in <b>30 days</b>. During the waiting period, you can cancel the request.
                  <br />
                  To confirm, type <span className="kbd">DELETE</span> below.
                </p>

                <div className="spacer" />

                <form
                  action={requestAccountDeletion}
                  onSubmit={() => {
                    setErr(null);
                    setBusy(true);
                  }}
                >
                  <input type="hidden" name="confirm" value={typed} />
                  <input
                    className="input"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    autoFocus
                  />

                  <div className="spacer" />

                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <button className="btn" type="button" onClick={() => setOpen(false)} disabled={busy}>
                      Cancel
                    </button>
                    <button
                      className="btn"
                      type="submit"
                      disabled={!canConfirm || busy}
                      style={{
                        borderColor: "rgba(255,80,80,0.55)",
                        background: "rgba(255,80,80,0.22)",
                      }}
                    >
                      Confirm delete (in 30 days)
                    </button>
                  </div>

                  <div className="spacer" />

                  <p className="p">
                    Tip: If the service role key isn’t set, deletion execution will fail safely.
                  </p>
                </form>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
