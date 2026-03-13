// ==================== SURVIVE NIGHTFALL ====================

// ==================== CONFIG ====================
const CFG = {
    WORLD_W: 8000,
    WORLD_H: 8000,
    DAY_DURATION: 150,    // seconds
    NIGHT_DURATION: 100,  // seconds
    PLAYER_SPEED: 200,
    PLAYER_HP: 100,
    PLAYER_REGEN: 0.5,    // hp/sec during day
    RESOURCE_COUNT: {
        tree: 180, rock: 140, copper_ore: 110, iron_ore: 85, silver_ore: 65,
        gold_ore: 50, platinum_ore: 38, titanium_ore: 28, cobalt_ore: 22,
        mythril_ore: 16, adamantite_ore: 12, orichalcum_ore: 9,
        luminite_ore: 7, voidcrystal_ore: 5, celestium_ore: 3,
    },
    ENEMY_BASE_COUNT: 8,
    ENEMY_SCALE_PER_WAVE: 4,
    BUILD_GRID: 48,
    TURRET_RANGE: 250,
    TURRET_FIRE_RATE: 1.2,
};

const TIERS = [
    'wood', 'stone', 'copper', 'iron', 'silver',
    'gold', 'platinum', 'titanium', 'cobalt',
    'mythril', 'adamantite', 'orichalcum',
    'luminite', 'voidcrystal', 'celestium',
];
const TIER_COLORS = {
    wood: '#8B5E3C',     stone: '#888',       copper: '#B87333',
    iron: '#5A7D9A',     silver: '#C0C0C0',   gold: '#FFD700',
    platinum: '#E5E4E2', titanium: '#878681',  cobalt: '#0047AB',
    mythril: '#00CED1',  adamantite: '#B040FF', orichalcum: '#FF6B9D',
    luminite: '#FFFF66',  voidcrystal: '#1A0033', celestium: '#00FFCC',
};
const TIER_NAMES = {
    wood: 'Wood',         stone: 'Stone',       copper: 'Copper',
    iron: 'Iron',         silver: 'Silver',     gold: 'Gold',
    platinum: 'Platinum', titanium: 'Titanium', cobalt: 'Cobalt',
    mythril: 'Mythril',   adamantite: 'Adamantite', orichalcum: 'Orichalcum',
    luminite: 'Luminite', voidcrystal: 'Void Crystal', celestium: 'Celestium',
};

const RESOURCE_TYPES = {
    tree:            { tier: 'wood',        hp: 50,   color: '#2d8a4e', radius: 22, drop: 10, label: 'Tree' },
    rock:            { tier: 'stone',       hp: 80,   color: '#777',    radius: 20, drop: 8,  label: 'Rock' },
    copper_ore:      { tier: 'copper',      hp: 110,  color: '#B87333', radius: 19, drop: 7,  label: 'Copper Ore' },
    iron_ore:        { tier: 'iron',        hp: 150,  color: '#4a6a80', radius: 18, drop: 6,  label: 'Iron Ore' },
    silver_ore:      { tier: 'silver',      hp: 200,  color: '#a8a8a8', radius: 17, drop: 5,  label: 'Silver Ore' },
    gold_ore:        { tier: 'gold',        hp: 260,  color: '#c9a800', radius: 16, drop: 5,  label: 'Gold Ore' },
    platinum_ore:    { tier: 'platinum',    hp: 340,  color: '#d0d0cc', radius: 16, drop: 4,  label: 'Platinum Ore' },
    titanium_ore:    { tier: 'titanium',    hp: 440,  color: '#6a6a62', radius: 15, drop: 4,  label: 'Titanium Ore' },
    cobalt_ore:      { tier: 'cobalt',      hp: 560,  color: '#003a8c', radius: 15, drop: 3,  label: 'Cobalt Ore' },
    mythril_ore:     { tier: 'mythril',     hp: 700,  color: '#00a5a5', radius: 14, drop: 3,  label: 'Mythril Ore' },
    adamantite_ore:  { tier: 'adamantite',  hp: 880,  color: '#8a2be2', radius: 14, drop: 3,  label: 'Adamantite Ore' },
    orichalcum_ore:  { tier: 'orichalcum',  hp: 1100, color: '#cc4477', radius: 13, drop: 2,  label: 'Orichalcum Ore' },
    luminite_ore:    { tier: 'luminite',    hp: 1400, color: '#cccc22', radius: 13, drop: 2,  label: 'Luminite Ore' },
    voidcrystal_ore: { tier: 'voidcrystal', hp: 1800, color: '#220044', radius: 12, drop: 2,  label: 'Void Crystal' },
    celestium_ore:   { tier: 'celestium',   hp: 2400, color: '#00cc99', radius: 12, drop: 1,  label: 'Celestium Ore' },
};

const ENEMY_TYPES = {
    basic:  { hp: 40, speed: 70,  damage: 8,  radius: 14, color: '#5a2d2d', xp: 5,  name: 'Zombie' },
    fast:   { hp: 25, speed: 140, damage: 5,  radius: 11, color: '#8a4a2d', xp: 7,  name: 'Runner' },
    tank:   { hp: 150,speed: 40,  damage: 18, radius: 20, color: '#3a1a1a', xp: 15, name: 'Brute' },
    ranged: { hp: 30, speed: 55,  damage: 12, radius: 12, color: '#5a1a3a', xp: 10, name: 'Spitter' },
};

const PET_TYPES = {
    wolf:   { name: 'Shadow Wolf',    role: 'combat',          color: '#555', desc: 'Attacks nearby enemies' },
    golem:  { name: 'Stone Golem',    role: 'repair_building', color: '#8a7a6a', desc: 'Repairs damaged buildings' },
    sprite: { name: 'Arcane Sprite',  role: 'repair_tool',     color: '#7af', desc: 'Restores tool durability' },
    beetle: { name: 'Harvest Beetle', role: 'harvest',         color: '#6a4', desc: 'Auto-harvests nearby resources' },
};

// ==================== GAME STATE ====================
const G = {
    canvas: null, ctx: null, mm: null, mmCtx: null,
    W: 0, H: 0,
    camera: { x: 0, y: 0 },
    player: null,
    resources: [],
    enemies: [],
    buildings: [],
    pets: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    inventory: {
        wood: 0, stone: 0, copper: 0, iron: 0, silver: 0,
        gold: 0, platinum: 0, titanium: 0, cobalt: 0,
        mythril: 0, adamantite: 0, orichalcum: 0,
        luminite: 0, voidcrystal: 0, celestium: 0, exp: 0,
    },
    tools: {
        pickaxe: { tier: 0, durability: 100, maxDurability: 100 },
        axe:     { tier: 0, durability: 100, maxDurability: 100 },
        sword:   { tier: 0, durability: 100, maxDurability: 100 },
    },
    time: 0,
    dayNum: 1,
    isNight: false,
    waveActive: false,
    waveNum: 0,
    enemiesRemaining: 0,
    keys: {},
    mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
    hotbarSlot: 0,
    buildMode: false,
    selectedBuild: null,
    buildTier: 0,
    menuOpen: null,
    paused: false,
    running: false,
    lastTime: 0,
    dt: 0,
    kills: 0,
    score: 0,
};

