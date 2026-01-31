'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';

const SAVE_KEY = 'rankroller_save';

interface SaveData {
  rollCount: number;
  totalPoints: number;
  highestRankIndex: number | null;
  highestRankRoll: number | null;
  collectedRanks: number[];
  rankRollCounts: Record<number, number>;
  ascendedRanks: number[];
  luckLevel: number;
  pointsMultiLevel: number;
  speedLevel: number;
  claimedMilestones: string[];
  // Rune data
  collectedRunes: number[];
  runeRollCounts: Record<number, number>;
  runeRollCount: number;
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  requirement: (state: { rollCount: number; collectedRanks: Set<number>; ascendedRanks: Set<number> }) => boolean;
  reward: number;
  luckBonus?: number;
  pointsBonus?: number;
  speedBonus?: number;
  unlockAutoRoll?: boolean;
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

const MILESTONES: Milestone[] = [
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
    id: 'rolls_25000',
    name: '25,000 Rolls',
    description: 'Roll 25,000 times',
    requirement: (state) => state.rollCount >= 25000,
    reward: 0,
    luckBonus: 2,
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
  // Luck multiplier boosts higher ranks more
  // Each rank's weight gets multiplied by luckMulti^(index/10)
  return ranks.map((rank) => rank.weight * Math.pow(luckMulti, rank.index / 10));
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
  const [ascendedRanks, setAscendedRanks] = useState<Set<number>>(new Set());
  const [ascendPrompt, setAscendPrompt] = useState<number | null>(null);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [luckLevel, setLuckLevel] = useState(0);
  const [pointsMultiLevel, setPointsMultiLevel] = useState(0);
  const [speedLevel, setSpeedLevel] = useState(0);
  const [claimedMilestones, setClaimedMilestones] = useState<Set<string>>(new Set());
  const [showMilestones, setShowMilestones] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [autoRollEnabled, setAutoRollEnabled] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [showRunes, setShowRunes] = useState(false);
  // Rune state
  const [currentRuneRoll, setCurrentRuneRoll] = useState<Rune | null>(null);
  const [collectedRunes, setCollectedRunes] = useState<Set<number>>(new Set());
  const [runeRollCounts, setRuneRollCounts] = useState<Record<number, number>>({});
  const [runeRollCount, setRuneRollCount] = useState(0);
  const [isRollingRune, setIsRollingRune] = useState(false);
  const rollCountRef = useRef(rollCount);

  // Load save data from cookies on mount
  useEffect(() => {
    const savedData = getCookie(SAVE_KEY);
    if (savedData) {
      try {
        const data: SaveData = JSON.parse(savedData);
        setRollCount(data.rollCount || 0);
        setTotalPoints(data.totalPoints || 0);
        if (data.highestRankIndex !== null && data.highestRankIndex !== undefined) {
          setHighestRank(ranks[data.highestRankIndex]);
        }
        setHighestRankRoll(data.highestRankRoll || null);
        setCollectedRanks(new Set(data.collectedRanks || []));
        setRankRollCounts(data.rankRollCounts || {});
        setAscendedRanks(new Set(data.ascendedRanks || []));
        setLuckLevel(data.luckLevel || 0);
        setPointsMultiLevel(data.pointsMultiLevel || 0);
        setSpeedLevel(data.speedLevel || 0);
        setClaimedMilestones(new Set(data.claimedMilestones || []));
        // Load rune data
        setCollectedRunes(new Set(data.collectedRunes || []));
        setRuneRollCounts(data.runeRollCounts || {});
        setRuneRollCount(data.runeRollCount || 0);
      } catch (e) {
        console.error('Failed to load save data:', e);
      }
    }
    setIsLoaded(true);
  }, [ranks]);

  // Save to cookies whenever state changes
  const saveGame = useCallback(() => {
    if (!isLoaded) return;

    const saveData: SaveData = {
      rollCount,
      totalPoints,
      highestRankIndex: highestRank?.index ?? null,
      highestRankRoll,
      collectedRanks: Array.from(collectedRanks),
      rankRollCounts,
      ascendedRanks: Array.from(ascendedRanks),
      luckLevel,
      pointsMultiLevel,
      speedLevel,
      claimedMilestones: Array.from(claimedMilestones),
      // Rune data
      collectedRunes: Array.from(collectedRunes),
      runeRollCounts,
      runeRollCount,
    };
    setCookie(SAVE_KEY, JSON.stringify(saveData));
  }, [isLoaded, rollCount, totalPoints, highestRank, highestRankRoll, collectedRanks, rankRollCounts, ascendedRanks, luckLevel, pointsMultiLevel, speedLevel, claimedMilestones, collectedRunes, runeRollCounts, runeRollCount]);

  useEffect(() => {
    saveGame();
  }, [saveGame]);

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

  // Rune bonuses (Rune of Beginning = index 0 gives +0.1x luck per roll, additive)
  const runeOfBeginningCount = runeRollCounts[0] || 0;
  const runeLuckBonus = 1 + (runeOfBeginningCount * 0.1); // 1.0 + 0.1 per rune

  // Luck calculations
  const baseLuckMulti = Math.pow(1.1, luckLevel);
  const luckMulti = baseLuckMulti * milestoneLuckBonus * runeLuckBonus;
  const luckUpgradeCost = Math.floor(100 * Math.pow(5, luckLevel));
  const canAffordLuckUpgrade = totalPoints >= luckUpgradeCost;

  // Points multiplier calculations
  const basePointsMulti = Math.pow(1.1, pointsMultiLevel);
  const pointsMulti = basePointsMulti * milestonePointsBonus;
  const pointsUpgradeCost = Math.floor(100 * Math.pow(5, pointsMultiLevel));
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
  const speedMulti = baseSpeedMulti * milestoneSpeedBonus;
  const speedUpgradeCost = Math.floor(100 * Math.pow(5, speedLevel));
  const canAffordSpeedUpgrade = totalPoints >= speedUpgradeCost;
  const animationInterval = Math.floor(50 / speedMulti);

  const handleUpgradeSpeed = () => {
    if (canAffordSpeedUpgrade) {
      setTotalPoints((p) => p - speedUpgradeCost);
      setSpeedLevel((l) => l + 1);
    }
  };

  // Milestone helpers
  const milestoneState = { rollCount, collectedRanks, ascendedRanks };
  const unclaimedMilestones = MILESTONES.filter(
    (m) => m.requirement(milestoneState) && !claimedMilestones.has(m.id)
  );

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
    const ascensionMulti = ascendedRanks.has(rank.index) ? 2 : 1;
    return Math.floor(basePoints * ascensionMulti * pointsMulti);
  };

