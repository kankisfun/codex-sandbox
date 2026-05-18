const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const statsEl = document.querySelector('#stats');
const atlasEl = document.querySelector('#atlas');
const inventoryEl = document.querySelector('#inventory');
const logEl = document.querySelector('#log');
const craftButton = document.querySelector('#craftButton');

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const mouse = { x: W / 2, y: H / 2, down: false };
const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const modPool = [
  { key: 'life', label: 'maximum Life', tiers: [14, 24, 36, 52, 74] },
  { key: 'damage', label: 'spell Damage', tiers: [7, 13, 21, 31, 45] },
  { key: 'speed', label: 'movement Speed', tiers: [3, 5, 8, 11, 15] },
  { key: 'crit', label: 'critical Chance', tiers: [2, 4, 6, 9, 13] },
  { key: 'armor', label: 'Armour', tiers: [8, 16, 28, 44, 68] },
  { key: 'regen', label: 'life Regeneration', tiers: [1, 2, 4, 6, 10] },
  { key: 'cooldown', label: 'cooldown Recovery', tiers: [3, 6, 9, 13, 18] },
  { key: 'aoe', label: 'area of Effect', tiers: [5, 9, 14, 20, 28] },
];

const bases = ['Driftwood Wand', 'Rusted Helm', 'Silk Robe', 'Bronze Boots', 'Mapmaker Gloves', 'Crystal Ring'];
const rareNames = ['Doom Song', 'Ghoul Ward', 'Viper Star', 'Storm Hunger', 'Rune Knell', 'Miracle Shelter', 'Horror Grasp'];
const mapNames = ['Ashen Grotto', 'Burial Arcade', 'Ivory Bog', 'Sulphur Plaza', 'Drowned Foundry', 'Moonlit Mire'];

const state = {
  time: 0,
  log: ['Welcome, exile. Click to cast. R opens a new map.'],
  selected: 0,
  projectiles: [],
  particles: [],
  drops: [],
  enemies: [],
  obstacles: [],
  portals: [],
  map: null,
  player: {
    x: W / 2,
    y: H / 2,
    r: 14,
    hp: 120,
    maxHp: 120,
    xp: 0,
    level: 1,
    speed: 210,
    damage: 18,
    crit: 5,
    armor: 0,
    regen: 1,
    cooldown: 0,
    aoe: 0,
    boltCd: 0,
    novaCd: 0,
    dashCd: 0,
    invuln: 0,
    inventory: [],
  },
};

function addLog(message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 7);
  logEl.innerHTML = state.log.map((m) => `<div>› ${m}</div>`).join('');
}

function makeMod(level, used = new Set()) {
  const choices = modPool.filter((m) => !used.has(m.key));
  const mod = pick(choices);
  used.add(mod.key);
  const tier = clamp(Math.floor(rand(0, mod.tiers.length) + level / 8), 0, mod.tiers.length - 1);
  return { ...mod, tier: tier + 1, value: mod.tiers[tier] };
}

function makeItem(level = 1) {
  const used = new Set();
  const mods = Array.from({ length: Math.floor(rand(1, 5)) }, () => makeMod(level, used));
  return { name: `${pick(rareNames)} ${pick(bases)}`, base: `Item level ${level} rare`, mods };
}

function itemStats(item) {
  return item.mods.reduce((acc, mod) => {
    acc[mod.key] = (acc[mod.key] || 0) + mod.value;
    return acc;
  }, {});
}

function recalcPlayer() {
  const p = state.player;
  const stats = p.inventory.reduce((acc, item) => {
    const s = itemStats(item);
    Object.entries(s).forEach(([key, value]) => { acc[key] = (acc[key] || 0) + value; });
    return acc;
  }, {});
  p.maxHp = 120 + (stats.life || 0);
  p.damage = 18 + (stats.damage || 0);
  p.speed = 210 + (stats.speed || 0) * 5;
  p.crit = 5 + (stats.crit || 0);
  p.armor = stats.armor || 0;
  p.regen = 1 + (stats.regen || 0);
  p.cooldown = stats.cooldown || 0;
  p.aoe = stats.aoe || 0;
  p.hp = Math.min(p.hp, p.maxHp);
}

