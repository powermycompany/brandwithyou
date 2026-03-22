"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function extFromName(name: string) {
  const i = name.lastIndexOf(".");
  if (i === -1) return "bin";
  return name.slice(i + 1).toLowerCase().slice(0, 10);
}

export default function ThreadComposer({ threadId }: { threadId: string }) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendText() {
    const text = body.trim();
    if (!text) return;

    setBusy(true);
    setErr(null);

    try {
      const { data: me, error: meErr } = await supabase.auth.getUser();
      if (meErr) throw new Error(meErr.message);
      const uid = me.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const ins = await supabase.from("chat_messages").insert({
        thread_id: threadId,
        sender_id: uid,
        body: text,
      });

      if (ins.error) throw new Error(ins.error.message);

      setBody("");
      router.refresh();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    setErr(null);

    try {
      const { data: me, error: meErr } = await supabase.auth.getUser();
      if (meErr) throw new Error(meErr.message);
      const uid = me.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const path = `threads/${threadId}/${crypto.randomUUID()}.${extFromName(file.name)}`;

      const up = await supabase.storage.from("chat-attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

      if (up.error) throw new Error(up.error.message);

      // create message
      const { data: msgRow, error: msgErr } = await supabase
        .from("chat_messages")
        .insert({
          thread_id: threadId,
          sender_id: uid,
          body: "📷 Image",
        })
        .select("id")
        .maybeSingle();

      if (msgErr) throw new Error(msgErr.message);
      if (!msgRow) throw new Error("Message not created");

      // attach
      const att = await supabase.from("chat_message_attachments").insert({
        message_id: (msgRow as any).id,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size || null,
      });

      if (att.error) throw new Error(att.error.message);

      router.refresh();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="cardInner">
        <div className="row" style={{ alignItems: "flex-end", gap: 10 }}>
          <div style={{ flex: "1 1 auto" }}>
            <label className="p">Message</label>
            <div className="spacer" style={{ height: 6 }} />
            <textarea
              className="input"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a message…"
            />
          </div>

          <div className="row" style={{ gap: 10 }}>
            <label className="btn" style={{ cursor: busy ? "not-allowed" : "pointer" }}>
              Upload image
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (f) uploadImage(f);
                }}
              />
            </label>

            <button className="btn btnPrimary" type="button" disabled={busy || !body.trim()} onClick={sendText}>
              Send
            </button>
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

        <div className="spacer" />
        <p className="p">Images are stored in <b>chat-attachments</b> (private). Recommended ≤ 5 MB.</p>
      </div>
    </div>
  );
}
