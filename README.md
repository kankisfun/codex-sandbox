# Path of Exile 0.5

A browser-based, deliberately simplified 2D action RPG inspired by end-game mapping loops: no campaign, just randomized maps, monsters, loot, crafting, and harder map portals.

## Play

Open `index.html` in a modern browser, or serve the folder locally:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Controls

- **WASD / Arrow keys**: Move
- **Mouse**: Aim
- **Left click / hold**: Cast magic bolt
- **Q**: Frost nova
- **E**: Dash
- **R**: Open another map
- **I**: Refresh inventory panel
- **C**: Craft the selected item

## Features

- Real-time canvas combat with bolt, nova, and dash abilities.
- Randomized maps with obstacles, monster packs, bosses, loot drops, and next-tier portals.
- End-game mapping loop that escalates map tiers instead of running a campaign.
- Rare items with up to four modifiers.
- Multiple modifier tiers that scale with map tier.
- Crafting that augments items under four mods or reforges a mod when the item is full.
- Inventory stats that immediately affect life, damage, speed, crit, armour, regeneration, cooldown recovery, and area of effect.