function generateMap(tier = 1) {
  state.map = {
    name: pick(mapNames),
    tier,
    monsterLevel: tier + 1,
    quantity: 35 + tier * 10,
    bossAlive: true,
  };
  state.enemies = [];
  state.obstacles = [];
  state.drops = [];
  state.projectiles = [];
  state.portals = [];
  state.player.x = W / 2;
  state.player.y = H / 2;
  for (let i = 0; i < 26; i++) {
    state.obstacles.push({ x: rand(60, W - 60), y: rand(80, H - 70), r: rand(16, 42) });
  }
  const count = 12 + tier * 4;
  for (let i = 0; i < count; i++) spawnEnemy(tier, false);
  spawnEnemy(tier, true);
  addLog(`Opened Tier ${tier} ${state.map.name}. Slay the map boss.`);
  renderPanel();
}

function spawnEnemy(tier, boss) {
  const type = boss ? 'Map Boss' : pick(['Feral Rhoa', 'Bone Archer', 'Volatile Imp', 'Frost Cultist']);
  const hp = boss ? 160 + tier * 75 : 38 + tier * 17;
  const angle = rand(0, Math.PI * 2);
  const radius = rand(180, 330);
  state.enemies.push({
    type,
    boss,
    x: W / 2 + Math.cos(angle) * radius,
    y: H / 2 + Math.sin(angle) * radius,
    r: boss ? 24 : 13,
    hp,
    maxHp: hp,
    speed: boss ? 70 + tier * 4 : rand(58, 105) + tier * 3,
    damage: boss ? 22 + tier * 5 : 8 + tier * 2,
    attackCd: rand(.2, 1.4),
    color: boss ? '#d8a84b' : pick(['#a65ee8', '#6bd1ff', '#75d46f', '#d85c5c']),
  });
}

function castBolt() {
  const p = state.player;
  const cd = Math.max(.12, .34 * (1 - p.cooldown / 100));
  if (p.boltCd > 0) return;
  const a = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  const crit = Math.random() * 100 < p.crit;
  state.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, r: 5, damage: p.damage * (crit ? 1.8 : 1), life: .85, color: crit ? '#ffd66b' : '#6bb7ff' });
  p.boltCd = cd;
}

function castNova() {
  const p = state.player;
  const cd = Math.max(1.2, 4.2 * (1 - p.cooldown / 100));
  if (p.novaCd > 0) return;
  const radius = 105 + p.aoe * 2;
  state.enemies.forEach((e) => {
    if (dist(p, e) < radius) damageEnemy(e, p.damage * 1.45);
  });
  burst(p.x, p.y, 36, '#79f2ff', radius);
  p.novaCd = cd;
  addLog('Frost nova detonated.');
}

function dash() {
  const p = state.player;
  const cd = Math.max(.8, 2.6 * (1 - p.cooldown / 100));
  if (p.dashCd > 0) return;
  const a = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  p.x = clamp(p.x + Math.cos(a) * 130, 24, W - 24);
  p.y = clamp(p.y + Math.sin(a) * 130, 48, H - 24);
  p.invuln = .35;
  p.dashCd = cd;
  burst(p.x, p.y, 18, '#ffffff', 40);
}

function damageEnemy(enemy, amount) {
  enemy.hp -= amount;
  burst(enemy.x, enemy.y, 5, enemy.color, 24);
  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy) {
  const p = state.player;
  state.enemies = state.enemies.filter((e) => e !== enemy);
  p.xp += enemy.boss ? 60 : 12;
  if (p.xp >= p.level * 100) {
    p.xp -= p.level * 100;
    p.level++;
    p.hp = p.maxHp;
    addLog(`Level up! You are now level ${p.level}.`);
  }
  if (enemy.boss || Math.random() < .28) {
    state.drops.push({ x: enemy.x, y: enemy.y, r: 9, item: makeItem(state.map.tier + (enemy.boss ? 2 : 0)) });
  }
  if (enemy.boss) {
    state.map.bossAlive = false;
    const nextTier = state.map.tier + 1;
    state.portals.push({ x: enemy.x, y: enemy.y, r: 20, tier: nextTier });
    addLog(`Boss down! A Tier ${nextTier} map portal opened.`);
  }
}