// ==================== UTILITY ====================
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angle(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function circleCollide(a, ar, b, br) { return dist(a, b) < ar + br; }

function tierIndex(tier) { return TIERS.indexOf(tier); }

function getUpgradeCost(currentTier) {
    if (currentTier < 15) {
        const res = TIERS[currentTier];
        const cost = Math.floor(15 * Math.pow(1.65, currentTier));
        return { resource: res, amount: cost };
    }
    // Beyond tier 15, celestium with exponential scaling
    const cost = Math.floor(200 * Math.pow(1.8, currentTier - 14));
    return { resource: 'celestium', amount: cost };
}

function getToolDamage(tier) { return 10 + tier * 8; }
function getToolSpeed(tier) { return 1 + tier * 0.3; }
function getSwordDamage(tier) { return 15 + tier * 12; }
function getSwordRange(tier) { return 50 + tier * 5; }
function getSwordKnockback(tier) { return 100 + tier * 30; }

function canAfford(resource, amount) { return G.inventory[resource] >= amount; }
function spend(resource, amount) { G.inventory[resource] -= amount; }

function getBuildCost(type, tierIdx) {
    const base = type === 'wall' ? 12 : 30;
    const res = TIERS[Math.min(tierIdx, 14)];
    const amount = Math.floor(base * Math.pow(1.65, tierIdx));
    return { resource: res, amount };
}

function getBuildHP(type, tierIdx) {
    if (type === 'wall') return 100 + tierIdx * 150;
    return 60 + tierIdx * 80;
}

function getTurretDamage(tierIdx) { return 8 + tierIdx * 7; }

// ==================== PLAYER ====================
function createPlayer() {
    return {
        x: CFG.WORLD_W / 2,
        y: CFG.WORLD_H / 2,
        vx: 0, vy: 0,
        radius: 18,
        hp: CFG.PLAYER_HP,
        maxHp: CFG.PLAYER_HP,
        angle: 0,
        attackCooldown: 0,
        invincible: 0,
        dead: false,
    };
}

// ==================== WORLD GENERATION ====================
function generateWorld() {
    G.resources = [];
    for (const [type, cfg] of Object.entries(RESOURCE_TYPES)) {
        const count = CFG.RESOURCE_COUNT[type] || 50;
        for (let i = 0; i < count; i++) {
            const margin = 100;
            G.resources.push({
                type,
                x: rand(margin, CFG.WORLD_W - margin),
                y: rand(margin, CFG.WORLD_H - margin),
                hp: cfg.hp,
                maxHp: cfg.hp,
                radius: cfg.radius,
                respawnTimer: 0,
                alive: true,
            });
        }
    }
    // Cluster higher-tier resources toward edges — higher tier = further out
    for (const r of G.resources) {
        const cfg = RESOURCE_TYPES[r.type];
        const ti = tierIndex(cfg.tier);
        if (ti >= 2) {
            const cx = CFG.WORLD_W / 2, cy = CFG.WORLD_H / 2;
            const dx = r.x - cx, dy = r.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            const push = 200 + ti * 180;
            r.x = clamp(r.x + (dx / d) * push, 50, CFG.WORLD_W - 50);
            r.y = clamp(r.y + (dy / d) * push, 50, CFG.WORLD_H - 50);
        }
    }
}

// ==================== ENEMY SPAWNING ====================
function spawnWave() {
    G.waveNum++;
    G.waveActive = true;
    const count = CFG.ENEMY_BASE_COUNT + G.waveNum * CFG.ENEMY_SCALE_PER_WAVE;
    G.enemiesRemaining = count;

    for (let i = 0; i < count; i++) {
        setTimeout(() => spawnEnemy(), i * 300 + rand(0, 200));
    }
}

function spawnEnemy() {
    // Pick type based on wave
    let type = 'basic';
    const r = Math.random();
    if (G.waveNum >= 2 && r < 0.25) type = 'fast';
    if (G.waveNum >= 3 && r < 0.15) type = 'tank';
    if (G.waveNum >= 4 && r < 0.12) type = 'ranged';

    const cfg = ENEMY_TYPES[type];
    const hpScale = 1 + (G.waveNum - 1) * 0.25;
    const dmgScale = 1 + (G.waveNum - 1) * 0.15;

    // Spawn from edge
    let x, y;
    const side = Math.floor(Math.random() * 4);
    const px = G.player.x, py = G.player.y;
    const spawnDist = 600 + rand(0, 200);
    switch (side) {
        case 0: x = px + rand(-spawnDist, spawnDist); y = py - spawnDist; break;
        case 1: x = px + spawnDist; y = py + rand(-spawnDist, spawnDist); break;
        case 2: x = px + rand(-spawnDist, spawnDist); y = py + spawnDist; break;
        case 3: x = px - spawnDist; y = py + rand(-spawnDist, spawnDist); break;
    }
    x = clamp(x, 20, CFG.WORLD_W - 20);
    y = clamp(y, 20, CFG.WORLD_H - 20);

    G.enemies.push({
        type, x, y, vx: 0, vy: 0,
        hp: Math.floor(cfg.hp * hpScale),
        maxHp: Math.floor(cfg.hp * hpScale),
        damage: Math.floor(cfg.damage * dmgScale),
        speed: cfg.speed,
        radius: cfg.radius,
        color: cfg.color,
        xp: cfg.xp,
        attackCooldown: 0,
        target: null,
        shootCooldown: 0,
    });
}

// ==================== PETS ====================
function createPet(type) {
    const cfg = PET_TYPES[type];
    return {
        type,
        name: cfg.name,
        role: cfg.role,
        color: cfg.color,
        level: 1,
        x: G.player.x + rand(-40, 40),
        y: G.player.y + rand(-40, 40),
        radius: 10,
        cooldown: 0,
        targetAngle: 0,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitIndex: G.pets.length,
    };
}

function getPetUpgradeCost(level) {
    return Math.floor(50 * Math.pow(level, 1.8));
}

// ==================== UPDATE SYSTEMS ====================
function updatePlayer(dt) {
    const p = G.player;
    if (p.dead) return;

    // Movement
    let mx = 0, my = 0;
    if (G.keys['w'] || G.keys['arrowup']) my -= 1;
    if (G.keys['s'] || G.keys['arrowdown']) my += 1;
    if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
    if (G.keys['d'] || G.keys['arrowright']) mx += 1;
    const len = Math.hypot(mx, my) || 1;
    mx /= len; my /= len;


    const speed = (G.keys['w'] || G.keys['s'] || G.keys['a'] || G.keys['d'] ||
                   G.keys['arrowup'] || G.keys['arrowdown'] || G.keys['arrowleft'] || G.keys['arrowright'])
        ? CFG.PLAYER_SPEED : 0;
    p.vx = mx * speed;
    p.vy = my * speed;
    p.x = clamp(p.x + p.vx * dt, p.radius, CFG.WORLD_W - p.radius);
    p.y = clamp(p.y + p.vy * dt, p.radius, CFG.WORLD_H - p.radius);

    // Aim
    p.angle = Math.atan2(G.mouse.wy - p.y, G.mouse.wx - p.x);

    // Regen during day
    if (!G.isNight && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + CFG.PLAYER_REGEN * dt);
    }

    // Attack cooldown
    if (p.attackCooldown > 0) p.attackCooldown -= dt;
    if (p.invincible > 0) p.invincible -= dt;

    // Collision with buildings
    for (const b of G.buildings) {
        if (!b.alive) continue;
        const d = dist(p, b);
        if (d < p.radius + b.radius) {
            const overlap = p.radius + b.radius - d;
            const ax = (p.x - b.x) / (d || 1);
            const ay = (p.y - b.y) / (d || 1);
            p.x += ax * overlap;
            p.y += ay * overlap;
        }
    }

    // Attack
    if (G.mouse.down && p.attackCooldown <= 0 && !G.buildMode && G.menuOpen === null) {
        performAttack();
    }
}

