[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xiangbingxi/makefun-gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xiangbingxi/makefun-gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR BAY

An open-world crime game for the [make.fun bounty gta6-01](https://make.fun/bounty/gta6-01).

A sun-soaked island city that never sleeps. You are **Rio**, a wheelman
trying to make a name for himself, working for **Luna Reyes** out of La Luna
Bar. Eight story jobs take you from stealing your first car to robbing the
Torre bank — while the Bay Police Department watches every move you make.

## The city

- **4800×3600 island city, 6 districts** — Solmar Beach, The Strip, Little
  Havana, Portside, Torre Heights and Marina District, each with its own
  look, buildings and street grid
- **Living streets** — traffic that follows the roads, pedestrians who stroll
  the sidewalks and run from gunfire, parked cars waiting to be borrowed
- **A real day cycle of light** — the city renders from a prerendered street
  layer, so it stays smooth on any machine

## The game

- **Walk and drive** — on foot with WASD and mouse aim, behind the wheel
  with real acceleration, steering, handbrake and crashes
- **8 story missions** — drive, deliver against the clock, collect a debt,
  shake 3 stars of heat, steal an armored van, win a 5-checkpoint street
  race, clear a rival crew, rob the bank and lose 4 stars
- **5-star wanted system** — patrol cars that ram, foot cops that shoot and
  arrest, roadblocks at 3 stars, the Air One helicopter at 4; heat cools
  when you hide, a fresh paint job at Spray & Shine loses the cops
- **Combat** — fists, pistol, SMG and shotgun, with a gun shop (Ironworks
  Guns), body armor and ammo
- **Money and respect** — earn cash from jobs and golden Sun Coins, climb
  from Street Punk to Kingpin
- **Save and load** — Casa del Sol saves your progress; the game autosaves
  after every mission
- **3 WebAudio radio stations** — Solmar FM, Bay Nights and Static 88,
  all synthesized live, no audio files
- **HUD and minimap** — wanted stars, cash, health, armor, weapon, radio,
  speed, district names and a live minimap with mission markers

## Play it

```bash
node serve.ts        # then open http://localhost:8080
```

No build step, no dependencies, no network requests — plain static files
and ES modules.

## Controls

- **WASD** move / drive, **mouse** aim, **click** shoot, **E** enter/exit car
- **Space** handbrake, **Shift** sprint, **R** change radio, **1–4** weapons
- **M** map, **P** pause, **F** pay 'n spray (when inside), **H** horn

## Screenshots

Captured from the game itself with headless Chromium:

1. **1-chase** — a 3-star pursuit through The Strip
2. **2-street** — on foot outside La Luna Bar, first job
3. **3-race** — the Street Kings race, checkpoint hunt
4. **4-vista** — the whole island city from above

## Files

- `game/` — the game: `index.html`, `style.css`, `src/` (modules)
- `screenshots/` — 4 JPEGs, each under 256 KiB
- `vendor/makefun-game.ts` — the make.fun dossier library (unchanged)
- `main.ts` — builds `dossier.json` (`MAKEFUN_OUTPUT_DIR=out node main.ts`)
- `serve.ts` — local static server for playtesting

---

Built for the make.fun bounty — [gta6-01 on make.fun](https://make.fun/bounty/gta6-01)
