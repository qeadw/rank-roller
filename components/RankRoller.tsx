'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';

const SAVE_KEY = 'rankroller_save';
const SAVE_VERSION = 'RR1:';
const OBF_KEY = 'RankRoller2024';

function obfuscateSave(data: string): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length));
  }
  return SAVE_VERSION + btoa(result);
}

function deobfuscateSave(data: string): string {
  if (!data.startsWith(SAVE_VERSION)) return data; // Legacy save
  const encoded = data.slice(SAVE_VERSION.length);
  const decoded = atob(encoded);
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length));
  }
  return result;
}

interface SaveData {
  rollCount: number;
  totalPoints: number;
  highestRankIndex: number | null;
  highestRankRoll: number | null;
  collectedRanks: number[];
  rankRollCounts: Record<number, number>;
  ascendedRanks: number[] | Record<number, number>; // Legacy: array, New: record with ascension level
  luckLevel: number;
  pointsMultiLevel: number;
  speedLevel: number;
  claimedMilestones: string[];
  // Rune data
  collectedRunes: number[];
  runeRollCounts: Record<number, number>;
  runeRollCount: number;
  // Legitimate rune rolls (not cheatable, used for milestones)
  legitimateRuneRollCounts?: Record<number, number>;
  // Bulk roll upgrade
  bulkRollLevel?: number;
  // Rune bulk roll upgrade (0-2, costs 1B and 1T)
  runeBulkRollLevel?: number;
  // Game speed cheat multiplier
  gameSpeedMultiplier?: number;
  // Prestige system
  rollerPrestigeLevel?: number;
  runePrestigeLevel?: number;
  // Cost reduction upgrade
  costReductionLevel?: number;
}

interface MilestoneState {
  rollCount: number;
  collectedRanks: Set<number>;
  ascendedRanks: Map<number, number>; // Map of rankIndex -> ascension level (1, 2, or 3)
  collectedRunes: Set<number>;
  runeRollCounts: Record<number, number>;
  legitimateRuneRollCounts: Record<number, number>;
  runeRollCount: number; // Total number of rune rolls
}

// Ascension tier thresholds and multipliers
const ASCENSION_TIERS = [
  { rolls: 1000, multiplier: 2, stars: 1 },
  { rolls: 15000, multiplier: 3, stars: 2 },
  { rolls: 250000, multiplier: 4, stars: 3 },
  { rolls: 5000000, multiplier: 5, stars: 4 },
  { rolls: 50000000, multiplier: 100, stars: 5 },
];

interface Milestone {
  id: string;
  name: string;
  description: string;
  requirement: (state: MilestoneState) => boolean;
  reward: number;
  luckBonus?: number;
  pointsBonus?: number;
  speedBonus?: number;
  unlockAutoRoll?: boolean;
  unlockSlowAutoRoll?: boolean;
  unlockSlowRuneAutoRoll?: boolean;
  unlockFastRuneAutoRoll?: boolean;
  runeSpeedBonus?: number;
  runeLuckBonus?: number;
}

interface Rune {
  index: number;
  name: string;
  color: string;
  weight: number;
  probability: number;
}

const RUNE_NAMES = [
  'Rune of Beginning',
  'Rune of Embers',
  'Rune of Tides',
  'Rune of Gales',
  'Rune of Stone',
  'Rune of Thunder',
  'Rune of Frost',
  'Rune of Shadow',
  'Rune of Light',
  'Rune of Eternity',
];

const RUNE_COLORS = [
  '#808080',  // Beginning - gray
  '#ff6b35',  // Embers - orange-red
  '#0077be',  // Tides - blue
  '#7fdbca',  // Gales - teal
  '#8b4513',  // Stone - brown
  '#ffd700',  // Thunder - gold
  '#87ceeb',  // Frost - ice blue
  '#4a0080',  // Shadow - dark purple
  '#ffffff',  // Light - white
  '#ff00ff',  // Eternity - magenta
];

function generateRunes(): Rune[] {
  const runes: Rune[] = [];
  let totalWeight = 0;

  // First rune is 1/2, each subsequent is 12x rarer
  for (let i = 0; i < 10; i++) {
    const weight = 1 / Math.pow(12, i);
    totalWeight += weight;

    runes.push({
      index: i,
      name: RUNE_NAMES[i],
      color: RUNE_COLORS[i],
      weight,
      probability: 0,
    });
  }

  // Calculate probabilities
  for (const rune of runes) {
    rune.probability = rune.weight / totalWeight;
  }

  return runes;
}

function rollRune(runes: Rune[]): Rune {
  const totalWeight = runes.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < runes.length; i++) {
    random -= runes[i].weight;
    if (random <= 0) {
      return runes[i];
    }
  }

  return runes[0];
}

function getEffectiveRuneWeights(runes: Rune[], runeLuck: number): number[] {
  // Rune luck boosts rarer runes more (similar to rank luck)
  return runes.map((rune) => rune.weight * Math.pow(runeLuck, rune.index));
}

function rollRuneWithLuck(runes: Rune[], runeLuck: number): Rune {
  const effectiveWeights = getEffectiveRuneWeights(runes, runeLuck);
  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < runes.length; i++) {
    random -= effectiveWeights[i];
    if (random <= 0) {
      return runes[i];
    }
  }

  return runes[0];
}

function getEffectiveRuneProbability(rune: Rune, runes: Rune[], runeLuck: number): number {
  const effectiveWeights = getEffectiveRuneWeights(runes, runeLuck);
  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  return effectiveWeights[rune.index] / totalWeight;
}

// Helper to check if a tier is complete
function isTierComplete(collectedRanks: Set<number>, tierIndex: number): boolean {
  for (let i = 0; i < 10; i++) {
    if (!collectedRanks.has(tierIndex * 10 + i)) return false;
  }
  return true;
}

// Helper to check if player has any rank from a tier
function hasAnyFromTier(collectedRanks: Set<number>, tierIndex: number): boolean {
  for (let i = 0; i < 10; i++) {
    if (collectedRanks.has(tierIndex * 10 + i)) return true;
  }
  return false;
}

// Helper to check if all ranks in a tier have tier 5 ascension (level 5)
function hasTierFullAscension(ascendedRanks: Map<number, number>, tierIndex: number): boolean {
  for (let i = 0; i < 10; i++) {
    const rankIndex = tierIndex * 10 + i;
    if ((ascendedRanks.get(rankIndex) || 0) < 5) return false;
  }
  return true;
}

// Helper to get which runes are unlocked based on progression
// First 3 runes available, then unlock more with higher tier firsts
function getUnlockedRunes(collectedRanks: Set<number>): Set<number> {
  const unlocked = new Set<number>([0, 1, 2]); // Beginning, Embers, Tides always available

  // Rune 3 (Gales): First Epic (tier 3)
  if (hasAnyFromTier(collectedRanks, 3)) unlocked.add(3);
  // Rune 4 (Stone): First Legendary (tier 4)
  if (hasAnyFromTier(collectedRanks, 4)) unlocked.add(4);
  // Rune 5 (Thunder): First Mythic (tier 5)
  if (hasAnyFromTier(collectedRanks, 5)) unlocked.add(5);
  // Rune 6 (Frost): First Divine (tier 6)
  if (hasAnyFromTier(collectedRanks, 6)) unlocked.add(6);
  // Rune 7 (Shadow): First Celestial (tier 7)
  if (hasAnyFromTier(collectedRanks, 7)) unlocked.add(7);
  // Rune 8 (Light): First Transcendent (tier 8)
  if (hasAnyFromTier(collectedRanks, 8)) unlocked.add(8);
  // Rune 9 (Eternity): First Ultimate (tier 9)
  if (hasAnyFromTier(collectedRanks, 9)) unlocked.add(9);

  return unlocked;
}

// Helper to check if any rank in a tier has ascension available
function tierHasAscensionAvailable(tierIndex: number, rankRollCounts: Record<number, number>, ascendedRanks: Map<number, number>): boolean {
  for (let i = 0; i < 10; i++) {
    const rankIndex = tierIndex * 10 + i;
    const rolls = rankRollCounts[rankIndex] || 0;
    const currentLevel = ascendedRanks.get(rankIndex) || 0;
    // Check if there's a next tier available
    for (let tier = currentLevel; tier < ASCENSION_TIERS.length; tier++) {
      if (rolls >= ASCENSION_TIERS[tier].rolls) {
        return true;
      }
    }
  }
  return false;
}

// Get the next available ascension tier for a rank
function getNextAscensionTier(rankIndex: number, rankRollCounts: Record<number, number>, ascendedRanks: Map<number, number>): number | null {
  const rolls = rankRollCounts[rankIndex] || 0;
  const currentLevel = ascendedRanks.get(rankIndex) || 0;

  for (let tier = currentLevel; tier < ASCENSION_TIERS.length; tier++) {
    if (rolls >= ASCENSION_TIERS[tier].rolls) {
      return tier;
    }
  }
  return null;
}

// Get ascension multiplier for a rank
function getAscensionMultiplier(rankIndex: number, ascendedRanks: Map<number, number>): number {
  const level = ascendedRanks.get(rankIndex) || 0;
  if (level === 0) return 1;
  return ASCENSION_TIERS[level - 1].multiplier;
}

// Get stars to display for a rank (returns string for levels 1-4, special for level 5)
function getAscensionStars(rankIndex: number, ascendedRanks: Map<number, number>): string {
  const level = ascendedRanks.get(rankIndex) || 0;
  if (level === 0) return '';
  if (level === 5) return ''; // Level 5 uses special star component
  return ' ' + '★'.repeat(level);
}

// Special star component for level 5 ascension
function AscensionStar5({ rankIndex, ascendedRanks }: { rankIndex: number; ascendedRanks: Map<number, number> }): JSX.Element | null {
  const level = ascendedRanks.get(rankIndex) || 0;
  if (level !== 5) return null;

  // Get the current tier and next tier color
  const tierIndex = Math.floor(rankIndex / 10);
  const nextTierIndex = Math.min(tierIndex + 1, TIER_NAMES.length - 1);
  const nextTierName = TIER_NAMES[nextTierIndex];
  const nextTierColor = TIER_COLORS[nextTierName]?.bg || '#FFD700';

  return (
    <span style={{
      marginLeft: '4px',
      color: nextTierColor,
      textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 3px #000',
      fontWeight: 'bold',
    }}>★</span>
  );
}