function performAttack() {
    const p = G.player;
    const slot = G.hotbarSlot;

    if (slot === 0) { // Pickaxe - mine all ores
        attackResources('pickaxe', Object.keys(RESOURCE_TYPES).filter(k => k !== 'tree'));
    } else if (slot === 1) { // Axe - chop trees
        attackResources('axe', ['tree']);
    } else if (slot === 2) { // Sword - attack enemies
        attackEnemies();
    }
}

function attackResources(tool, types) {
    const p = G.player;
    const tier = G.tools[tool].tier;
    const damage = getToolDamage(tier);
    const range = 55 + tier * 3;
    const speed = getToolSpeed(tier);
    const durMult = G.tools[tool].durability <= 0 ? 0.5 : 1;

    p.attackCooldown = 0.45 / speed;

    // Reduce durability
    if (G.tools[tool].durability > 0) {
        G.tools[tool].durability = Math.max(0, G.tools[tool].durability - 1);
    }

    let hit = false;
    for (const r of G.resources) {
        if (!r.alive || !types.includes(r.type)) continue;
        if (dist(p, r) < range + r.radius) {
            const dmg = Math.floor(damage * durMult);
            r.hp -= dmg;
            hit = true;
            spawnParticles(r.x, r.y, RESOURCE_TYPES[r.type].color, 4);
            addFloatingText(r.x, r.y - r.radius, `-${dmg}`, '#fff');

            if (r.hp <= 0) {
                r.alive = false;
                r.respawnTimer = 30 + rand(10, 30);
                const cfg = RESOURCE_TYPES[r.type];
                const drop = cfg.drop + Math.floor(tier * 0.5);
                G.inventory[cfg.tier] += drop;
                addFloatingText(r.x, r.y - 30, `+${drop} ${TIER_NAMES[cfg.tier]}`, TIER_COLORS[cfg.tier]);
                spawnParticles(r.x, r.y, cfg.color, 12);
                G.score += drop;
            }
            break; // Hit one at a time
        }
    }

    if (hit) {
        // Visual swing effect
        spawnSwingParticle(p, range);
    }
}

function attackEnemies() {
    const p = G.player;
    const tier = G.tools.sword.tier;
    const damage = getSwordDamage(tier);
    const range = getSwordRange(tier);
    const knockback = getSwordKnockback(tier);
    const durMult = G.tools.sword.durability <= 0 ? 0.5 : 1;

    p.attackCooldown = 0.35;

    if (G.tools.sword.durability > 0) {
        G.tools.sword.durability = Math.max(0, G.tools.sword.durability - 0.5);
    }

    let hitAny = false;
    // Swing arc: hit enemies in a cone in front
    for (const e of G.enemies) {
        const d = dist(p, e);
        if (d > range + e.radius) continue;
        const a = angle(p, e);
        let diff = a - p.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > Math.PI / 3) continue; // 60 degree cone each side

        const dmg = Math.floor(damage * durMult);
        e.hp -= dmg;
        hitAny = true;
        addFloatingText(e.x, e.y - e.radius - 5, `-${dmg}`, '#ff4444');
        spawnParticles(e.x, e.y, '#a33', 5);

        // Knockback
        const ka = angle(p, e);
        e.x += Math.cos(ka) * knockback * 0.1;
        e.y += Math.sin(ka) * knockback * 0.1;

        if (e.hp <= 0) {
            G.inventory.exp += e.xp;
            G.kills++;
            G.score += e.xp * 2;
            addFloatingText(e.x, e.y - 20, `+${e.xp} XP`, '#ff0');
            spawnParticles(e.x, e.y, e.color, 15);
        }
    }

    if (hitAny) spawnSwingParticle(p, range);
}

function updateEnemies(dt) {
    for (const e of G.enemies) {
        // Find target: nearest building or player
        let target = G.player;
        let minD = dist(e, G.player);

        for (const b of G.buildings) {
            if (!b.alive) continue;
            const d = dist(e, b);
            if (d < minD) { minD = d; target = b; }
        }

        // Move toward target
        const a = angle(e, target);
        const attackRange = e.radius + (target.radius || 18) + 5;

        if (minD > attackRange) {
            e.x += Math.cos(a) * e.speed * dt;
            e.y += Math.sin(a) * e.speed * dt;
        }

        // Avoid clumping with other enemies
        for (const other of G.enemies) {
            if (other === e) continue;
            const d = dist(e, other);
            if (d < e.radius + other.radius + 4) {
                const pushAngle = angle(other, e);
                e.x += Math.cos(pushAngle) * 30 * dt;
                e.y += Math.sin(pushAngle) * 30 * dt;
            }
        }

        e.x = clamp(e.x, 10, CFG.WORLD_W - 10);
        e.y = clamp(e.y, 10, CFG.WORLD_H - 10);

        // Attack
        e.attackCooldown -= dt;
        if (minD < attackRange && e.attackCooldown <= 0) {
            e.attackCooldown = 1;

            if (e.type === 'ranged' && minD > 40) {
                // Shoot projectile
                G.projectiles.push({
                    x: e.x, y: e.y,
                    vx: Math.cos(a) * 200,
                    vy: Math.sin(a) * 200,
                    damage: e.damage,
                    radius: 5,
                    life: 3,
                    from: 'enemy',
                    color: '#a33',
                });
            } else {
                // Melee
                if (target === G.player) {
                    damagePlayer(e.damage);
                } else if (target.alive) {
                    target.hp -= e.damage;
                    spawnParticles(target.x, target.y, '#a33', 3);
                    if (target.hp <= 0) target.alive = false;
                }
            }
        }
    }

    // Check if wave is done
    if (G.waveActive && G.enemies.length === 0) {
        G.waveActive = false;
        G.enemiesRemaining = 0;
    }
}

function damagePlayer(dmg) {
    const p = G.player;
    if (p.invincible > 0 || p.dead) return;
    p.hp -= dmg;
    p.invincible = 0.3;
    spawnParticles(p.x, p.y, '#f44', 6);
    addFloatingText(p.x, p.y - 30, `-${dmg}`, '#ff0000');
    if (p.hp <= 0) {
        p.dead = true;
        showDeathScreen();
    }
}

