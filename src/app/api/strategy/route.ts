import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/adminServer";
import {
  findAssist,
  findBit,
  findBlade,
  findLockChip,
  findRatchet,
} from "@/data/parts";
import { Combo, comboName, comboStats, comboType, isComplete } from "@/lib/combo";
import {
  StrategyLocale,
  StrategyPair,
  StrategyQuota,
  StrategyResult,
  StrategySource,
  strategyMatchupKey,
  strategyMatchupKeyJson,
} from "@/lib/strategy";

const DAILY_LIMIT = 3;
const CACHE_MS = 30 * 24 * 60 * 60 * 1000;

interface ComboPayload {
  bladeId?: string | null;
  lockChipId?: string | null;
  assistId?: string | null;
  ratchetId?: string | null;
  bitId?: string | null;
}

interface StrategyRequest {
  locale?: StrategyLocale;
  own?: ComboPayload;
  opponent?: ComboPayload;
}

type JsonObject = Record<string, unknown>;

function comboFromPayload(input: ComboPayload | undefined): Combo {
  const blade = input?.bladeId ? findBlade(input.bladeId) : null;
  const defaultLockChip = blade?.lockChip ? findLockChip(blade.lockChip) : null;
  return {
    blade,
    lockChip: blade?.cx
      ? input?.lockChipId
        ? findLockChip(input.lockChipId) ?? defaultLockChip
        : defaultLockChip
      : null,
    assist: blade?.cx && input?.assistId ? findAssist(input.assistId) : null,
    ratchet: input?.ratchetId ? findRatchet(input.ratchetId) : null,
    bit: input?.bitId ? findBit(input.bitId) : null,
  };
}

function describeCombo(combo: Combo, locale: StrategyLocale) {
  return {
    name: comboName(combo, locale),
    type: comboType(combo),
    stats: comboStats(combo),
    parts: {
      blade: combo.blade
        ? {
            id: combo.blade.id,
            name: locale === "zh" ? combo.blade.zh : combo.blade.enFull,
            type: combo.blade.type,
            tier: combo.blade.tier,
            spin: combo.blade.spin,
            line: combo.blade.line,
          }
        : null,
      lockChip: combo.lockChip
        ? {
            id: combo.lockChip.id,
            name: locale === "zh" ? combo.lockChip.zh : combo.lockChip.name,
            metal: combo.lockChip.hasMetal,
          }
        : null,
      assist: combo.assist
        ? {
            id: combo.assist.id,
            name: combo.assist.name,
          }
        : null,
      ratchet: combo.ratchet
        ? {
            id: combo.ratchet.id,
            prongs: combo.ratchet.prongs,
            height: combo.ratchet.height,
            metal: combo.ratchet.isMetal,
          }
        : null,
      bit: combo.bit
        ? {
            id: combo.bit.id,
            name: combo.bit.name,
          }
        : null,
    },
  };
}

function fallbackStrategy(
  locale: StrategyLocale,
  own: ReturnType<typeof describeCombo>,
  opponent: ReturnType<typeof describeCombo>
): StrategyResult {
  const ownStats = own.stats;
  const oppStats = opponent.stats;
  const staminaEdge = (ownStats?.stamina ?? 0) - (oppStats?.stamina ?? 0);
  const attackEdge = (ownStats?.attack ?? 0) - (oppStats?.attack ?? 0);
  const defenseEdge = (ownStats?.defense ?? 0) - (oppStats?.defense ?? 0);
  const totalEdge = staminaEdge + attackEdge + defenseEdge;

  if (locale === "zh") {
    return {
      edge: totalEdge > 1 ? "你的组合" : totalEdge < -1 ? "对手组合" : "接近",
      confidence: "中等",
      prediction: `${own.name} 对 ${opponent.name} 是接近对局。`,
      summary: "AI 暂时无法返回完整分析，以下为本地数据推断。",
      openingPlan: ["先观察对手移动路线", "避免连续硬碰硬", "优先把对手带到外圈失衡"],
      winConditions: ["保持中心控制", "利用发射角度制造稳定接触", "等待对手耐力下降后收尾"],
      risks: ["被高攻击开局击出", "低耐力时被拖入持久战", "过度追击导致自失衡"],
      adjustments: ["降低发射角度提高稳定性", "对攻击型对手保守发射"],
    };
  }

  return {
    edge: totalEdge > 1 ? "Your combo" : totalEdge < -1 ? "Opponent combo" : "Even",
    confidence: "Medium",
    prediction: `${own.name} into ${opponent.name} looks like a close matchup.`,
    summary: "AI returned no complete analysis, so this is inferred from local stats.",
    openingPlan: ["Read the opponent's movement first", "Avoid repeated direct trades", "Pull the opponent off-center"],
    winConditions: ["Keep center control", "Use launch angle for stable contact", "Finish after their stamina drops"],
    risks: ["Early knockout pressure", "Losing a stamina race", "Overchasing and self-destabilizing"],
    adjustments: ["Use a flatter, controlled launch", "Launch conservatively into attack types"],
  };
}

