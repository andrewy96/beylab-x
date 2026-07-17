"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dict, Locale } from "@/i18n";
import {
  blades,
  ratchets,
  bits,
  assists,
  lockChips,
  findBlade,
  findRatchet,
  findBit,
  findAssist,
  findLockChip,
  tierRank,
} from "@/data/parts";
import { Combo, comboName, comboStats, comboType, comboToParams, isComplete } from "@/lib/combo";
import { TypeBadge, TierChip, TYPE_COLOR } from "./badges";
import Radar from "./Radar";
import PartImage from "./PartImage";

type SlotKey = "blade" | "lockChip" | "assist" | "ratchet" | "bit";

interface PickerItem {
  id: string;
  title: string;
  subtitle: string | null;
  image: string | null;
  tier?: string | null;
}

function PickerModal({
  title,
  items,
  onPick,
  onClose,
  dict,
}: {
  title: string;
  items: PickerItem[];
  onPick: (id: string) => void;
  onClose: () => void;
  dict: Dict;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const query = q.trim().toLowerCase();
  const filtered = query
    ? items.filter(
        (i) =>
          i.id.toLowerCase().includes(query) ||
          i.title.toLowerCase().includes(query) ||
          (i.subtitle ?? "").toLowerCase().includes(query)
      )
    : items;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="panel flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-edge p-4">
          <h3 className="font-display text-sm font-bold tracking-wider">{title}</h3>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dict.builder.pickerSearch}
            className="ml-auto w-40 rounded-md border border-edge bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent sm:w-56"
          />
          <button
            onClick={onClose}
            aria-label={dict.builder.close}
            className="rounded-md border border-edge px-2 py-1.5 text-xs text-ink-dim hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="thin-scroll grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
          {filtered.map((i) => (
            <button
              key={i.id}
              onClick={() => onPick(i.id)}
              className="panel group flex flex-col items-center gap-1 p-3 text-center transition hover:border-accent/60"
            >
              <div className="relative h-20 w-full">
                {i.tier && (
                  <span className="absolute -left-1 -top-1 z-10">
                    <TierChip tier={i.tier} />
                  </span>
                )}
                <PartImage src={i.image} alt={i.title} fallbackLabel={i.id} className="transition group-hover:scale-105" />
              </div>
              <div className="w-full truncate text-xs font-semibold">{i.title}</div>
              {i.subtitle && (
                <div className="w-full truncate text-[10px] text-ink-dim">{i.subtitle}</div>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-ink-dim">
              {dict.catalog.noResults}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BuilderClient({ locale, dict }: { locale: Locale; dict: Dict }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [bladeId, setBladeId] = useState<string | null>(searchParams.get("b"));
  const [lockChipId, setLockChipId] = useState<string | null>(searchParams.get("l"));
  const [ratchetId, setRatchetId] = useState<string | null>(searchParams.get("r"));
  const [bitId, setBitId] = useState<string | null>(searchParams.get("t"));
  const [assistId, setAssistId] = useState<string | null>(searchParams.get("a"));
  const [openSlot, setOpenSlot] = useState<SlotKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const combo: Combo = useMemo(() => {
    const blade = bladeId ? findBlade(bladeId) : null;
    const defaultLockChip = blade?.lockChip ? findLockChip(blade.lockChip) : null;
    return {
      blade,
      lockChip: blade?.cx
        ? lockChipId
          ? findLockChip(lockChipId) ?? defaultLockChip
          : defaultLockChip
        : null,
      ratchet: ratchetId ? findRatchet(ratchetId) : null,
      bit: bitId ? findBit(bitId) : null,
      assist: blade?.cx && assistId ? findAssist(assistId) : null,
    };
  }, [bladeId, lockChipId, ratchetId, bitId, assistId]);

  // Keep the URL in sync so the address bar is always the share link.
  useEffect(() => {
    const params = comboToParams(combo).toString();
    router.replace(params ? `${pathname}?${params}` : pathname, { scroll: false });
  }, [combo, pathname, router]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const stats = comboStats(combo);
  const type = comboType(combo);
  const name = comboName(combo, locale);
  const complete = isComplete(combo);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${dict.site.name} — ${name}`, text: name, url });
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    await navigator.clipboard.writeText(url);
    showToast(dict.builder.copied);
  };

  const copyName = async () => {
    await navigator.clipboard.writeText(name);
    showToast(dict.builder.nameCopied);
  };

  const randomize = () => {
    const pool = blades.filter((b) => b.image);
    const blade = pool[Math.floor(Math.random() * pool.length)];
    setBladeId(blade.id);
    setLockChipId(
      blade.cx ? lockChips[Math.floor(Math.random() * lockChips.length)].id : null
    );
    setRatchetId(ratchets[Math.floor(Math.random() * ratchets.length)].id);
    setBitId(bits[Math.floor(Math.random() * bits.length)].id);
    setAssistId(
      blade.cx ? assists[Math.floor(Math.random() * assists.length)].id : null
    );
  };

  const reset = () => {
    setBladeId(null);
    setLockChipId(null);
    setRatchetId(null);
    setBitId(null);
    setAssistId(null);
  };

  const pickerItems: Record<SlotKey, PickerItem[]> = useMemo(
    () => ({
      blade: [...blades]
        .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.en.localeCompare(b.en))
        .map((b) => ({
          id: b.id,
          title: locale === "zh" ? b.zh : b.enFull,
          subtitle: b.code,
          image: b.image,
          tier: b.tier,
        })),
      ratchet: ratchets.map((r) => ({
        id: r.id,
        title: r.id,
        subtitle: r.height != null ? `${r.height.toFixed(1)}mm` : null,
        image: r.image,
      })),
      bit: bits.map((b) => ({ id: b.id, title: b.id, subtitle: b.name, image: b.image })),
      lockChip: lockChips.map((l) => ({
        id: l.id,
        title: locale === "zh" ? l.zh : l.id,
        subtitle: l.hasMetal ? dict.part.metalLockChip : locale === "zh" ? dict.part.lockChip : l.name,
        image: l.image,
      })),
      assist: assists.map((a) => ({ id: a.id, title: a.id, subtitle: a.name, image: a.image })),
    }),
    [dict.part.lockChip, dict.part.metalLockChip, locale]
  );

  const setters: Record<SlotKey, (id: string | null) => void> = {
    blade: setBladeId,
    lockChip: setLockChipId,
    ratchet: setRatchetId,
    bit: setBitId,
    assist: setAssistId,
  };

  const slots: {
    key: SlotKey;
    label: string;
    value: string | null;
    image: string | null;
    hidden?: boolean;
  }[] = [
    {
      key: "blade",
      label: dict.builder.slotBlade,
      value: combo.blade ? (locale === "zh" ? combo.blade.zh : combo.blade.enFull) : null,
      image: combo.blade?.image ?? null,
    },
    {
      key: "lockChip",
      label: dict.builder.slotLockChip,
      value: combo.lockChip
        ? `${locale === "zh" ? combo.lockChip.zh : combo.lockChip.id}${
            combo.lockChip.hasMetal ? ` · ${dict.part.metalLockChip}` : ""
          }`
        : null,
      image: combo.lockChip?.image ?? null,
      hidden: !combo.blade?.cx,
    },
    {
      key: "assist",
      label: dict.builder.slotAssist,
      value: combo.assist ? `${combo.assist.id}${combo.assist.name ? ` · ${combo.assist.name}` : ""}` : null,
      image: combo.assist?.image ?? null,
      hidden: !combo.blade?.cx,
    },
    {
      key: "ratchet",
      label: dict.builder.slotRatchet,
      value: combo.ratchet?.id ?? null,
      image: combo.ratchet?.image ?? null,
    },
    {
      key: "bit",
      label: dict.builder.slotBit,
      value: combo.bit ? `${combo.bit.id}${combo.bit.name ? ` · ${combo.bit.name}` : ""}` : null,
      image: combo.bit?.image ?? null,
    },
  ];

  const slotLabels: Record<SlotKey, string> = {
    blade: dict.builder.slotBlade,
    lockChip: dict.builder.slotLockChip,
    assist: dict.builder.slotAssist,
    ratchet: dict.builder.slotRatchet,
    bit: dict.builder.slotBit,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* Left: slots + preview */}
      <div className="space-y-6">
        {/* Assembly preview */}
        <div className="panel bg-grid relative flex flex-col items-center gap-0 px-6 py-8">
          {combo.blade && (
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <TierChip tier={combo.blade.tier} />
              <span className="font-display text-[10px] tracking-widest text-ink-dim">
                {combo.blade.code}
              </span>
            </div>
          )}
          <div className="h-44 w-full max-w-64">
            {combo.blade ? (
              <PartImage
                src={combo.blade.image}
                alt="blade"
                fallbackLabel="X"
                color={TYPE_COLOR[combo.blade.type]}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-edge text-sm text-ink-dim">
                {dict.builder.slotBlade}
              </div>
            )}
          </div>
          {combo.blade?.cx && (
            <div className="-mt-2 h-12 w-full max-w-28 opacity-95">
              <PartImage
                src={combo.lockChip?.image ?? null}
                alt="lock chip"
                fallbackLabel={
                  combo.lockChip ? (locale === "zh" ? combo.lockChip.zh : combo.lockChip.id) : "LC"
                }
              />
            </div>
          )}
          {combo.blade?.cx && combo.assist?.image && (
            <div className="-mt-3 h-16 w-full max-w-40 opacity-95">
              <PartImage src={combo.assist.image} alt="assist" fallbackLabel={combo.assist.id} />
            </div>
          )}
          <div className="-mt-2 h-20 w-full max-w-36">
            {combo.ratchet ? (
              <PartImage src={combo.ratchet.image} alt="ratchet" fallbackLabel={combo.ratchet.id} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-edge text-xs text-ink-dim">
                {dict.builder.slotRatchet}
              </div>
            )}
          </div>
          <div className="-mt-1 h-16 w-full max-w-28">
            {combo.bit ? (
              <PartImage src={combo.bit.image} alt="bit" fallbackLabel={combo.bit.id} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-edge text-xs text-ink-dim">
                {dict.builder.slotBit}
              </div>
            )}
          </div>
        </div>

        {/* Slot buttons */}
        <div className="grid grid-cols-2 gap-3">
          {slots
            .filter((s) => !s.hidden)
            .map((s) => (
              <button
                key={s.key}
                onClick={() => setOpenSlot(s.key)}
                className={`panel flex items-center gap-3 p-3 text-left transition hover:border-accent/60 ${
                  s.value ? "" : "border-dashed"
                }`}
              >
                <div className="h-12 w-12 shrink-0">
                  <PartImage src={s.image} alt={s.label} fallbackLabel="+" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-[10px] uppercase tracking-widest text-ink-dim">
                    {s.label}
                  </div>
                  <div className="truncate text-sm font-semibold">
                    {s.value ?? dict.builder.emptySlot}
                  </div>
                </div>
                <span className="ml-auto text-xs text-accent">
                  {s.value ? dict.builder.change : dict.builder.pick}
                </span>
              </button>
            ))}
        </div>

        {combo.blade?.cx && (!combo.lockChip || !combo.assist) && (
          <p className="text-xs text-accent-2">◆ {dict.builder.cxNote}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={randomize}
            className="clip-x border border-edge bg-panel px-4 py-2 font-display text-xs font-bold tracking-wider text-ink transition hover:border-accent-2/60 hover:text-accent-2"
          >
            ⚡ {dict.builder.random}
          </button>
          <button
            onClick={reset}
            className="clip-x border border-edge bg-panel px-4 py-2 font-display text-xs font-bold tracking-wider text-ink-dim transition hover:text-ink"
          >
            {dict.builder.reset}
          </button>
        </div>
      </div>

      {/* Right: name, stats, share */}
      <div className="space-y-4">
        <div className="panel p-5">
          <div className="font-display text-[10px] uppercase tracking-widest text-ink-dim">
            {dict.builder.comboName}
          </div>
          <div className="mt-1 min-h-9 font-display text-2xl font-bold tracking-wide text-glow text-accent">
            {name || "—"}
          </div>
          {type && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-ink-dim">{dict.builder.comboType}:</span>
              <TypeBadge type={type} dict={dict} />
            </div>
          )}
          {!complete && <p className="mt-3 text-xs text-ink-dim">{dict.builder.incomplete}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={share}
              disabled={!combo.blade}
              className="clip-x bg-accent px-5 py-2.5 font-display text-xs font-bold tracking-wider text-bg transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ⤴ {dict.builder.share}
            </button>
            <button
              onClick={copyName}
              disabled={!combo.blade}
              className="clip-x border border-edge bg-panel px-5 py-2.5 font-display text-xs font-bold tracking-wider transition enabled:hover:border-accent/60 enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dict.builder.copyName}
            </button>
          </div>
        </div>

        {stats && (
          <div className="panel p-5">
            <div className="mb-2 font-display text-[10px] uppercase tracking-widest text-ink-dim">
              {dict.builder.statsTitle}
            </div>
            <Radar stats={stats} dict={dict} />
          </div>
        )}
      </div>

      {openSlot && (
        <PickerModal
          title={slotLabels[openSlot]}
          items={pickerItems[openSlot]}
          dict={dict}
          onClose={() => setOpenSlot(null)}
          onPick={(id) => {
            setters[openSlot](id);
            setOpenSlot(null);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-accent px-5 py-2 font-display text-xs font-bold text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
