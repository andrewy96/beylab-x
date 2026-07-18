import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/adminServer";
import { StrategyQuota } from "@/lib/strategy";

const DAILY_LIMIT = 1;

type JsonObject = Record<string, unknown>;

function normalizeQuota(input: unknown): StrategyQuota {
  const raw = input && typeof input === "object" ? (input as JsonObject) : {};
  const limit = Number(raw.limit ?? DAILY_LIMIT);
  const used = Number(raw.used ?? 0);
  const remaining = Number(raw.remaining ?? Math.max(limit - used, 0));
  return {
    limit: Number.isFinite(limit) ? limit : DAILY_LIMIT,
    used: Number.isFinite(used) ? used : 0,
    remaining: Number.isFinite(remaining) ? Math.max(remaining, 0) : 0,
    resetAt:
      typeof raw.resetAt === "string" ? raw.resetAt : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function GET(request: Request) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) return NextResponse.json({ error: "missing_session" }, { status: 401 });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const { data, error } = await admin.rpc("ai_strategy_quota_payload", {
    p_user_id: userData.user.id,
    p_limit: DAILY_LIMIT,
  });
  if (error) {
    return NextResponse.json({ error: "quota_not_configured" }, { status: 503 });
  }

  return NextResponse.json({ quota: normalizeQuota(data) });
}