function fallbackPair(ownCombo: Combo, opponentCombo: Combo): StrategyPair {
  const ownEn = describeCombo(ownCombo, "en");
  const opponentEn = describeCombo(opponentCombo, "en");
  const ownZh = describeCombo(ownCombo, "zh");
  const opponentZh = describeCombo(opponentCombo, "zh");
  return {
    en: fallbackStrategy("en", ownEn, opponentEn),
    zh: fallbackStrategy("zh", ownZh, opponentZh),
  };
}

function hashMatchup(matchupJson: string): string {
  return createHash("sha256").update(matchupJson).digest("hex");
}

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

async function getQuota(admin: SupabaseClient, userId: string): Promise<StrategyQuota> {
  const { data, error } = await admin.rpc("ai_strategy_quota_payload", {
    p_user_id: userId,
    p_limit: DAILY_LIMIT,
  });
  if (error) throw error;
  return normalizeQuota(data);
}

async function consumeQuota(admin: SupabaseClient, userId: string): Promise<{
  allowed: boolean;
  quota: StrategyQuota;
}> {
  const { data, error } = await admin.rpc("consume_ai_strategy_quota", {
    p_user_id: userId,
    p_limit: DAILY_LIMIT,
  });
  if (error) throw error;
  const raw = data && typeof data === "object" ? (data as JsonObject) : {};
  return {
    allowed: raw.allowed === true,
    quota: normalizeQuota(data),
  };
}

async function refundQuota(admin: SupabaseClient, userId: string, fallbackQuota: StrategyQuota): Promise<StrategyQuota> {
  const { data, error } = await admin.rpc("refund_ai_strategy_quota", {
    p_user_id: userId,
    p_limit: DAILY_LIMIT,
  });
  if (error) return fallbackQuota;
  return normalizeQuota(data);
}

function responsePayload({
  locale,
  ownCombo,
  opponentCombo,
  strategies,
  cached,
  source,
  quota,
  matchupHash,
}: {
  locale: StrategyLocale;
  ownCombo: Combo;
  opponentCombo: Combo;
  strategies: StrategyPair;
  cached: boolean;
  source: StrategySource;
  quota: StrategyQuota;
  matchupHash: string;
}) {
  return {
    own: describeCombo(ownCombo, locale),
    opponent: describeCombo(opponentCombo, locale),
    strategy: strategies[locale],
    strategies,
    cached,
    source,
    quota,
    matchupHash,
  };
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  const clean = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return clean.length ? clean.slice(0, 4) : fallback;
}

function normalizeStrategy(value: unknown, fallback: StrategyResult): StrategyResult {
  const raw = value && typeof value === "object" ? (value as JsonObject) : {};
  return {
    edge: stringValue(raw.edge, fallback.edge),
    confidence: stringValue(raw.confidence, fallback.confidence),
    prediction: stringValue(raw.prediction, fallback.prediction),
    summary: stringValue(raw.summary, fallback.summary),
    openingPlan: stringArray(raw.openingPlan, fallback.openingPlan),
    winConditions: stringArray(raw.winConditions, fallback.winConditions),
    risks: stringArray(raw.risks, fallback.risks),
    adjustments: stringArray(raw.adjustments, fallback.adjustments),
  };
}

function parseStrategyPair(content: string, fallback: StrategyPair): StrategyPair | null {
  try {
    const parsed = JSON.parse(content) as JsonObject;
    if (!parsed.en || !parsed.zh) return null;
    return {
      en: normalizeStrategy(parsed.en, fallback.en),
      zh: normalizeStrategy(parsed.zh, fallback.zh),
    };
  } catch {
    return null;
  }
}

async function readCachedStrategy(admin: SupabaseClient, matchupHash: string): Promise<StrategyPair | null> {
  const { data, error } = await admin
    .from("ai_strategy_cache")
    .select("strategy_en, strategy_zh")
    .eq("matchup_hash", matchupHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    en: data.strategy_en as StrategyResult,
    zh: data.strategy_zh as StrategyResult,
  };
}

async function writeCachedStrategy(
  admin: SupabaseClient,
  matchupHash: string,
  matchup: ReturnType<typeof strategyMatchupKey>,
  strategies: StrategyPair
) {
  await admin.from("ai_strategy_cache").upsert(
    {
      matchup_hash: matchupHash,
      matchup,
      strategy_en: strategies.en,
      strategy_zh: strategies.zh,
      expires_at: new Date(Date.now() + CACHE_MS).toISOString(),
    },
    { onConflict: "matchup_hash" }
  );
}

async function authenticate(request: Request, admin: SupabaseClient) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) return { response: NextResponse.json({ error: "missing_session" }, { status: 401 }) };

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return { response: NextResponse.json({ error: "invalid_session" }, { status: 401 }) };
  }

  return { userId: userData.user.id };
}

