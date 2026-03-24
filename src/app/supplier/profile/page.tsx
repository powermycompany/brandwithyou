import { supabaseServer } from "@/lib/supabase/server";
import BrandMultiSelect from "@/components/forms/BrandMultiSelect";
import CountryPhoneFields from "@/components/forms/CountryPhoneFields";
import DeleteAccountButton from "@/components/profile/DeleteAccountButton";
import { updateSupplierProfile } from "@/server/actions/updateSupplierProfile";

type Profile = {
  id: string;
  full_name: string | null;
  account_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  preferred_language: string | null;
  role: string | null;
  status: string | null;
};

type Brand = { id: number; name_en: string | null };

export default async function SupplierProfilePage() {
  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: p, error } = await supabase
    .from("profiles")
    .select("id,full_name,account_name,email,phone,country,preferred_language,role,status")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const prof = (p ?? null) as Profile | null;

  if (!prof) {
    return (
      <div className="card">
        <div className="cardInner">
          <div className="badge">
            <span>Error</span>
            <span className="kbd">Profile not found</span>
          </div>
        </div>
      </div>
    );
  }

  const { data: delReq, error: delErr } = await supabase
    .from("account_deletion_requests")
    .select("execute_after,cancelled_at,completed_at")
    .eq("user_id", uid)
    .maybeSingle();
  if (delErr) throw new Error(delErr.message);

  const scheduledExecuteAfter =
    delReq && !(delReq as any).cancelled_at && !(delReq as any).completed_at
      ? ((delReq as any).execute_after as string)
      : null;

  const { data: brandsRaw, error: bErr } = await supabase
    .from("catalog_brands")
    .select("id,name_en")
    .order("name_en", { ascending: true });

  if (bErr) throw new Error(bErr.message);
  const brands = (brandsRaw ?? []) as Brand[];

  const { data: prefRaw, error: prErr } = await supabase
    .from("supplier_preferred_brands")
    .select("brand_id")
    .eq("supplier_id", uid);

  if (prErr) throw new Error(prErr.message);

  const defaultPref = (prefRaw ?? []).map((r: any) => Number(r.brand_id)).filter((n) => Number.isFinite(n));

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <h1 className="h1">Profile</h1>
          <p className="p">Update your supplier contact details. Email is managed by authentication.</p>
          <div className="spacer" />
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="badge">
              <span>Status</span>
              <span className="kbd">{prof.status ?? "—"}</span>
            </div>
            <div className="badge">
              <span>Role</span>
              <span className="kbd">{prof.role ?? "—"}</span>
            </div>
            <div className="badge">
              <span>Email</span>
              <span className="kbd">{prof.email ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <form action={updateSupplierProfile}>
            <div className="row supplierProfileTopRow">
              <div className="supplierProfileField" style={{ flex: "1 1 320px" }}>
                <label className="p">Full name</label>
                <div className="spacer" style={{ height: 6 }} />
                <input className="input" name="full_name" required defaultValue={prof.full_name ?? ""} />
              </div>

              <div className="supplierProfileField" style={{ flex: "1 1 320px" }}>
                <label className="p">Account name</label>
                <div className="spacer" style={{ height: 6 }} />
                <input className="input" name="account_name" required defaultValue={prof.account_name ?? ""} />
              </div>
            </div>

            <div className="spacer" />

            <CountryPhoneFields defaultCountry={prof.country ?? ""} defaultPhone={prof.phone ?? ""} />

            <div className="spacer" />

            <div className="row supplierProfileSelectRow">
              <div className="supplierProfileSelectField" style={{ flex: "0 0 220px" }}>
                <label className="p">Language</label>
                <div className="spacer" style={{ height: 6 }} />
                <select className="input" name="preferred_language" defaultValue={prof.preferred_language ?? "en"}>
                  <option value="en">English</option>
                  <option value="zh-CN">中文 (简体)</option>
                </select>
              </div>
            </div>

            <div className="spacer" />

            <BrandMultiSelect
              name="preferred_brand_ids_json"
              brands={brands}
              defaultSelectedIds={defaultPref}
              title="Preferred brands to sell"
              subtitle="Used to organize supply and accelerate catalog/product workflows later."
            />

            <div className="spacer" />

            <button className="btn btnPrimary supplierProfileSaveButton" type="submit">
              Save
            </button>
          </form>
        </div>
      </div>

      <DeleteAccountButton scheduledExecuteAfter={scheduledExecuteAfter} />
    </div>
  );
}