const MILESTONES: Milestone[] = [
  {
    id: 'rolls_100',
    name: '100 Rolls',
    description: 'Roll 100 times',
    requirement: (state) => state.rollCount >= 100,
    reward: 100,
    unlockSlowAutoRoll: true,
  },
  {
    id: 'rolls_1000',
    name: '1,000 Rolls',
    description: 'Roll 1,000 times',
    requirement: (state) => state.rollCount >= 1000,
    reward: 1000,
  },
  {
    id: 'rolls_2500',
    name: '2,500 Rolls',
    description: 'Roll 2,500 times',
    requirement: (state) => state.rollCount >= 2500,
    reward: 0,
    luckBonus: 1.5,
  },
  {
    id: 'complete_common',
    name: 'Common Complete',
    description: 'Collect all Common ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 0),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'complete_uncommon',
    name: 'Uncommon Complete',
    description: 'Collect all Uncommon ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 1),
    reward: 0,
    speedBonus: 1.5,
  },
  {
    id: 'complete_rare',
    name: 'Rare Complete',
    description: 'Collect all Rare ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 2),
    reward: 0,
    speedBonus: 1.5,
  },
  {
    id: 'complete_epic',
    name: 'Epic Complete',
    description: 'Collect all Epic ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 3),
    reward: 0,
    pointsBonus: 5,
  },
  {
    id: 'complete_legendary',
    name: 'Legendary Complete',
    description: 'Collect all Legendary ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 4),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'complete_mythic',
    name: 'Mythic Complete',
    description: 'Collect all Mythic ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 5),
    reward: 0,
    pointsBonus: 5,
  },
  {
    id: 'complete_divine',
    name: 'Divine Complete',
    description: 'Collect all Divine ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 6),
    reward: 0,
    luckBonus: 5,
  },
  {
    id: 'complete_celestial',
    name: 'Celestial Complete',
    description: 'Collect all Celestial ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 7),
    reward: 0,
    speedBonus: 3,
  },
  {
    id: 'complete_cosmic',
    name: 'Cosmic Complete',
    description: 'Collect all Cosmic ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 8),
    reward: 0,
    pointsBonus: 10,
  },
  {
    id: 'complete_ultimate',
    name: 'Ultimate Complete',
    description: 'Collect all Ultimate ranks',
    requirement: (state) => isTierComplete(state.collectedRanks, 9),
    reward: 0,
    luckBonus: 10,
  },
  // Tier 5 Ascension milestones (50M rolls on all 10 of a rarity)
  {
    id: 'ascend5_common',
    name: 'Common Mastery',
    description: 'Tier 5 ascension on all Common ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 0),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_uncommon',
    name: 'Uncommon Mastery',
    description: 'Tier 5 ascension on all Uncommon ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 1),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_rare',
    name: 'Rare Mastery',
    description: 'Tier 5 ascension on all Rare ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 2),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_epic',
    name: 'Epic Mastery',
    description: 'Tier 5 ascension on all Epic ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 3),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_legendary',
    name: 'Legendary Mastery',
    description: 'Tier 5 ascension on all Legendary ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 4),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_mythic',
    name: 'Mythic Mastery',
    description: 'Tier 5 ascension on all Mythic ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 5),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_divine',
    name: 'Divine Mastery',
    description: 'Tier 5 ascension on all Divine ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 6),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_celestial',
    name: 'Celestial Mastery',
    description: 'Tier 5 ascension on all Celestial ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 7),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_cosmic',
    name: 'Cosmic Mastery',
    description: 'Tier 5 ascension on all Cosmic ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 8),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'ascend5_ultimate',
    name: 'Ultimate Mastery',
    description: 'Tier 5 ascension on all Ultimate ranks',
    requirement: (state) => hasTierFullAscension(state.ascendedRanks, 9),
    reward: 0,
    luckBonus: 3,
  },
  {
    id: 'rolls_5000',
    name: '5,000 Rolls',
    description: 'Roll 5,000 times',
    requirement: (state) => state.rollCount >= 5000,
    reward: 0,
    unlockAutoRoll: true,
  },
  {
    id: 'rolls_10000',
    name: '10,000 Rolls',
    description: 'Roll 10,000 times',
    requirement: (state) => state.rollCount >= 10000,
    reward: 0,
    luckBonus: 1.5,
  },
  {
    id: 'rolls_15000',
    name: '15,000 Rolls',
    description: 'Roll 15,000 times',
    requirement: (state) => state.rollCount >= 15000,
    reward: 0,
    pointsBonus: 3,
  },
  {
    id: 'rolls_25000',
    name: '25,000 Rolls',
    description: 'Roll 25,000 times',
    requirement: (state) => state.rollCount >= 25000,
    reward: 0,
    luckBonus: 2,
  },
  {
    id: 'rolls_50000',
    name: '50,000 Rolls',
    description: 'Roll 50,000 times',
    requirement: (state) => state.rollCount >= 50000,
    reward: 0,
    pointsBonus: 4,
  },
  // First of each tier milestones
  {
    id: 'first_common',
    name: 'First Common',
    description: 'Roll your first Common rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 0),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_uncommon',
    name: 'First Uncommon',
    description: 'Roll your first Uncommon rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 1),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_rare',
    name: 'First Rare',
    description: 'Roll your first Rare rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 2),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_epic',
    name: 'First Epic',
    description: 'Roll your first Epic rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 3),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_legendary',
    name: 'First Legendary',
    description: 'Roll your first Legendary rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 4),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_mythic',
    name: 'First Mythic',
    description: 'Roll your first Mythic rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 5),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_divine',
    name: 'First Divine',
    description: 'Roll your first Divine rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 6),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_celestial',
    name: 'First Celestial',
    description: 'Roll your first Celestial rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 7),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_cosmic',
    name: 'First Cosmic',
    description: 'Roll your first Cosmic rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 8),
    reward: 0,
    pointsBonus: 1.1,
  },
  {
    id: 'first_ultimate',
    name: 'First Ultimate',
    description: 'Roll your first Ultimate rank',
    requirement: (state) => hasAnyFromTier(state.collectedRanks, 9),
    reward: 0,
    pointsBonus: 1.1,
  },
  // Ascension milestones
  {
    id: 'first_ascension',
    name: 'First Ascension',
    description: 'Ascend a rank for the first time',
    requirement: (state) => state.ascendedRanks.size >= 1,
    reward: 0,
    speedBonus: 1.2,
  },
  {
    id: 'ten_ascensions',
    name: 'Ascension Master',
    description: 'Ascend 10 different ranks',
    requirement: (state) => state.ascendedRanks.size >= 10,
    reward: 0,
    speedBonus: 1.5,
  },
  // First rune milestones (1.05x rune speed each)
  {
    id: 'first_rune_0',
    name: 'First Beginning',
    description: 'Roll your first Rune of Beginning',
    requirement: (state) => state.collectedRunes.has(0),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_1',
    name: 'First Embers',
    description: 'Roll your first Rune of Embers',
    requirement: (state) => state.collectedRunes.has(1),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_2',
    name: 'First Tides',
    description: 'Roll your first Rune of Tides',
    requirement: (state) => state.collectedRunes.has(2),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_3',
    name: 'First Gales',
    description: 'Roll your first Rune of Gales',
    requirement: (state) => state.collectedRunes.has(3),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_4',
    name: 'First Stone',
    description: 'Roll your first Rune of Stone',
    requirement: (state) => state.collectedRunes.has(4),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_5',
    name: 'First Thunder',
    description: 'Roll your first Rune of Thunder',
    requirement: (state) => state.collectedRunes.has(5),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_6',
    name: 'First Frost',
    description: 'Roll your first Rune of Frost',
    requirement: (state) => state.collectedRunes.has(6),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_7',
    name: 'First Shadow',
    description: 'Roll your first Rune of Shadow',
    requirement: (state) => state.collectedRunes.has(7),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_8',
    name: 'First Light',
    description: 'Roll your first Rune of Light',
    requirement: (state) => state.collectedRunes.has(8),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  {
    id: 'first_rune_9',
    name: 'First Eternity',
    description: 'Roll your first Rune of Eternity',
    requirement: (state) => state.collectedRunes.has(9),
    reward: 0,
    runeSpeedBonus: 1.05,
  },
  // 10x rune milestones (1.1x rune luck each)
  {
    id: 'ten_rune_0',
    name: 'Beginning Collector',
    description: 'Roll 10 Runes of Beginning',
    requirement: (state) => (state.legitimateRuneRollCounts[0] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_1',
    name: 'Embers Collector',
    description: 'Roll 10 Runes of Embers',
    requirement: (state) => (state.legitimateRuneRollCounts[1] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_2',
    name: 'Tides Collector',
    description: 'Roll 10 Runes of Tides',
    requirement: (state) => (state.legitimateRuneRollCounts[2] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_3',
    name: 'Gales Collector',
    description: 'Roll 10 Runes of Gales',
    requirement: (state) => (state.legitimateRuneRollCounts[3] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_4',
    name: 'Stone Collector',
    description: 'Roll 10 Runes of Stone',
    requirement: (state) => (state.legitimateRuneRollCounts[4] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_5',
    name: 'Thunder Collector',
    description: 'Roll 10 Runes of Thunder',
    requirement: (state) => (state.legitimateRuneRollCounts[5] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_6',
    name: 'Frost Collector',
    description: 'Roll 10 Runes of Frost',
    requirement: (state) => (state.legitimateRuneRollCounts[6] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_7',
    name: 'Shadow Collector',
    description: 'Roll 10 Runes of Shadow',
    requirement: (state) => (state.legitimateRuneRollCounts[7] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_8',
    name: 'Light Collector',
    description: 'Roll 10 Runes of Light',
    requirement: (state) => (state.legitimateRuneRollCounts[8] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  {
    id: 'ten_rune_9',
    name: 'Eternity Collector',
    description: 'Roll 10 Runes of Eternity',
    requirement: (state) => (state.legitimateRuneRollCounts[9] || 0) >= 10,
    reward: 0,
    runeLuckBonus: 1.1,
  },
  // Rune autoroll milestones
  {
    id: 'rune_rolls_500',
    name: '500 Rune Rolls',
    description: 'Roll runes 500 times',
    requirement: (state) => state.runeRollCount >= 500,
    reward: 0,
    unlockSlowRuneAutoRoll: true,
  },
  {
    id: 'rune_rolls_5000',
    name: '5,000 Rune Rolls',
    description: 'Roll runes 5,000 times',
    requirement: (state) => state.runeRollCount >= 5000,
    reward: 0,
    unlockFastRuneAutoRoll: true,
  },
];

function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }
  return null;
}

const TIER_NAMES = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
  'Mythic',
  'Divine',
  'Celestial',
  'Transcendent',
  'Ultimate',
];

const TIER_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  Common: { bg: '#808080', text: '#ffffff', glow: 'rgba(128, 128, 128, 0.5)' },
  Uncommon: { bg: '#1eff00', text: '#000000', glow: 'rgba(30, 255, 0, 0.5)' },
  Rare: { bg: '#0070dd', text: '#ffffff', glow: 'rgba(0, 112, 221, 0.5)' },
  Epic: { bg: '#a335ee', text: '#ffffff', glow: 'rgba(163, 53, 238, 0.5)' },
  Legendary: { bg: '#ff8000', text: '#000000', glow: 'rgba(255, 128, 0, 0.5)' },
  Mythic: { bg: '#e6cc80', text: '#000000', glow: 'rgba(230, 204, 128, 0.5)' },
  Divine: { bg: '#00ffff', text: '#000000', glow: 'rgba(0, 255, 255, 0.5)' },
  Celestial: { bg: '#ff69b4', text: '#000000', glow: 'rgba(255, 105, 180, 0.5)' },
  Transcendent: { bg: '#ff0000', text: '#ffffff', glow: 'rgba(255, 0, 0, 0.5)' },
  Ultimate: { bg: '#000000', text: '#ffffff', glow: 'rgba(255, 215, 0, 0.8)' },
};

interface Rank {
  index: number;
  tier: string;
  tierNumber: number;
  displayName: string;
  weight: number;
  probability: number;
}

function generateRanks(): Rank[] {
  const ranks: Rank[] = [];
  let totalWeight = 0;

  // Calculate weights: each rank is 1.5x rarer than the previous
  // Weight for rank n (0-indexed) = 1 / 1.5^n
  for (let i = 0; i < 100; i++) {
    const weight = 1 / Math.pow(1.5, i);
    totalWeight += weight;

    const tierIndex = Math.floor(i / 10);
    const tierNumber = (i % 10) + 1;
    const tier = TIER_NAMES[tierIndex];

    ranks.push({
      index: i,
      tier,
      tierNumber,
      displayName: `${tier} ${tierNumber}`,
      weight,
      probability: 0, // Will calculate after
    });
  }

  // Calculate actual probabilities
  for (const rank of ranks) {
    rank.probability = rank.weight / totalWeight;
  }

  return ranks;
}

function getEffectiveWeights(ranks: Rank[], luckMulti: number): number[] {
  // Luck multiplier boosts higher ranks smoothly based on individual rank index
  // Rank 0 (Common 1) gets no boost, Rank 99 (Ultimate 10) gets full luck boost
  // This ensures rarer ranks always stay rarer, even with very high luck
  return ranks.map((rank) => {
    return rank.weight * Math.pow(luckMulti, rank.index / 99);
  });
}

function rollRankWithLuck(ranks: Rank[], luckMulti: number): Rank {
  const effectiveWeights = getEffectiveWeights(ranks, luckMulti);
  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < ranks.length; i++) {
    random -= effectiveWeights[i];
    if (random <= 0) {
      return ranks[i];
    }
  }

  return ranks[0]; // Fallback
}

function getEffectiveProbability(rank: Rank, ranks: Rank[], luckMulti: number): number {
  const effectiveWeights = getEffectiveWeights(ranks, luckMulti);
  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  return effectiveWeights[rank.index] / totalWeight;
}

function calculatePoints(rank: Rank): number {
  const rankNumber = rank.index + 1; // 1-100
  const exponentialPoints = Math.floor(Math.pow(2, rankNumber / 4));
  return Math.max(rankNumber, exponentialPoints);
}

// Format large numbers with suffixes (K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc)
function formatNumber(num: number): string {
  if (num < 1000) return num.toLocaleString();
  const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const tier = Math.floor(Math.log10(Math.abs(num)) / 3);
  if (tier >= suffixes.length) return num.toExponential(2);
  const suffix = suffixes[tier];
  const scale = Math.pow(10, tier * 3);
  const scaled = num / scale;
  return scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0) + suffix;
}

export default function RankRoller() {
  const ranks = useMemo(() => generateRanks(), []);
  const runes = useMemo(() => generateRunes(), []);
  const [currentRoll, setCurrentRoll] = useState<Rank | null>(null);
  const [highestRank, setHighestRank] = useState<Rank | null>(null);
  const [highestRankRoll, setHighestRankRoll] = useState<number | null>(null);
  const [rollCount, setRollCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [lastPointsGained, setLastPointsGained] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [collectedRanks, setCollectedRanks] = useState<Set<number>>(new Set());
  const [rankRollCounts, setRankRollCounts] = useState<Record<number, number>>({});
  const [ascendedRanks, setAscendedRanks] = useState<Map<number, number>>(new Map());
  const [ascendPrompt, setAscendPrompt] = useState<number | null>(null);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [luckLevel, setLuckLevel] = useState(0);
  const [pointsMultiLevel, setPointsMultiLevel] = useState(0);
  const [speedLevel, setSpeedLevel] = useState(0);
  const [costReductionLevel, setCostReductionLevel] = useState(0); // 0-5, each level gives 10% cost reduction
  const [claimedMilestones, setClaimedMilestones] = useState<Set<string>>(new Set());
  const [showMilestones, setShowMilestones] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [autoRollEnabled, setAutoRollEnabled] = useState(false);
  const [runeAutoRollEnabled, setRuneAutoRollEnabled] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [showRunes, setShowRunes] = useState(false);
  const [showPercentFormat, setShowPercentFormat] = useState(false); // false = 1/x, true = x%
  // Rune state
  const [currentRuneRoll, setCurrentRuneRoll] = useState<Rune | null>(null);
  const [collectedRunes, setCollectedRunes] = useState<Set<number>>(new Set());
  const [runeRollCounts, setRuneRollCounts] = useState<Record<number, number>>({});
  const [legitimateRuneRollCounts, setLegitimateRuneRollCounts] = useState<Record<number, number>>({});
  const [runeRollCount, setRuneRollCount] = useState(0);
  const [isRollingRune, setIsRollingRune] = useState(false);
  const [showCheatMenu, setShowCheatMenu] = useState(false);
  const [cheatBuffer, setCheatBuffer] = useState('');
  const [showMultiplierBreakdown, setShowMultiplierBreakdown] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [bulkRollLevel, setBulkRollLevel] = useState(0); // 0-4, each level adds +1 bulk
  const [runeBulkRollLevel, setRuneBulkRollLevel] = useState(0); // 0-2, each level adds +1 rune bulk
  const [gameSpeedMultiplier, setGameSpeedMultiplier] = useState(1); // Cheat: game speed multiplier
  const [rollerPrestigeLevel, setRollerPrestigeLevel] = useState(0); // Prestige level for roller
  const [runePrestigeLevel, setRunePrestigeLevel] = useState(0); // Prestige level for runes
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const rollCountRef = useRef(rollCount);
  const totalPointsRef = useRef(totalPoints);
  const isRollingRuneRef = useRef(isRollingRune);
  const availableRunesRef = useRef<typeof runes>([]);
  const runeRollCostRef = useRef(0);
  const runeBulkCountRef = useRef(1);
  const totalRuneLuckRef = useRef(1);

  // Bulk roll upgrade base costs (actual costs calculated after shadowCostReduction)
  const BULK_UPGRADE_COSTS = [10000, 100000, 1000000, 10000000];

  // Rune bulk roll upgrade base costs (actual costs calculated after shadowCostReduction)
  const RUNE_BULK_UPGRADE_COSTS = [1000000000, 1000000000000];

  // Load save data from cookies on mount
  useEffect(() => {
    const savedData = getCookie(SAVE_KEY);
    if (savedData) {
      try {
        const data: SaveData = JSON.parse(deobfuscateSave(savedData));
        setRollCount(data.rollCount || 0);
        setTotalPoints(data.totalPoints || 0);
        if (data.highestRankIndex !== null && data.highestRankIndex !== undefined) {
          setHighestRank(ranks[data.highestRankIndex]);
        }
        setHighestRankRoll(data.highestRankRoll || null);
        setCollectedRanks(new Set(data.collectedRanks || []));
        setRankRollCounts(data.rankRollCounts || {});
        // Handle both legacy (array) and new (record) formats for ascendedRanks
        if (Array.isArray(data.ascendedRanks)) {
          // Legacy format: array of rank indices (all at level 1)
          const legacyMap = new Map<number, number>();
          for (const rankIndex of data.ascendedRanks) {
            legacyMap.set(rankIndex, 1);
          }
          setAscendedRanks(legacyMap);
        } else if (data.ascendedRanks && typeof data.ascendedRanks === 'object') {
          // New format: record of rankIndex -> level
          const newMap = new Map<number, number>();
          for (const [key, value] of Object.entries(data.ascendedRanks)) {
            newMap.set(Number(key), value as number);
          }
          setAscendedRanks(newMap);
        } else {
          setAscendedRanks(new Map());
        }
        setLuckLevel(data.luckLevel || 0);
        setPointsMultiLevel(data.pointsMultiLevel || 0);
        setSpeedLevel(data.speedLevel || 0);
        setCostReductionLevel(data.costReductionLevel || 0);
        setClaimedMilestones(new Set(data.claimedMilestones || []));
        // Load rune data
        setCollectedRunes(new Set(data.collectedRunes || []));
        setRuneRollCounts(data.runeRollCounts || {});
        setLegitimateRuneRollCounts(data.legitimateRuneRollCounts || data.runeRollCounts || {});
        setRuneRollCount(data.runeRollCount || 0);
        // Load bulk roll upgrade and game speed
        setBulkRollLevel(data.bulkRollLevel || 0);
        setRuneBulkRollLevel(data.runeBulkRollLevel || 0);
        setGameSpeedMultiplier(data.gameSpeedMultiplier || 1);
        // Load prestige levels
        setRollerPrestigeLevel(data.rollerPrestigeLevel || 0);
        setRunePrestigeLevel(data.runePrestigeLevel || 0);
      } catch (e) {
        console.error('Failed to load save data:', e);
      }
    }
    setIsLoaded(true);
  }, [ranks]);

  // Save to cookies whenever state changes
  const saveGame = useCallback(() => {
    if (!isLoaded) return;

    // Convert Map to Record for saving
    const ascendedRanksRecord: Record<number, number> = {};
    ascendedRanks.forEach((level, rankIndex) => {
      ascendedRanksRecord[rankIndex] = level;
    });

    const saveData: SaveData = {
      rollCount,
      totalPoints,
      highestRankIndex: highestRank?.index ?? null,
      highestRankRoll,
      collectedRanks: Array.from(collectedRanks),
      rankRollCounts,
      ascendedRanks: ascendedRanksRecord,
      luckLevel,
      pointsMultiLevel,
      speedLevel,
      costReductionLevel,
      claimedMilestones: Array.from(claimedMilestones),
      // Rune data
      collectedRunes: Array.from(collectedRunes),
      runeRollCounts,
      legitimateRuneRollCounts,
      runeRollCount,
      // Bulk roll upgrade and game speed
      bulkRollLevel,
      runeBulkRollLevel,
      gameSpeedMultiplier,
      // Prestige levels
      rollerPrestigeLevel,
      runePrestigeLevel,
    };
    setCookie(SAVE_KEY, obfuscateSave(JSON.stringify(saveData)));
  }, [isLoaded, rollCount, totalPoints, highestRank, highestRankRoll, collectedRanks, rankRollCounts, ascendedRanks, luckLevel, pointsMultiLevel, speedLevel, costReductionLevel, claimedMilestones, collectedRunes, runeRollCounts, legitimateRuneRollCounts, runeRollCount, bulkRollLevel, runeBulkRollLevel, gameSpeedMultiplier, rollerPrestigeLevel, runePrestigeLevel]);

  useEffect(() => {
    saveGame();
  }, [saveGame]);

  // Cheat code and save modal listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const newBuffer = (cheatBuffer + e.key).slice(-7);
      setCheatBuffer(newBuffer);
      if (newBuffer.toLowerCase() === 'cheater') {
        setShowCheatMenu(true);
        setCheatBuffer('');
      }
      if (newBuffer.toLowerCase().endsWith('save')) {
        setShowSaveModal(true);
        setCheatBuffer('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cheatBuffer]);

  // Export save to file
  const exportSave = () => {
    const saveData = getCookie(SAVE_KEY);
    if (!saveData) {
      alert('No save data found!');
      return;
    }
    const blob = new Blob([saveData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rank-roller-save-${new Date().toISOString().split('T')[0]}.sav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import save from file
  const importSave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const saveData = event.target?.result as string;
        // Validate obfuscated format
        if (!saveData.startsWith('RR1:')) {
          alert('Invalid save file format!');
          return;
        }
        setCookie(SAVE_KEY, saveData);
        alert('Save imported successfully! Refreshing...');
        window.location.reload();
      } catch {
        alert('Invalid save file!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Calculate milestone bonuses
  const milestoneLuckBonus = MILESTONES.reduce((acc, m) => {
    if (claimedMilestones.has(m.id) && m.luckBonus) {
      return acc * m.luckBonus;
    }
    return acc;
  }, 1);

  const milestonePointsBonus = MILESTONES.reduce((acc, m) => {
    if (claimedMilestones.has(m.id) && m.pointsBonus) {
      return acc * m.pointsBonus;
    }
    return acc;
  }, 1);

  const milestoneSpeedBonus = MILESTONES.reduce((acc, m) => {
    if (claimedMilestones.has(m.id) && m.speedBonus) {
      return acc * m.speedBonus;
    }
    return acc;
  }, 1);

  // Rune bonuses (additive with themselves, compounding with others)
  const runeOfBeginningCount = runeRollCounts[0] || 0; // Gives +0.1x points per roll
  const runeOfEmbersCount = runeRollCounts[1] || 0; // Gives +0.1x luck per roll
  const runeOfTidesCount = runeRollCounts[2] || 0; // Gives +0.5x speed per roll
  const runeOfGalesCount = runeRollCounts[3] || 0; // Gives +0.2x rune roll speed per roll
  const runeOfStoneCount = runeRollCounts[4] || 0; // Gives +1 bulk roll per roll
  const runeOfThunderCount = runeRollCounts[5] || 0; // Gives +0.5x rune luck per roll
  const runeOfFrostCount = runeRollCounts[6] || 0; // Gives +1 rune bulk per roll
  const runeOfShadowCount = runeRollCounts[7] || 0; // Gives -10% upgrade cost per roll (multiplicative)
  const runeOfLightCount = runeRollCounts[8] || 0; // Gives +1x ascension multiplier per roll (2x -> 3x -> 4x...)
  const runeOfEternityCount = runeRollCounts[9] || 0; // Gives +50% to ALL bonuses per roll (multiplicative)

  // Eternity multiplier affects everything
  // Asymptotic formula: approaches 2x but never reaches it
  // 0 runes: 1x, 1 rune: 1.1x, 2 runes: 1.19x, 3 runes: 1.271x, etc.
  const eternityMultiplier = 1 + (1 - Math.pow(0.9, runeOfEternityCount));

  // Points bonus with soft cap at 100x:
  // 0-100x: 1 Beginning = +0.1x points (normal, reaches 100x at 990 Beginning)
  // 100-1000x: 1000 Beginning = +1x points
  // 1000x+: 1M Beginning = +1x points
  const calculateRunePointsBonus = (beginningRunes: number, eternityMult: number): number => {
    const rawRunes = beginningRunes * eternityMult;
    const rawBonus = 1 + rawRunes * 0.1;

    if (rawBonus <= 100) {
      return rawBonus;
    } else if (rawBonus <= 100 + 900 * 1000 * 0.1) {
      const excessBonus = rawBonus - 100;
      const excessRunes = excessBonus / 0.1;
      const softcappedExtra = excessRunes * 0.001;
      return 100 + softcappedExtra;
    } else {
      const tier2Bonus = 900;
      const tier2Runes = 900 * 1000;
      const totalRunesAtTier2End = 990 + tier2Runes;
      const excessRunes = rawRunes - totalRunesAtTier2End;
      const tier3Extra = excessRunes * 0.000001;
      return 100 + tier2Bonus + tier3Extra;
    }
  };
  const runePointsBonus = calculateRunePointsBonus(runeOfBeginningCount, eternityMultiplier);

  // Luck bonus with soft cap at 100x:
  // 0-100x: 1 Embers = +0.1x luck (normal, reaches 100x at 990 Embers)
  // 100-1000x: 1000 Embers = +1x luck
  // 1000x+: 1M Embers = +1x luck
  const calculateRuneLuckBonus = (embersRunes: number, eternityMult: number): number => {
    const rawRunes = embersRunes * eternityMult;
    const rawBonus = 1 + rawRunes * 0.1;

    if (rawBonus <= 100) {
      return rawBonus;
    } else if (rawBonus <= 100 + 900 * 1000 * 0.1) {
      const excessBonus = rawBonus - 100;
      const excessRunes = excessBonus / 0.1;
      const softcappedExtra = excessRunes * 0.001;
      return 100 + softcappedExtra;
    } else {
      const tier2Bonus = 900;
      const tier2Runes = 900 * 1000;
      const totalRunesAtTier2End = 990 + tier2Runes;
      const excessRunes = rawRunes - totalRunesAtTier2End;
      const tier3Extra = excessRunes * 0.000001;
      return 100 + tier2Bonus + tier3Extra;
    }
  };
  const runeLuckBonus = calculateRuneLuckBonus(runeOfEmbersCount, eternityMultiplier);
  // Rune speed with soft cap at 100x:
  // 0-100x: 1 Tides = +0.5x speed (normal, reaches 100x at 198 Tides)
  // 100-1000x: 1000 Tides = +1x speed
  // 1000x+: 1M Tides = +1x speed
  const calculateRuneSpeedBonus = (tidesRunes: number, eternityMult: number): number => {
    const rawTides = tidesRunes * eternityMult;
    const rawSpeed = 1 + rawTides * 0.5; // Base calculation

    if (rawSpeed <= 100) {
      return rawSpeed;
    } else if (rawSpeed <= 100 + 900 * 1000 * 0.5) { // 100 + (900x speed from 900k Tides / 1000 per 1x)
      const excessSpeed = rawSpeed - 100;
      // excessSpeed was calculated at 0.5 per Tides, but we want 0.001 per Tides (1/1000 rate)
      // So we need to convert: excess Tides = excessSpeed / 0.5, new speed = excess Tides * 0.001
      const excessTides = excessSpeed / 0.5;
      const softcappedExtra = excessTides * 0.001;
      return 100 + softcappedExtra;
    } else {
      // Tier 3: even slower scaling
      const tier2Speed = 900; // 900x from tier 2
      const tier2Tides = 900 * 1000; // Tides needed for tier 2
      const totalTidesAtTier2End = 198 + tier2Tides; // 198 to reach 100x + tier 2 tides
      const excessTides = rawTides - totalTidesAtTier2End * eternityMult / eternityMult;
      const tier3Extra = excessTides * 0.000001; // 1M Tides = 1x speed
      return 100 + tier2Speed + tier3Extra;
    }
  };
  const runeSpeedBonus = calculateRuneSpeedBonus(runeOfTidesCount, eternityMultiplier);
  // Rune roll speed bonus with soft cap at 100x:
  // 0-100x: 1 Gales = +0.2x rune speed (normal, reaches 100x at 495 Gales)
  // 100-1000x: 1000 Gales = +1x rune speed
  // 1000x+: 1M Gales = +1x rune speed
  const calculateRuneRuneSpeedBonus = (galesRunes: number, eternityMult: number): number => {
    const rawRunes = galesRunes * eternityMult;
    const rawBonus = 1 + rawRunes * 0.2;

    if (rawBonus <= 100) {
      return rawBonus;
    } else if (rawBonus <= 100 + 900 * 1000 * 0.2) {
      const excessBonus = rawBonus - 100;
      const excessRunes = excessBonus / 0.2;
      const softcappedExtra = excessRunes * 0.001;
      return 100 + softcappedExtra;
    } else {
      const tier2Bonus = 900;
      const tier2Runes = 900 * 1000;
      const totalRunesAtTier2End = 495 + tier2Runes;
      const excessRunes = rawRunes - totalRunesAtTier2End;
      const tier3Extra = excessRunes * 0.000001;
      return 100 + tier2Bonus + tier3Extra;
    }
  };
  const runeRuneSpeedBonus = calculateRuneRuneSpeedBonus(runeOfGalesCount, eternityMultiplier);
  // Bulk roll with soft caps:
  // 0-1000: 1 stone rune = 1 bulk roll
  // 1000-10000: 1000 stone runes = 1 bulk roll
  // 10000+: 1M stone runes = 1 bulk roll
  const calculateBulkRollCount = (stoneRunes: number, bulkLevel: number, eternityMult: number): number => {
    const rawStones = stoneRunes * eternityMult;
    let baseBulk: number;
    if (rawStones <= 1000) {
      baseBulk = Math.floor(1 + rawStones);
    } else if (rawStones <= 1000 + 9000 * 1000) { // 1000 + (9000 bulk rolls * 1000 runes each)
      const extraStones = rawStones - 1000;
      const extraBulk = Math.floor(extraStones / 1000);
      baseBulk = Math.floor(1001 + extraBulk);
    } else {
      const tier1Bulk = 1000; // First 1000 bulk from first 1000 stones
      const tier2Bulk = 9000; // Next 9000 bulk from 9M stones
      const tier2StonesUsed = 9000 * 1000;
      const remainingStones = rawStones - 1000 - tier2StonesUsed;
      const tier3Bulk = Math.floor(remainingStones / 1000000);
      baseBulk = Math.floor(1 + tier1Bulk + tier2Bulk + tier3Bulk);
    }
    // Add upgrade bonus directly to bulk count
    return baseBulk + bulkLevel;
  };
  const bulkRollCount = calculateBulkRollCount(runeOfStoneCount, bulkRollLevel, eternityMultiplier);
  // Rune luck with soft caps:
  // 0-2x: 1 Thunder = +0.5x rune luck (normal, reaches 2x at 2 Thunder)
  // 2-3x: 15 Thunder = +0.5x rune luck (15x harder)
  // 3-4x: 225 Thunder = +0.5x rune luck (225x harder)
  // 4-5x: 3375 Thunder = +0.5x rune luck (3375x harder)
  // etc. Each +1x costs 15x more Thunder
  const calculateRuneRuneLuckBonus = (thunderRunes: number, eternityMult: number): number => {
    const rawThunder = thunderRunes * eternityMult;
    let bonus = 1.0;
    let remainingThunder = rawThunder;

    // First tier: up to 2x (needs 2 Thunder at 0.5x each)
    const tier1Thunder = Math.min(remainingThunder, 2);
    bonus += tier1Thunder * 0.5;
    remainingThunder -= tier1Thunder;

    // Subsequent tiers: each +1x costs 15x more
    let tierMultiplier = 15;
    while (remainingThunder > 0 && bonus < 10) { // Cap at 10x
      // Each +0.5x now costs tierMultiplier Thunder
      const thunderForHalf = tierMultiplier;
      const halves = Math.floor(remainingThunder / thunderForHalf);
      const actualHalves = Math.min(halves, 2); // Max 2 halves (+1x) per tier
      bonus += actualHalves * 0.5;
      remainingThunder -= actualHalves * thunderForHalf;
      tierMultiplier *= 15;
    }

    return bonus;
  };
  const runeRuneLuckBonus = calculateRuneRuneLuckBonus(runeOfThunderCount, eternityMultiplier);
  // Rune bulk with soft caps:
  // 0-10: 1 frost rune = 1 rune bulk
  // 10-100: 10,000 frost runes = 1 rune bulk
  // 100-1000: 10,000,000 frost runes = 1 rune bulk
  const calculateRuneBulkCount = (frostRunes: number, bulkLevel: number, eternityMult: number): number => {
    const rawFrost = frostRunes * eternityMult;
    let baseBulk: number;
    if (rawFrost <= 10) {
      baseBulk = Math.floor(1 + rawFrost);
    } else if (rawFrost <= 10 + 90 * 10000) { // 10 + (90 rune bulk * 10,000 runes each)
      const extraFrost = rawFrost - 10;
      const extraBulk = Math.floor(extraFrost / 10000);
      baseBulk = Math.floor(11 + extraBulk);
    } else {
      const tier1Bulk = 10; // First 10 bulk from first 10 frost
      const tier2Bulk = 90; // Next 90 bulk from 900k frost
      const tier2FrostUsed = 90 * 10000;
      const remainingFrost = rawFrost - 10 - tier2FrostUsed;
      const tier3Bulk = Math.floor(remainingFrost / 10000000);
      baseBulk = Math.floor(1 + tier1Bulk + tier2Bulk + tier3Bulk);
    }
    // Add upgrade bonus directly to bulk count
    return baseBulk + bulkLevel;
  };
  const runeBulkCount = calculateRuneBulkCount(runeOfFrostCount, runeBulkRollLevel, eternityMultiplier);
  // Shadow cost reduction with gradual soft caps:
  // Tier 1: 0-10 shadows = 0-10% reduction (1% per shadow)
  // Tier 2: 10-1010 shadows = 10-20% reduction (1% per 100 shadows)
  // Tier 3: 1010-101010 shadows = 20-30% reduction (1% per 10000 shadows)
  // Each tier is 100x harder, but reduction is gradual within each tier
  const calculateShadowCostReduction = (shadowRunes: number, eternityMult: number): number => {
    const rawShadows = shadowRunes * eternityMult;

    let reductionPercent = 0; // Total reduction percentage (0-100)
    let remainingShadows = rawShadows;
    let shadowsPerPercent = 1; // How many shadows needed for 1% reduction

    // Each tier gives up to 10% reduction, then next tier is 100x harder
    while (remainingShadows > 0 && reductionPercent < 90) { // Cap at 90% reduction
      const maxPercentThisTier = 10;
      const shadowsNeededForTier = maxPercentThisTier * shadowsPerPercent;

      if (remainingShadows >= shadowsNeededForTier) {
        // Complete this tier
        reductionPercent += maxPercentThisTier;
        remainingShadows -= shadowsNeededForTier;
        shadowsPerPercent *= 100; // Next tier is 100x harder
      } else {
        // Partial tier - gradual reduction
        const percentGained = remainingShadows / shadowsPerPercent;
        reductionPercent += percentGained;
        remainingShadows = 0;
      }
    }

    // Convert reduction percent to multiplier (10% reduction = 0.9x cost)
    const costMultiplier = Math.max(1 - (reductionPercent / 100), 0.01);
    return costMultiplier;
  };
  const shadowCostReduction = calculateShadowCostReduction(runeOfShadowCount, eternityMultiplier);

  // Cost Reduction Upgrade - unlocks at 1 quadrillion, 5 tiers, each gives 10% compounding
  // Costs: 1q, 100q, 10Q, 1s, 100s (1e15, 1e17, 1e19, 1e21, 1e23)
  const COST_REDUCTION_UPGRADE_COSTS = [1e15, 1e17, 1e19, 1e21, 1e23];
  const costReductionUnlocked = totalPoints >= 1e15 || costReductionLevel > 0;
  const upgradeCostReduction = Math.pow(0.9, costReductionLevel); // Each level = 10% reduction (0.9^level)
  const costReductionUpgradeCost = costReductionLevel < 5 ? COST_REDUCTION_UPGRADE_COSTS[costReductionLevel] : Infinity;
  const canAffordCostReductionUpgrade = totalPoints >= costReductionUpgradeCost && costReductionLevel < 5;

  const handleUpgradeCostReduction = () => {
    if (canAffordCostReductionUpgrade) {
      setTotalPoints((p) => p - costReductionUpgradeCost);
      setCostReductionLevel((l) => l + 1);
    }
  };

  // Apply shadow cost reduction AND upgrade cost reduction to all upgrade costs (except cost reduction itself)
  const totalCostReduction = shadowCostReduction * upgradeCostReduction;
  const bulkUpgradeCost = bulkRollLevel < 4 ? Math.floor(BULK_UPGRADE_COSTS[bulkRollLevel] * totalCostReduction) : Infinity;
  const canAffordBulkUpgrade = totalPoints >= bulkUpgradeCost && bulkRollLevel < 4;
  const runeBulkUpgradeCost = runeBulkRollLevel < 2 ? Math.floor(RUNE_BULK_UPGRADE_COSTS[runeBulkRollLevel] * totalCostReduction) : Infinity;
  const canAffordRuneBulkUpgrade = totalPoints >= runeBulkUpgradeCost && runeBulkRollLevel < 2;

  // Ascension bonus with soft cap at 100x:
  // 0-100x: 1 Light = +1x ascension (normal, starts at 2x, reaches 100x at 98 Light)
  // 100-1000x: 1000 Light = +1x ascension
  // 1000x+: 1M Light = +1x ascension
  const calculateLightAscensionBonus = (lightRunes: number, eternityMult: number): number => {
    const rawRunes = lightRunes * eternityMult;
    const rawBonus = 2 + rawRunes; // Starts at 2x, +1x per rune

    if (rawBonus <= 100) {
      return rawBonus;
    } else if (rawBonus <= 100 + 900 * 1000) {
      const excessBonus = rawBonus - 100;
      const excessRunes = excessBonus; // 1:1 ratio originally
      const softcappedExtra = excessRunes * 0.001;
      return 100 + softcappedExtra;
    } else {
      const tier2Bonus = 900;
      const tier2Runes = 900 * 1000;
      const totalRunesAtTier2End = 98 + tier2Runes;
      const excessRunes = rawRunes - totalRunesAtTier2End;
      const tier3Extra = excessRunes * 0.000001;
      return 100 + tier2Bonus + tier3Extra;
    }
  };
  const lightAscensionBonus = calculateLightAscensionBonus(runeOfLightCount, eternityMultiplier);

  // Raw rune bonuses (without eternity multiplier) for display in Rune Buffs panel
  const rawRunePointsBonus = calculateRunePointsBonus(runeOfBeginningCount, 1);
  const rawRuneLuckBonus = calculateRuneLuckBonus(runeOfEmbersCount, 1);
  const rawRuneSpeedBonus = calculateRuneSpeedBonus(runeOfTidesCount, 1);
  const rawRuneRuneSpeedBonus = calculateRuneRuneSpeedBonus(runeOfGalesCount, 1);
  const rawBulkRollCount = calculateBulkRollCount(runeOfStoneCount, 0, 1); // Raw = just runes, no upgrade
  const rawRuneRuneLuckBonus = calculateRuneRuneLuckBonus(runeOfThunderCount, 1);
  const rawRuneBulkCount = calculateRuneBulkCount(runeOfFrostCount, 0, 1); // Raw = just runes, no upgrade
  const rawShadowCostReduction = calculateShadowCostReduction(runeOfShadowCount, 1);
  const rawLightAscensionBonus = calculateLightAscensionBonus(runeOfLightCount, 1);

  // Prestige bonuses (10% per prestige level for roller, 5% for runes)
  const rollerPrestigeBonus = 1 + (rollerPrestigeLevel * 0.1);
  const runePrestigeBonus = 1 + (runePrestigeLevel * 0.05);

  // Luck calculations
  const baseLuckMulti = Math.pow(1.1, luckLevel);
  const luckMulti = baseLuckMulti * milestoneLuckBonus * runeLuckBonus * rollerPrestigeBonus;
  const luckUpgradeCost = Math.floor(100 * Math.pow(2, luckLevel) * totalCostReduction);
  const canAffordLuckUpgrade = totalPoints >= luckUpgradeCost;

  // Points multiplier calculations
  const basePointsMulti = Math.pow(1.1, pointsMultiLevel);
  const pointsMulti = basePointsMulti * milestonePointsBonus * runePointsBonus;
  const pointsUpgradeCost = Math.floor(100 * Math.pow(2, pointsMultiLevel) * totalCostReduction);
  const canAffordPointsUpgrade = totalPoints >= pointsUpgradeCost;

  const handleUpgradeLuck = () => {
    if (canAffordLuckUpgrade) {
      setTotalPoints((p) => p - luckUpgradeCost);
      setLuckLevel((l) => l + 1);
    }
  };

  const handleUpgradePoints = () => {
    if (canAffordPointsUpgrade) {
      setTotalPoints((p) => p - pointsUpgradeCost);
      setPointsMultiLevel((l) => l + 1);
    }
  };

  // Speed calculations
  const baseSpeedMulti = Math.pow(1.1, speedLevel);
  const speedMulti = baseSpeedMulti * milestoneSpeedBonus * runeSpeedBonus;
  const speedUpgradeCost = Math.floor(100 * Math.pow(2, speedLevel) * totalCostReduction);
  const canAffordSpeedUpgrade = totalPoints >= speedUpgradeCost;
  // Game speed cheat multiplier affects animation interval
  const animationInterval = Math.max(1, Math.floor(50 / (speedMulti * gameSpeedMultiplier)));

  const handleUpgradeSpeed = () => {
    if (canAffordSpeedUpgrade) {
      setTotalPoints((p) => p - speedUpgradeCost);
      setSpeedLevel((l) => l + 1);
    }
  };

  // Bulk roll upgrade handler
  const handleUpgradeBulk = () => {
    if (canAffordBulkUpgrade) {
      setTotalPoints((p) => p - bulkUpgradeCost);
      setBulkRollLevel((l) => l + 1);
    }
  };

  // Rune bulk roll upgrade handler
  const handleUpgradeRuneBulk = () => {
    if (canAffordRuneBulkUpgrade) {
      setTotalPoints((p) => p - runeBulkUpgradeCost);
      setRuneBulkRollLevel((l) => l + 1);
    }
  };

  // Milestone helpers
  const milestoneState: MilestoneState = { rollCount, collectedRanks, ascendedRanks, collectedRunes, runeRollCounts, legitimateRuneRollCounts, runeRollCount };
  const unclaimedMilestones = MILESTONES.filter(
    (m) => m.requirement(milestoneState) && !claimedMilestones.has(m.id)
  );

  // Calculate rune milestone bonuses
  const milestoneRuneSpeedBonus = MILESTONES.reduce((acc, m) => {
    if (claimedMilestones.has(m.id) && m.runeSpeedBonus) {
      return acc * m.runeSpeedBonus;
    }
    return acc;
  }, 1);

  const milestoneRuneLuckBonus = MILESTONES.reduce((acc, m) => {
    if (claimedMilestones.has(m.id) && m.runeLuckBonus) {
      return acc * m.runeLuckBonus;
    }
    return acc;
  }, 1);

  const handleClaimMilestone = (milestone: Milestone) => {
    if (milestone.requirement(milestoneState) && !claimedMilestones.has(milestone.id)) {
      setTotalPoints((p) => p + milestone.reward);
      setClaimedMilestones((prev) => {
        const next = new Set(prev);
        next.add(milestone.id);
        return next;
      });
    }
  };

  // Claim all available milestones at once
  const handleClaimAllMilestones = () => {
    let totalReward = 0;
    const newClaimed = new Set(claimedMilestones);
    let claimedAny = false;

    for (const milestone of MILESTONES) {
      if (milestone.requirement(milestoneState) && !claimedMilestones.has(milestone.id)) {
        totalReward += milestone.reward;
        newClaimed.add(milestone.id);
        claimedAny = true;
      }
    }

    if (claimedAny) {
      if (totalReward > 0) {
        setTotalPoints((p) => p + totalReward);
      }
      setClaimedMilestones(newClaimed);
    }
  };

  // Calculate which tiers are complete
  const completeTiers = useMemo(() => {
    const complete = new Set<string>();
    TIER_NAMES.forEach((tier, tierIndex) => {
      const startIdx = tierIndex * 10;
      let count = 0;
      for (let i = 0; i < 10; i++) {
        if (collectedRanks.has(startIdx + i)) count++;
      }
      if (count === 10) complete.add(tier);
    });
    return complete;
  }, [collectedRanks]);

  const toggleTierExpansion = (tier: string) => {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  // Calculate total points for a complete tier (with multiplier)
  const getTierTotalPoints = (tierIndex: number): number => {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += Math.floor(calculatePoints(ranks[tierIndex * 10 + i]) * pointsMulti);
    }
    return total;
  };

  // Get points for a rank with multiplier applied (includes ascension bonus)
  const getDisplayPoints = (rank: Rank): number => {
    const basePoints = calculatePoints(rank);
    const baseAscensionMulti = getAscensionMultiplier(rank.index, ascendedRanks);
    // Light rune adds to base ascension multiplier (only if ascended)
    const ascensionMulti = baseAscensionMulti > 1
      ? baseAscensionMulti + (lightAscensionBonus - 2) // lightAscensionBonus base is 2, so subtract 2 and add to tier multi
      : 1;
    return Math.floor(basePoints * ascensionMulti * pointsMulti);
  };

  // Check if a rank can be ascended to the next tier
  const canAscend = (rankIndex: number): boolean => {
    const nextTier = getNextAscensionTier(rankIndex, rankRollCounts, ascendedRanks);
    return nextTier !== null;
  };

  // Get the next ascension info for display
  const getNextAscensionInfo = (rankIndex: number): { tierIndex: number; rolls: number; multiplier: number; stars: number } | null => {
    const nextTier = getNextAscensionTier(rankIndex, rankRollCounts, ascendedRanks);
    if (nextTier === null) return null;
    return {
      tierIndex: nextTier,
      ...ASCENSION_TIERS[nextTier]
    };
  };

  // Handle ascension
  const handleAscend = (rankIndex: number) => {
    const nextTier = getNextAscensionTier(rankIndex, rankRollCounts, ascendedRanks);
    if (nextTier !== null) {
      setAscendedRanks((prev) => {
        const next = new Map(prev);
        next.set(rankIndex, nextTier + 1); // Store level (1, 2, or 3)
        return next;
      });
    }
    setAscendPrompt(null);
  };

  // Handle ascend all - ascend all available ranks
  const handleAscendAll = () => {
    setAscendedRanks((prev) => {
      const next = new Map(prev);
      // Go through all collected ranks and ascend any that can be ascended
      for (const rankIndex of Array.from(collectedRanks)) {
        let changed = true;
        // Keep ascending until no more tiers available
        while (changed) {
          const currentLevel = next.get(rankIndex) || 0;
          const nextTier = getNextAscensionTier(rankIndex, rankRollCounts, next);
          if (nextTier !== null) {
            next.set(rankIndex, nextTier + 1);
          } else {
            changed = false;
          }
        }
      }
      return next;
    });
  };

  // Check if any ranks can be ascended
  const hasAnyAscendable = useMemo(() => {
    for (const rankIndex of Array.from(collectedRanks)) {
      const nextTier = getNextAscensionTier(rankIndex, rankRollCounts, ascendedRanks);
      if (nextTier !== null) return true;
    }
    return false;
  }, [collectedRanks, rankRollCounts, ascendedRanks]);

  // Prestige requirements and checks
  const ROLLER_PRESTIGE_REQ = 100; // 100 Ultimate 10's to prestige
  const RUNE_PRESTIGE_TIERS = [100, 400, 1000]; // Rune rolls needed per tier
  const MAX_RUNE_PRESTIGE = 3; // Max prestige level
  const ultimate10Index = 99; // Ultimate 10 is rank index 99
  const ultimate10Rolls = rankRollCounts[ultimate10Index] || 0;
  const canRollerPrestige = ultimate10Rolls >= ROLLER_PRESTIGE_REQ;

  // Rune prestige - can only prestige if not at max level and have enough rune rolls for current tier
  const nextRunePrestigeReq = runePrestigeLevel < MAX_RUNE_PRESTIGE ? RUNE_PRESTIGE_TIERS[runePrestigeLevel] : null;
  const canRunePrestige = runePrestigeLevel < MAX_RUNE_PRESTIGE && runeRollCount >= RUNE_PRESTIGE_TIERS[runePrestigeLevel];

  // Handle roller prestige - resets ranks but keeps runes and increases prestige bonus
  const handleRollerPrestige = () => {
    if (!canRollerPrestige) return;

    // Increase prestige level
    setRollerPrestigeLevel(prev => prev + 1);

    // Reset rank-related progress
    setCurrentRoll(null);
    setHighestRank(null);
    setHighestRankRoll(null);
    setRollCount(0);
    setTotalPoints(0);
    setLastPointsGained(null);
    setCollectedRanks(new Set());
    setRankRollCounts({});
    setAscendedRanks(new Map());
    setExpandedTiers(new Set());
    setLuckLevel(0);
    setPointsMultiLevel(0);
    setSpeedLevel(0);
    setCostReductionLevel(0);
    setClaimedMilestones(new Set());
    setAutoRollEnabled(false);
    setBulkRollLevel(0);

    // Close modal
    setShowPrestigeModal(false);
  };

  // Handle rune prestige - resets runes but increases rune prestige bonus
  const handleRunePrestige = () => {
    if (!canRunePrestige) return;

    // Increase prestige level
    setRunePrestigeLevel(prev => prev + 1);

    // Reset rune progress
    setCurrentRuneRoll(null);
    setCollectedRunes(new Set());
    setRuneRollCounts({});
    setLegitimateRuneRollCounts({});
    setRuneRollCount(0);
    setIsRollingRune(false);
    setRuneAutoRollEnabled(false);

    // Close modal
    setShowPrestigeModal(false);
  };

  // Handle reset progress
  const handleReset = () => {
    if (resetInput === 'RESET') {
      // Clear cookie first
      setCookie(SAVE_KEY, '');
      // Reset all game state
      setCurrentRoll(null);
      setHighestRank(null);
      setHighestRankRoll(null);
      setRollCount(0);
      setTotalPoints(0);
      setLastPointsGained(null);
      setIsRolling(false);
      setCollectedRanks(new Set());
      setRankRollCounts({});
      setAscendedRanks(new Map());
      setAscendPrompt(null);
      setExpandedTiers(new Set());
      setLuckLevel(0);
      setPointsMultiLevel(0);
      setSpeedLevel(0);
      setCostReductionLevel(0);
      setClaimedMilestones(new Set());
      setAutoRollEnabled(false);
      setRuneAutoRollEnabled(false);
      // Reset rune data
      setCurrentRuneRoll(null);
      setCollectedRunes(new Set());
      setRuneRollCounts({});
      setLegitimateRuneRollCounts({});
      setRuneRollCount(0);
      setIsRollingRune(false);
      // Reset UI state
      setShowRunes(false);
      setShowResetModal(false);
      setResetInput('');
      setShowCheatMenu(false);
      setCheatBuffer('');
      setShowMilestones(false);
      setShowMultiplierBreakdown(false);
      setShowSaveModal(false);
      setShowPrestigeModal(false);
      // Reset bulk and game speed
      setBulkRollLevel(0);
      setRuneBulkRollLevel(0);
      setGameSpeedMultiplier(1);
      // Reset prestige levels
      setRollerPrestigeLevel(0);
      setRunePrestigeLevel(0);
    }
  };

  // Rune roll time (5 seconds base, affected by rune speed milestones and game speed)
  const baseRuneRollTime = 5000;
  const runeRollTime = Math.floor(baseRuneRollTime / (milestoneRuneSpeedBonus * runeRuneSpeedBonus * gameSpeedMultiplier));
  const runeAnimationInterval = Math.max(10, Math.floor(100 / gameSpeedMultiplier)); // Animation frame rate for runes
  const runeRollCost = Math.floor(1000 * runeBulkCount * totalCostReduction); // Cost scales with rune bulk, reduced by shadow + upgrade
  const canAffordRuneRoll = totalPoints >= runeRollCost;

  // Calculate which runes are unlocked based on progression
  const unlockedRunes = useMemo(() => getUnlockedRunes(collectedRanks), [collectedRanks]);

  // Get only unlocked runes for rolling
  const availableRunes = useMemo(() => {
    return runes.filter((rune) => unlockedRunes.has(rune.index));
  }, [runes, unlockedRunes]);

  // Total rune luck (from milestones and Thunder runes)
  const totalRuneLuck = milestoneRuneLuckBonus * runeRuneLuckBonus * runePrestigeBonus;

  // Handle rune roll (animated)
  // Uses refs for all state checks to avoid stale closure issues in auto-roll
  const handleRuneRoll = useCallback(() => {
    const currentAvailableRunes = availableRunesRef.current;
    const currentRuneRollCost = runeRollCostRef.current;
    const currentRuneBulkCount = runeBulkCountRef.current;
    const currentTotalRuneLuck = totalRuneLuckRef.current;
    // Check current state using refs to avoid stale closure
    if (totalPointsRef.current < currentRuneRollCost || isRollingRuneRef.current || currentAvailableRunes.length === 0) return;

    setTotalPoints((p) => p - currentRuneRollCost);
    setIsRollingRune(true);

    const animationFrames = Math.floor(runeRollTime / runeAnimationInterval);
    let animationCount = 0;

    const rollTimer = setInterval(() => {
      const simulatedRoll = rollRuneWithLuck(currentAvailableRunes, currentTotalRuneLuck);
      setCurrentRuneRoll(simulatedRoll);
      animationCount++;

      if (animationCount >= animationFrames) {
        clearInterval(rollTimer);

        // Final roll with bulk (roll multiple times, keep the best/rarest for display)
        const results: Rune[] = [];
        for (let i = 0; i < currentRuneBulkCount; i++) {
          results.push(rollRuneWithLuck(currentAvailableRunes, currentTotalRuneLuck));
        }
        const bestResult = results.reduce((best, current) =>
          current.index > best.index ? current : best
        );

        setCurrentRuneRoll(bestResult);
        setRuneRollCount((c) => c + currentRuneBulkCount);

        // Track all runes collected and their counts
        const newCollected = new Set<number>();
        const runeCountUpdates: Record<number, number> = {};
        for (const result of results) {
          newCollected.add(result.index);
          runeCountUpdates[result.index] = (runeCountUpdates[result.index] || 0) + 1;
        }

        setCollectedRunes((prev) => {
          const next = new Set(prev);
          newCollected.forEach((idx) => next.add(idx));
          return next;
        });

        setRuneRollCounts((prev) => {
          const next = { ...prev };
          for (const [idx, count] of Object.entries(runeCountUpdates)) {
            next[Number(idx)] = (next[Number(idx)] || 0) + count;
          }
          return next;
        });

        // Also increment legitimate counts (not cheatable, used for milestones)
        setLegitimateRuneRollCounts((prev) => {
          const next = { ...prev };
          for (const [idx, count] of Object.entries(runeCountUpdates)) {
            next[Number(idx)] = (next[Number(idx)] || 0) + count;
          }
          return next;
        });

        setIsRollingRune(false);
      }
    }, runeAnimationInterval);
  }, [runeRollTime, runeAnimationInterval]);

  // Instant rune roll for fast auto-roll (no animation)
  // Uses refs for all state to avoid stale closure issues in auto-roll
  const handleInstantRuneRoll = useCallback(() => {
    const currentAvailableRunes = availableRunesRef.current;
    const currentRuneRollCost = runeRollCostRef.current;
    const currentRuneBulkCount = runeBulkCountRef.current;
    const currentTotalRuneLuck = totalRuneLuckRef.current;
    // Check current state using refs to avoid stale closure
    if (totalPointsRef.current < currentRuneRollCost || currentAvailableRunes.length === 0) return;

    setTotalPoints((p) => p - currentRuneRollCost);

    // Roll multiple times, keep the best/rarest for display
    const results: Rune[] = [];
    for (let i = 0; i < currentRuneBulkCount; i++) {
      results.push(rollRuneWithLuck(currentAvailableRunes, currentTotalRuneLuck));
    }
    const bestResult = results.reduce((best, current) =>
      current.index > best.index ? current : best
    );

    setCurrentRuneRoll(bestResult);
    setRuneRollCount((c) => c + currentRuneBulkCount);

    // Track all runes collected and their counts
    const newCollected = new Set<number>();
    const runeCountUpdates: Record<number, number> = {};
    for (const result of results) {
      newCollected.add(result.index);
      runeCountUpdates[result.index] = (runeCountUpdates[result.index] || 0) + 1;
    }

    setCollectedRunes((prev) => {
      const next = new Set(prev);
      newCollected.forEach((idx) => next.add(idx));
      return next;
    });

    setRuneRollCounts((prev) => {
      const next = { ...prev };
      for (const [idx, count] of Object.entries(runeCountUpdates)) {
        next[Number(idx)] = (next[Number(idx)] || 0) + count;
      }
      return next;
    });

    setLegitimateRuneRollCounts((prev) => {
      const next = { ...prev };
      for (const [idx, count] of Object.entries(runeCountUpdates)) {
        next[Number(idx)] = (next[Number(idx)] || 0) + count;
      }
      return next;
    });
  }, []);

  // Get total roll count for a tier
  const getTierRollCount = (tierIndex: number): number => {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += rankRollCounts[tierIndex * 10 + i] || 0;
    }
    return total;
  };

  // Keep refs updated
  useEffect(() => {
    rollCountRef.current = rollCount;
  }, [rollCount]);

  useEffect(() => {
    totalPointsRef.current = totalPoints;
  }, [totalPoints]);

  useEffect(() => {
    isRollingRuneRef.current = isRollingRune;
  }, [isRollingRune]);

  useEffect(() => {
    availableRunesRef.current = availableRunes;
  }, [availableRunes]);

  useEffect(() => {
    runeRollCostRef.current = runeRollCost;
  }, [runeRollCost]);

  useEffect(() => {
    runeBulkCountRef.current = runeBulkCount;
  }, [runeBulkCount]);

  useEffect(() => {
    totalRuneLuckRef.current = totalRuneLuck;
  }, [totalRuneLuck]);

  const handleRoll = useCallback(() => {
    setIsRolling(true);

    // Simulate actual rolls for animation
    let animationCount = 0;
    const rollTimer = setInterval(() => {
      const simulatedRoll = rollRankWithLuck(ranks, luckMulti);
      setCurrentRoll(simulatedRoll);
      animationCount++;

      if (animationCount >= 10) {
        clearInterval(rollTimer);

        // Bulk roll - roll multiple times based on bulkRollCount
        const results: Rank[] = [];
        for (let i = 0; i < bulkRollCount; i++) {
          results.push(rollRankWithLuck(ranks, luckMulti));
        }

        // Find the best result to display
        const bestResult = results.reduce((best, current) =>
          current.index > best.index ? current : best
        );
        setCurrentRoll(bestResult);
        setRollCount((c) => c + bulkRollCount);

        // Calculate total points from all rolls
        let totalPointsGained = 0;
        const newCollected = new Set<number>();
        const rollCountUpdates: Record<number, number> = {};

        for (const result of results) {
          const basePoints = calculatePoints(result);
          const baseAscensionMulti = getAscensionMultiplier(result.index, ascendedRanks);
          // Light rune adds to base ascension multiplier (only if ascended)
          const ascensionMulti = baseAscensionMulti > 1
            ? baseAscensionMulti + (lightAscensionBonus - 2)
            : 1;
          totalPointsGained += Math.floor(basePoints * ascensionMulti * pointsMulti);
          newCollected.add(result.index);
          rollCountUpdates[result.index] = (rollCountUpdates[result.index] || 0) + 1;
        }

        setTotalPoints((p) => p + totalPointsGained);
        setLastPointsGained(totalPointsGained);

        setCollectedRanks((prev) => {
          const next = new Set(prev);
          newCollected.forEach((idx) => next.add(idx));
          return next;
        });

        setRankRollCounts((prev) => {
          const next = { ...prev };
          for (const [idx, count] of Object.entries(rollCountUpdates)) {
            next[Number(idx)] = (next[Number(idx)] || 0) + count;
          }
          return next;
        });

        const newRollCount = rollCountRef.current + bulkRollCount;
        if (!highestRank || bestResult.index > highestRank.index) {
          setHighestRank(bestResult);
          setHighestRankRoll(newRollCount);
        }

        setIsRolling(false);
      }
    }, animationInterval);
  }, [ranks, luckMulti, pointsMulti, animationInterval, highestRank, ascendedRanks, bulkRollCount, lightAscensionBonus]);

  // Instant roll for auto-roll (no animation, just results)
  const handleInstantRoll = useCallback(() => {
    // Bulk roll - roll multiple times based on bulkRollCount
    const results: Rank[] = [];
    for (let i = 0; i < bulkRollCount; i++) {
      results.push(rollRankWithLuck(ranks, luckMulti));
    }

    // Find the best result to display
    const bestResult = results.reduce((best, current) =>
      current.index > best.index ? current : best
    );
    setCurrentRoll(bestResult);
    setRollCount((c) => c + bulkRollCount);

    // Calculate total points from all rolls
    let totalPointsGained = 0;
    const newCollected = new Set<number>();
    const rollCountUpdates: Record<number, number> = {};

    for (const result of results) {
      const basePoints = calculatePoints(result);
      const baseAscensionMulti = getAscensionMultiplier(result.index, ascendedRanks);
      const ascensionMulti = baseAscensionMulti > 1
        ? baseAscensionMulti + (lightAscensionBonus - 2)
        : 1;
      totalPointsGained += Math.floor(basePoints * ascensionMulti * pointsMulti);
      newCollected.add(result.index);
      rollCountUpdates[result.index] = (rollCountUpdates[result.index] || 0) + 1;
    }

    setTotalPoints((p) => p + totalPointsGained);
    setLastPointsGained(totalPointsGained);

    setCollectedRanks((prev) => {
      const next = new Set(prev);
      newCollected.forEach((idx) => next.add(idx));
      return next;
    });

    setRankRollCounts((prev) => {
      const next = { ...prev };
      for (const [idx, count] of Object.entries(rollCountUpdates)) {
        next[Number(idx)] = (next[Number(idx)] || 0) + count;
      }
      return next;
    });

    const newRollCount = rollCountRef.current + bulkRollCount;
    if (!highestRank || bestResult.index > highestRank.index) {
      setHighestRank(bestResult);
      setHighestRankRoll(newRollCount);
    }
  }, [ranks, luckMulti, pointsMulti, highestRank, ascendedRanks, bulkRollCount, lightAscensionBonus]);

  // Check if auto-roll is unlocked (slow at 100 rolls, fast at 5000 rolls)
  const slowAutoRollUnlocked = claimedMilestones.has('rolls_100');
  const fastAutoRollUnlocked = claimedMilestones.has('rolls_5000');
  const autoRollUnlocked = slowAutoRollUnlocked;

  // Check if rune auto-roll is unlocked (slow at 500 rune rolls, fast at 5000 rune rolls)
  const slowRuneAutoRollUnlocked = claimedMilestones.has('rune_rolls_500');
  const fastRuneAutoRollUnlocked = claimedMilestones.has('rune_rolls_5000');
  const runeAutoRollUnlocked = slowRuneAutoRollUnlocked;

  // Check if runes area is unlocked (first Rare)
  const runesUnlocked = hasAnyFromTier(collectedRanks, 2);

  // Auto-roll effect
  useEffect(() => {
    if (!autoRollEnabled || !autoRollUnlocked) return;

    // Animation takes 10 frames × animationInterval
    const animationDuration = animationInterval * 10;
    // Auto-roll interval: at high speeds (animationInterval <= 5ms), just use animationInterval directly
    // Otherwise use multiplier: Slow = 10x, Fast = 5x
    let autoRollInterval: number;
    if (animationInterval <= 5) {
      // Very high speed - roll as fast as possible (every animationInterval ms)
      autoRollInterval = animationInterval;
    } else {
      const baseMultiplier = fastAutoRollUnlocked ? 5 : 10;
      autoRollInterval = animationDuration * baseMultiplier;
    }
    // Browser minimum is ~1ms for setInterval
    autoRollInterval = Math.max(autoRollInterval, 1);

    // Use instant roll (no animation) at high speeds
    const useInstantRoll = animationInterval <= 10;

    const autoRollTimer = setInterval(() => {
      if (useInstantRoll) {
        // Skip animation for fast rolling
        handleInstantRoll();
      } else {
        // Use animated roll, only trigger if not currently rolling
        setIsRolling((currentlyRolling) => {
          if (!currentlyRolling) {
            handleRoll();
          }
          return currentlyRolling;
        });
      }
    }, autoRollInterval);

    return () => clearInterval(autoRollTimer);
  }, [autoRollEnabled, autoRollUnlocked, fastAutoRollUnlocked, animationInterval, handleRoll, handleInstantRoll, bulkRollCount]);

  // Rune auto-roll effect (works on all screens)
  useEffect(() => {
    if (!runeAutoRollEnabled || !runeAutoRollUnlocked) return;

    // Rune auto-roll interval: slow = 5x rune roll time, fast = 2x rune roll time
    let autoRuneRollInterval = fastRuneAutoRollUnlocked ? runeRollTime * 2 : runeRollTime * 5;
    // Cap at 500 rolls per second: interval must be at least runeBulkCount * 2ms
    const minRuneInterval = runeBulkCount * 2;
    autoRuneRollInterval = Math.max(autoRuneRollInterval, minRuneInterval);

    // Use instant roll if rolling faster than animation can handle
    const useInstantRuneRoll = autoRuneRollInterval < runeRollTime;

    const autoRuneRollTimer = setInterval(() => {
      if (useInstantRuneRoll) {
        // Skip animation for fast rolling - handleInstantRuneRoll checks canAfford internally
        handleInstantRuneRoll();
      } else {
        // Use animated roll - handleRuneRoll checks canAfford and isRolling internally
        handleRuneRoll();
      }
    }, autoRuneRollInterval);

    return () => clearInterval(autoRuneRollTimer);
  }, [runeAutoRollEnabled, runeAutoRollUnlocked, fastRuneAutoRollUnlocked, runeRollTime, handleRuneRoll, handleInstantRuneRoll, runeBulkCount]);

  // Spacebar to roll, A to toggle auto roll
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Prevent scrolling
        e.preventDefault();
        // Roll based on current view
        if (showRunes) {
          if (!isRollingRune && canAffordRuneRoll) {
            handleRuneRoll();
          }
        } else {
          if (!isRolling && !autoRollEnabled) {
            handleRoll();
          }
        }
      }
      // A key to toggle auto roll (only when auto roll is unlocked)
      if (e.code === 'KeyA' && !e.repeat && autoRollUnlocked) {
        if (showRunes) {
          if (runeAutoRollUnlocked) {
            setRuneAutoRollEnabled((prev) => !prev);
          }
        } else {
          setAutoRollEnabled((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showRunes, isRolling, isRollingRune, canAffordRuneRoll, autoRollEnabled, autoRollUnlocked, runeAutoRollUnlocked, handleRoll, handleRuneRoll]);

  const collectedCount = collectedRanks.size;

  const formatProbability = (prob: number): string => {
    if (showPercentFormat) {
      return `${(prob * 100).toFixed(5)}%`;
    }
    const oneIn = Math.round(1 / prob);
    return `1 in ${oneIn.toLocaleString()}`;
  };

  const colors = currentRoll ? TIER_COLORS[currentRoll.tier] : null;
  const highestColors = highestRank ? TIER_COLORS[highestRank.tier] : null;

  // Format rune probability
  const formatRuneProbability = (prob: number): string => {
    if (showPercentFormat) {
      return `${(prob * 100).toFixed(5)}%`;
    }
    const oneIn = Math.round(1 / prob);
    return `1 in ${oneIn.toLocaleString()}`;
  };

  // Runes Screen
  if (showRunes) {
    return (
      <div style={styles.container}>
        <button
          onClick={() => setShowRunes(false)}
          style={styles.backBtn}
        >
          ← Back
        </button>

        {/* Stats Panel for Runes */}
        <div className="stats-panel" style={styles.statsPanel}>
          <h3 className="stats-panel-title" style={styles.statsPanelTitle}>Total Stats</h3>
          <div style={styles.statsPanelList}>
            {luckMulti > 1.0 && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Luck</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{luckMulti.toFixed(2)}x</span>
              </div>
            )}
            {pointsMulti > 1.0 && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Points</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{pointsMulti.toFixed(2)}x</span>
              </div>
            )}
            {speedMulti > 1.0 && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Speed</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{speedMulti.toFixed(2)}x</span>
              </div>
            )}
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Roll Time</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{((animationInterval * 10) / 1000).toFixed(2)}s</span>
            </div>
            {autoRollUnlocked && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Auto Roll{fastAutoRollUnlocked ? '' : ' (Slow)'}</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{((animationInterval * 10 * (fastAutoRollUnlocked ? 5 : 10)) / 1000).toFixed(2)}s</span>
              </div>
            )}
            {bulkRollCount > 1 && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Bulk Roll</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{formatNumber(bulkRollCount)}x</span>
              </div>
            )}
            {autoRollUnlocked && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Rolls/sec</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{formatNumber((1000 / (animationInterval * 10 * (fastAutoRollUnlocked ? 5 : 10))) * bulkRollCount)}</span>
              </div>
            )}
            {totalRuneLuck > 1.0 && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Luck</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{totalRuneLuck.toFixed(2)}x</span>
              </div>
            )}
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Roll</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{(runeRollTime / 1000).toFixed(2)}s</span>
            </div>
            {runeAutoRollUnlocked && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Auto{fastRuneAutoRollUnlocked ? '' : ' (Slow)'}</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{((runeRollTime * (fastRuneAutoRollUnlocked ? 2 : 5)) / 1000).toFixed(2)}s</span>
              </div>
            )}
            {runeBulkCount > 1 && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Bulk</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{formatNumber(runeBulkCount)}x</span>
              </div>
            )}
            {runeAutoRollUnlocked && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Runes/sec</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{formatNumber((1000 / (runeRollTime * (fastRuneAutoRollUnlocked ? 2 : 5))) * runeBulkCount)}</span>
              </div>
            )}
            {totalCostReduction < 1 && (
              <div style={styles.statsPanelItem}>
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Cost Reduction</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{((1 - totalCostReduction) * 100).toFixed(2)}%</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowPercentFormat(!showPercentFormat)}
            style={styles.formatToggleBtn}
          >
            {showPercentFormat ? 'Show 1/x' : 'Show %'}
          </button>
          <button
            onClick={() => setShowMultiplierBreakdown(true)}
            style={{...styles.formatToggleBtn, marginTop: '0.5rem'}}
          >
            View Breakdown
          </button>
        </div>

        {/* Rune Buffs Panel */}
        {(runeOfBeginningCount > 0 || runeOfEmbersCount > 0 || runeOfTidesCount > 0 || runeOfGalesCount > 0 || runeOfStoneCount > 0 || runeOfThunderCount > 0 || runeOfFrostCount > 0 || runeOfShadowCount > 0 || runeOfLightCount > 0 || runeOfEternityCount > 0) && (
          <div className="rune-buffs-panel" style={styles.runeBuffsPanel}>
            <h3 style={styles.runeBuffsTitle}>Rune Buffs</h3>
            <div style={styles.runeBuffsList}>
              {runeOfEternityCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={{...styles.runeBuffName, color: '#ff00ff'}}>ALL STATS</span>
                  <span style={{...styles.runeBuffValue, color: '#ff00ff'}}>{eternityMultiplier.toFixed(2)}x</span>
                  <span style={styles.runeBuffSource}>({runeOfEternityCount}x Eternity)</span>
                </div>
              )}
              {runeOfBeginningCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={styles.runeBuffName}>Points</span>
                  <span style={styles.runeBuffValue}>{rawRunePointsBonus.toFixed(2)}x</span>
                  <span style={styles.runeBuffSource}>({runeOfBeginningCount}x Beginning)</span>
                </div>
              )}
              {runeOfEmbersCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={styles.runeBuffName}>Luck</span>
                  <span style={styles.runeBuffValue}>{rawRuneLuckBonus.toFixed(2)}x</span>
                  <span style={styles.runeBuffSource}>({runeOfEmbersCount}x Embers)</span>
                </div>
              )}
              {runeOfTidesCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={styles.runeBuffName}>Speed</span>
                  <span style={styles.runeBuffValue}>{rawRuneSpeedBonus.toFixed(2)}x</span>
                  <span style={styles.runeBuffSource}>({runeOfTidesCount}x Tides)</span>
                </div>
              )}
              {runeOfGalesCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={styles.runeBuffName}>Rune Speed</span>
                  <span style={styles.runeBuffValue}>{rawRuneRuneSpeedBonus.toFixed(2)}x</span>
                  <span style={styles.runeBuffSource}>({runeOfGalesCount}x Gales)</span>
                </div>
              )}
              {runeOfStoneCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={styles.runeBuffName}>Bulk Roll</span>
                  <span style={styles.runeBuffValue}>{formatNumber(rawBulkRollCount)}</span>
                  <span style={styles.runeBuffSource}>({formatNumber(runeOfStoneCount)}x Stone)</span>
                </div>
              )}
              {runeOfThunderCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={styles.runeBuffName}>Rune Luck</span>
                  <span style={styles.runeBuffValue}>{rawRuneRuneLuckBonus.toFixed(2)}x</span>
                  <span style={styles.runeBuffSource}>({runeOfThunderCount}x Thunder)</span>
                </div>
              )}
              {runeOfFrostCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={styles.runeBuffName}>Rune Bulk</span>
                  <span style={styles.runeBuffValue}>{formatNumber(rawRuneBulkCount)}</span>
                  <span style={styles.runeBuffSource}>({formatNumber(runeOfFrostCount)}x Frost)</span>
                </div>
              )}
              {runeOfShadowCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={{...styles.runeBuffName, color: '#4a0080'}}>Cost Reduction</span>
                  <span style={{...styles.runeBuffValue, color: '#4a0080'}}>{((1 - rawShadowCostReduction) * 100).toFixed(2)}%</span>
                  <span style={styles.runeBuffSource}>({runeOfShadowCount}x Shadow)</span>
                </div>
              )}
              {runeOfLightCount > 0 && (
                <div style={styles.runeBuffItem}>
                  <span style={{...styles.runeBuffName, color: '#ffffff'}}>Ascension</span>
                  <span style={{...styles.runeBuffValue, color: '#ffffff'}}>{rawLightAscensionBonus.toFixed(1)}x</span>
                  <span style={styles.runeBuffSource}>({runeOfLightCount}x Light)</span>
                </div>
              )}
            </div>
          </div>
        )}

        <h1 style={styles.runesTitle}>Runes</h1>

        <div style={styles.runesPointsDisplay}>
          <span style={styles.runesPointsLabel}>Points</span>
          <span style={styles.runesPointsValue}>{totalPoints.toLocaleString()}</span>
        </div>

        {/* Rune Roll Display */}
        <div
          style={{
            ...styles.runeRollDisplay,
            backgroundColor: currentRuneRoll ? currentRuneRoll.color : '#333',
            color: currentRuneRoll && (currentRuneRoll.index === 8 || currentRuneRoll.index === 5) ? '#000' : '#fff',
            boxShadow: currentRuneRoll ? `0 0 30px ${currentRuneRoll.color}80` : 'none',
          }}
        >
          {currentRuneRoll ? (
            <>
              <div style={styles.runeRollName}>{currentRuneRoll.name}</div>
              <div style={styles.runeRollProbability}>
                {formatRuneProbability(getEffectiveRuneProbability(currentRuneRoll, runes, totalRuneLuck))}
              </div>
            </>
          ) : (
            <div style={styles.rollPlaceholder}>Roll a rune!</div>
          )}
        </div>

        {/* Roll Button */}
        <button
          onClick={handleRuneRoll}
          disabled={!canAffordRuneRoll || isRollingRune || runeAutoRollEnabled}
          style={{
            ...styles.runeRollButton,
            opacity: !canAffordRuneRoll || isRollingRune || runeAutoRollEnabled ? 0.5 : 1,
            cursor: !canAffordRuneRoll || isRollingRune || runeAutoRollEnabled ? 'not-allowed' : 'pointer',
          }}
        >
          {isRollingRune ? 'Rolling...' : `ROLL RUNE (${runeRollCost.toLocaleString()} pts)`}
        </button>

        {/* Rune Auto Roll Button */}
        {runeAutoRollUnlocked && (
          <button
            onClick={() => setRuneAutoRollEnabled((prev) => !prev)}
            style={{
              ...styles.autoRollBtn,
              backgroundColor: runeAutoRollEnabled ? '#22c55e' : '#4a4a8a',
              marginTop: '10px',
            }}
          >
            Auto Roll: {runeAutoRollEnabled ? 'ON' : 'OFF'} {fastRuneAutoRollUnlocked ? '(Fast)' : '(Slow)'}
          </button>
        )}

        <div style={styles.runeStatsRow}>
          <span>Rune Rolls: {runeRollCount}</span>
          <span>Collected: {collectedRunes.size}/10</span>
        </div>

        {/* Rune Catalogue */}
        <div style={styles.runeCatalogue}>
          <h3 style={styles.catalogueTitle}>Rune Collection ({collectedRunes.size}/10)</h3>
          <div style={styles.runeCatalogueGrid}>
            {runes.map((rune) => {
              const isCollected = collectedRunes.has(rune.index);
              const isUnlocked = unlockedRunes.has(rune.index);
              const rollCount = runeRollCounts[rune.index] || 0;
              // Unlock requirements for locked runes
              const unlockRequirements: Record<number, string> = {
                3: 'First Epic',
                4: 'First Legendary',
                5: 'First Mythic',
                6: 'First Divine',
                7: 'First Celestial',
                8: 'First Transcendent',
                9: 'First Ultimate',
              };
              return (
                <div
                  key={rune.index}
                  style={{
                    ...styles.runeItem,
                    backgroundColor: isCollected ? rune.color : '#222',
                    color: isCollected && (rune.index === 8 || rune.index === 5) ? '#000' : '#fff',
                    opacity: isUnlocked ? (isCollected ? 1 : 0.4) : 0.25,
                    boxShadow: isCollected ? `0 0 15px ${rune.color}60` : 'none',
                  }}
                >
                  <div style={styles.runeItemName}>{rune.name}</div>
                  {!isUnlocked ? (
                    <>
                      <div style={{...styles.runeItemChance, color: '#ff6666', fontWeight: 'bold'}}>
                        🔒 LOCKED
                      </div>
                      <div style={{...styles.runeItemRolls, fontSize: '0.7rem', color: '#888'}}>
                        Unlock: {unlockRequirements[rune.index]}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.runeItemChance}>
                        {formatRuneProbability(getEffectiveRuneProbability(rune, availableRunes, totalRuneLuck))}
                      </div>
                      {isCollected && (
                        <div style={styles.runeItemRolls}>
                          Rolled: {rollCount.toLocaleString()}x
                        </div>
                      )}
                      {isCollected && runeRollCount > 0 && (
                        <div style={styles.runeItemPercent}>
                          {((rollCount / runeRollCount) * 100).toFixed(5)}%
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cheat Menu Modal (also available on runes screen) */}
        {showCheatMenu && (
          <div style={styles.modalOverlay} onClick={() => setShowCheatMenu(false)}>
            <div className="modal" style={styles.cheatModal} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.cheatTitle}>🎮 Cheat Menu</h2>
              <div style={styles.cheatGrid}>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Points:</label>
                  <input
                    type="number"
                    value={totalPoints}
                    onChange={(e) => setTotalPoints(Number(e.target.value))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Rolls:</label>
                  <input
                    type="number"
                    value={rollCount}
                    onChange={(e) => setRollCount(Number(e.target.value))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Luck Level:</label>
                  <input
                    type="number"
                    value={luckLevel}
                    onChange={(e) => setLuckLevel(Number(e.target.value))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Points Multi Level:</label>
                  <input
                    type="number"
                    value={pointsMultiLevel}
                    onChange={(e) => setPointsMultiLevel(Number(e.target.value))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Speed Level:</label>
                  <input
                    type="number"
                    value={speedLevel}
                    onChange={(e) => setSpeedLevel(Number(e.target.value))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Rune Rolls:</label>
                  <input
                    type="number"
                    value={runeRollCount}
                    onChange={(e) => setRuneRollCount(Number(e.target.value))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Stone Runes (Bulk):</label>
                  <input
                    type="number"
                    value={runeRollCounts[4] || 0}
                    onChange={(e) => setRuneRollCounts(prev => ({ ...prev, 4: Number(e.target.value) }))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Thunder Runes (Rune Luck):</label>
                  <input
                    type="number"
                    value={runeRollCounts[5] || 0}
                    onChange={(e) => setRuneRollCounts(prev => ({ ...prev, 5: Number(e.target.value) }))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Frost Runes (Rune Bulk):</label>
                  <input
                    type="number"
                    value={runeRollCounts[6] || 0}
                    onChange={(e) => setRuneRollCounts(prev => ({ ...prev, 6: Number(e.target.value) }))}
                    style={styles.cheatInput}
                  />
                </div>
                <div style={styles.cheatItem}>
                  <label style={styles.cheatLabel}>Game Speed (1-100x):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={gameSpeedMultiplier}
                    onChange={(e) => setGameSpeedMultiplier(Math.max(1, Math.min(100, Number(e.target.value))))}
                    style={styles.cheatInput}
                  />
                </div>
              </div>
              <button
                onClick={() => setCollectedRanks(prev => new Set([...Array.from(prev), 20]))}
                style={{...styles.cheatCloseBtn, backgroundColor: '#9333ea', marginBottom: '10px'}}
              >
                Unlock Runes
              </button>
              <button
                onClick={() => setShowCheatMenu(false)}
                style={styles.cheatCloseBtn}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Save Management Modal */}
        {showSaveModal && (
          <div style={styles.modalOverlay} onClick={() => setShowSaveModal(false)}>
            <div className="modal" style={{...styles.cheatModal, maxWidth: '400px'}} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.cheatTitle}>💾 Save Management</h2>
              <p style={{color: '#aaa', marginBottom: '20px', textAlign: 'center'}}>Export your save to back it up, or import a previous save.</p>
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                <button onClick={exportSave} style={{...styles.cheatCloseBtn, backgroundColor: '#4a9'}}>
                  📥 Export Save
                </button>
                <label style={{...styles.cheatCloseBtn, backgroundColor: '#49a', cursor: 'pointer', textAlign: 'center'}}>
                  📤 Import Save
                  <input type="file" accept=".sav" onChange={importSave} style={{display: 'none'}} />
                </label>
                <button onClick={() => setShowSaveModal(false)} style={{...styles.cheatCloseBtn, marginTop: '10px'}}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multiplier Breakdown Modal (also available on runes screen) */}
        {showMultiplierBreakdown && (
          <div style={styles.modalOverlay} onClick={() => setShowMultiplierBreakdown(false)}>
            <div className="modal" style={{...styles.modal, maxWidth: '500px'}} onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title" style={styles.modalTitle}>Multiplier Breakdown</h2>
              <div style={{...styles.milestonesList, maxHeight: '60vh'}}>
                {/* Luck Breakdown */}
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Luck ({luckMulti.toFixed(2)}x total)</h3>
                  <div style={styles.breakdownItem}>
                    <span>Base (Upgrades Lv.{luckLevel})</span>
                    <span>{baseLuckMulti.toFixed(2)}x</span>
                  </div>
                  {milestoneLuckBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Milestones</span>
                      <span>{milestoneLuckBonus.toFixed(2)}x</span>
                    </div>
                  )}
                  {runeLuckBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Runes (Embers + Eternity)</span>
                      <span>{runeLuckBonus.toFixed(2)}x</span>
                    </div>
                  )}
                </div>

                {/* Points Breakdown */}
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Points ({pointsMulti.toFixed(2)}x total)</h3>
                  <div style={styles.breakdownItem}>
                    <span>Base (Upgrades Lv.{pointsMultiLevel})</span>
                    <span>{basePointsMulti.toFixed(2)}x</span>
                  </div>
                  {milestonePointsBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Milestones</span>
                      <span>{milestonePointsBonus.toFixed(2)}x</span>
                    </div>
                  )}
                  {runePointsBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Runes (Beginning + Eternity)</span>
                      <span>{runePointsBonus.toFixed(2)}x</span>
                    </div>
                  )}
                </div>

                {/* Speed Breakdown */}
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Speed ({speedMulti.toFixed(2)}x total)</h3>
                  <div style={styles.breakdownItem}>
                    <span>Base (Upgrades Lv.{speedLevel})</span>
                    <span>{baseSpeedMulti.toFixed(2)}x</span>
                  </div>
                  {milestoneSpeedBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Milestones</span>
                      <span>{milestoneSpeedBonus.toFixed(2)}x</span>
                    </div>
                  )}
                  {runeSpeedBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Runes (Tides + Eternity)</span>
                      <span>{runeSpeedBonus.toFixed(2)}x</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowMultiplierBreakdown(false)}
                style={styles.closeBtn}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Milestones Panel - Top Left */}
      <div className="milestones-panel" style={styles.milestonesPanel}>
        <button
          onClick={() => setShowMilestones(true)}
          style={styles.milestonesBtn}
        >
          Milestones {unclaimedMilestones.length > 0 && `(${unclaimedMilestones.length})`}
        </button>
        {runesUnlocked && (
          <button
            onClick={() => setShowRunes(true)}
            style={styles.runesBtn}
          >
            Runes
          </button>
        )}
      </div>

      {/* Stats Display - Next to Upgrades */}
      <div className="stats-panel" style={styles.statsPanel}>
        <h3 className="stats-panel-title" style={styles.statsPanelTitle}>Total Stats</h3>
        <div style={styles.statsPanelList}>
          {luckMulti > 1.0 && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Luck</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{luckMulti.toFixed(2)}x</span>
            </div>
          )}
          {pointsMulti > 1.0 && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Points</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{pointsMulti.toFixed(2)}x</span>
            </div>
          )}
          {speedMulti > 1.0 && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Speed</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{speedMulti.toFixed(2)}x</span>
            </div>
          )}
          <div style={styles.statsPanelItem}>
            <span className="stats-panel-label" style={styles.statsPanelLabel}>Roll Time</span>
            <span className="stats-panel-value" style={styles.statsPanelValue}>{((animationInterval * 10) / 1000).toFixed(2)}s</span>
          </div>
          {autoRollUnlocked && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Auto Roll{fastAutoRollUnlocked ? '' : ' (Slow)'}</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{((animationInterval * 10 * (fastAutoRollUnlocked ? 5 : 10)) / 1000).toFixed(2)}s</span>
            </div>
          )}
          {bulkRollCount > 1 && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Bulk Roll</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{formatNumber(bulkRollCount)}x</span>
            </div>
          )}
          {autoRollUnlocked && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Rolls/sec</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{formatNumber((1000 / (animationInterval * 10 * (fastAutoRollUnlocked ? 5 : 10))) * bulkRollCount)}</span>
            </div>
          )}
          {totalRuneLuck > 1.0 && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Luck</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{totalRuneLuck.toFixed(2)}x</span>
            </div>
          )}
          <div style={styles.statsPanelItem}>
            <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Roll</span>
            <span className="stats-panel-value" style={styles.statsPanelValue}>{(runeRollTime / 1000).toFixed(2)}s</span>
          </div>
          {runeAutoRollUnlocked && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Auto{fastRuneAutoRollUnlocked ? '' : ' (Slow)'}</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{((runeRollTime * (fastRuneAutoRollUnlocked ? 2 : 5)) / 1000).toFixed(2)}s</span>
            </div>
          )}
          {runeBulkCount > 1 && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Bulk</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{formatNumber(runeBulkCount)}x</span>
            </div>
          )}
          {runeAutoRollUnlocked && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Runes/sec</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{formatNumber((1000 / (runeRollTime * (fastRuneAutoRollUnlocked ? 2 : 5))) * runeBulkCount)}</span>
            </div>
          )}
          {totalCostReduction < 1 && (
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Cost Reduction</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{((1 - totalCostReduction) * 100).toFixed(2)}%</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowPercentFormat(!showPercentFormat)}
          style={styles.formatToggleBtn}
        >
          {showPercentFormat ? 'Show 1/x' : 'Show %'}
        </button>
        <button
          onClick={() => setShowMultiplierBreakdown(true)}
          style={{...styles.formatToggleBtn, marginTop: '0.5rem'}}
        >
          View Breakdown
        </button>
      </div>

      {/* Upgrades Panel - Top Right */}
      <div className="upgrades-panel" style={styles.upgradesPanel}>
        <h3 style={styles.upgradesTitle}>Upgrades</h3>
        <div className="upgrades-list" style={styles.upgradesList}>
          {/* Luck Upgrade */}
          <div className="upgrade-item" style={styles.upgradeItem}>
            <div className="upgrade-info" style={styles.upgradeInfo}>
              <span className="upgrade-name" style={styles.upgradeName}>Luck</span>
              <span className="upgrade-value" style={styles.upgradeValue}>{baseLuckMulti.toFixed(2)}x</span>
              <span className="upgrade-level" style={styles.upgradeLevel}>Lv.{luckLevel}</span>
            </div>
            <button
              className="upgrade-btn"
              onClick={handleUpgradeLuck}
              disabled={!canAffordLuckUpgrade}
              style={{
                ...styles.upgradeBtn,
                opacity: canAffordLuckUpgrade ? 1 : 0.5,
                cursor: canAffordLuckUpgrade ? 'pointer' : 'not-allowed',
              }}
            >
              {formatNumber(luckUpgradeCost)}
            </button>
          </div>
          {/* Points Multiplier Upgrade */}
          <div className="upgrade-item" style={styles.upgradeItem}>
            <div className="upgrade-info" style={styles.upgradeInfo}>
              <span className="upgrade-name" style={styles.upgradeName}>Points</span>
              <span className="upgrade-value" style={styles.upgradeValue}>{basePointsMulti.toFixed(2)}x</span>
              <span className="upgrade-level" style={styles.upgradeLevel}>Lv.{pointsMultiLevel}</span>
            </div>
            <button
              className="upgrade-btn"
              onClick={handleUpgradePoints}
              disabled={!canAffordPointsUpgrade}
              style={{
                ...styles.upgradeBtn,
                opacity: canAffordPointsUpgrade ? 1 : 0.5,
                cursor: canAffordPointsUpgrade ? 'pointer' : 'not-allowed',
              }}
            >
              {formatNumber(pointsUpgradeCost)}
            </button>
          </div>
          {/* Speed Upgrade */}
          <div className="upgrade-item" style={styles.upgradeItem}>
            <div className="upgrade-info" style={styles.upgradeInfo}>
              <span className="upgrade-name" style={styles.upgradeName}>Speed</span>
              <span className="upgrade-value" style={styles.upgradeValue}>{baseSpeedMulti.toFixed(2)}x</span>
              <span className="upgrade-level" style={styles.upgradeLevel}>Lv.{speedLevel}</span>
            </div>
            <button
              className="upgrade-btn"
              onClick={handleUpgradeSpeed}
              disabled={!canAffordSpeedUpgrade}
              style={{
                ...styles.upgradeBtn,
                opacity: canAffordSpeedUpgrade ? 1 : 0.5,
                cursor: canAffordSpeedUpgrade ? 'pointer' : 'not-allowed',
              }}
            >
              {formatNumber(speedUpgradeCost)}
            </button>
          </div>
          {/* Bulk Roll Upgrade */}
          <div className="upgrade-item" style={styles.upgradeItem}>
            <div className="upgrade-info" style={styles.upgradeInfo}>
              <span className="upgrade-name" style={styles.upgradeName}>Bulk</span>
              <span className="upgrade-value" style={styles.upgradeValue}>+{bulkRollLevel}</span>
              <span className="upgrade-level" style={styles.upgradeLevel}>Lv.{bulkRollLevel}/4</span>
            </div>
            <button
              className="upgrade-btn"
              onClick={handleUpgradeBulk}
              disabled={!canAffordBulkUpgrade}
              style={{
                ...styles.upgradeBtn,
                opacity: canAffordBulkUpgrade ? 1 : 0.5,
                cursor: canAffordBulkUpgrade ? 'pointer' : 'not-allowed',
              }}
            >
              {bulkRollLevel >= 4 ? 'MAX' : formatNumber(bulkUpgradeCost)}
            </button>
          </div>
          {/* Rune Bulk Upgrade - only show after runes unlocked */}
          {runesUnlocked && (
            <div className="upgrade-item" style={styles.upgradeItem}>
              <div className="upgrade-info" style={styles.upgradeInfo}>
                <span className="upgrade-name" style={styles.upgradeName}>Rune Bulk</span>
                <span className="upgrade-value" style={styles.upgradeValue}>+{runeBulkRollLevel}</span>
                <span className="upgrade-level" style={styles.upgradeLevel}>Lv.{runeBulkRollLevel}/2</span>
              </div>
              <button
                className="upgrade-btn"
                onClick={handleUpgradeRuneBulk}
                disabled={!canAffordRuneBulkUpgrade}
                style={{
                  ...styles.upgradeBtn,
                  opacity: canAffordRuneBulkUpgrade ? 1 : 0.5,
                  cursor: canAffordRuneBulkUpgrade ? 'pointer' : 'not-allowed',
                }}
              >
                {runeBulkRollLevel >= 2 ? 'MAX' : formatNumber(runeBulkUpgradeCost)}
              </button>
            </div>
          )}
          {/* Cost Reduction Upgrade - unlocks at 1 quadrillion */}
          {costReductionUnlocked && (
            <div className="upgrade-item" style={styles.upgradeItem}>
              <div className="upgrade-info" style={styles.upgradeInfo}>
                <span className="upgrade-name" style={styles.upgradeName}>Discount</span>
                <span className="upgrade-value" style={styles.upgradeValue}>{((1 - upgradeCostReduction) * 100).toFixed(0)}% off</span>
                <span className="upgrade-level" style={styles.upgradeLevel}>Lv.{costReductionLevel}/5</span>
              </div>
              <button
                className="upgrade-btn"
                onClick={handleUpgradeCostReduction}
                disabled={!canAffordCostReductionUpgrade}
                style={{
                  ...styles.upgradeBtn,
                  opacity: canAffordCostReductionUpgrade ? 1 : 0.5,
                  cursor: canAffordCostReductionUpgrade ? 'pointer' : 'not-allowed',
                }}
              >
                {costReductionLevel >= 5 ? 'MAX' : formatNumber(costReductionUpgradeCost)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Milestones Modal */}
      {showMilestones && (
        <div style={styles.modalOverlay} onClick={() => setShowMilestones(false)}>
          <div className="modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title" style={styles.modalTitle}>Milestones</h2>
            <div className="milestones-list" style={styles.milestonesList}>
              {MILESTONES.filter((milestone) => {
                const isCompleted = milestone.requirement(milestoneState);
                const isClaimed = claimedMilestones.has(milestone.id);
                return isCompleted || isClaimed;
              }).map((milestone) => {
                const isCompleted = milestone.requirement(milestoneState);
                const isClaimed = claimedMilestones.has(milestone.id);
                return (
                  <div
                    key={milestone.id}
                    style={styles.milestoneItem}
                  >
                    <div style={styles.milestoneInfo}>
                      <div style={styles.milestoneName}>{milestone.name}</div>
                      <div style={styles.milestoneDesc}>{milestone.description}</div>
                      <div style={styles.milestoneReward}>
                        {milestone.luckBonus ? (
                          <>Reward: {milestone.luckBonus}x Luck</>
                        ) : milestone.pointsBonus ? (
                          <>Reward: {milestone.pointsBonus}x Points</>
                        ) : milestone.speedBonus ? (
                          <>Reward: {milestone.speedBonus}x Speed</>
                        ) : milestone.unlockSlowAutoRoll ? (
                          <>Reward: Slow Auto Roll</>
                        ) : milestone.unlockAutoRoll ? (
                          <>Reward: Fast Auto Roll</>
                        ) : milestone.unlockSlowRuneAutoRoll ? (
                          <>Reward: Slow Rune Auto Roll</>
                        ) : milestone.unlockFastRuneAutoRoll ? (
                          <>Reward: Fast Rune Auto Roll</>
                        ) : milestone.runeSpeedBonus ? (
                          <>Reward: {milestone.runeSpeedBonus}x Rune Speed</>
                        ) : milestone.runeLuckBonus ? (
                          <>Reward: {milestone.runeLuckBonus}x Rune Luck</>
                        ) : (
                          <>Reward: {milestone.reward.toLocaleString()} pts</>
                        )}
                      </div>
                    </div>
                    {isClaimed ? (
                      <div style={styles.claimedLabel}>Claimed</div>
                    ) : (
                      <button
                        onClick={() => handleClaimMilestone(milestone)}
                        disabled={!isCompleted}
                        style={{
                          ...styles.claimBtn,
                          opacity: isCompleted ? 1 : 0.5,
                          cursor: isCompleted ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Claim
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
              {unclaimedMilestones.length > 0 && (
                <button
                  onClick={handleClaimAllMilestones}
                  style={{...styles.closeBtn, backgroundColor: '#22c55e'}}
                >
                  Claim All ({unclaimedMilestones.length})
                </button>
              )}
              <button
                onClick={() => setShowMilestones(false)}
                style={styles.closeBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiplier Breakdown Modal */}
      {showMultiplierBreakdown && (
        <div style={styles.modalOverlay} onClick={() => setShowMultiplierBreakdown(false)}>
          <div className="modal" style={{...styles.modal, maxWidth: '500px'}} onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title" style={styles.modalTitle}>Multiplier Breakdown</h2>
            <div style={{...styles.milestonesList, maxHeight: '60vh'}}>
              {/* Luck Breakdown */}
              <div style={styles.breakdownSection}>
                <h3 style={styles.breakdownHeader}>Luck ({luckMulti.toFixed(2)}x total)</h3>
                <div style={styles.breakdownItem}>
                  <span>Base (Upgrades Lv.{luckLevel})</span>
                  <span>{baseLuckMulti.toFixed(2)}x</span>
                </div>
                {milestoneLuckBonus > 1 && (
                  <div style={styles.breakdownItem}>
                    <span>Milestones</span>
                    <span>{milestoneLuckBonus.toFixed(2)}x</span>
                  </div>
                )}
                {runeLuckBonus > 1 && (
                  <div style={styles.breakdownItem}>
                    <span>Runes (Embers + Eternity)</span>
                    <span>{runeLuckBonus.toFixed(2)}x</span>
                  </div>
                )}
              </div>

              {/* Points Breakdown */}
              <div style={styles.breakdownSection}>
                <h3 style={styles.breakdownHeader}>Points ({pointsMulti.toFixed(2)}x total)</h3>
                <div style={styles.breakdownItem}>
                  <span>Base (Upgrades Lv.{pointsMultiLevel})</span>
                  <span>{basePointsMulti.toFixed(2)}x</span>
                </div>
                {milestonePointsBonus > 1 && (
                  <div style={styles.breakdownItem}>
                    <span>Milestones</span>
                    <span>{milestonePointsBonus.toFixed(2)}x</span>
                  </div>
                )}
                {runePointsBonus > 1 && (
                  <div style={styles.breakdownItem}>
                    <span>Runes (Beginning + Eternity)</span>
                    <span>{runePointsBonus.toFixed(2)}x</span>
                  </div>
                )}
              </div>

              {/* Speed Breakdown */}
              <div style={styles.breakdownSection}>
                <h3 style={styles.breakdownHeader}>Speed ({speedMulti.toFixed(2)}x total)</h3>
                <div style={styles.breakdownItem}>
                  <span>Base (Upgrades Lv.{speedLevel})</span>
                  <span>{baseSpeedMulti.toFixed(2)}x</span>
                </div>
                {milestoneSpeedBonus > 1 && (
                  <div style={styles.breakdownItem}>
                    <span>Milestones</span>
                    <span>{milestoneSpeedBonus.toFixed(2)}x</span>
                  </div>
                )}
                {runeSpeedBonus > 1 && (
                  <div style={styles.breakdownItem}>
                    <span>Runes (Tides + Eternity)</span>
                    <span>{runeSpeedBonus.toFixed(2)}x</span>
                  </div>
                )}
              </div>

              {/* Bulk Breakdown */}
              {bulkRollCount > 1 && (
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Bulk Roll ({formatNumber(bulkRollCount)}x total)</h3>
                  <div style={styles.breakdownItem}>
                    <span>Stone Runes</span>
                    <span>{formatNumber(runeOfStoneCount)}</span>
                  </div>
                  {bulkRollCount > 1001 && (
                    <div style={styles.breakdownItem}>
                      <span style={{ fontSize: '0.8em', color: '#888' }}>Soft cap: 1k runes/bulk after 1000</span>
                    </div>
                  )}
                  {bulkRollCount > 10001 && (
                    <div style={styles.breakdownItem}>
                      <span style={{ fontSize: '0.8em', color: '#888' }}>Soft cap: 1M runes/bulk after 10k</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rune Luck Breakdown */}
              {totalRuneLuck > 1 && (
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Rune Luck ({totalRuneLuck.toFixed(2)}x total)</h3>
                  {milestoneRuneLuckBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Milestones</span>
                      <span>{milestoneRuneLuckBonus.toFixed(2)}x</span>
                    </div>
                  )}
                  {runeRuneLuckBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Runes (Thunder + Eternity)</span>
                      <span>{runeRuneLuckBonus.toFixed(2)}x</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rune Bulk Breakdown */}
              {runeBulkCount > 1 && (
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Rune Bulk ({formatNumber(runeBulkCount)}x total)</h3>
                  <div style={styles.breakdownItem}>
                    <span>Frost Runes</span>
                    <span>{formatNumber(runeOfFrostCount)}</span>
                  </div>
                  {runeBulkCount > 11 && (
                    <div style={styles.breakdownItem}>
                      <span style={{ fontSize: '0.8em', color: '#888' }}>Soft cap: 10k runes/bulk after 10</span>
                    </div>
                  )}
                  {runeBulkCount > 101 && (
                    <div style={styles.breakdownItem}>
                      <span style={{ fontSize: '0.8em', color: '#888' }}>Soft cap: 10M runes/bulk after 100</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rune Speed Breakdown */}
              {(milestoneRuneSpeedBonus > 1 || runeRuneSpeedBonus > 1) && (
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Rune Speed ({(milestoneRuneSpeedBonus * runeRuneSpeedBonus).toFixed(2)}x total)</h3>
                  {milestoneRuneSpeedBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Milestones</span>
                      <span>{milestoneRuneSpeedBonus.toFixed(2)}x</span>
                    </div>
                  )}
                  {runeRuneSpeedBonus > 1 && (
                    <div style={styles.breakdownItem}>
                      <span>Runes (Gales + Eternity)</span>
                      <span>{runeRuneSpeedBonus.toFixed(2)}x</span>
                    </div>
                  )}
                </div>
              )}

              {/* Cost Reduction from Shadow */}
              {runeOfShadowCount > 0 && (
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Upgrade Cost Reduction</h3>
                  <div style={styles.breakdownItem}>
                    <span>Runes (Shadow + Eternity)</span>
                    <span>{((1 - shadowCostReduction) * 100).toFixed(1)}% off</span>
                  </div>
                </div>
              )}

              {/* Ascension Bonus from Light */}
              {runeOfLightCount > 0 && (
                <div style={styles.breakdownSection}>
                  <h3 style={styles.breakdownHeader}>Ascension Multiplier</h3>
                  <div style={styles.breakdownItem}>
                    <span>Base</span>
                    <span>2x</span>
                  </div>
                  <div style={styles.breakdownItem}>
                    <span>Runes (Light + Eternity)</span>
                    <span>+{(lightAscensionBonus - 2).toFixed(2)}x</span>
                  </div>
                  <div style={styles.breakdownItem}>
                    <span style={{fontWeight: 'bold'}}>Total</span>
                    <span style={{fontWeight: 'bold'}}>{lightAscensionBonus.toFixed(2)}x</span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowMultiplierBreakdown(false)}
              style={styles.closeBtn}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Ascension Prompt Modal */}
      {ascendPrompt !== null && (() => {
        const nextInfo = getNextAscensionInfo(ascendPrompt);
        if (!nextInfo) return null;
        const currentLevel = ascendedRanks.get(ascendPrompt) || 0;
        const currentMulti = currentLevel > 0 ? ASCENSION_TIERS[currentLevel - 1].multiplier : 1;
        const basePoints = calculatePoints(ranks[ascendPrompt]);
        return (
          <div style={styles.modalOverlay} onClick={() => setAscendPrompt(null)}>
            <div className="modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.ascendTitle}>
                {currentLevel === 0 ? 'Ascend Rank?' : `Ascend to Tier ${nextInfo.tierIndex + 1}?`}
              </h2>
              <div style={styles.ascendInfo}>
                <div style={styles.ascendRankName}>
                  {ranks[ascendPrompt].displayName}{getAscensionStars(ascendPrompt, ascendedRanks)}<AscensionStar5 rankIndex={ascendPrompt} ascendedRanks={ascendedRanks} />
                </div>
                <div style={styles.ascendDesc}>
                  {currentLevel === 0
                    ? `Ascending this rank will multiply the base points by ${nextInfo.multiplier}x when rolling it.`
                    : `Upgrade from ${currentMulti}x to ${nextInfo.multiplier}x base points.`
                  }
                </div>
                <div style={styles.ascendBonus}>
                  {basePoints} pts → {basePoints * nextInfo.multiplier} pts (base)
                </div>
                <div style={{...styles.ascendDesc, fontSize: '0.8rem', color: '#888', marginTop: '0.5rem'}}>
                  {'★'.repeat(nextInfo.stars)} ({nextInfo.rolls.toLocaleString()} rolls required)
                </div>
              </div>
              <div style={styles.ascendButtons}>
                <button
                  onClick={() => handleAscend(ascendPrompt)}
                  style={styles.ascendConfirmBtn}
                >
                  Ascend
                </button>
                <button
                  onClick={() => setAscendPrompt(null)}
                  style={styles.closeBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <h1 className="game-title" style={styles.title}>Rank Roller</h1>

      <div style={styles.statsColumn}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Rolls</span>
          <span style={styles.statValue}>{rollCount}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Points</span>
          <span style={styles.statValue}>{totalPoints.toLocaleString()}</span>
        </div>
        {lastPointsGained !== null && (
          <div style={styles.stat}>
            <span style={styles.lastGained}>+{lastPointsGained.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Current Roll Display */}
      <div
        className="roll-display"
        style={{
          ...styles.rollDisplay,
          backgroundColor: colors?.bg || '#333',
          color: colors?.text || '#fff',
          boxShadow: colors ? `0 0 30px ${colors.glow}` : 'none',
        }}
      >
        {currentRoll ? (
          <>
            <div className="roll-tier" style={styles.rollTier}>{currentRoll.tier}</div>
            <div className="roll-number" style={styles.rollNumber}>{currentRoll.tierNumber}</div>
            <div style={styles.rollProbability}>
              {formatProbability(getEffectiveProbability(currentRoll, ranks, luckMulti))}
            </div>
          </>
        ) : (
          <div style={styles.rollPlaceholder}>Click Roll to start!</div>
        )}
      </div>

      <button
        className="roll-button"
        onClick={handleRoll}
        disabled={isRolling || autoRollEnabled}
        style={{
          ...styles.rollButton,
          opacity: isRolling || autoRollEnabled ? 0.6 : 1,
          cursor: isRolling || autoRollEnabled ? 'not-allowed' : 'pointer',
        }}
      >
        {isRolling ? 'Rolling...' : 'ROLL'}
      </button>

      {autoRollUnlocked && (
        <button
          className="auto-roll-btn"
          onClick={() => setAutoRollEnabled((prev) => !prev)}
          style={{
            ...styles.autoRollBtn,
            backgroundColor: autoRollEnabled ? '#22c55e' : '#4a4a8a',
          }}
        >
          Auto Roll: {autoRollEnabled ? 'ON' : 'OFF'} {fastAutoRollUnlocked ? '(Fast)' : '(Slow)'}
        </button>
      )}

      {/* Highest Rank Display */}
      <div style={styles.highestSection}>
        <h2 style={styles.highestTitle}>Highest Rank</h2>
        <div
          style={{
            ...styles.highestDisplay,
            backgroundColor: highestColors?.bg || '#222',
            color: highestColors?.text || '#666',
            boxShadow: highestColors ? `0 0 20px ${highestColors.glow}` : 'none',
          }}
        >
          {highestRank ? (
            <>
              <div style={styles.highestName}>{highestRank.displayName}</div>
              <div style={styles.highestProbability}>
                {formatProbability(getEffectiveProbability(highestRank, ranks, luckMulti))}
              </div>
              <div style={styles.highestRollNumber}>
                on roll #{highestRankRoll?.toLocaleString()}
              </div>
            </>
          ) : (
            <div style={styles.highestPlaceholder}>None yet</div>
          )}
        </div>
      </div>

      {/* Catalogue */}
      <div className="catalogue-section" style={styles.catalogue}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ ...styles.catalogueTitle, marginBottom: 0 }}>
            Catalogue ({collectedCount}/100)
          </h3>
          {hasAnyAscendable && (
            <button
              onClick={handleAscendAll}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                backgroundColor: '#ffd700',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
              }}
            >
              Ascend All
            </button>
          )}
        </div>
        {collectedCount === 0 ? (
          <div style={styles.emptyMessage}>Roll to start collecting ranks!</div>
        ) : (
          <div className="catalogue-grid" style={styles.catalogueGrid}>
            {TIER_NAMES.map((tier, tierIndex) => {
              const tierColors = TIER_COLORS[tier];
              const tierRanks = ranks.slice(tierIndex * 10, tierIndex * 10 + 10);
              const collectedInTier = tierRanks.filter((r) =>
                collectedRanks.has(r.index)
              );
              const isComplete = completeTiers.has(tier);
              const isExpanded = expandedTiers.has(tier);

              if (collectedInTier.length === 0) return null;

              // Complete tier - show condensed or expanded
              if (isComplete) {
                if (isExpanded) {
                  // Expanded view - show all ranks in tier
                  return (
                    <div key={tier} style={styles.tierGroup}>
                      <div
                        onClick={() => toggleTierExpansion(tier)}
                        style={{
                          ...styles.tierHeader,
                          backgroundColor: tierColors.bg,
                          color: tierColors.text,
                          boxShadow: `0 0 10px ${tierColors.glow}`,
                        }}
                      >
                        <div style={styles.tierHeaderName}>{tier} (Complete)</div>
                        <div style={styles.tierHeaderPoints}>
                          {getTierTotalPoints(tierIndex).toLocaleString()} pts
                        </div>
                        <div style={styles.collapseHint}>Click to collapse</div>
                      </div>
                      <div style={styles.tierRanksGrid}>
                        {tierRanks.map((rank) => {
                          const points = getDisplayPoints(rank);
                          const isAscended = (ascendedRanks.get(rank.index) || 0) > 0;
                          const isAscendable = canAscend(rank.index);
                          return (
                            <div
                              key={rank.index}
                              onClick={() => isAscendable && setAscendPrompt(rank.index)}
                              style={{
                                ...styles.tierRankItem,
                                backgroundColor: tierColors.bg,
                                color: tierColors.text,
                                ...(isAscended ? styles.ascendedRank : {}),
                                ...(isAscendable ? styles.ascendableRank : {}),
                                cursor: isAscendable ? 'pointer' : 'default',
                              }}
                            >
                              <div style={styles.tierRankNumber}>
                                {rank.tierNumber}{getAscensionStars(rank.index, ascendedRanks)}<AscensionStar5 rankIndex={rank.index} ascendedRanks={ascendedRanks} />
                              </div>
                              <div style={styles.tierRankChance}>
                                {formatProbability(getEffectiveProbability(rank, ranks, luckMulti))}
                              </div>
                              <div style={styles.tierRankPoints}>
                                {points.toLocaleString()} pts
                              </div>
                              <div style={styles.tierRankRolls}>
                                {(rankRollCounts[rank.index] || 0).toLocaleString()}x
                              </div>
                              {rollCount > 0 && (
                                <div style={styles.tierRankPercent}>
                                  {(((rankRollCounts[rank.index] || 0) / rollCount) * 100).toFixed(5)}%
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } else {
                  // Condensed view - single item
                  const hasAscension = tierHasAscensionAvailable(tierIndex, rankRollCounts, ascendedRanks);
                  return (
                    <div
                      key={tier}
                      onClick={() => toggleTierExpansion(tier)}
                      style={{
                        ...styles.catalogueItem,
                        ...styles.completeTier,
                        backgroundColor: tierColors.bg,
                        color: tierColors.text,
                        boxShadow: `0 0 15px ${tierColors.glow}`,
                      }}
                    >
                      <div style={styles.catalogueItemName}>{tier}</div>
                      <div style={styles.completeLabel}>COMPLETE</div>
                      <div style={styles.catalogueItemRolls}>
                        Rolled: {getTierRollCount(tierIndex).toLocaleString()}x
                      </div>
                      {hasAscension && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '4px',
                        }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#ff3333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#ffffff',
                            boxShadow: '0 0 8px rgba(255, 51, 51, 0.6)',
                          }}>
                            !
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              }

              // Incomplete tier - show individual ranks
              return collectedInTier
                .sort((a, b) => b.index - a.index)
                .map((rank) => {
                  const points = getDisplayPoints(rank);
                  const isAscended = (ascendedRanks.get(rank.index) || 0) > 0;
                  const isAscendable = canAscend(rank.index);
                  return (
                    <div
                      key={rank.index}
                      className="catalogue-item"
                      onClick={() => isAscendable && setAscendPrompt(rank.index)}
                      style={{
                        ...styles.catalogueItem,
                        backgroundColor: tierColors.bg,
                        color: tierColors.text,
                        boxShadow: `0 0 10px ${tierColors.glow}`,
                        ...(isAscended ? styles.ascendedRank : {}),
                        ...(isAscendable ? styles.ascendableRank : {}),
                        cursor: isAscendable ? 'pointer' : 'default',
                      }}
                    >
                      <div className="catalogue-item-name" style={styles.catalogueItemName}>
                        {rank.displayName}{getAscensionStars(rank.index, ascendedRanks)}<AscensionStar5 rankIndex={rank.index} ascendedRanks={ascendedRanks} />
                      </div>
                      <div style={styles.catalogueItemChance}>
                        {formatProbability(getEffectiveProbability(rank, ranks, luckMulti))}
                      </div>
                      <div style={styles.catalogueItemPoints}>
                        {points.toLocaleString()} pts
                      </div>
                      <div style={styles.catalogueItemRolls}>
                        Rolled: {(rankRollCounts[rank.index] || 0).toLocaleString()}x
                      </div>
                      {rollCount > 0 && (
                        <div style={styles.catalogueItemPercent}>
                          {(((rankRollCounts[rank.index] || 0) / rollCount) * 100).toFixed(5)}%
                        </div>
                      )}
                    </div>
                  );
                });
            })}
          </div>
        )}
      </div>

      {/* Reset Button - Bottom Left */}
      <div className="reset-panel" style={styles.resetPanel}>
        <button
          className="reset-btn"
          onClick={() => setShowResetModal(true)}
          style={styles.resetBtn}
        >
          Reset Progress
        </button>
        {(canRollerPrestige || canRunePrestige) && (
          <button
            onClick={() => setShowPrestigeModal(true)}
            style={{
              ...styles.resetBtn,
              backgroundColor: '#9932cc',
              marginTop: '0.5rem',
              boxShadow: '0 0 15px rgba(153, 50, 204, 0.5)',
            }}
          >
            Prestige Available!
          </button>
        )}
      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div style={styles.modalOverlay} onClick={() => { setShowResetModal(false); setResetInput(''); }}>
          <div className="modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.resetTitle}>Reset Progress?</h2>
            <div style={styles.resetWarning}>
              This will permanently delete all your progress including rolls, points, upgrades, and milestones.
            </div>
            <div style={styles.resetInputContainer}>
              <div style={styles.resetInputLabel}>Type RESET to confirm:</div>
              <input
                type="text"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                style={styles.resetInput}
                placeholder="RESET"
              />
            </div>
            <div style={styles.resetButtons}>
              <button
                onClick={handleReset}
                disabled={resetInput !== 'RESET'}
                style={{
                  ...styles.resetConfirmBtn,
                  opacity: resetInput === 'RESET' ? 1 : 0.5,
                  cursor: resetInput === 'RESET' ? 'pointer' : 'not-allowed',
                }}
              >
                Reset Everything
              </button>
              <button
                onClick={() => { setShowResetModal(false); setResetInput(''); }}
                style={styles.closeBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prestige Modal */}
      {showPrestigeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowPrestigeModal(false)}>
          <div className="modal" style={{ ...styles.modal, maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ ...styles.resetTitle, color: '#9932cc' }}>⭐ Prestige</h2>
            <div style={{ marginBottom: '1.5rem', color: '#aaa', textAlign: 'center' }}>
              Prestige resets your progress but grants permanent bonuses!
            </div>

            {/* Roller Prestige */}
            <div style={{
              backgroundColor: '#1a1a2e',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              border: canRollerPrestige ? '2px solid #9932cc' : '1px solid #333',
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffd700' }}>
                Roller Prestige (Level {rollerPrestigeLevel})
              </h3>
              <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Requirement: {ROLLER_PRESTIGE_REQ} Ultimate 10 rolls
              </div>
              <div style={{ color: '#fff', marginBottom: '0.5rem' }}>
                Progress: {ultimate10Rolls} / {ROLLER_PRESTIGE_REQ}
              </div>
              <div style={{ color: '#4CAF50', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Current bonus: +{rollerPrestigeLevel * 10}% Luck
              </div>
              <div style={{ color: '#9932cc', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Next prestige: +{(rollerPrestigeLevel + 1) * 10}% Luck
              </div>
              <div style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Resets: Ranks, points, upgrades, milestones, ascensions
                <br />
                Keeps: Runes, rune rolls, rune prestige
              </div>
              <button
                onClick={handleRollerPrestige}
                disabled={!canRollerPrestige}
                style={{
                  ...styles.resetConfirmBtn,
                  backgroundColor: canRollerPrestige ? '#9932cc' : '#444',
                  opacity: canRollerPrestige ? 1 : 0.5,
                  cursor: canRollerPrestige ? 'pointer' : 'not-allowed',
                  width: '100%',
                }}
              >
                {canRollerPrestige ? 'Prestige Roller' : `Need ${ROLLER_PRESTIGE_REQ - ultimate10Rolls} more Ultimate 10s`}
              </button>
            </div>

            {/* Rune Prestige */}
            <div style={{
              backgroundColor: '#1a1a2e',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              border: canRunePrestige ? '2px solid #00bcd4' : '1px solid #333',
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#00bcd4' }}>
                Rune Prestige (Level {runePrestigeLevel})
              </h3>
              <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Requirements: 100 / 400 / 1000 rune rolls per tier
              </div>
              <div style={{ color: '#fff', marginBottom: '0.5rem' }}>
                Total rune rolls: {runeRollCount}
                {nextRunePrestigeReq && ` (next tier at ${nextRunePrestigeReq})`}
              </div>
              <div style={{ color: '#4CAF50', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Current bonus: +{runePrestigeLevel * 5}% Rune Luck
              </div>
              <div style={{ color: '#00bcd4', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Next prestige: +{(runePrestigeLevel + 1) * 5}% Rune Luck
              </div>
              <div style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Resets: Collected runes, rune roll counts
                <br />
                Keeps: Ranks, points, upgrades, roller prestige
              </div>
              <button
                onClick={handleRunePrestige}
                disabled={!canRunePrestige}
                style={{
                  ...styles.resetConfirmBtn,
                  backgroundColor: canRunePrestige ? '#00bcd4' : '#444',
                  opacity: canRunePrestige ? 1 : 0.5,
                  cursor: canRunePrestige ? 'pointer' : 'not-allowed',
                  width: '100%',
                }}
              >
                {canRunePrestige ? 'Prestige Runes' : `Need ${(nextRunePrestigeReq || 100) - runeRollCount} more rune rolls`}
              </button>
            </div>

            <button
              onClick={() => setShowPrestigeModal(false)}
              style={{ ...styles.closeBtn, width: '100%' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Cheat Menu Modal */}
      {showCheatMenu && (
        <div style={styles.modalOverlay} onClick={() => setShowCheatMenu(false)}>
          <div className="modal" style={styles.cheatModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.cheatTitle}>🎮 Cheat Menu</h2>
            <div style={styles.cheatGrid}>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Points:</label>
                <input
                  type="number"
                  value={totalPoints}
                  onChange={(e) => setTotalPoints(Number(e.target.value))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Rolls:</label>
                <input
                  type="number"
                  value={rollCount}
                  onChange={(e) => setRollCount(Number(e.target.value))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Luck Level:</label>
                <input
                  type="number"
                  value={luckLevel}
                  onChange={(e) => setLuckLevel(Number(e.target.value))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Points Multi Level:</label>
                <input
                  type="number"
                  value={pointsMultiLevel}
                  onChange={(e) => setPointsMultiLevel(Number(e.target.value))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Speed Level:</label>
                <input
                  type="number"
                  value={speedLevel}
                  onChange={(e) => setSpeedLevel(Number(e.target.value))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Rune Rolls:</label>
                <input
                  type="number"
                  value={runeRollCount}
                  onChange={(e) => setRuneRollCount(Number(e.target.value))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Stone Runes (Bulk):</label>
                <input
                  type="number"
                  value={runeRollCounts[4] || 0}
                  onChange={(e) => setRuneRollCounts(prev => ({ ...prev, 4: Number(e.target.value) }))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Thunder Runes (Rune Luck):</label>
                <input
                  type="number"
                  value={runeRollCounts[5] || 0}
                  onChange={(e) => setRuneRollCounts(prev => ({ ...prev, 5: Number(e.target.value) }))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Frost Runes (Rune Bulk):</label>
                <input
                  type="number"
                  value={runeRollCounts[6] || 0}
                  onChange={(e) => setRuneRollCounts(prev => ({ ...prev, 6: Number(e.target.value) }))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Game Speed (1-100x):</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={gameSpeedMultiplier}
                  onChange={(e) => setGameSpeedMultiplier(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  style={styles.cheatInput}
                />
              </div>
              <div style={styles.cheatItem}>
                <label style={styles.cheatLabel}>Bulk Upgrade Level (0-4):</label>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={bulkRollLevel}
                  onChange={(e) => setBulkRollLevel(Math.max(0, Math.min(4, Number(e.target.value) || 0)))}
                  style={styles.cheatInput}
                />
              </div>
            </div>
            <button
              onClick={() => setCollectedRanks(prev => new Set([...Array.from(prev), 20]))}
              style={{...styles.cheatCloseBtn, backgroundColor: '#9333ea', marginBottom: '10px'}}
            >
              Unlock Runes
            </button>
            <button
              onClick={() => setShowCheatMenu(false)}
              style={styles.cheatCloseBtn}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Save Management Modal (Runes Screen) */}
      {showSaveModal && (
        <div style={styles.modalOverlay} onClick={() => setShowSaveModal(false)}>
          <div className="modal" style={{...styles.cheatModal, maxWidth: '400px'}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.cheatTitle}>💾 Save Management</h2>
            <p style={{color: '#aaa', marginBottom: '20px', textAlign: 'center'}}>Export your save to back it up, or import a previous save.</p>
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <button onClick={exportSave} style={{...styles.cheatCloseBtn, backgroundColor: '#4a9'}}>
                📥 Export Save
              </button>
              <label style={{...styles.cheatCloseBtn, backgroundColor: '#49a', cursor: 'pointer', textAlign: 'center'}}>
                📤 Import Save
                <input type="file" accept=".sav" onChange={importSave} style={{display: 'none'}} />
              </label>
              <button onClick={() => setShowSaveModal(false)} style={{...styles.cheatCloseBtn, marginTop: '10px'}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keybind hints - bottom left */}
      <div style={styles.keybindHints}>
        <span style={styles.keybindHint}>[SPACE] Roll</span>
        {autoRollUnlocked && <span style={styles.keybindHint}>[A] Auto Roll</span>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    fontSize: '2.5rem',
    marginBottom: '5px',
    textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
  },
  statsColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    marginBottom: '10px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '0.9rem',
    color: '#888',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  lastGained: {
    fontSize: '1.1rem',
    color: '#4ade80',
    fontWeight: 'bold',
  },
  rollDisplay: {
    width: '280px',
    height: '160px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    transition: 'all 0.2s ease',
  },
  rollTier: {
    fontSize: '1.2rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  rollNumber: {
    fontSize: '4rem',
    fontWeight: 'bold',
    lineHeight: 1,
  },
  rollProbability: {
    fontSize: '0.9rem',
    marginTop: '8px',
    opacity: 0.9,
  },
  rollPlaceholder: {
    fontSize: '1.2rem',
    color: '#888',
  },
  rollButton: {
    padding: '14px 60px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    backgroundColor: '#4a4a8a',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    marginBottom: '15px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(74, 74, 138, 0.4)',
  },
  autoRollBtn: {
    padding: '10px 30px',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    marginBottom: '15px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  highestSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '15px',
  },
  highestTitle: {
    fontSize: '1.1rem',
    marginBottom: '5px',
    color: '#aaa',
  },
  highestDisplay: {
    padding: '12px 30px',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transition: 'all 0.3s ease',
  },
  highestName: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  highestProbability: {
    fontSize: '0.85rem',
    marginTop: '4px',
    opacity: 0.9,
  },
  highestRollNumber: {
    fontSize: '0.75rem',
    marginTop: '4px',
    opacity: 0.7,
  },
  highestPlaceholder: {
    color: '#666',
  },
  milestonesPanel: {
    position: 'fixed',
    top: '20px',
    left: '20px',
    zIndex: 100,
  },
  statsPanel: {
    position: 'fixed',
    top: '20px',
    right: '235px',
    backgroundColor: 'rgba(30, 30, 50, 0.95)',
    borderRadius: '12px',
    padding: '15px',
    minWidth: '140px',
    border: '2px solid rgba(100, 200, 255, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    zIndex: 100,
  },
  statsPanelTitle: {
    margin: '0 0 10px 0',
    fontSize: '0.85rem',
    color: '#64c8ff',
    textAlign: 'center',
    borderBottom: '1px solid rgba(100, 200, 255, 0.3)',
    paddingBottom: '8px',
  },
  statsPanelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  statsPanelItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsPanelLabel: {
    fontSize: '0.8rem',
    color: '#aaa',
  },
  statsPanelValue: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#64c8ff',
  },
  formatToggleBtn: {
    marginTop: '8px',
    padding: '4px 8px',
    fontSize: '0.7rem',
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    color: '#64c8ff',
    border: '1px solid rgba(100, 200, 255, 0.4)',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '100%',
  },
  upgradesPanel: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.95)',
    borderRadius: '12px',
    padding: '15px',
    minWidth: '180px',
    maxWidth: '220px',
    border: '2px solid rgba(255, 215, 0, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    zIndex: 100,
  },
  upgradesTitle: {
    margin: '0 0 12px 0',
    fontSize: '1rem',
    color: '#ffd700',
    textAlign: 'center',
    borderBottom: '1px solid rgba(255, 215, 0, 0.3)',
    paddingBottom: '8px',
  },
  upgradesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  upgradeItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  upgradeInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  upgradeName: {
    fontSize: '0.85rem',
    color: '#fff',
    fontWeight: 'bold',
  },
  upgradeValue: {
    fontSize: '1.1rem',
    color: '#ffd700',
    fontWeight: 'bold',
  },
  upgradeLevel: {
    fontSize: '0.7rem',
    color: '#888',
  },
  upgradeBtn: {
    padding: '8px 12px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    backgroundColor: '#ffd700',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  milestonesBtn: {
    padding: '12px 16px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    backgroundColor: '#9333ea',
    color: '#fff',
    border: '2px solid rgba(147, 51, 234, 0.5)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 20px rgba(147, 51, 234, 0.3)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    padding: '20px',
    minWidth: '300px',
    maxWidth: '400px',
    border: '2px solid #9333ea',
  },
  modalTitle: {
    margin: '0 0 15px 0',
    fontSize: '1.3rem',
    color: '#9333ea',
    textAlign: 'center',
  },
  milestonesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  milestoneItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(147, 51, 234, 0.3)',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    fontWeight: 'bold',
    fontSize: '1rem',
    color: '#fff',
  },
  milestoneDesc: {
    fontSize: '0.8rem',
    color: '#888',
    marginTop: '2px',
  },
  milestoneReward: {
    fontSize: '0.85rem',
    color: '#ffd700',
    marginTop: '4px',
  },
  claimBtn: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    backgroundColor: '#9333ea',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  claimedLabel: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#4ade80',
  },
  closeBtn: {
    marginTop: '15px',
    padding: '10px 20px',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
  },
  catalogue: {
    width: '100%',
    maxWidth: '600px',
  },
  catalogueTitle: {
    textAlign: 'center',
    fontSize: '1.1rem',
    color: '#aaa',
    marginBottom: '15px',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#666',
    fontSize: '1rem',
  },
  catalogueGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '10px',
  },
  catalogueItem: {
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  },
  catalogueItemName: {
    fontWeight: 'bold',
    fontSize: '0.9rem',
  },
  catalogueItemChance: {
    fontSize: '0.7rem',
    marginTop: '2px',
    opacity: 0.8,
  },
  catalogueItemPoints: {
    fontSize: '0.8rem',
    marginTop: '2px',
    opacity: 0.9,
  },
  catalogueItemRolls: {
    fontSize: '0.7rem',
    marginTop: '2px',
    opacity: 0.7,
  },
  completeTier: {
    cursor: 'pointer',
    border: '2px solid rgba(255, 255, 255, 0.3)',
  },
  completeLabel: {
    fontSize: '0.65rem',
    fontWeight: 'bold',
    letterSpacing: '1px',
    opacity: 0.8,
    marginTop: '2px',
  },
  tierGroup: {
    gridColumn: '1 / -1',
    width: '100%',
  },
  tierHeader: {
    padding: '12px',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    textAlign: 'center',
  },
  tierHeaderName: {
    fontWeight: 'bold',
    fontSize: '1rem',
  },
  tierHeaderPoints: {
    fontSize: '0.85rem',
    marginTop: '2px',
  },
  collapseHint: {
    fontSize: '0.7rem',
    opacity: 0.7,
    marginTop: '4px',
  },
  tierRanksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '4px',
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '0 0 8px 8px',
  },
  tierRankItem: {
    padding: '8px',
    borderRadius: '4px',
    textAlign: 'center',
  },
  tierRankNumber: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  tierRankChance: {
    fontSize: '0.6rem',
    opacity: 0.8,
  },
  tierRankPoints: {
    fontSize: '0.65rem',
    opacity: 0.9,
  },
  tierRankRolls: {
    fontSize: '0.6rem',
    opacity: 0.7,
  },
  tierRankPercent: {
    fontSize: '0.55rem',
    opacity: 0.7,
  },
  catalogueItemPercent: {
    fontSize: '0.75rem',
    opacity: 0.8,
  },
  ascendedRank: {
    boxShadow: '0 0 15px rgba(255, 215, 0, 0.8), inset 0 0 20px rgba(255, 215, 0, 0.2)',
    border: '2px solid #ffd700',
  },
  ascendableRank: {
    animation: 'pulse 2s infinite',
    boxShadow: '0 0 20px rgba(255, 255, 255, 0.6)',
    border: '2px dashed rgba(255, 255, 255, 0.8)',
  },
  ascendTitle: {
    margin: '0 0 15px 0',
    fontSize: '1.3rem',
    color: '#ffd700',
    textAlign: 'center',
  },
  ascendInfo: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  ascendRankName: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '10px',
  },
  ascendDesc: {
    fontSize: '0.9rem',
    color: '#aaa',
    marginBottom: '10px',
  },
  ascendBonus: {
    fontSize: '1rem',
    color: '#ffd700',
    fontWeight: 'bold',
  },
  ascendButtons: {
    display: 'flex',
    gap: '10px',
  },
  ascendConfirmBtn: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: '#ffd700',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  resetPanel: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    zIndex: 100,
  },
  resetBtn: {
    padding: '10px 16px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  resetTitle: {
    margin: '0 0 15px 0',
    fontSize: '1.3rem',
    color: '#ef4444',
    textAlign: 'center',
  },
  resetWarning: {
    fontSize: '0.9rem',
    color: '#f87171',
    textAlign: 'center',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
  resetInputContainer: {
    marginBottom: '20px',
  },
  resetInputLabel: {
    fontSize: '0.9rem',
    color: '#aaa',
    marginBottom: '8px',
    textAlign: 'center',
  },
  resetInput: {
    width: '100%',
    padding: '12px',
    fontSize: '1.1rem',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: '2px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    outline: 'none',
  },
  resetButtons: {
    display: 'flex',
    gap: '10px',
  },
  resetConfirmBtn: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  runesBtn: {
    padding: '12px 16px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    backgroundColor: '#a335ee',
    color: '#fff',
    border: '2px solid rgba(163, 53, 238, 0.5)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 20px rgba(163, 53, 238, 0.3)',
    marginTop: '10px',
  },
  backBtn: {
    position: 'fixed',
    top: '20px',
    left: '20px',
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  runesTitle: {
    fontSize: '3rem',
    marginTop: '60px',
    marginBottom: '20px',
    textShadow: '0 0 20px rgba(163, 53, 238, 0.5)',
    color: '#a335ee',
  },
  runesPointsDisplay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    marginBottom: '20px',
  },
  runesPointsLabel: {
    fontSize: '1rem',
    color: '#888',
  },
  runesPointsValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#fff',
  },
  runeRollDisplay: {
    width: '280px',
    height: '120px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '15px',
    transition: 'all 0.2s ease',
  },
  runeRollName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    textAlign: 'center',
    padding: '0 10px',
  },
  runeRollProbability: {
    fontSize: '0.9rem',
    marginTop: '8px',
    opacity: 0.9,
  },
  runeRollButton: {
    padding: '14px 40px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    backgroundColor: '#a335ee',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    marginBottom: '15px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(163, 53, 238, 0.4)',
  },
  runeStatsRow: {
    display: 'flex',
    gap: '30px',
    marginBottom: '20px',
    fontSize: '0.9rem',
    color: '#aaa',
  },
  runeCatalogue: {
    width: '100%',
    maxWidth: '600px',
  },
  runeCatalogueGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '10px',
  },
  runeItem: {
    padding: '15px',
    borderRadius: '10px',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  },
  runeItemName: {
    fontWeight: 'bold',
    fontSize: '0.85rem',
    marginBottom: '5px',
  },
  runeItemChance: {
    fontSize: '0.75rem',
    opacity: 0.8,
  },
  runeItemRolls: {
    fontSize: '0.7rem',
    marginTop: '5px',
    opacity: 0.7,
  },
  runeItemPercent: {
    fontSize: '0.7rem',
    marginTop: '2px',
    opacity: 0.7,
  },
  runeBuffsPanel: {
    position: 'fixed',
    top: '200px',
    right: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.95)',
    borderRadius: '12px',
    padding: '15px',
    minWidth: '160px',
    border: '2px solid rgba(163, 53, 238, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    zIndex: 100,
  },
  runeBuffsTitle: {
    margin: '0 0 10px 0',
    fontSize: '0.9rem',
    color: '#a335ee',
    textAlign: 'center',
    borderBottom: '1px solid rgba(163, 53, 238, 0.3)',
    paddingBottom: '8px',
  },
  runeBuffsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  runeBuffItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  runeBuffName: {
    fontSize: '0.8rem',
    color: '#aaa',
  },
  runeBuffValue: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#a335ee',
  },
  runeBuffSource: {
    fontSize: '0.7rem',
    color: '#888',
  },
  cheatModal: {
    backgroundColor: 'rgba(30, 30, 50, 0.98)',
    borderRadius: '16px',
    padding: '25px',
    minWidth: '350px',
    maxWidth: '450px',
    border: '2px solid #ff6b6b',
    boxShadow: '0 0 30px rgba(255, 107, 107, 0.3)',
  },
  cheatTitle: {
    margin: '0 0 20px 0',
    fontSize: '1.4rem',
    color: '#ff6b6b',
    textAlign: 'center',
  },
  cheatGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px',
    marginBottom: '20px',
  },
  cheatItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  cheatLabel: {
    fontSize: '0.85rem',
    color: '#aaa',
  },
  cheatInput: {
    padding: '8px 12px',
    fontSize: '1rem',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    border: '1px solid rgba(255, 107, 107, 0.4)',
    borderRadius: '6px',
    outline: 'none',
  },
  cheatCloseBtn: {
    width: '100%',
    padding: '12px',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: '#ff6b6b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  breakdownSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
  },
  breakdownHeader: {
    margin: '0 0 8px 0',
    fontSize: '1rem',
    color: '#ffd700',
    borderBottom: '1px solid rgba(255, 215, 0, 0.3)',
    paddingBottom: '6px',
  },
  breakdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '0.9rem',
    color: '#ccc',
  },
  keybindHints: {
    position: 'fixed',
    bottom: '15px',
    left: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    zIndex: 100,
  },
  keybindHint: {
    fontSize: '0.8rem',
    color: '#666',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
};
