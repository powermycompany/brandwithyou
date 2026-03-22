"use client";

import { useEffect, useMemo, useState } from "react";
import { requestAccountDeletion, cancelAccountDeletion } from "@/server/actions/deleteAccount";

type Props = {
  // ISO string if already scheduled; null/undefined otherwise
  scheduledExecuteAfter?: string | null;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function DeleteAccountButton({ scheduledExecuteAfter }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isScheduled = !!scheduledExecuteAfter;

  const canConfirm = useMemo(() => confirmText.trim().toUpperCase() === "DELETE", [confirmText]);

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  async function onRequest() {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("confirm", confirmText);
      await requestAccountDeletion(fd);
      setOpen(false);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function onCancelScheduled() {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      await cancelAccountDeletion(fd);
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
            <p className="p">
              Account deletion is scheduled for <b>30 days</b> after confirmation. You can cancel anytime before the deletion date.
            </p>
            {isScheduled ? (
              <p className="p">
                Scheduled deletion date: <b>{fmtDate(scheduledExecuteAfter)}</b>
              </p>
            ) : null}
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            {isScheduled ? (
              <button className="btn" type="button" disabled={busy} onClick={onCancelScheduled}>
                Cancel deletion
              </button>
            ) : (
              <button
                className="btn"
                type="button"
                onClick={() => setOpen(true)}
                style={{
                  borderColor: "rgba(255, 80, 80, 0.35)",
                  background: "rgba(255, 80, 80, 0.10)",
                }}
              >
                Schedule deletion
              </button>
            )}
          </div>
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

        {/* Modal */}
        {open ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: "rgba(0,0,0,0.78)", // NOT transparent
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
            }}
            onMouseDown={(e) => {
              // close when clicking the backdrop
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="card"
              style={{
                width: "min(780px, 100%)",
              }}
            >
              <div className="cardInner">
                <div style={{ fontWeight: 700, fontSize: 22 }}>Confirm account deletion</div>
                <div className="spacer" style={{ height: 8 }} />
                <p className="p">
                  This schedules your account for deletion in <b>30 days</b>. During those 30 days you can cancel the deletion at any time from this page.
                  After the deletion date, your account and related data will be permanently removed.
                </p>

                <div className="spacer" />

                <label className="p">Type <span className="kbd">DELETE</span> to confirm</label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  className="input"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
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
                    type="button"
                    disabled={!canConfirm || busy}
                    onClick={onRequest}
                    style={{
                      borderColor: "rgba(255, 80, 80, 0.45)",
                      background: canConfirm ? "rgba(255, 80, 80, 0.18)" : "rgba(255, 80, 80, 0.10)",
                    }}
                  >
                    {busy ? "Scheduling…" : "Confirm delete (30 days)"}
                  </button>
                </div>

                <div className="spacer" />
                <p className="p">Tip: If you change your mind, you can cancel before the deletion date.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
