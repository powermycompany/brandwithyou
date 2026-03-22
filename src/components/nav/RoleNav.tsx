import Link from "next/link";

export default function RoleNav() {
  return (
    <div className="row">
      <Link className="btn" href="/admin/dashboard">Admin</Link>
      <Link className="btn" href="/supplier/dashboard">Supplier</Link>
      <Link className="btn" href="/market">Customer</Link>
    </div>
  );
}
