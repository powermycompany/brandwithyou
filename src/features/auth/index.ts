import { supabaseBrowser } from "@/lib/supabase/client";

export async function signInWithPassword(email: string, password: string) {
  const supabase = supabaseBrowser();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithProfile(input: {
  email: string;
  password: string;
  full_name: string;
  account_name: string;
  phone: string;
  country: string;
}) {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });

  if (error) return { data, error };

  const userId = data.user?.id;
  if (!userId) return { data, error: null };

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    status: "pending",
    role: null,
    full_name: input.full_name,
    account_name: input.account_name,
    email: input.email,
    phone: input.phone,
    country: input.country,
    preferred_language: "en",
  });

  return { data, error: profileError };
}

export async function signOut() {
  const supabase = supabaseBrowser();
  return supabase.auth.signOut();
}
