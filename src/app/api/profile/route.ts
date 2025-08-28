// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

type ProfileUpdate = { display_name?: string; company?: string; timezone?: string };

export async function PUT(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let raw: unknown = {};
    try { raw = await req.json(); } catch { /* ignore */ }
    const body = (raw ?? {}) as Partial<ProfileUpdate>;

    const payload: ProfileUpdate = {};
    if (typeof body.display_name === "string") payload.display_name = body.display_name.slice(0, 80);
    if (typeof body.company === "string") payload.company = body.company.slice(0, 120);
    if (typeof body.timezone === "string") payload.timezone = body.timezone;

    if (Object.keys(payload).length === 0) return NextResponse.json({ ok: true });

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (error) {
      console.error("profile update error:", error);
      return NextResponse.json({ error: "update_failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("profile route error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