function burst(x, y, count, color, power) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(30, power * 2);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.25, .7), color });
  }
}

function craftSelected() {
  const item = state.player.inventory[state.selected];
  if (!item) return addLog('No item selected. Loot something first.');
  if (item.mods.length >= 4) {
    item.mods.splice(Math.floor(rand(0, item.mods.length)), 1, makeMod(state.map.tier, new Set(item.mods.map((m) => m.key))));
    addLog(`Reforged one modifier on ${item.name}.`);
  } else {
    item.mods.push(makeMod(state.map.tier, new Set(item.mods.map((m) => m.key))));
    addLog(`Augmented ${item.name} with a new modifier.`);
  }
  recalcPlayer();
  renderPanel();
}

function pickupDrops() {
  const p = state.player;
  state.drops = state.drops.filter((drop) => {
    if (dist(p, drop) < 28) {
      p.inventory.unshift(drop.item);
      state.selected = 0;
      recalcPlayer();
      addLog(`Looted ${drop.item.name}.`);
      return false;
    }
    return true;
  });
}

function update(dt) {
  state.time += dt;
  const p = state.player;
  p.boltCd -= dt; p.novaCd -= dt; p.dashCd -= dt; p.invuln -= dt;
  p.hp = clamp(p.hp + p.regen * dt, 0, p.maxHp);
  if (mouse.down) castBolt();

  let dx = 0; let dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy--;
  if (keys.has('s') || keys.has('arrowdown')) dy++;
  if (keys.has('a') || keys.has('arrowleft')) dx--;
  if (keys.has('d') || keys.has('arrowright')) dx++;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    p.x = clamp(p.x + (dx / len) * p.speed * dt, 20, W - 20);
    p.y = clamp(p.y + (dy / len) * p.speed * dt, 44, H - 20);
  }

  state.projectiles.forEach((b) => { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; });
  state.projectiles = state.projectiles.filter((b) => b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H);
  state.projectiles.forEach((b) => state.enemies.forEach((e) => {
    if (b.life > 0 && dist(b, e) < b.r + e.r) { b.life = 0; damageEnemy(e, b.damage); }
  }));

  state.enemies.forEach((e) => {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (dist(p, e) > e.r + p.r + 6) {
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
    }
    e.attackCd -= dt;
    if (e.attackCd <= 0 && dist(p, e) < e.r + p.r + 16) {
      if (p.invuln <= 0) p.hp -= Math.max(1, e.damage - p.armor * .08);
      e.attackCd = e.boss ? .8 : 1.2;
      burst(p.x, p.y, 8, '#e25757', 34);
    }
  });

  state.particles.forEach((pt) => { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; });
  state.particles = state.particles.filter((pt) => pt.life > 0);
  pickupDrops();
  state.portals.forEach((portal) => { if (dist(p, portal) < 28) generateMap(portal.tier); });
  if (p.hp <= 0) {
    p.hp = p.maxHp;
    p.x = W / 2; p.y = H / 2;
    addLog('You died. In true exile fashion, you got back up at the map device.');
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#111927'); g.addColorStop(1, '#24151a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  state.obstacles.forEach((o) => {
    ctx.fillStyle = '#263141'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3b4a60'; ctx.stroke();
  });

  state.portals.forEach((p) => {
    ctx.strokeStyle = '#8c5cff'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + Math.sin(state.time * 5) * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#d6c7ff'; ctx.fillText(`T${p.tier}`, p.x - 8, p.y + 4);
  });

  state.drops.forEach((d) => {
    ctx.fillStyle = '#d8a84b'; ctx.shadowColor = '#d8a84b'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  });

  state.enemies.forEach((e) => {
    ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 4);
    ctx.fillStyle = e.boss ? '#d8a84b' : '#e25757'; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2 * (e.hp / e.maxHp), 4);
  });

  state.projectiles.forEach((b) => {
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  });
  state.particles.forEach((pt) => { ctx.globalAlpha = clamp(pt.life, 0, 1); ctx.fillStyle = pt.color; ctx.fillRect(pt.x, pt.y, 3, 3); ctx.globalAlpha = 1; });

  const p = state.player;
  ctx.fillStyle = p.invuln > 0 ? '#ffffff' : '#6bb7ff';
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d8a84b'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, 40);
  ctx.fillStyle = '#e25757'; ctx.fillRect(18, 12, 260 * (p.hp / p.maxHp), 16);
  ctx.strokeStyle = '#ffffff55'; ctx.strokeRect(18, 12, 260, 16);
  ctx.fillStyle = '#eef3f9'; ctx.font = '14px system-ui';
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp} Life`, 28, 25);
  ctx.fillStyle = '#d8a84b'; ctx.fillText(`${state.map.name} · Tier ${state.map.tier} · ${state.enemies.length} monsters remain`, 330, 25);
  ctx.fillStyle = '#94a3b8'; ctx.fillText(`Bolt ${Math.max(0, p.boltCd).toFixed(1)}  Nova ${Math.max(0, p.novaCd).toFixed(1)}  Dash ${Math.max(0, p.dashCd).toFixed(1)}`, 760, 25);
}

function renderPanel() {
  const p = state.player;
  statsEl.innerHTML = [
    `Level ${p.level} (${p.xp}/${p.level * 100} XP)`,
    `${Math.ceil(p.hp)}/${p.maxHp} life`,
    `${Math.round(p.damage)} spell damage · ${Math.round(p.speed)} speed`,
    `${p.crit}% crit · ${p.armor} armour · ${p.regen}/s regen`,
  ].map((s) => `<div class="stat">${s}</div>`).join('');
  atlasEl.innerHTML = `<div class="map-row"><strong>${state.map.name}</strong><br>Tier ${state.map.tier} map · monster level ${state.map.monsterLevel}<br>${state.map.quantity}% item quantity · boss ${state.map.bossAlive ? 'alive' : 'slain'}</div>`;
  inventoryEl.innerHTML = p.inventory.length ? p.inventory.map((item, i) => `
    <div class="item ${i === state.selected ? 'selected' : ''}" data-index="${i}">
      <span class="name">${item.name}</span><span class="base">${item.base} · ${item.mods.length}/4 mods</span>
      <ul>${item.mods.map((m) => `<li>T${m.tier} +${m.value}% ${m.label}</li>`).join('')}</ul>
    </div>`).join('') : '<div class="stat">No loot yet. Kill monsters for rare items.</div>';
  logEl.innerHTML = state.log.map((m) => `<div>› ${m}</div>`).join('');
}

inventoryEl.addEventListener('click', (event) => {
  const item = event.target.closest('.item');
  if (!item) return;
  state.selected = Number(item.dataset.index);
  renderPanel();
});
craftButton.addEventListener('click', craftSelected);
canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) * (W / rect.width);
  mouse.y = (event.clientY - rect.top) * (H / rect.height);
});
canvas.addEventListener('mousedown', () => { mouse.down = true; castBolt(); });
window.addEventListener('mouseup', () => { mouse.down = false; });
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (key === 'q') castNova();
  if (key === 'e') dash();
  if (key === 'r') generateMap(state.map.tier + (state.map.bossAlive ? 0 : 1));
  if (key === 'i') renderPanel();
  if (key === 'c') craftSelected();
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

let last = performance.now();
function loop(now) {
  const dt = Math.min(.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  if (Math.floor(state.time * 4) !== Math.floor((state.time - dt) * 4)) renderPanel();
  requestAnimationFrame(loop);
}

state.player.inventory.push(makeItem(1), makeItem(1));
recalcPlayer();
generateMap(1);
requestAnimationFrame(loop);