  // Check if a rank can be ascended (1000+ rolls and not yet ascended)
  const canAscend = (rankIndex: number): boolean => {
    return (rankRollCounts[rankIndex] || 0) >= 1000 && !ascendedRanks.has(rankIndex);
  };

  // Handle ascension
  const handleAscend = (rankIndex: number) => {
    if (canAscend(rankIndex)) {
      setAscendedRanks((prev) => {
        const next = new Set(prev);
        next.add(rankIndex);
        return next;
      });
    }
    setAscendPrompt(null);
  };

  // Handle reset progress
  const handleReset = () => {
    if (resetInput === 'RESET') {
      setCurrentRoll(null);
      setHighestRank(null);
      setHighestRankRoll(null);
      setRollCount(0);
      setTotalPoints(0);
      setLastPointsGained(null);
      setCollectedRanks(new Set());
      setRankRollCounts({});
      setAscendedRanks(new Set());
      setExpandedTiers(new Set());
      setLuckLevel(0);
      setPointsMultiLevel(0);
      setSpeedLevel(0);
      setClaimedMilestones(new Set());
      setAutoRollEnabled(false);
      // Reset rune data
      setCurrentRuneRoll(null);
      setCollectedRunes(new Set());
      setRuneRollCounts({});
      setRuneRollCount(0);
      setCookie(SAVE_KEY, '');
      setShowResetModal(false);
      setResetInput('');
    }
  };

  // Rune roll time (5 seconds base, not affected by speed)
  const runeRollTime = 5000;
  const runeAnimationInterval = 100; // Animation frame rate for runes
  const runeRollCost = 1000;
  const canAffordRuneRoll = totalPoints >= runeRollCost;

