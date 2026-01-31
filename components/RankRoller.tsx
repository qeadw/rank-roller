'use client';

import { useState, useMemo } from 'react';

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
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [luckLevel, setLuckLevel] = useState(0);

  // Luck calculations
  const luckMulti = Math.pow(1.1, luckLevel);
  const upgradeCost = Math.floor(100 * Math.pow(5, luckLevel));
  const canAffordUpgrade = totalPoints >= upgradeCost;

  const handleUpgradeLuck = () => {
    if (canAffordUpgrade) {
      setTotalPoints((p) => p - upgradeCost);
      setLuckLevel((l) => l + 1);
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

  // Calculate total points for a complete tier
  const getTierTotalPoints = (tierIndex: number): number => {
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += calculatePoints(ranks[tierIndex * 10 + i]);
    }
    return total;
  };

  const handleRoll = () => {
    setIsRolling(true);

    // Simulate actual rolls for animation
    let animationCount = 0;
    const animationInterval = setInterval(() => {
      const simulatedRoll = rollRankWithLuck(ranks, luckMulti);
      setCurrentRoll(simulatedRoll);
      animationCount++;

      if (animationCount >= 10) {
        clearInterval(animationInterval);

        // Final roll
        const result = rollRankWithLuck(ranks, luckMulti);
        setCurrentRoll(result);
        setRollCount((c) => c + 1);

        const pointsGained = calculatePoints(result);
        setTotalPoints((p) => p + pointsGained);
        setLastPointsGained(pointsGained);

        setCollectedRanks((prev) => {
          const next = new Set(prev);
          next.add(result.index);
          return next;
        });

        const newRollCount = rollCount + 1;
        if (!highestRank || result.index > highestRank.index) {
          setHighestRank(result);
          setHighestRankRoll(newRollCount);
        }

        setIsRolling(false);
      }
    }, 50);
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
              disabled={!canAffordUpgrade}
              style={{
                ...styles.upgradeBtn,
                opacity: canAffordUpgrade ? 1 : 0.5,
                cursor: canAffordUpgrade ? 'pointer' : 'not-allowed',
              }}
            >
              {upgradeCost.toLocaleString()}
            </button>
          </div>
        </div>
      </div>

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
                          const points = calculatePoints(rank);
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
                    </div>
                  );
                }
              }

              // Incomplete tier - show individual ranks
              return collectedInTier
                .sort((a, b) => b.index - a.index)
                .map((rank) => {
                  const points = calculatePoints(rank);
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
    marginBottom: '10px',
    textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
  },
  statsColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    marginBottom: '20px',
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
    height: '180px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
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
    padding: '16px 64px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    backgroundColor: '#4a4a8a',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    marginBottom: '30px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(74, 74, 138, 0.4)',
  },
  highestSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '30px',
  },
  highestTitle: {
    fontSize: '1.2rem',
    marginBottom: '10px',
    color: '#aaa',
  },
  highestDisplay: {
    padding: '20px 40px',
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
};
