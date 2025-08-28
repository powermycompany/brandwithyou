// src/app/api/designs/[id]/share/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareRecord = { token: string; expires_at: string | null };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const rotate = url.searchParams.get("rotate") === "1";

    const { data, error } = await supabase.rpc("create_or_get_design_share", {
      p_design_id: id,
      p_ttl_minutes: 60 * 24 * 7,
      p_rotate: rotate,
    });

    if (error || !data) {
      console.error("create_or_get_design_share error:", error);
      return NextResponse.json(
        { error: error?.message ?? "Could not create share" },
        { status: 400 }
      );
    }

    const record = data as ShareRecord;
    return NextResponse.json({ token: record.token, expires_at: record.expires_at });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("share route fatal error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