function updateBuildings(dt) {
    for (const b of G.buildings) {
        if (!b.alive) continue;

        if (b.type === 'turret') {
            b.shootCooldown -= dt;
            if (b.shootCooldown <= 0 && G.enemies.length > 0) {
                // Find nearest enemy in range
                let nearest = null, minD = CFG.TURRET_RANGE + b.tierIdx * 30;
                for (const e of G.enemies) {
                    const d = dist(b, e);
                    if (d < minD) { minD = d; nearest = e; }
                }
                if (nearest) {
                    const a = angle(b, nearest);
                    const dmg = getTurretDamage(b.tierIdx);
                    G.projectiles.push({
                        x: b.x, y: b.y,
                        vx: Math.cos(a) * 350,
                        vy: Math.sin(a) * 350,
                        damage: dmg,
                        radius: 4,
                        life: 1.5,
                        from: 'turret',
                        color: TIER_COLORS[TIERS[Math.min(b.tierIdx, 14)]],
                    });
                    b.shootCooldown = CFG.TURRET_FIRE_RATE / (1 + b.tierIdx * 0.15);
                }
            }
        }
    }
    G.buildings = G.buildings.filter(b => b.alive);
}

function updateProjectiles(dt) {
    for (const proj of G.projectiles) {
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        proj.life -= dt;

        if (proj.from === 'enemy') {
            // Hit player
            if (dist(proj, G.player) < proj.radius + G.player.radius) {
                damagePlayer(proj.damage);
                proj.life = 0;
            }
            // Hit buildings
            for (const b of G.buildings) {
                if (b.alive && dist(proj, b) < proj.radius + b.radius) {
                    b.hp -= proj.damage;
                    spawnParticles(b.x, b.y, '#a33', 3);
                    if (b.hp <= 0) b.alive = false;
                    proj.life = 0;
                    break;
                }
            }
        } else if (proj.from === 'turret') {
            for (const e of G.enemies) {
                if (dist(proj, e) < proj.radius + e.radius) {
                    e.hp -= proj.damage;
                    spawnParticles(e.x, e.y, proj.color, 4);
                    addFloatingText(e.x, e.y - 10, `-${proj.damage}`, proj.color);
                    if (e.hp <= 0) {
                        G.inventory.exp += e.xp;
                        G.kills++;
                        G.score += e.xp * 2;
                        addFloatingText(e.x, e.y - 20, `+${e.xp} XP`, '#ff0');
                        spawnParticles(e.x, e.y, e.color, 12);
                    }
                    proj.life = 0;
                    break;
                }
            }
        }
    }
    G.projectiles = G.projectiles.filter(p => p.life > 0);
}

function updatePets(dt) {
    for (const pet of G.pets) {
        // Follow player with orbit
        pet.orbitAngle += dt * 1.5;
        const orbitDist = 50 + pet.orbitIndex * 25;
        const targetX = G.player.x + Math.cos(pet.orbitAngle) * orbitDist;
        const targetY = G.player.y + Math.sin(pet.orbitAngle) * orbitDist;
        pet.x = lerp(pet.x, targetX, dt * 3);
        pet.y = lerp(pet.y, targetY, dt * 3);

        pet.cooldown -= dt;
        if (pet.cooldown > 0) continue;

        const effectiveness = pet.level;

        switch (pet.role) {
            case 'combat': {
                // Attack nearest enemy
                let nearest = null, minD = 120 + pet.level * 20;
                for (const e of G.enemies) {
                    const d = dist(pet, e);
                    if (d < minD) { minD = d; nearest = e; }
                }
                if (nearest) {
                    const dmg = 5 + pet.level * 4;
                    nearest.hp -= dmg;
                    spawnParticles(nearest.x, nearest.y, pet.color, 3);
                    addFloatingText(nearest.x, nearest.y - 15, `-${dmg}`, '#aaf');
                    if (nearest.hp <= 0) {
                        G.inventory.exp += nearest.xp;
                        G.kills++;
                        spawnParticles(nearest.x, nearest.y, nearest.color, 10);
                    }
                    pet.cooldown = 1.2 / (1 + pet.level * 0.1);
                }
                break;
            }
            case 'repair_building': {
                let target = null, minHP = Infinity;
                for (const b of G.buildings) {
                    if (!b.alive || b.hp >= b.maxHp) continue;
                    const d = dist(pet, b);
                    if (d < 200 && b.hp < minHP) { minHP = b.hp; target = b; }
                }
                if (target) {
                    const heal = 5 + pet.level * 3;
                    target.hp = Math.min(target.maxHp, target.hp + heal);
                    spawnParticles(target.x, target.y, '#4f4', 3);
                    pet.cooldown = 2 / (1 + pet.level * 0.1);
                }
                break;
            }
            case 'repair_tool': {
                for (const key of ['pickaxe', 'axe', 'sword']) {
                    const tool = G.tools[key];
                    if (tool.durability < tool.maxDurability) {
                        const repair = 2 + pet.level * 2;
                        tool.durability = Math.min(tool.maxDurability, tool.durability + repair);
                        pet.cooldown = 3 / (1 + pet.level * 0.1);
                        break;
                    }
                }
                if (pet.cooldown <= 0) pet.cooldown = 1;
                break;
            }
            case 'harvest': {
                let nearest = null, minD = 100 + pet.level * 15;
                for (const r of G.resources) {
                    if (!r.alive) continue;
                    const d = dist(pet, r);
                    if (d < minD) { minD = d; nearest = r; }
                }
                if (nearest) {
                    const dmg = 3 + pet.level * 2;
                    nearest.hp -= dmg;
                    spawnParticles(nearest.x, nearest.y, RESOURCE_TYPES[nearest.type].color, 2);
                    if (nearest.hp <= 0) {
                        nearest.alive = false;
                        nearest.respawnTimer = 30 + rand(10, 30);
                        const cfg = RESOURCE_TYPES[nearest.type];
                        const drop = Math.floor(cfg.drop * 0.7);
                        G.inventory[cfg.tier] += drop;
                        addFloatingText(nearest.x, nearest.y - 20, `+${drop}`, TIER_COLORS[cfg.tier]);
                        spawnParticles(nearest.x, nearest.y, cfg.color, 8);
                    }
                    pet.cooldown = 1.5 / (1 + pet.level * 0.1);
                }
                break;
            }
        }
    }
}

function updateDayNight(dt) {
    G.time += dt;
    const cycleDuration = G.isNight ? CFG.NIGHT_DURATION : CFG.DAY_DURATION;

    if (G.time >= cycleDuration) {
        G.time = 0;
        if (G.isNight) {
            G.isNight = false;
            G.dayNum++;
        } else {
            G.isNight = true;
            spawnWave();
        }
    }

    // Update UI
    const pct = G.time / cycleDuration;
    const timeBar = document.getElementById('time-bar');
    const dayText = document.getElementById('day-text');
    timeBar.style.width = `${pct * 100}%`;

    if (G.isNight) {
        timeBar.style.background = 'linear-gradient(90deg, #2c3e50, #8e44ad)';
        dayText.textContent = `Night ${G.waveNum}`;
        dayText.style.color = '#e74c3c';
    } else {
        timeBar.style.background = 'linear-gradient(90deg, #f1c40f, #e67e22)';
        dayText.textContent = `Day ${G.dayNum}`;
        dayText.style.color = '#f1c40f';
    }

    const waveInfo = document.getElementById('wave-info');
    if (G.waveActive) {
        waveInfo.textContent = `Wave ${G.waveNum} - ${G.enemies.length} enemies`;
    } else if (G.isNight) {
        waveInfo.textContent = 'Night - Stay alert!';
    } else {
        waveInfo.textContent = '';
    }
}

function updateResources(dt) {
    for (const r of G.resources) {
        if (r.alive) continue;
        r.respawnTimer -= dt;
        if (r.respawnTimer <= 0) {
            r.alive = true;
            r.hp = r.maxHp;
        }
    }
}

