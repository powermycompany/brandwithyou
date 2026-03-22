import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  account_name: string | null;
  email: string | null;
  country: string | null;
  status: string | null;
  role: string | null;
  created_at: string | null;
};

type ProductRow = {
  id: string;
  supplier_id: string;
  status: string | null;
  quantity_available: number | null;
  created_at: string | null;
};

type ReservationRow = {
  id: string;
  supplier_id: string;
  status: string | null;
  quantity: number | null;
  created_at: string | null;
  completed_at: string | null;
};

function safeText(v: unknown) {
  return String(v ?? "").trim();
}

function qtyOr1(n: unknown) {
  const v = Number(n ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function d(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function riskBadgeStyles(risk: "low" | "medium" | "high") {
  if (risk === "high") {
    return {
      background: "rgba(120, 32, 32, 0.10)",
      border: "1px solid rgba(120, 32, 32, 0.18)",
    };
  }
  if (risk === "medium") {
    return {
      background: "rgba(139, 106, 26, 0.10)",
      border: "1px solid rgba(139, 106, 26, 0.18)",
    };
  }
  return {
    background: "rgba(33, 91, 55, 0.10)",
    border: "1px solid rgba(33, 91, 55, 0.18)",
  };
}

type ChecklistItem = {
  label: string;
  passed: boolean;
  note?: string;
};

type SupplierAuditView = {
  supplier_id: string;
  name: string;
  email: string;
  country: string;
  status: string;
  cadence: "monthly" | "half_yearly";
  due_at: Date;
  due_label: string;
  audit_status: "due_now" | "follow_up_required" | "healthy";
  risk: "low" | "medium" | "high";
  checklist: ChecklistItem[];
  passed_count: number;
  total_count: number;
  listed_products: number;
  available_units: number;
  requested_units: number;
  confirmed_units: number;
  completed_units: number;
  cancelled_units: number;
  completion_rate: number;
  cancellation_rate: number;
  recent_activity_at: string | null;
};

export default async function AdminAuditLogsPage() {
  const supabase = await supabaseServer();

  const [profilesRes, productsRes, reservationsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,account_name,email,country,status,role,created_at")
      .eq("role", "supplier")
      .order("created_at", { ascending: false }),

    supabase
      .from("products")
      .select("id,supplier_id,status,quantity_available,created_at"),

    supabase
      .from("reservations")
      .select("id,supplier_id,status,quantity,created_at,completed_at")
      .order("created_at", { ascending: false }),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (reservationsRes.error) throw new Error(reservationsRes.error.message);

  const suppliers = (profilesRes.data ?? []) as ProfileRow[];
  const products = (productsRes.data ?? []) as ProductRow[];
  const reservations = (reservationsRes.data ?? []) as ReservationRow[];

  const now = new Date();

  const audits: SupplierAuditView[] = suppliers.map((s) => {
    const supplierProducts = products.filter((p) => String(p.supplier_id) === String(s.id));
    const supplierReservations = reservations.filter((r) => String(r.supplier_id) === String(s.id));

    const listedProducts = supplierProducts.filter((p) => safeText(p.status) === "published").length;
    const availableUnits = supplierProducts.reduce(
      (sum, p) => sum + Math.max(0, Number(p.quantity_available ?? 0)),
      0
    );

    let requestedUnits = 0;
    let confirmedUnits = 0;
    let completedUnits = 0;
    let cancelledUnits = 0;

    let lastActivity: string | null = null;

    for (const r of supplierReservations) {
      const qty = qtyOr1(r.quantity);
      const status = safeText(r.status);

      if (status === "requested") requestedUnits += qty;
      if (status === "confirmed") confirmedUnits += qty;
      if (status === "completed") completedUnits += qty;
      if (status === "cancelled") cancelledUnits += qty;

      const activityAt = safeText(r.completed_at) || safeText(r.created_at);
      if (activityAt && (!lastActivity || activityAt > lastActivity)) {
        lastActivity = activityAt;
      }
    }

    const resolvedUnits = completedUnits + cancelledUnits;
    const completionRate = resolvedUnits > 0 ? Math.round((completedUnits / resolvedUnits) * 100) : 0;
    const cancellationRate = resolvedUnits > 0 ? Math.round((cancelledUnits / resolvedUnits) * 100) : 0;

    const createdAt = s.created_at ? new Date(s.created_at) : now;
    const cadence: "monthly" | "half_yearly" =
      safeText(s.status) !== "active" || cancellationRate >= 35 || listedProducts <= 2
        ? "monthly"
        : "half_yearly";

    const dueAt = cadence === "monthly" ? addMonths(createdAt, 1) : addMonths(createdAt, 6);

    while (dueAt < now) {
      dueAt.setMonth(dueAt.getMonth() + (cadence === "monthly" ? 1 : 6));
    }

    const daysUntilDue = daysBetween(dueAt, now);

    const checklist: ChecklistItem[] = [
      {
        label: "Account is active",
        passed: safeText(s.status) === "active",
        note: safeText(s.status) || "Missing status",
      },
      {
        label: "Business name is filled",
        passed: !!safeText(s.account_name),
        note: safeText(s.account_name) || "Missing account name",
      },
      {
        label: "Email is present",
        passed: !!safeText(s.email),
        note: safeText(s.email) || "Missing email",
      },
      {
        label: "Supplier country is recorded",
        passed: !!safeText(s.country),
        note: safeText(s.country) || "Missing country",
      },
      {
        label: "Has listed products",
        passed: listedProducts > 0,
        note: `${listedProducts} listed`,
      },
      {
        label: "Has stock available",
        passed: availableUnits > 0,
        note: `${availableUnits} available units`,
      },
      {
        label: "Completion rate is acceptable",
        passed: completionRate >= 70 || resolvedUnits === 0,
        note: `${completionRate}%`,
      },
      {
        label: "Cancellation rate is acceptable",
        passed: cancellationRate <= 30 || resolvedUnits === 0,
        note: `${cancellationRate}%`,
      },
      {
        label: "Recent activity exists",
        passed: !!lastActivity,
        note: lastActivity ? d(lastActivity) : "No reservation activity",
      },
    ];

    const passedCount = checklist.filter((x) => x.passed).length;
    const failedCount = checklist.length - passedCount;

    let risk: "low" | "medium" | "high" = "low";
    if (failedCount >= 4 || safeText(s.status) !== "active" || cancellationRate >= 40) {
      risk = "high";
    } else if (failedCount >= 2 || cancellationRate >= 25 || listedProducts === 0) {
      risk = "medium";
    }

    let auditStatus: "due_now" | "follow_up_required" | "healthy" = "healthy";
    if (risk === "high" || failedCount >= 3) {
      auditStatus = "follow_up_required";
    } else if (daysUntilDue <= 30) {
      auditStatus = "due_now";
    }

    return {
      supplier_id: s.id,
      name: safeText(s.account_name) || safeText(s.email) || s.id,
      email: safeText(s.email) || "—",
      country: safeText(s.country) || "—",
      status: auditStatus === "due_now"
        ? "Due now"
        : auditStatus === "follow_up_required"
        ? "Follow-up required"
        : "Healthy",
      cadence,
      due_at: dueAt,
      due_label: d(dueAt.toISOString()),
      audit_status: auditStatus,
      risk,
      checklist,
      passed_count: passedCount,
      total_count: checklist.length,
      listed_products: listedProducts,
      available_units: availableUnits,
      requested_units: requestedUnits,
      confirmed_units: confirmedUnits,
      completed_units: completedUnits,
      cancelled_units: cancelledUnits,
      completion_rate: completionRate,
      cancellation_rate: cancellationRate,
      recent_activity_at: lastActivity,
    };
  });

  const dueNow = audits
    .filter((a) => a.audit_status === "due_now")
    .sort((a, b) => a.due_at.getTime() - b.due_at.getTime());

  const followUp = audits
    .filter((a) => a.audit_status === "follow_up_required")
    .sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      return riskOrder[a.risk] - riskOrder[b.risk] || a.name.localeCompare(b.name);
    });

  const healthy = audits
    .filter((a) => a.audit_status === "healthy")
    .sort((a, b) => a.due_at.getTime() - b.due_at.getTime());

  const monthlyCadence = audits.filter((a) => a.cadence === "monthly").length;
  const halfYearlyCadence = audits.filter((a) => a.cadence === "half_yearly").length;
  const highRisk = audits.filter((a) => a.risk === "high").length;
  const mediumRisk = audits.filter((a) => a.risk === "medium").length;
  const lowRisk = audits.filter((a) => a.risk === "low").length;

  function renderAuditCard(a: SupplierAuditView) {
    return (
      <details
        key={a.supplier_id}
        className="card"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.66) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(29,27,24,0.07)",
        }}
      >
        <summary
          style={{
            listStyle: "none",
            cursor: "pointer",
            padding: 18,
          }}
        >
          <div
            className="row"
            style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}
          >
            <div style={{ minWidth: 260, flex: "1 1 auto" }}>
              <div style={{ fontWeight: 650, fontSize: 18 }}>{a.name}</div>
              <div className="p">
                {a.email} · {a.country}
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div className="badge">
                <span>Status</span>
                <span className="kbd">{a.status}</span>
              </div>

              <div className="badge" style={riskBadgeStyles(a.risk)}>
                <span>Risk</span>
                <span className="kbd">{a.risk}</span>
              </div>

              <div className="badge">
                <span>Checklist</span>
                <span className="kbd">
                  {a.passed_count}/{a.total_count} passed
                </span>
              </div>
            </div>
          </div>
        </summary>

        <div className="cardInner" style={{ paddingTop: 0 }}>
          <div className="p">
            Audit cadence: {a.cadence === "monthly" ? "Monthly" : "Half-yearly"} · Due: {a.due_label}
          </div>
          <div className="p">
            Recent activity: {a.recent_activity_at ? d(a.recent_activity_at) : "—"}
          </div>

          <div className="spacer" style={{ height: 10 }} />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <div className="badge">
              <span>Listed products</span>
              <span className="kbd">{a.listed_products}</span>
            </div>
            <div className="badge">
              <span>Available units</span>
              <span className="kbd">{a.available_units}</span>
            </div>
            <div className="badge">
              <span>Requested</span>
              <span className="kbd">{a.requested_units}</span>
            </div>
            <div className="badge">
              <span>Confirmed</span>
              <span className="kbd">{a.confirmed_units}</span>
            </div>
            <div className="badge">
              <span>Completed</span>
              <span className="kbd">{a.completed_units}</span>
            </div>
            <div className="badge">
              <span>Cancelled</span>
              <span className="kbd">{a.cancelled_units}</span>
            </div>
            <div className="badge">
              <span>Completion rate</span>
              <span className="kbd">{a.completion_rate}%</span>
            </div>
            <div className="badge">
              <span>Cancellation rate</span>
              <span className="kbd">{a.cancellation_rate}%</span>
            </div>
          </div>

          <div className="spacer" style={{ height: 12 }} />

          <div
            className="card"
            style={{
              background: "rgba(255,255,255,0.58)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
            }}
          >
            <div className="cardInner" style={{ padding: 14 }}>
              <div style={{ fontWeight: 650, marginBottom: 8 }}>Checklist</div>

              <div className="row" style={{ flexDirection: "column", gap: 8 }}>
                {a.checklist.map((item, idx) => (
                  <div
                    key={`${a.supplier_id}-${idx}`}
                    className="row"
                    style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ fontWeight: 550 }}>{item.label}</div>
                      {item.note ? <div className="p">{item.note}</div> : null}
                    </div>

                    <div className="badge">
                      <span>Check</span>
                      <span className="kbd">{item.passed ? "Pass" : "Review"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="spacer" style={{ height: 12 }} />

          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="p">
              This is a live control view based on current supplier, product, and reservation data.
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <Link className="btn" href="/admin/suppliers">
                Open suppliers
              </Link>
            </div>
          </div>
        </div>
      </details>
    );
  }

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <h1 className="h1">Supplier Audits</h1>
          <p className="p">
            Review suppliers through a recurring control framework with checklist-based monitoring, risk visibility, and
            follow-up identification. Healthy, due-now, and follow-up states are currently auto-generated from live supplier,
            product, and reservation data.
          </p>
        </div>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <div className="badge">
          <span>Total suppliers</span>
          <span className="kbd">{audits.length}</span>
        </div>
        <div className="badge">
          <span>Due now</span>
          <span className="kbd">{dueNow.length}</span>
        </div>
        <div className="badge">
          <span>Follow-up required</span>
          <span className="kbd">{followUp.length}</span>
        </div>
        <div className="badge">
          <span>Healthy</span>
          <span className="kbd">{healthy.length}</span>
        </div>
        <div className="badge">
          <span>Monthly cadence</span>
          <span className="kbd">{monthlyCadence}</span>
        </div>
        <div className="badge">
          <span>Half-yearly cadence</span>
          <span className="kbd">{halfYearlyCadence}</span>
        </div>
        <div className="badge">
          <span>High risk</span>
          <span className="kbd">{highRisk}</span>
        </div>
        <div className="badge">
          <span>Medium risk</span>
          <span className="kbd">{mediumRisk}</span>
        </div>
        <div className="badge">
          <span>Low risk</span>
          <span className="kbd">{lowRisk}</span>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div style={{ fontWeight: 650, fontSize: 18 }}>Due now</div>
          <p className="p">Suppliers whose next audit window is approaching or due.</p>

          <div className="spacer" />

          {dueNow.length === 0 ? (
            <p className="p">No suppliers currently due.</p>
          ) : (
            <div className="row" style={{ flexDirection: "column", gap: 10 }}>
              {dueNow.map(renderAuditCard)}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div style={{ fontWeight: 650, fontSize: 18 }}>Follow-up required</div>
          <p className="p">Suppliers with higher risk signals or checklist failures that need manual review.</p>

          <div className="spacer" />

          {followUp.length === 0 ? (
            <p className="p">No suppliers currently flagged for follow-up.</p>
          ) : (
            <div className="row" style={{ flexDirection: "column", gap: 10 }}>
              {followUp.map(renderAuditCard)}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div style={{ fontWeight: 650, fontSize: 18 }}>Healthy</div>
          <p className="p">
            Suppliers that are not currently due and are not flagged by the live checklist and risk rules.
          </p>

          <div className="spacer" />

          {healthy.length === 0 ? (
            <p className="p">No healthy suppliers yet.</p>
          ) : (
            <div className="row" style={{ flexDirection: "column", gap: 10 }}>
              {healthy.map(renderAuditCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}