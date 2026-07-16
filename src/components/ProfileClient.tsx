"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dict, Locale } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { supabase, Match, Profile, Round } from "@/lib/supabase";

const FINISH_COLOR: Record<string, string> = {
  spin: "var(--color-sta)",
  over: "var(--color-def)",
  burst: "var(--color-spc)",
  xtreme: "var(--color-atk)",
};

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="panel px-4 py-3 text-center">
      <div className={`font-display text-2xl font-bold ${accent ? "text-bal" : "text-accent"}`}>
        {value}
      </div>
      <div className="text-xs text-ink-dim">{label}</div>
    </div>
  );
}

export function ProfileHeader({ p, dict }: { p: Profile; dict: Dict }) {
  const total = p.wins + p.losses;
  const rate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-accent/40 font-display text-xl font-black text-accent">
          {p.handle.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-wide">
            {p.display_name || p.handle}
          </h1>
          <div className="text-sm text-ink-dim">
            @{p.handle}
            {p.city ? ` · ${p.city}` : ""} · {dict.battle.memberSince}{" "}
            {new Date(p.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <StatCard label={dict.battle.starsBalance} value={`★${p.stars}`} accent />
        <StatCard label={dict.battle.wins} value={p.wins} />
        <StatCard label={dict.battle.losses} value={p.losses} />
        <StatCard label={dict.battle.winRate} value={`${rate}%`} />
      </div>
    </div>
  );
}

export function MatchRow({
  m,
  perspectiveId,
  locale,
  dict,
}: {
  m: Match;
  perspectiveId: string;
  locale: Locale;
  dict: Dict;
}) {
  const iAmP1 = m.p1 === perspectiveId;
  const me = iAmP1 ? m.p1_profile : m.p2_profile;
  const opp = iAmP1 ? m.p2_profile : m.p1_profile;
  const myScore = iAmP1 ? m.p1_score : m.p2_score;
  const oppScore = iAmP1 ? m.p2_score : m.p1_score;
  const won = m.winner === perspectiveId;
  const rounds = (m.rounds ?? []) as Round[];

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`font-display text-sm font-black ${won ? "text-accent" : "text-atk"}`}
        >
          {won ? "W" : "L"} {myScore}:{oppScore}
        </span>
        <span className="text-sm text-ink-dim">
          vs{" "}
          <Link
            href={`/${locale}/players/${opp?.handle ?? ""}`}
            className="font-semibold text-ink hover:text-accent"
          >
            @{opp?.handle ?? "?"}
          </Link>
        </span>
        {m.status === "confirmed" && m.stars_moved != null && (
          <span className={`text-xs font-bold ${won ? "text-bal" : "text-ink-dim"}`}>
            {won ? `+${m.stars_moved}★` : `−${m.stars_moved}★`}
          </span>
        )}
        {m.status === "pending" && (
          <span className="rounded-full bg-accent-2/10 px-2 py-0.5 text-[10px] font-semibold text-accent-2">
            {dict.battle.statusOpen === "Open" ? "Pending" : "待确认"}
          </span>
        )}
        <span className="ml-auto text-xs text-ink-dim">
          {new Date(m.created_at).toLocaleDateString()}
        </span>
      </div>
      {rounds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {rounds.map((r, i) => {
            const mine = (r.side === 1) === iAmP1;
            return (
              <span
                key={i}
                className="rounded px-1.5 py-0.5 font-display text-[9px] font-bold"
                style={{
                  color: FINISH_COLOR[r.finish],
                  background: `color-mix(in srgb, ${FINISH_COLOR[r.finish]} ${mine ? 18 : 8}%, transparent)`,
                  opacity: mine ? 1 : 0.6,
                }}
              >
                {mine ? "+" : "·"}{r.pts}
              </span>
            );
          })}
        </div>
      )}
      <span className="sr-only">{me?.handle}</span>
    </div>
  );
}

const MATCH_SELECT =
  "*, p1_profile:profiles!matches_p1_fkey(*), p2_profile:profiles!matches_p2_fkey(*)";