// ==================== PARTICLES / EFFECTS ====================
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        G.particles.push({
            x, y,
            vx: rand(-80, 80),
            vy: rand(-80, 80),
            life: rand(0.3, 0.7),
            maxLife: 0.7,
            color,
            radius: rand(2, 5),
        });
    }
}

function spawnSwingParticle(p, range) {
    const a = p.angle;
    for (let i = -2; i <= 2; i++) {
        const sa = a + i * 0.2;
        G.particles.push({
            x: p.x + Math.cos(sa) * range * 0.7,
            y: p.y + Math.sin(sa) * range * 0.7,
            vx: Math.cos(sa) * 60,
            vy: Math.sin(sa) * 60,
            life: 0.2,
            maxLife: 0.2,
            color: '#fff',
            radius: 3,
        });
    }
}

function addFloatingText(x, y, text, color) {
    G.floatingTexts.push({ x, y, text, color, life: 1.2 });
}

function updateParticles(dt) {
    for (const p of G.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
    }
    G.particles = G.particles.filter(p => p.life > 0);

    for (const ft of G.floatingTexts) {
        ft.y -= 30 * dt;
        ft.life -= dt;
    }
    G.floatingTexts = G.floatingTexts.filter(ft => ft.life > 0);
}

// ==================== BUILDING PLACEMENT ====================
function tryPlaceBuilding() {
    if (!G.buildMode || !G.selectedBuild) return;

    const gridX = Math.round(G.mouse.wx / CFG.BUILD_GRID) * CFG.BUILD_GRID;
    const gridY = Math.round(G.mouse.wy / CFG.BUILD_GRID) * CFG.BUILD_GRID;

    // Check overlap with existing buildings
    for (const b of G.buildings) {
        if (b.alive && dist({ x: gridX, y: gridY }, b) < CFG.BUILD_GRID * 0.8) return;
    }

    // Check cost
    const cost = getBuildCost(G.selectedBuild, G.buildTier);
    if (!canAfford(cost.resource, cost.amount)) {
        addFloatingText(gridX, gridY - 20, 'Not enough resources!', '#f44');
        return;
    }

    spend(cost.resource, cost.amount);
    const hp = getBuildHP(G.selectedBuild, G.buildTier);

    G.buildings.push({
        type: G.selectedBuild,
        tierIdx: G.buildTier,
        x: gridX,
        y: gridY,
        hp, maxHp: hp,
        radius: G.selectedBuild === 'wall' ? 22 : 18,
        alive: true,
        shootCooldown: 0,
    });

    spawnParticles(gridX, gridY, TIER_COLORS[TIERS[Math.min(G.buildTier, 14)]], 8);
}

