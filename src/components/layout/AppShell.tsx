import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type Variant = "member" | "admin" | "supplier" | "customer";
type TopbarMode = "default" | "club";

export default function AppShell({
  title,
  variant = "member",
  topbarMode = "default",
  children,
}: {
  title?: string;
  variant?: Variant;
  topbarMode?: TopbarMode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Topbar title={title} variant={variant} mode={topbarMode} />
      <div
        className="container"
        style={{
          maxWidth: "1440px",
          paddingTop: 18,
          paddingBottom: 28,
        }}
      >
        <div className="row" style={{ alignItems: "flex-start", gap: 18, flexWrap: "nowrap" }}>
          <div style={{ flex: "0 0 280px" }}>
            <Sidebar variant={variant} />
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}