export function MeClient({ locale, dict }: { locale: Locale; dict: Dict }) {
  const router = useRouter();
  const { enabled, loading, profile, refreshProfile, signOut } = useAuth();
  const [pending, setPending] = useState<Match[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !profile) return;
    const { data: all } = await supabase
      .from("matches")
      .select(MATCH_SELECT)
      .or(`p1.eq.${profile.id},p2.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (all as unknown as Match[]) ?? [];
    setPending(
      list.filter((m) => m.status === "pending" && m.reported_by !== profile.id)
    );
    setMatches(list.filter((m) => m.status !== "rejected"));
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && enabled && !profile) router.replace(`/${locale}/login`);
  }, [loading, enabled, profile, router, locale]);

  if (!enabled) {
    return (
      <div className="panel border-accent-2/40 p-5 text-sm text-ink-dim">
        🚧 {dict.auth.notConfigured}
      </div>
    );
  }
  if (!profile) return null;

  const act = async (id: string, fn: "confirm_match" | "reject_match") => {
    if (!supabase) return;
    setBusy(true);
    await supabase.rpc(fn, { mid: id });
    await Promise.all([load(), refreshProfile()]);
    setBusy(false);
  };

  return (
    <div className="space-y-8">
      <ProfileHeader p={profile} dict={dict} />

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold tracking-wide text-accent-2">
            ⏳ {dict.battle.pendingConfirm}
          </h2>
          <p className="mb-3 text-xs text-ink-dim">{dict.battle.confirmHint}</p>
          <div className="space-y-3">
            {pending.map((m) => (
              <div key={m.id}>
                <MatchRow m={m} perspectiveId={profile.id} locale={locale} dict={dict} />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => act(m.id, "confirm_match")}
                    disabled={busy}
                    className="clip-x bg-accent px-4 py-2 font-display text-xs font-bold tracking-wider text-bg transition enabled:hover:brightness-110 disabled:opacity-50"
                  >
                    ✓ {dict.battle.confirm}
                  </button>
                  <button
                    onClick={() => act(m.id, "reject_match")}
                    disabled={busy}
                    className="clip-x border border-edge bg-panel px-4 py-2 font-display text-xs font-bold tracking-wider text-atk transition disabled:opacity-50"
                  >
                    ✕ {dict.battle.reject}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold tracking-wide">
          {dict.battle.records}
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-ink-dim">{dict.battle.noRecords}</p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <MatchRow key={m.id} m={m} perspectiveId={profile.id} locale={locale} dict={dict} />
            ))}
          </div>
        )}
      </section>

      <button
        onClick={async () => {
          await signOut();
          router.push(`/${locale}`);
        }}
        className="clip-x border border-edge bg-panel px-5 py-2.5 font-display text-xs font-bold tracking-wider text-ink-dim transition hover:text-atk"
      >
        {dict.auth.logout}
      </button>
    </div>
  );
}

export function PlayerClient({
  handle,
  locale,
  dict,
}: {
  handle: string;
  locale: Locale;
  dict: Dict;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: p } = await supabase!
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();
      if (!p) {
        setMissing(true);
        return;
      }
      setProfile(p as Profile);
      const { data: ms } = await supabase!
        .from("matches")
        .select(MATCH_SELECT)
        .or(`p1.eq.${(p as Profile).id},p2.eq.${(p as Profile).id}`)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(50);
      setMatches((ms as unknown as Match[]) ?? []);
    })();
  }, [handle]);

  if (!supabase) {
    return (
      <div className="panel border-accent-2/40 p-5 text-sm text-ink-dim">
        🚧 {dict.auth.notConfigured}
      </div>
    );
  }
  if (missing) {
    return <p className="py-16 text-center text-sm text-ink-dim">404</p>;
  }
  if (!profile) return null;

  return (
    <div className="space-y-8">
      <ProfileHeader p={profile} dict={dict} />
      <section>
        <h2 className="mb-3 font-display text-lg font-bold tracking-wide">
          {dict.battle.records}
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-ink-dim">{dict.battle.noRecords}</p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <MatchRow key={m.id} m={m} perspectiveId={profile.id} locale={locale} dict={dict} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