// ==================== RENDERING ====================
function render() {
    const ctx = G.ctx;
    const W = G.W, H = G.H;
    const cam = G.camera;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(-cam.x + W / 2, -cam.y + H / 2);

    // Background
    drawBackground(ctx, cam);

    // Night overlay
    const nightAlpha = G.isNight ? 0.35 : Math.max(0, (G.time / CFG.DAY_DURATION - 0.85) * 0.35 / 0.15);

    // Resources
    for (const r of G.resources) {
        if (!r.alive) continue;
        if (!isOnScreen(r, cam, r.radius + 30)) continue;
        drawResource(ctx, r);
    }

    // Buildings
    for (const b of G.buildings) {
        if (!b.alive) continue;
        if (!isOnScreen(b, cam, 40)) continue;
        drawBuilding(ctx, b);
    }

    // Enemies
    for (const e of G.enemies) {
        if (!isOnScreen(e, cam, 30)) continue;
        drawEnemy(ctx, e);
    }

    // Pets
    for (const pet of G.pets) {
        drawPet(ctx, pet);
    }

    // Player
    if (!G.player.dead) drawPlayer(ctx);

    // Projectiles
    for (const proj of G.projectiles) {
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Particles
    for (const p of G.particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating texts
    for (const ft of G.floatingTexts) {
        ctx.globalAlpha = Math.min(1, ft.life * 2);
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // Build preview
    if (G.buildMode && G.selectedBuild) {
        const gridX = Math.round(G.mouse.wx / CFG.BUILD_GRID) * CFG.BUILD_GRID;
        const gridY = Math.round(G.mouse.wy / CFG.BUILD_GRID) * CFG.BUILD_GRID;
        const cost = getBuildCost(G.selectedBuild, G.buildTier);
        const affordable = canAfford(cost.resource, cost.amount);

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = affordable ? '#4f4' : '#f44';
        ctx.strokeStyle = affordable ? '#0f0' : '#f00';
        ctx.lineWidth = 2;

        if (G.selectedBuild === 'wall') {
            ctx.fillRect(gridX - 22, gridY - 22, 44, 44);
            ctx.strokeRect(gridX - 22, gridY - 22, 44, 44);
        } else {
            ctx.beginPath();
            ctx.arc(gridX, gridY, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Range circle
            ctx.strokeStyle = 'rgba(255,255,100,0.3)';
            ctx.beginPath();
            ctx.arc(gridX, gridY, CFG.TURRET_RANGE + G.buildTier * 30, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Night overlay on top
    if (nightAlpha > 0) {
        ctx.fillStyle = `rgba(10, 5, 30, ${nightAlpha})`;
        ctx.fillRect(0, 0, W, H);

        // Player light
        if (!G.player.dead) {
            const px = G.player.x - cam.x + W / 2;
            const py = G.player.y - cam.y + H / 2;
            const lightRadius = 200 + G.dayNum * 10;
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, lightRadius);
            gradient.addColorStop(0, `rgba(10, 5, 30, ${nightAlpha})`);
            gradient.addColorStop(1, 'rgba(10, 5, 30, 0)');
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(px, py, lightRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // HUD updates
    updateHUD();
    renderMinimap();
}

function isOnScreen(obj, cam, margin) {
    const sx = obj.x - cam.x + G.W / 2;
    const sy = obj.y - cam.y + G.H / 2;
    return sx > -margin && sx < G.W + margin && sy > -margin && sy < G.H + margin;
}

function drawBackground(ctx, cam) {
    // Ground
    const startX = Math.floor((cam.x - G.W / 2) / 80) * 80;
    const startY = Math.floor((cam.y - G.H / 2) / 80) * 80;
    const endX = cam.x + G.W / 2 + 80;
    const endY = cam.y + G.H / 2 + 80;

    ctx.fillStyle = G.isNight ? '#1a2a1a' : '#3a5a2a';
    ctx.fillRect(0, 0, CFG.WORLD_W, CFG.WORLD_H);

    // Grid dots
    ctx.fillStyle = G.isNight ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
    for (let x = startX; x < endX; x += 80) {
        for (let y = startY; y < endY; y += 80) {
            if (x >= 0 && x <= CFG.WORLD_W && y >= 0 && y <= CFG.WORLD_H) {
                ctx.fillRect(x - 1, y - 1, 2, 2);
            }
        }
    }

    // World border
    ctx.strokeStyle = '#f44';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, CFG.WORLD_W, CFG.WORLD_H);
}

function drawResource(ctx, r) {
    const cfg = RESOURCE_TYPES[r.type];

    if (r.type === 'tree') {
        // Trunk
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(r.x - 4, r.y - 4, 8, 12);
        // Canopy
        ctx.fillStyle = cfg.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y - 8, r.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a5a2a';
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        // Ore/rock - polygonal shape
        ctx.fillStyle = cfg.color;
        ctx.beginPath();
        const sides = r.type === 'rock' ? 6 : 5;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
            const rad = r.radius * (0.85 + Math.sin(i * 2.3) * 0.15);
            const px = r.x + Math.cos(a) * rad;
            const py = r.y + Math.sin(a) * rad;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Sparkle for high-tier
        const ti = tierIndex(cfg.tier);
        if (ti >= 3) {
            ctx.fillStyle = TIER_COLORS[cfg.tier];
            ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 300 + r.x) * 0.3;
            const sparkleCount = Math.min(ti - 2, 4);
            for (let s = 0; s < sparkleCount; s++) {
                const sa = (Date.now() / 500 + s * 1.5 + r.x) % (Math.PI * 2);
                ctx.beginPath();
                ctx.arc(r.x + Math.sin(sa) * 5, r.y + Math.cos(sa * 1.3) * 5, 1.5 + ti * 0.15, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Glow for ultra-high tier (10+)
            if (ti >= 10) {
                ctx.shadowColor = TIER_COLORS[cfg.tier];
                ctx.shadowBlur = 8 + (ti - 10) * 3;
                ctx.fillStyle = TIER_COLORS[cfg.tier];
                ctx.globalAlpha = 0.15;
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius + 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
            }
        }
    }

    // HP bar
    if (r.hp < r.maxHp) {
        const barW = r.radius * 2;
        const barH = 4;
        const bx = r.x - barW / 2;
        const by = r.y + r.radius + 5;
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = '#4f4';
        ctx.fillRect(bx, by, barW * (r.hp / r.maxHp), barH);
    }
}

function drawBuilding(ctx, b) {
    const tierColor = TIER_COLORS[TIERS[Math.min(b.tierIdx, 14)]];
    const darkerColor = b.type === 'wall' ? tierColor : '#333';

    if (b.type === 'wall') {
        ctx.fillStyle = tierColor;
        ctx.fillRect(b.x - 22, b.y - 22, 44, 44);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - 22, b.y - 22, 44, 44);
        // Brick pattern
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x - 22, b.y); ctx.lineTo(b.x + 22, b.y);
        ctx.moveTo(b.x, b.y - 22); ctx.lineTo(b.x, b.y);
        ctx.moveTo(b.x - 11, b.y); ctx.lineTo(b.x - 11, b.y + 22);
        ctx.moveTo(b.x + 11, b.y); ctx.lineTo(b.x + 11, b.y + 22);
        ctx.stroke();
    } else {
        // Turret base
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = tierColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Turret barrel - aim at nearest enemy
        let aimAngle = 0;
        let minD = Infinity;
        for (const e of G.enemies) {
            const d = dist(b, e);
            if (d < minD) { minD = d; aimAngle = angle(b, e); }
        }
        ctx.strokeStyle = tierColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(aimAngle) * 20, b.y + Math.sin(aimAngle) * 20);
        ctx.stroke();
        // Center dot
        ctx.fillStyle = tierColor;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // HP bar
    if (b.hp < b.maxHp) {
        const barW = 40;
        const barH = 4;
        const bx = b.x - barW / 2;
        const by = b.y - (b.type === 'wall' ? 28 : 24);
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = '#4f4';
        ctx.fillRect(bx, by, barW * (b.hp / b.maxHp), barH);
    }
}

function drawEnemy(ctx, e) {
    const cfg = ENEMY_TYPES[e.type];

    // Body
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    const eyeAngle = angle(e, G.player);
    ctx.fillStyle = '#f44';
    for (let i = -1; i <= 1; i += 2) {
        const ex = e.x + Math.cos(eyeAngle + i * 0.4) * e.radius * 0.4;
        const ey = e.y + Math.sin(eyeAngle + i * 0.4) * e.radius * 0.4;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Type indicator
    if (e.type === 'fast') {
        ctx.strokeStyle = '#fa0';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const a = eyeAngle + Math.PI + (i - 1) * 0.3;
            ctx.beginPath();
            ctx.moveTo(e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius);
            ctx.lineTo(e.x + Math.cos(a) * (e.radius + 8), e.y + Math.sin(a) * (e.radius + 8));
            ctx.stroke();
        }
    } else if (e.type === 'tank') {
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
    } else if (e.type === 'ranged') {
        ctx.fillStyle = '#a3f';
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(eyeAngle) * e.radius, e.y + Math.sin(eyeAngle) * e.radius, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // HP bar
    if (e.hp < e.maxHp) {
        const barW = e.radius * 2.5;
        const barH = 3;
        ctx.fillStyle = '#333';
        ctx.fillRect(e.x - barW/2, e.y - e.radius - 8, barW, barH);
        ctx.fillStyle = '#f44';
        ctx.fillRect(e.x - barW/2, e.y - e.radius - 8, barW * (e.hp / e.maxHp), barH);
    }
}

function drawPet(ctx, pet) {
    const cfg = PET_TYPES[pet.type];

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(pet.x, pet.y + 8, pet.radius, pet.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = pet.color;
    ctx.beginPath();
    ctx.arc(pet.x, pet.y, pet.radius + pet.level, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon based on type
    ctx.fillStyle = '#fff';
    ctx.font = `${10 + pet.level}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons = { wolf: '🐺', golem: '🗿', sprite: '✨', beetle: '🪲' };
    ctx.fillText(icons[pet.type] || '?', pet.x, pet.y);

    // Level indicator
    ctx.font = 'bold 9px Arial';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`Lv${pet.level}`, pet.x, pet.y - pet.radius - 6);
}

function drawPlayer(ctx) {
    const p = G.player;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, p.radius, p.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const flash = p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0;
    ctx.fillStyle = flash ? '#fff' : '#3498db';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Eyes
    const eyeDist = p.radius * 0.35;
    ctx.fillStyle = '#fff';
    for (let i = -1; i <= 1; i += 2) {
        const ex = p.x + Math.cos(p.angle + i * 0.4) * eyeDist;
        const ey = p.y + Math.sin(p.angle + i * 0.4) * eyeDist;
        ctx.beginPath();
        ctx.arc(ex, ey, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(ex + Math.cos(p.angle) * 1.5, ey + Math.sin(p.angle) * 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
    }

    // Held item
    const slot = G.hotbarSlot;
    const toolTier = slot === 0 ? G.tools.pickaxe.tier : slot === 1 ? G.tools.axe.tier : G.tools.sword.tier;
    const tierColor = TIER_COLORS[TIERS[Math.min(toolTier, 14)]] || '#8B5E3C';

    if (slot <= 2) {
        const handX = p.x + Math.cos(p.angle) * (p.radius + 10);
        const handY = p.y + Math.sin(p.angle) * (p.radius + 10);
        ctx.strokeStyle = tierColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.angle) * p.radius, p.y + Math.sin(p.angle) * p.radius);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Tool head
        if (slot === 0) { // Pickaxe
            ctx.strokeStyle = tierColor;
            ctx.lineWidth = 3;
            const pa = p.angle + Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(handX + Math.cos(pa) * 7, handY + Math.sin(pa) * 7);
            ctx.lineTo(handX - Math.cos(pa) * 7, handY - Math.sin(pa) * 7);
            ctx.stroke();
        } else if (slot === 1) { // Axe
            ctx.fillStyle = tierColor;
            ctx.beginPath();
            const aa = p.angle - Math.PI / 4;
            ctx.moveTo(handX, handY);
            ctx.lineTo(handX + Math.cos(aa) * 8, handY + Math.sin(aa) * 8);
            ctx.lineTo(handX + Math.cos(p.angle) * 6, handY + Math.sin(p.angle) * 6);
            ctx.fill();
        } else { // Sword
            ctx.strokeStyle = tierColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(handX, handY);
            ctx.lineTo(handX + Math.cos(p.angle) * 14, handY + Math.sin(p.angle) * 14);
            ctx.stroke();
        }
    }
}

function updateHUD() {
    const p = G.player;
    // Health
    const hpPct = Math.max(0, p.hp / p.maxHp * 100);
    document.getElementById('health-bar').style.width = `${hpPct}%`;
    document.getElementById('health-text').textContent = `${Math.max(0, Math.round(p.hp))} / ${p.maxHp}`;

    // Resources - dynamically update all tiers
    const resContainer = document.getElementById('resources');
    if (resContainer._built !== true) {
        resContainer.innerHTML = '';
        for (const tier of TIERS) {
            const span = document.createElement('span');
            span.className = 'res';
            span.id = `res-${tier}`;
            span.style.borderLeft = `3px solid ${TIER_COLORS[tier]}`;
            resContainer.appendChild(span);
        }
        const expSpan = document.createElement('span');
        expSpan.className = 'res';
        expSpan.id = 'res-exp';
        expSpan.style.borderLeft = '3px solid #FFD700';
        resContainer.appendChild(expSpan);
        resContainer._built = true;
    }
    for (const tier of TIERS) {
        const el = document.getElementById(`res-${tier}`);
        if (el) {
            const val = G.inventory[tier];
            if (val > 0 || tierIndex(tier) < 3) {
                el.textContent = `${TIER_NAMES[tier]}: ${val}`;
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        }
    }
    document.getElementById('res-exp').textContent = `⭐ ${G.inventory.exp}`;

    // Hotbar names
    const slots = document.querySelectorAll('.hotbar-slot');
    const toolNames = [
        `Pickaxe T${G.tools.pickaxe.tier + 1}`,
        `Axe T${G.tools.axe.tier + 1}`,
        `Sword T${G.tools.sword.tier + 1}`,
        'Build',
        'Pets',
    ];
    slots.forEach((s, i) => {
        s.querySelector('.slot-name').textContent = toolNames[i];
        s.classList.toggle('selected', i === G.hotbarSlot);
    });
}

function renderMinimap() {
    const ctx = G.mmCtx;
    const w = G.mm.width, h = G.mm.height;
    const scale = w / CFG.WORLD_W;

    ctx.fillStyle = G.isNight ? '#111' : '#1a3a1a';
    ctx.fillRect(0, 0, w, h);

    // Resources as dots
    for (const r of G.resources) {
        if (!r.alive) continue;
        ctx.fillStyle = RESOURCE_TYPES[r.type].color;
        ctx.fillRect(r.x * scale, r.y * scale, 2, 2);
    }

    // Buildings
    ctx.fillStyle = '#88f';
    for (const b of G.buildings) {
        if (!b.alive) continue;
        ctx.fillRect(b.x * scale - 1, b.y * scale - 1, 3, 3);
    }

    // Enemies
    ctx.fillStyle = '#f44';
    for (const e of G.enemies) {
        ctx.fillRect(e.x * scale - 1, e.y * scale - 1, 2, 2);
    }

    // Player
    if (!G.player.dead) {
        ctx.fillStyle = '#4af';
        ctx.fillRect(G.player.x * scale - 2, G.player.y * scale - 2, 5, 5);
    }

    // Camera viewport
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
        (G.camera.x - G.W / 2) * scale,
        (G.camera.y - G.H / 2) * scale,
        G.W * scale,
        G.H * scale
    );
}

// ==================== MENUS ====================
function openBuildMenu() {
    G.menuOpen = 'build';
    const menu = document.getElementById('build-menu');
    menu.classList.remove('hidden');

    const opts = document.getElementById('build-options');
    opts.innerHTML = '';

    for (const type of ['wall', 'turret']) {
        for (let ti = 0; ti <= Math.min(14, G.dayNum + 1); ti++) {
            const cost = getBuildCost(type, ti);
            const hp = getBuildHP(type, ti);
            const affordable = canAfford(cost.resource, cost.amount);

            const div = document.createElement('div');
            div.className = `build-option ${affordable ? '' : 'option-locked'}`;
            div.innerHTML = `
                <div class="option-info">
                    <span class="option-name">${TIER_NAMES[TIERS[ti]]} ${type === 'wall' ? 'Wall' : 'Turret'}</span>
                    <span class="option-stats">${hp} HP${type === 'turret' ? ` | ${getTurretDamage(ti)} DMG` : ''}</span>
                </div>
                <div class="option-action">
                    <span class="option-cost">${cost.amount} ${TIER_NAMES[cost.resource]}</span>
                </div>
            `;
            div.onclick = () => {
                const cost2 = getBuildCost(type, ti);
                if (!canAfford(cost2.resource, cost2.amount)) return;
                G.selectedBuild = type;
                G.buildTier = ti;
                G.buildMode = true;
                closeMenus();
            };
            opts.appendChild(div);
        }
    }
}

function openUpgradeMenu() {
    G.menuOpen = 'upgrade';
    const menu = document.getElementById('upgrade-menu');
    menu.classList.remove('hidden');

    const opts = document.getElementById('upgrade-options');
    opts.innerHTML = '';

    for (const [key, tool] of Object.entries(G.tools)) {
        const cost = getUpgradeCost(tool.tier);
        const affordable = canAfford(cost.resource, cost.amount);
        const name = key.charAt(0).toUpperCase() + key.slice(1);

        let statsText = '';
        if (key === 'sword') {
            statsText = `DMG: ${getSwordDamage(tool.tier)} → ${getSwordDamage(tool.tier + 1)} | Range: ${getSwordRange(tool.tier)} → ${getSwordRange(tool.tier + 1)}`;
        } else {
            statsText = `DMG: ${getToolDamage(tool.tier)} → ${getToolDamage(tool.tier + 1)} | Speed: x${getToolSpeed(tool.tier).toFixed(1)} → x${getToolSpeed(tool.tier + 1).toFixed(1)}`;
        }

        const tierName = tool.tier < TIERS.length ? TIER_NAMES[TIERS[tool.tier]] : `Celestium +${tool.tier - TIERS.length + 1}`;
        const nextTier = tool.tier + 1 < TIERS.length ? TIER_NAMES[TIERS[tool.tier + 1]] : `Celestium +${tool.tier + 1 - TIERS.length + 1}`;
        const durPct = Math.round(tool.durability / tool.maxDurability * 100);

        const div = document.createElement('div');
        div.className = `upgrade-option ${affordable ? '' : 'option-locked'}`;
        div.innerHTML = `
            <div class="option-info">
                <span class="option-name">${name} (${tierName} → ${nextTier})</span>
                <span class="option-stats">${statsText}</span>
                <span class="option-stats" style="color:#aaa">Durability: ${durPct}%</span>
            </div>
            <div class="option-action">
                <span class="option-cost">${cost.amount} ${TIER_NAMES[cost.resource]}</span>
            </div>
        `;
        div.onclick = () => {
            if (!canAfford(cost.resource, cost.amount)) return;
            spend(cost.resource, cost.amount);
            tool.tier++;
            tool.maxDurability = 100 + tool.tier * 20;
            tool.durability = tool.maxDurability;
            openUpgradeMenu(); // Refresh
        };
        opts.appendChild(div);
    }
}

function openPetMenu() {
    G.menuOpen = 'pet';
    const menu = document.getElementById('pet-menu');
    menu.classList.remove('hidden');

    const opts = document.getElementById('pet-options');
    opts.innerHTML = '';

    for (const [type, cfg] of Object.entries(PET_TYPES)) {
        const owned = G.pets.find(p => p.type === type);
        let div;

        if (owned) {
            const cost = getPetUpgradeCost(owned.level + 1);
            const affordable = G.inventory.exp >= cost;

            div = document.createElement('div');
            div.className = `pet-option ${affordable ? '' : 'option-locked'}`;
            div.innerHTML = `
                <div class="option-info">
                    <span class="option-name">${cfg.name} (Lv ${owned.level})</span>
                    <span class="option-stats">${cfg.desc}</span>
                </div>
                <div class="option-action">
                    <span class="option-cost">Upgrade: ${cost} XP</span>
                </div>
            `;
            div.onclick = () => {
                if (G.inventory.exp < cost) return;
                G.inventory.exp -= cost;
                owned.level++;
                openPetMenu();
            };
        } else {
            const cost = 30;
            const affordable = G.inventory.exp >= cost;

            div = document.createElement('div');
            div.className = `pet-option ${affordable ? '' : 'option-locked'}`;
            div.innerHTML = `
                <div class="option-info">
                    <span class="option-name">${cfg.name}</span>
                    <span class="option-stats">${cfg.desc}</span>
                </div>
                <div class="option-action">
                    <span class="option-cost">Unlock: ${cost} XP</span>
                </div>
            `;
            div.onclick = () => {
                if (G.inventory.exp < cost) return;
                G.inventory.exp -= cost;
                G.pets.push(createPet(type));
                openPetMenu();
            };
        }
        opts.appendChild(div);
    }
}

function closeMenus() {
    G.menuOpen = null;
    document.getElementById('build-menu').classList.add('hidden');
    document.getElementById('upgrade-menu').classList.add('hidden');
    document.getElementById('pet-menu').classList.add('hidden');
}

function showDeathScreen() {
    document.getElementById('death-screen').classList.remove('hidden');
    document.getElementById('death-stats').textContent =
        `Survived ${G.dayNum} days | ${G.kills} kills | Score: ${G.score}`;
}

// ==================== INPUT ====================
function setupInput() {
    window.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        G.keys[key] = true;

        if (key === 'escape') {
            if (G.buildMode) { G.buildMode = false; G.selectedBuild = null; }
            else closeMenus();
        }

        // Hotbar
        if (key >= '1' && key <= '5') {
            const slot = parseInt(key) - 1;
            G.hotbarSlot = slot;
            if (slot === 3) openBuildMenu();
            else if (slot === 4) openPetMenu();
            else { closeMenus(); G.buildMode = false; }
        }

        if (key === 'e') {
            if (G.menuOpen === 'upgrade') closeMenus();
            else { closeMenus(); openUpgradeMenu(); }
        }
        if (key === 'b') {
            if (G.menuOpen === 'build') closeMenus();
            else { closeMenus(); openBuildMenu(); }
        }
        if (key === 'p') {
            if (G.menuOpen === 'pet') closeMenus();
            else { closeMenus(); openPetMenu(); }
        }
    });

    window.addEventListener('keyup', e => {
        G.keys[e.key.toLowerCase()] = false;
    });

    G.canvas.addEventListener('mousemove', e => {
        const rect = G.canvas.getBoundingClientRect();
        G.mouse.x = (e.clientX - rect.left) * (G.canvas.width / rect.width);
        G.mouse.y = (e.clientY - rect.top) * (G.canvas.height / rect.height);
        G.mouse.wx = G.mouse.x + G.camera.x - G.W / 2;
        G.mouse.wy = G.mouse.y + G.camera.y - G.H / 2;
    });

    G.canvas.addEventListener('mousedown', e => {
        if (e.button === 0) {
            G.mouse.down = true;
            if (G.buildMode) tryPlaceBuilding();
        }
    });

    G.canvas.addEventListener('mouseup', e => {
        if (e.button === 0) G.mouse.down = false;
    });

    G.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Close buttons
    document.getElementById('close-upgrade').onclick = closeMenus;
    document.getElementById('close-pet').onclick = closeMenus;

    // Hotbar click
    document.querySelectorAll('.hotbar-slot').forEach(slot => {
        slot.onclick = () => {
            const idx = parseInt(slot.dataset.slot);
            G.hotbarSlot = idx;
            if (idx === 3) openBuildMenu();
            else if (idx === 4) openPetMenu();
            else { closeMenus(); G.buildMode = false; }
        };
    });

    // Start button
    document.getElementById('start-btn').onclick = () => {
        document.getElementById('instructions').classList.add('hidden');
        G.running = true;
        G.lastTime = performance.now();
        gameLoop();
    };

    // Respawn
    document.getElementById('respawn-btn').onclick = () => {
        document.getElementById('death-screen').classList.add('hidden');
        G.player = createPlayer();
        G.enemies = [];
        G.waveActive = false;
        G.time = 0;
        G.isNight = false;
        // Keep inventory, buildings, pets
    };
}

// ==================== GAME LOOP ====================
function gameLoop(timestamp) {
    if (!G.running) return;

    const now = timestamp || performance.now();
    G.dt = Math.min(0.05, (now - G.lastTime) / 1000);
    G.lastTime = now;

    if (!G.player.dead && G.menuOpen === null) {
        updatePlayer(G.dt);
        updateEnemies(G.dt);
        updateBuildings(G.dt);
        updateProjectiles(G.dt);
        updatePets(G.dt);
    }
    updateDayNight(G.dt);
    updateResources(G.dt);
    G.enemies = G.enemies.filter(e => e.hp > 0);
    updateParticles(G.dt);

    // Camera follow
    G.camera.x = lerp(G.camera.x, G.player.x, G.dt * 6);
    G.camera.y = lerp(G.camera.y, G.player.y, G.dt * 6);

    render();
    requestAnimationFrame(gameLoop);
}

// ==================== INIT ====================
function init() {
    G.canvas = document.getElementById('gameCanvas');
    G.ctx = G.canvas.getContext('2d');
    G.mm = document.getElementById('minimap');
    G.mmCtx = G.mm.getContext('2d');

    function resize() {
        G.W = window.innerWidth;
        G.H = window.innerHeight;
        G.canvas.width = G.W;
        G.canvas.height = G.H;
    }
    resize();
    window.addEventListener('resize', resize);

    G.player = createPlayer();
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
    generateWorld();

    setupInput();
}

window.onload = init;
