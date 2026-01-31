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

function rollRank(ranks: Rank[]): Rank {
  const totalWeight = ranks.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;

  for (const rank of ranks) {
    random -= rank.weight;
    if (random <= 0) {
      return rank;
    }
  }

  return ranks[0]; // Fallback
}

export default function RankRoller() {
  const ranks = useMemo(() => generateRanks(), []);
  const [currentRoll, setCurrentRoll] = useState<Rank | null>(null);
  const [highestRank, setHighestRank] = useState<Rank | null>(null);
  const [rollCount, setRollCount] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  const handleRoll = () => {
    setIsRolling(true);

    // Quick animation of random ranks
    let animationCount = 0;
    const animationInterval = setInterval(() => {
      const randomRank = ranks[Math.floor(Math.random() * 100)];
      setCurrentRoll(randomRank);
      animationCount++;

      if (animationCount >= 10) {
        clearInterval(animationInterval);

        // Final roll
        const result = rollRank(ranks);
        setCurrentRoll(result);
        setRollCount((c) => c + 1);

        if (!highestRank || result.index > highestRank.index) {
          setHighestRank(result);
        }

        setIsRolling(false);
      }
    }, 50);
  };

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
      <h1 style={styles.title}>Rank Roller</h1>

      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Rolls</span>
          <span style={styles.statValue}>{rollCount}</span>
        </div>
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
              {formatProbability(currentRoll.probability)}
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
                {formatProbability(highestRank.probability)}
              </div>
            </>
          ) : (
            <div style={styles.highestPlaceholder}>None yet</div>
          )}
        </div>
      </div>

      {/* Tier Legend */}
      <div style={styles.legend}>
        <h3 style={styles.legendTitle}>Tiers</h3>
        <div style={styles.tierGrid}>
          {TIER_NAMES.map((tier, i) => {
            const tierColors = TIER_COLORS[tier];
            const startRank = ranks[i * 10];
            const endRank = ranks[i * 10 + 9];
            return (
              <div
                key={tier}
                style={{
                  ...styles.tierItem,
                  backgroundColor: tierColors.bg,
                  color: tierColors.text,
                  boxShadow: `0 0 10px ${tierColors.glow}`,
                }}
              >
                <div style={styles.tierName}>{tier}</div>
                <div style={styles.tierRange}>
                  {formatProbability(endRank.probability)} - {formatProbability(startRank.probability)}
                </div>
              </div>
            );
          })}
        </div>
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
  statsRow: {
    display: 'flex',
    gap: '30px',
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
  highestPlaceholder: {
    color: '#666',
  },
  legend: {
    width: '100%',
    maxWidth: '600px',
  },
  legendTitle: {
    textAlign: 'center',
    fontSize: '1rem',
    color: '#888',
    marginBottom: '15px',
  },
  tierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
  },
  tierItem: {
    padding: '10px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  tierName: {
    fontWeight: 'bold',
    fontSize: '0.9rem',
  },
  tierRange: {
    fontSize: '0.7rem',
    marginTop: '4px',
    opacity: 0.8,
  },
};
