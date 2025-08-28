// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

type ProfileUpdate = {
  display_name?: string;
  company?: string;
  timezone?: string;
};

export async function PUT(req: Request) {
  try {
    // Auth (must be signed in)
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    let raw: unknown = {};
    try {
      raw = await req.json();
    } catch {
      // ignore invalid/empty JSON; treat as empty update
    }

    const body = (raw ?? {}) as Partial<ProfileUpdate>;
    const display_name = typeof body.display_name === "string" ? body.display_name.slice(0, 80) : undefined;
    const company = typeof body.company === "string" ? body.company.slice(0, 120) : undefined;
    const timezone = typeof body.timezone === "string" ? body.timezone : undefined;

    const payload: ProfileUpdate = {};
    if (display_name !== undefined) payload.display_name = display_name;
    if (company !== undefined) payload.company = company;
    if (timezone !== undefined) payload.timezone = timezone;

    if (Object.keys(payload).length === 0) {
      // nothing to update
      return NextResponse.json({ ok: true });
    }

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
