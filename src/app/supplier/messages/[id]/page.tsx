import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import ThreadComposer from "@/components/chat/ThreadComposer";

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachments?: { storage_path: string; mime_type: string | null }[] | null;
};

export default async function SupplierMessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: threadId } = await params;
  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: thread, error: tErr } = await supabase
    .from("chat_threads")
    .select(
      `
      id,reservation_id,product_id,customer_id,updated_at,
      product:products!chat_threads_product_id_fkey(product_name,reference_code),
      customer:profiles!chat_threads_customer_id_fkey(account_name,email)
    `.trim()
    )
    .eq("id", threadId)
    .maybeSingle();

  if (tErr) throw new Error(tErr.message);
  if (!thread) throw new Error("Thread not found");

  const { data: msgsRaw, error: mErr } = await supabase
    .from("chat_messages")
    .select(
      `
      id,sender_id,body,created_at,
      attachments:chat_message_attachments(storage_path,mime_type)
    `.trim()
    )
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (mErr) throw new Error(mErr.message);

  const msgs = (msgsRaw ?? []) as Msg[];

  await supabase.from("chat_thread_reads").upsert(
    { thread_id: threadId, user_id: uid, last_read_at: new Date().toISOString() },
    { onConflict: "thread_id,user_id" }
  );

  const signedByPath = new Map<string, string>();
  for (const m of msgs) {
    for (const a of m.attachments ?? []) {
      const p = a.storage_path;
      if (!p || signedByPath.has(p)) continue;
      const { data: s } = await supabase.storage.from("chat-attachments").createSignedUrl(p, 60 * 60);
      if (s?.signedUrl) signedByPath.set(p, s.signedUrl);
    }
  }

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 650, fontSize: 18 }}>
                {thread.product?.product_name ?? "Product"}
              </div>
              <div className="p">
                {thread.product?.reference_code ?? thread.product_id} · Customer:{" "}
                {thread.customer?.account_name ?? thread.customer_id}
                {thread.customer?.email ? ` · ${thread.customer.email}` : ""}
              </div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Link className="btn" href="/supplier/messages">Back</Link>
              <Link className="btn" href="/supplier/reservations">Reservations</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          {msgs.length === 0 ? (
            <p className="p">No messages yet.</p>
          ) : (
            <div className="row" style={{ flexDirection: "column", gap: 10 }}>
              {msgs.map((m) => {
                const mine = m.sender_id === uid;
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        maxWidth: 560,
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: mine
                          ? "1px solid rgba(111, 170, 44, 0.45)"
                          : "1px solid rgba(255,255,255,0.10)",
                        background: mine ? "#9FE04F" : "rgba(255,255,255,0.06)",
                        color: mine ? "#111111" : "inherit",
                        boxShadow: mine ? "0 8px 18px rgba(111, 170, 44, 0.18)" : "none",
                      }}
                    >
                      <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>

                      {(m.attachments ?? []).length ? (
                        <div className="spacer" style={{ height: 10 }} />
                      ) : null}

                      {(m.attachments ?? []).map((a, i) => {
                        const url = signedByPath.get(a.storage_path);
                        if (!url) return null;
                        return (
                          <img
                            key={`${m.id}-${i}`}
                            src={url}
                            alt="Attachment"
                            style={{
                              width: "100%",
                              maxWidth: 520,
                              borderRadius: 14,
                              border: "1px solid rgba(255,255,255,0.10)",
                              display: "block",
                            }}
                          />
                        );
                      })}

                      <div
                        className="p"
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          textAlign: mine ? "right" : "left",
                          color: mine ? "rgba(17,17,17,0.72)" : undefined,
                        }}
                      >
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ThreadComposer threadId={threadId} />
    </div>
  );
}