  // Handle rune roll
  const handleRuneRoll = useCallback(() => {
    if (!canAffordRuneRoll || isRollingRune) return;

    setTotalPoints((p) => p - runeRollCost);
    setIsRollingRune(true);

    const animationFrames = Math.floor(runeRollTime / runeAnimationInterval);
    let animationCount = 0;

    const rollTimer = setInterval(() => {
      const simulatedRoll = rollRune(runes);
      setCurrentRuneRoll(simulatedRoll);
      animationCount++;

      if (animationCount >= animationFrames) {
        clearInterval(rollTimer);

        // Final roll
        const result = rollRune(runes);
        setCurrentRuneRoll(result);
        setRuneRollCount((c) => c + 1);

        setCollectedRunes((prev) => {
          const next = new Set(prev);
          next.add(result.index);
          return next;
        });

        setRuneRollCounts((prev) => ({
          ...prev,
          [result.index]: (prev[result.index] || 0) + 1,
        }));

        setIsRollingRune(false);
      }
    }, runeAnimationInterval);
  }, [runes, canAffordRuneRoll, isRollingRune]);

  // Get total roll count for a tier
  const getTierRollCount = (tierIndex: number): number => {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += rankRollCounts[tierIndex * 10 + i] || 0;
    }
    return total;
  };

  // Keep rollCountRef updated
  useEffect(() => {
    rollCountRef.current = rollCount;
  }, [rollCount]);

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

        // Final roll
        const result = rollRankWithLuck(ranks, luckMulti);
        setCurrentRoll(result);
        setRollCount((c) => c + 1);

        const basePoints = calculatePoints(result);
        const ascensionMulti = ascendedRanks.has(result.index) ? 2 : 1;
        const pointsGained = Math.floor(basePoints * ascensionMulti * pointsMulti);
        setTotalPoints((p) => p + pointsGained);
        setLastPointsGained(pointsGained);

        setCollectedRanks((prev) => {
          const next = new Set(prev);
          next.add(result.index);
          return next;
        });

        setRankRollCounts((prev) => ({
          ...prev,
          [result.index]: (prev[result.index] || 0) + 1,
        }));

        const newRollCount = rollCountRef.current + 1;
        if (!highestRank || result.index > highestRank.index) {
          setHighestRank(result);
          setHighestRankRoll(newRollCount);
        }

        setIsRolling(false);
      }
    }, animationInterval);
  }, [ranks, luckMulti, pointsMulti, animationInterval, highestRank, ascendedRanks]);

  // Check if auto-roll is unlocked
  const autoRollUnlocked = claimedMilestones.has('rolls_5000');

  // Check if runes area is unlocked (first Epic)
  const runesUnlocked = hasAnyFromTier(collectedRanks, 3);

  // Auto-roll effect
  useEffect(() => {
    if (!autoRollEnabled || !autoRollUnlocked) return;

    // Auto-roll interval = normal roll time × 5
    // Normal roll time = 10 frames × animationInterval
    const autoRollInterval = animationInterval * 10 * 5;

    const autoRollTimer = setInterval(() => {
      // Only trigger if not currently rolling
      setIsRolling((currentlyRolling) => {
        if (!currentlyRolling) {
          handleRoll();
        }
        return currentlyRolling;
      });
    }, autoRollInterval);

    return () => clearInterval(autoRollTimer);
  }, [autoRollEnabled, autoRollUnlocked, animationInterval, handleRoll]);

  const collectedCount = collectedRanks.size;

  const formatProbability = (prob: number): string => {
    if (prob >= 0.01) {
      return `${(prob * 100).toFixed(2)}%`;
    }
    const oneIn = Math.round(1 / prob);
    return `1 in ${oneIn.toLocaleString()}`;
  };

  const colors = currentRoll ? TIER_COLORS[currentRoll.tier] : null;
  const highestColors = highestRank ? TIER_COLORS[highestRank.tier] : null;

  // Format rune probability
  const formatRuneProbability = (prob: number): string => {
    if (prob >= 0.01) {
      return `${(prob * 100).toFixed(2)}%`;
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
                <span className="stats-panel-label" style={styles.statsPanelLabel}>Auto Roll</span>
                <span className="stats-panel-value" style={styles.statsPanelValue}>{((animationInterval * 10 * 5) / 1000).toFixed(2)}s</span>
              </div>
            )}
            <div style={styles.statsPanelItem}>
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Rune Roll</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{(runeRollTime / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>

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
                {formatRuneProbability(currentRuneRoll.probability)}
              </div>
            </>
          ) : (
            <div style={styles.rollPlaceholder}>Roll a rune!</div>
          )}
        </div>

        {/* Roll Button */}
        <button
          onClick={handleRuneRoll}
          disabled={!canAffordRuneRoll || isRollingRune}
          style={{
            ...styles.runeRollButton,
            opacity: !canAffordRuneRoll || isRollingRune ? 0.5 : 1,
            cursor: !canAffordRuneRoll || isRollingRune ? 'not-allowed' : 'pointer',
          }}
        >
          {isRollingRune ? 'Rolling...' : `ROLL RUNE (${runeRollCost.toLocaleString()} pts)`}
        </button>

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
              const rollCount = runeRollCounts[rune.index] || 0;
              return (
                <div
                  key={rune.index}
                  style={{
                    ...styles.runeItem,
                    backgroundColor: isCollected ? rune.color : '#222',
                    color: isCollected && (rune.index === 8 || rune.index === 5) ? '#000' : '#fff',
                    opacity: isCollected ? 1 : 0.4,
                    boxShadow: isCollected ? `0 0 15px ${rune.color}60` : 'none',
                  }}
                >
                  <div style={styles.runeItemName}>{rune.name}</div>
                  <div style={styles.runeItemChance}>
                    {formatRuneProbability(rune.probability)}
                  </div>
                  {isCollected && (
                    <div style={styles.runeItemRolls}>
                      Rolled: {rollCount.toLocaleString()}x
                    </div>
                  )}
                  {isCollected && runeRollCount > 0 && (
                    <div style={styles.runeItemPercent}>
                      {((rollCount / runeRollCount) * 100).toFixed(3)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
              <span className="stats-panel-label" style={styles.statsPanelLabel}>Auto Roll</span>
              <span className="stats-panel-value" style={styles.statsPanelValue}>{((animationInterval * 10 * 5) / 1000).toFixed(2)}s</span>
            </div>
          )}
        </div>
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
              {luckUpgradeCost.toLocaleString()}
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
              {pointsUpgradeCost.toLocaleString()}
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
              {speedUpgradeCost.toLocaleString()}
            </button>
          </div>
        </div>
      </div>

      {/* Rune Buffs Panel - Below Upgrades */}
      {runeOfBeginningCount > 0 && (
        <div className="rune-buffs-panel" style={styles.runeBuffsPanel}>
          <h3 style={styles.runeBuffsTitle}>Rune Buffs</h3>
          <div style={styles.runeBuffsList}>
            <div style={styles.runeBuffItem}>
              <span style={styles.runeBuffName}>Luck</span>
              <span style={styles.runeBuffValue}>{runeLuckBonus.toFixed(2)}x</span>
              <span style={styles.runeBuffSource}>({runeOfBeginningCount}x Beginning)</span>
            </div>
          </div>
        </div>
      )}

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
                        ) : milestone.unlockAutoRoll ? (
                          <>Reward: Auto Roll</>
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
            <button
              onClick={() => setShowMilestones(false)}
              style={styles.closeBtn}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Ascension Prompt Modal */}
      {ascendPrompt !== null && (
        <div style={styles.modalOverlay} onClick={() => setAscendPrompt(null)}>
          <div className="modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.ascendTitle}>Ascend Rank?</h2>
            <div style={styles.ascendInfo}>
              <div style={styles.ascendRankName}>{ranks[ascendPrompt].displayName}</div>
              <div style={styles.ascendDesc}>
                Ascending this rank will double the base points gained when rolling it.
              </div>
              <div style={styles.ascendBonus}>
                {calculatePoints(ranks[ascendPrompt])} pts → {calculatePoints(ranks[ascendPrompt]) * 2} pts (base)
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
      )}

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
          Auto Roll: {autoRollEnabled ? 'ON' : 'OFF'}
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
        <h3 style={styles.catalogueTitle}>
          Catalogue ({collectedCount}/100)
        </h3>
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
                          const isAscended = ascendedRanks.has(rank.index);
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
                                {rank.tierNumber}{isAscended && ' ★'}
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
                                  {(((rankRollCounts[rank.index] || 0) / rollCount) * 100).toFixed(3)}%
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
                    </div>
                  );
                }
              }

              // Incomplete tier - show individual ranks
              return collectedInTier
                .sort((a, b) => b.index - a.index)
                .map((rank) => {
                  const points = getDisplayPoints(rank);
                  const isAscended = ascendedRanks.has(rank.index);
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
                        {rank.displayName}{isAscended && ' ★'}
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
                          {(((rankRollCounts[rank.index] || 0) / rollCount) * 100).toFixed(3)}%
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
  upgradesPanel: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: 'rgba(30, 30, 50, 0.95)',
    borderRadius: '12px',
    padding: '15px',
    minWidth: '180px',
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
};
