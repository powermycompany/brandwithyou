import { supabaseServer } from "@/lib/supabase/server";
import { adminSetUserStatusRole, adminRevertToPending } from "@/server/actions/adminApproveUser";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  account_name: string | null;
  phone: string | null;
  country: string | null;
  status: "pending" | "active";
  role: "admin" | "supplier" | "customer" | null;
  created_at: string;
};

export default async function AdminUsersPage() {
  const supabase = await supabaseServer();

  const { data: me } = await supabase.auth.getUser();
  const meId = me.user?.id ?? null;

  const { data: pending } = await supabase
    .from("profiles")
    .select("id,email,full_name,account_name,phone,country,status,role,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: active } = await supabase
    .from("profiles")
    .select("id,email,full_name,account_name,phone,country,status,role,created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  const pendingRows = (pending ?? []) as ProfileRow[];
  const activeRows = (active ?? []) as ProfileRow[];

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <h1 className="h1">Users</h1>
          <p className="p">Approve pending users and assign roles. This controls access to the platform.</p>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div className="badge">
            <span>Pending approvals</span>
            <span className="kbd">{pendingRows.length}</span>
          </div>

          <div className="spacer" />

          {pendingRows.length === 0 ? (
            <p className="p">No pending users.</p>
          ) : (
            <div className="row" style={{ flexDirection: "column", gap: 10 }}>
              {pendingRows.map((u) => (
                <div key={u.id} className="card">
                  <div className="cardInner">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ maxWidth: 560 }}>
                        <div style={{ fontWeight: 600 }}>
                          {u.account_name || u.full_name || u.email || u.id}
                        </div>
                        <div className="p">
                          {u.email ? u.email : "—"} · {u.country ? u.country : "—"} · {u.phone ? u.phone : "—"}
                        </div>
                        <div className="p">status: {u.status} · role: {u.role ?? "—"}</div>
                      </div>

                      <form action={adminSetUserStatusRole} className="row" style={{ gap: 10, alignItems: "center" }}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="status" value="active" />

                        <select name="role" className="input" style={{ width: 220 }}>
                          <option value="customer">customer</option>
                          <option value="supplier">supplier</option>
                          <option value="admin">admin</option>
                        </select>

                        <button className="btn btnPrimary" type="submit">
                          Approve
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div className="badge">
            <span>Active users</span>
            <span className="kbd">{activeRows.length}</span>
          </div>

          <div className="spacer" />

          {activeRows.length === 0 ? (
            <p className="p">No active users found.</p>
          ) : (
            <div className="row" style={{ flexDirection: "column", gap: 10 }}>
              {activeRows.map((u) => {
                const canRevert = u.role !== "admin" && u.id !== meId;
                return (
                  <div key={u.id} className="card">
                    <div className="cardInner">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ maxWidth: 560 }}>
                          <div style={{ fontWeight: 600 }}>
                            {u.account_name || u.full_name || u.email || u.id}
                          </div>
                          <div className="p">
                            {u.email ? u.email : "—"} · {u.country ? u.country : "—"} · {u.phone ? u.phone : "—"}
                          </div>
                          <div className="p">status: {u.status} · role: {u.role ?? "—"}</div>
                        </div>

                        {canRevert ? (
                          <form action={adminRevertToPending} className="row" style={{ gap: 10, alignItems: "center" }}>
                            <input type="hidden" name="user_id" value={u.id} />
                            <button className="btn" type="submit">
                              Revert to pending
                            </button>
                          </form>
                        ) : (
                          <div className="badge">
                            <span>Protected</span>
                            <span className="kbd">{u.role === "admin" ? "admin" : "self"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
