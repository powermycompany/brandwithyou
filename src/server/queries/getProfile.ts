import { supabaseServer } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  status: "pending" | "active";
  role: "admin" | "supplier" | "customer" | null;
  email: string | null;
};

export async function getProfile() {
  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) return { user: null, profile: null as Profile | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,status,role,email")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: (profile as Profile | null) };
}
