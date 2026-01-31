'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';

const SAVE_KEY = 'rankroller_save';

interface SaveData {
  rollCount: number;
  totalPoints: number;
  highestRankIndex: number | null;
  highestRankRoll: number | null;
  collectedRanks: number[];
  rankRollCounts: Record<number, number>;
  luckLevel: number;
  pointsMultiLevel: number;
  speedLevel: number;
  claimedMilestones: string[];
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  requirement: (state: { rollCount: number; collectedRanks: Set<number> }) => boolean;
  reward: number;
  luckBonus?: number;
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
  const [currentRoll, setCurrentRoll] = useState<Rank | null>(null);
  const [highestRank, setHighestRank] = useState<Rank | null>(null);
  const [highestRankRoll, setHighestRankRoll] = useState<number | null>(null);
  const [rollCount, setRollCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [lastPointsGained, setLastPointsGained] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [collectedRanks, setCollectedRanks] = useState<Set<number>>(new Set());
  const [rankRollCounts, setRankRollCounts] = useState<Record<number, number>>({});
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [luckLevel, setLuckLevel] = useState(0);
  const [pointsMultiLevel, setPointsMultiLevel] = useState(0);
  const [speedLevel, setSpeedLevel] = useState(0);
  const [claimedMilestones, setClaimedMilestones] = useState<Set<string>>(new Set());
  const [showMilestones, setShowMilestones] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

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
        setLuckLevel(data.luckLevel || 0);
        setPointsMultiLevel(data.pointsMultiLevel || 0);
        setSpeedLevel(data.speedLevel || 0);
        setClaimedMilestones(new Set(data.claimedMilestones || []));
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
      luckLevel,
      pointsMultiLevel,
      speedLevel,
      claimedMilestones: Array.from(claimedMilestones),
    };
    setCookie(SAVE_KEY, JSON.stringify(saveData));
  }, [isLoaded, rollCount, totalPoints, highestRank, highestRankRoll, collectedRanks, rankRollCounts, luckLevel, pointsMultiLevel, speedLevel, claimedMilestones]);

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

  // Luck calculations
  const baseLuckMulti = Math.pow(1.1, luckLevel);
  const luckMulti = baseLuckMulti * milestoneLuckBonus;
  const luckUpgradeCost = Math.floor(100 * Math.pow(5, luckLevel));
  const canAffordLuckUpgrade = totalPoints >= luckUpgradeCost;

  // Points multiplier calculations
  const pointsMulti = Math.pow(1.1, pointsMultiLevel);
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
  const speedMulti = Math.pow(1.1, speedLevel);
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
  const milestoneState = { rollCount, collectedRanks };
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

  // Get points for a rank with multiplier applied
  const getDisplayPoints = (rank: Rank): number => {
    return Math.floor(calculatePoints(rank) * pointsMulti);
  };

  // Get total roll count for a tier
  const getTierRollCount = (tierIndex: number): number => {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += rankRollCounts[tierIndex * 10 + i] || 0;
    }
    return total;
  };

  const handleRoll = () => {
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
        const pointsGained = Math.floor(basePoints * pointsMulti);
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

        const newRollCount = rollCount + 1;
        if (!highestRank || result.index > highestRank.index) {
          setHighestRank(result);
          setHighestRankRoll(newRollCount);
        }

        setIsRolling(false);
      }
    }, animationInterval);
  };

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

  return (
    <div style={styles.container}>
      {/* Milestones Panel - Top Left */}
      <div style={styles.milestonesPanel}>
        <button
          onClick={() => setShowMilestones(true)}
          style={styles.milestonesBtn}
        >
          Milestones {unclaimedMilestones.length > 0 && `(${unclaimedMilestones.length})`}
        </button>
      </div>

      {/* Stats Display - Next to Upgrades */}
      <div style={styles.statsPanel}>
        <h3 style={styles.statsPanelTitle}>Total Multipliers</h3>
        <div style={styles.statsPanelList}>
          <div style={styles.statsPanelItem}>
            <span style={styles.statsPanelLabel}>Luck</span>
            <span style={styles.statsPanelValue}>{luckMulti.toFixed(2)}x</span>
          </div>
          <div style={styles.statsPanelItem}>
            <span style={styles.statsPanelLabel}>Points</span>
            <span style={styles.statsPanelValue}>{pointsMulti.toFixed(2)}x</span>
          </div>
          <div style={styles.statsPanelItem}>
            <span style={styles.statsPanelLabel}>Speed</span>
            <span style={styles.statsPanelValue}>{speedMulti.toFixed(2)}x</span>
          </div>
        </div>
      </div>

      {/* Upgrades Panel - Top Right */}
      <div style={styles.upgradesPanel}>
        <h3 style={styles.upgradesTitle}>Upgrades</h3>
        <div style={styles.upgradesList}>
          {/* Luck Upgrade */}
          <div style={styles.upgradeItem}>
            <div style={styles.upgradeInfo}>
              <span style={styles.upgradeName}>Luck</span>
              <span style={styles.upgradeValue}>{luckMulti.toFixed(2)}x</span>
              <span style={styles.upgradeLevel}>Lv.{luckLevel}</span>
            </div>
            <button
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
          <div style={styles.upgradeItem}>
            <div style={styles.upgradeInfo}>
              <span style={styles.upgradeName}>Points</span>
              <span style={styles.upgradeValue}>{pointsMulti.toFixed(2)}x</span>
              <span style={styles.upgradeLevel}>Lv.{pointsMultiLevel}</span>
            </div>
            <button
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
          <div style={styles.upgradeItem}>
            <div style={styles.upgradeInfo}>
              <span style={styles.upgradeName}>Speed</span>
              <span style={styles.upgradeValue}>{speedMulti.toFixed(2)}x</span>
              <span style={styles.upgradeLevel}>Lv.{speedLevel}</span>
            </div>
            <button
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

      {/* Milestones Modal */}
      {showMilestones && (
        <div style={styles.modalOverlay} onClick={() => setShowMilestones(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Milestones</h2>
            <div style={styles.milestonesList}>
              {MILESTONES.map((milestone) => {
                const isCompleted = milestone.requirement(milestoneState);
                const isClaimed = claimedMilestones.has(milestone.id);
                return (
                  <div
                    key={milestone.id}
                    style={{
                      ...styles.milestoneItem,
                      opacity: isCompleted ? 1 : 0.5,
                    }}
                  >
                    <div style={styles.milestoneInfo}>
                      <div style={styles.milestoneName}>{milestone.name}</div>
                      <div style={styles.milestoneDesc}>{milestone.description}</div>
                      <div style={styles.milestoneReward}>
                        {milestone.luckBonus ? (
                          <>Reward: {milestone.luckBonus}x Luck</>
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

      <h1 style={styles.title}>Rank Roller</h1>

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
        style={{
          ...styles.rollDisplay,
          backgroundColor: colors?.bg || '#333',
          color: colors?.text || '#fff',
          boxShadow: colors ? `0 0 30px ${colors.glow}` : 'none',
        }}
      >
        {currentRoll ? (
          <>
            <div style={styles.rollTier}>{currentRoll.tier}</div>
            <div style={styles.rollNumber}>{currentRoll.tierNumber}</div>
            <div style={styles.rollProbability}>
              {formatProbability(getEffectiveProbability(currentRoll, ranks, luckMulti))}
            </div>
          </>
        ) : (
          <div style={styles.rollPlaceholder}>Click Roll to start!</div>
        )}
      </div>

      <button
        onClick={handleRoll}
        disabled={isRolling}
        style={{
          ...styles.rollButton,
          opacity: isRolling ? 0.6 : 1,
          cursor: isRolling ? 'not-allowed' : 'pointer',
        }}
      >
        {isRolling ? 'Rolling...' : 'ROLL'}
      </button>

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
      <div style={styles.catalogue}>
        <h3 style={styles.catalogueTitle}>
          Catalogue ({collectedCount}/100)
        </h3>
        {collectedCount === 0 ? (
          <div style={styles.emptyMessage}>Roll to start collecting ranks!</div>
        ) : (
          <div style={styles.catalogueGrid}>
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
                          return (
                            <div
                              key={rank.index}
                              style={{
                                ...styles.tierRankItem,
                                backgroundColor: tierColors.bg,
                                color: tierColors.text,
                              }}
                            >
                              <div style={styles.tierRankNumber}>{rank.tierNumber}</div>
                              <div style={styles.tierRankChance}>
                                {formatProbability(getEffectiveProbability(rank, ranks, luckMulti))}
                              </div>
                              <div style={styles.tierRankPoints}>
                                {points.toLocaleString()} pts
                              </div>
                              <div style={styles.tierRankRolls}>
                                {(rankRollCounts[rank.index] || 0).toLocaleString()}x
                              </div>
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
                  return (
                    <div
                      key={rank.index}
                      style={{
                        ...styles.catalogueItem,
                        backgroundColor: tierColors.bg,
                        color: tierColors.text,
                        boxShadow: `0 0 10px ${tierColors.glow}`,
                      }}
                    >
                      <div style={styles.catalogueItemName}>{rank.displayName}</div>
                      <div style={styles.catalogueItemChance}>
                        {formatProbability(getEffectiveProbability(rank, ranks, luckMulti))}
                      </div>
                      <div style={styles.catalogueItemPoints}>
                        {points.toLocaleString()} pts
                      </div>
                      <div style={styles.catalogueItemRolls}>
                        Rolled: {(rankRollCounts[rank.index] || 0).toLocaleString()}x
                      </div>
                    </div>
                  );
                });
            })}
          </div>
        )}
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
};
