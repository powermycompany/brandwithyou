"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Variant = "member" | "admin" | "supplier" | "customer";
type NavKey = "messages" | "supplier_reservations" | "customer_reservations" | "customer_purchases";

type NavItem = { href: string; label: string; key?: NavKey };

function Badge({ n }: { n: number }) {
  if (!n || n <= 0) return null;
  const text = n > 99 ? "99+" : String(n);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 6px",
        borderRadius: 999,
        background: "#1f1d1a",
        color: "#f8f5ef",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: "18px",
      }}
    >
      {text}
    </span>
  );
}

export default function Sidebar({ variant = "member" }: { variant?: Variant }) {
  const supabase = supabaseBrowser();
  const pathname = usePathname();

  const [badges, setBadges] = useState<{
    messages: number;
    supplier_reservations: number;
    customer_reservations: number;
    customer_purchases: number;
  }>({
    messages: 0,
    supplier_reservations: 0,
    customer_reservations: 0,
    customer_purchases: 0,
  });

  const items: NavItem[] = useMemo(() => {
    if (variant === "admin") {
      return [
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/luxe-atelier", label: "Luxe Atelier" },
        { href: "/admin/suppliers", label: "Suppliers" },
        { href: "/admin/products", label: "Supplier Assortment" },
        { href: "/admin/reservations", label: "Reservations" },
        { href: "/admin/catalog", label: "Catalog" },
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/audit-logs", label: "Audit logs" },
        { href: "/admin/users", label: "Users" },
      ];
    }

    if (variant === "supplier") {
      return [
        { href: "/supplier/dashboard", label: "Dashboard" },
        { href: "/luxe-atelier", label: "Luxe Atelier" },
        { href: "/supplier/products", label: "Products" },
        { href: "/supplier/reservations", label: "Reservations", key: "supplier_reservations" },
        { href: "/supplier/messages", label: "Messages", key: "messages" },
        { href: "/supplier/profile", label: "Profile" },
      ];
    }

    if (variant === "customer") {
      return [
        { href: "/luxe-atelier", label: "Luxe Atelier" },
        { href: "/customer/reservations", label: "Reservations", key: "customer_reservations" },
        { href: "/customer/messages", label: "Messages", key: "messages" },
        { href: "/customer/purchases", label: "Purchase history", key: "customer_purchases" },
        { href: "/customer/profile", label: "Profile" },
      ];
    }

    return [{ href: "/luxe-atelier", label: "Luxe Atelier" }];
  }, [variant]);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data, error } = await supabase.rpc("get_nav_badges");
      if (!alive) return;

      if (error || !data) {
        setBadges({ messages: 0, supplier_reservations: 0, customer_reservations: 0, customer_purchases: 0 });
        return;
      }

      setBadges({
        messages: Number((data as any).messages_unread_threads ?? 0),
        supplier_reservations: Number((data as any).reservations_requested_qty ?? 0),
        customer_reservations: Number((data as any).customer_confirmed_qty_new ?? 0),
        customer_purchases: Number((data as any).customer_purchases_qty_new ?? 0),
      });
    }

    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [supabase]);

  return (
    <div
      className="card"
      style={{
        background: "rgba(255,255,255,0.62)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div className="cardInner" style={{ padding: 14 }}>
        <div
          style={{
            fontWeight: 700,
            marginBottom: 14,
            fontSize: 18,
            letterSpacing: "0.03em",
          }}
        >
          Brandwithyou
        </div>

        <div className="row" style={{ flexDirection: "column", gap: 8 }}>
          {items.map((it) => {
            const active = pathname === it.href || pathname?.startsWith(it.href + "/");

            const badgeN =
              it.key === "messages"
                ? badges.messages
                : it.key === "supplier_reservations"
                ? badges.supplier_reservations
                : it.key === "customer_reservations"
                ? badges.customer_reservations
                : it.key === "customer_purchases"
                ? badges.customer_purchases
                : 0;

            return (
              <Link
                key={it.href}
                href={it.href}
                className="card"
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: active ? "rgba(29,27,24,0.08)" : "rgba(255,255,255,0.40)",
                  border: "1px solid rgba(29,27,24,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: active ? "0 8px 18px rgba(78,64,42,0.06)" : "none",
                }}
              >
                <span style={{ fontWeight: 650 }}>{it.label}</span>
                <Badge n={badgeN} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
