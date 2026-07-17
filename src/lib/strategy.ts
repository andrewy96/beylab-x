import { Combo, comboStats, comboType } from "@/lib/combo";

export type StrategyLocale = "en" | "zh";
export type StrategySource = "ai" | "cache" | "fallback";

export interface StrategyResult {
  edge?: string;
  confidence?: string;
  prediction?: string;
  summary?: string;
  openingPlan?: string[];
  winConditions?: string[];
  risks?: string[];
  adjustments?: string[];
}

export interface StrategyPair {
  en: StrategyResult;
  zh: StrategyResult;
}

export interface StrategyQuota {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
}

export interface StrategyComboKey {
  bladeId: string;
  lockChipId: string | null;
  assistId: string | null;
  ratchetId: string;
  bitId: string;
  type: ReturnType<typeof comboType>;
  stats: ReturnType<typeof comboStats>;
}

export interface StrategyMatchupKey {
  version: 1;
  own: StrategyComboKey;
  opponent: StrategyComboKey;
}

export function strategyComboKey(combo: Combo): StrategyComboKey | null {
  if (!combo.blade || !combo.ratchet || !combo.bit) return null;
  if (combo.blade.cx && (!combo.lockChip || !combo.assist)) return null;

  return {
    bladeId: combo.blade.id,
    lockChipId: combo.blade.cx ? combo.lockChip?.id ?? null : null,
    assistId: combo.blade.cx ? combo.assist?.id ?? null : null,
    ratchetId: combo.ratchet.id,
    bitId: combo.bit.id,
    type: comboType(combo),
    stats: comboStats(combo),
  };
}

export function strategyMatchupKey(own: Combo, opponent: Combo): StrategyMatchupKey | null {
  const ownKey = strategyComboKey(own);
  const opponentKey = strategyComboKey(opponent);
  if (!ownKey || !opponentKey) return null;

  return {
    version: 1,
    own: ownKey,
    opponent: opponentKey,
  };
}

export function strategyMatchupKeyJson(own: Combo, opponent: Combo): string | null {
  const key = strategyMatchupKey(own, opponent);
  return key ? JSON.stringify(key) : null;
}
