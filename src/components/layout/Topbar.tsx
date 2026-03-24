import Link from "next/link";

type Variant = "member" | "admin" | "supplier" | "customer";
type TopbarMode = "default" | "club";

function homeHrefFor(variant: Variant) {
  if (variant === "admin") return "/admin/dashboard";
  if (variant === "supplier") return "/supplier/dashboard";
  if (variant === "customer") return "/luxe-atelier";
  return "/";
}

function linksFor(variant: Variant, mode: TopbarMode) {
  if (mode === "club") {
    return [
      { href: "/exclusivity-club", label: "Exclusivity Club" },
      { href: "/policy", label: "Policy" },
    ];
  }

  if (variant === "admin") {
    return [
      { href: "/exclusivity-club", label: "Exclusivity Club" },
      { href: "/policy", label: "Policy" },
    ];
  }

  if (variant === "supplier") {
    return [
      { href: "/exclusivity-club", label: "Exclusivity Club" },
      { href: "/policy", label: "Policy" },
    ];
  }

  if (variant === "customer") {
    return [
      { href: "/exclusivity-club", label: "Exclusivity Club" },
      { href: "/policy", label: "Policy" },
    ];
  }

  return [{ href: "/luxe-atelier", label: "Luxe Atelier" }];
}

export default function Topbar({
  variant = "member",
  mode = "default",
}: {
  title?: string;
  variant?: Variant;
  mode?: TopbarMode;
}) {
  const links = linksFor(variant, mode);
  const homeHref = homeHrefFor(variant);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        background: "rgba(255,255,255,0.58)",
        borderBottom: "1px solid rgba(29,27,24,0.08)",
      }}
    >
      <div
        className="container"
        style={{
          maxWidth: "1440px",
          paddingTop: 18,
          paddingBottom: 18,
        }}
      >
        <div className="row topbarRow" style={{ justifyContent: "space-between", alignItems: "center", gap: 18 }}>
          <Link
            href={homeHref}
            className="topbarBrand"
            style={{
              textDecoration: "none",
              fontSize: 28,
              fontWeight: 560,
              letterSpacing: "0.04em",
              color: "var(--text)",
            }}
          >
            Brandwithyou
          </Link>

          <div className="row topbarLinks" style={{ gap: 10, justifyContent: "flex-end" }}>
            {links.map((l) => (
              <Link
                key={l.href}
                className="btn topbarLink"
                href={l.href}
                style={{
                  background: "rgba(255,255,255,0.70)",
                  border: "1px solid rgba(29,27,24,0.08)",
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}