export async function POST(request: Request) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const auth = await authenticate(request, admin);
  if ("response" in auth) return auth.response;

  let body: StrategyRequest;
  try {
    body = (await request.json()) as StrategyRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const locale: StrategyLocale = body.locale === "zh" ? "zh" : "en";
  const ownCombo = comboFromPayload(body.own);
  const opponentCombo = comboFromPayload(body.opponent);
  if (!isComplete(ownCombo) || !isComplete(opponentCombo)) {
    return NextResponse.json({ error: "incomplete_combo" }, { status: 400 });
  }

  const matchup = strategyMatchupKey(ownCombo, opponentCombo);
  const matchupJson = strategyMatchupKeyJson(ownCombo, opponentCombo);
  if (!matchup || !matchupJson) {
    return NextResponse.json({ error: "incomplete_combo" }, { status: 400 });
  }
  const matchupHash = hashMatchup(matchupJson);

  let quota: StrategyQuota;
  try {
    quota = await getQuota(admin, auth.userId);
    const cachedStrategies = await readCachedStrategy(admin, matchupHash);
    if (cachedStrategies) {
      return NextResponse.json(
        responsePayload({
          locale,
          ownCombo,
          opponentCombo,
          strategies: cachedStrategies,
          cached: true,
          source: "cache",
          quota,
          matchupHash,
        })
      );
    }
  } catch {
    return NextResponse.json({ error: "quota_not_configured" }, { status: 503 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const fallbacks = fallbackPair(ownCombo, opponentCombo);
  if (!apiKey) {
    return NextResponse.json(
      responsePayload({
        locale,
        ownCombo,
        opponentCombo,
        strategies: fallbacks,
        cached: false,
        source: "fallback",
        quota,
        matchupHash,
      })
    );
  }

  let reserved: Awaited<ReturnType<typeof consumeQuota>>;
  try {
    reserved = await consumeQuota(admin, auth.userId);
  } catch {
    return NextResponse.json({ error: "quota_not_configured" }, { status: 503 });
  }
  if (!reserved.allowed) {
    return NextResponse.json(
      { error: "daily_limit_reached", quota: reserved.quota, matchupHash },
      { status: 429 }
    );
  }
  quota = reserved.quota;

  const ownEn = describeCombo(ownCombo, "en");
  const ownZh = describeCombo(ownCombo, "zh");
  const opponentEn = describeCombo(opponentCombo, "en");
  const opponentZh = describeCombo(opponentCombo, "zh");

  const prompt = {
    role: "user",
    content: [
      "Create bilingual Beyblade X matchup coaching for the player's combo against the opponent combo.",
      "Do not guarantee outcomes. Give practical tournament-style advice.",
      "Return strict JSON with exactly two top-level keys: en and zh.",
      "The en value must be English. The zh value must be Simplified Chinese.",
      "Each language object must use keys: edge, confidence, prediction, summary, openingPlan, winConditions, risks, adjustments.",
      "openingPlan, winConditions, risks, and adjustments must be arrays of 2-4 short strings.",
      JSON.stringify({
        matchup,
        englishNames: { player: ownEn, opponent: opponentEn },
        chineseNames: { player: ownZh, opponent: opponentZh },
      }),
    ].join("\n"),
  };

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are concise, practical, and honest. You understand Beyblade X combo archetypes, launch plans, win conditions, and matchup risks.",
          },
          prompt,
        ],
        temperature: 0.45,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const refunded = await refundQuota(admin, auth.userId, quota);
      return NextResponse.json(
        responsePayload({
          locale,
          ownCombo,
          opponentCombo,
          strategies: fallbacks,
          cached: false,
          source: "fallback",
          quota: refunded,
          matchupHash,
        })
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const strategies = parseStrategyPair(content, fallbacks);
    if (!strategies) {
      const refunded = await refundQuota(admin, auth.userId, quota);
      return NextResponse.json(
        responsePayload({
          locale,
          ownCombo,
          opponentCombo,
          strategies: fallbacks,
          cached: false,
          source: "fallback",
          quota: refunded,
          matchupHash,
        })
      );
    }

    await writeCachedStrategy(admin, matchupHash, matchup, strategies).catch(() => {
      /* Cache writes should not discard a paid, usable AI result. */
    });
    return NextResponse.json(
      responsePayload({
        locale,
        ownCombo,
        opponentCombo,
        strategies,
        cached: false,
        source: "ai",
        quota,
        matchupHash,
      })
    );
  } catch {
    const refunded = await refundQuota(admin, auth.userId, quota);
    return NextResponse.json(
      responsePayload({
        locale,
        ownCombo,
        opponentCombo,
        strategies: fallbacks,
        cached: false,
        source: "fallback",
        quota: refunded,
        matchupHash,
      })
    );
  }
}
