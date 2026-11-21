# HANDOFF — SOLMAR BAY (gta6-01, record2 rebuild)

Rebuilt from scratch in the sealed recording 01a1fd2e, in the new repo
https://github.com/xiangbingxi/makefun-gta6-01-v2 (main branch).
Every counted file below was hand-written in this session with write/edit
tools — nothing was copied from the old record/ or repo/ (those were read
only as design reference). The only copied file is the kit's vendored
vendor/makefun-game.ts, byte-identical to the kit (sha256
dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129).

## The game

SOLMAR BAY — top-down 2D open-world crime game, 4800×3600 island city,
6 districts (Solmar Beach, The Strip, Little Havana, Portside,
Torre Heights, Marina District). You are Rio, a wheelman working for
Luna Reyes at La Luna Bar.

- Walk (WASD, Shift sprint, mouse aim) and drive (W/S accel/brake,
  A/D steer, Space handbrake, H horn, E enter/exit, real accel/turn/grip
  physics, crash damage, building collision).
- Traffic follows the road grid and turns at intersections; parked cars
  to steal; pedestrians stroll sidewalks and flee gunfire.
- 5-star wanted system: patrol cars ram, foot cops shoot and arrest,
  roadblocks at 3 stars, Air One helicopter at 4, heat cools when hidden,
  Spray & Shine paint job ($300) loses the cops.
- Combat: fists, pistol, SMG, shotgun (mouse aim, click shoot), gun shop
  Ironworks Guns, body armor, ammo.
- 8 story missions for Luna: steal a car, timed delivery, debt collection,
  lose 3 stars, steal the armored van, 5-checkpoint street race, clear a
  rival crew (6), rob Torre Bank and lose 4 stars. Cash + respect rewards,
  ranks Street Punk → Kingpin.
- Money, Sun Coin collectibles (24, respawn), save/load via localStorage,
  autosave after every mission, Casa del Sol save point.
- 3 WebAudio radio stations (Solmar FM, Bay Nights, Static 88), all
  synthesized live; engine hum, gunshots, sirens, horn — no audio files.
- HUD: wanted stars, cash, rank, mission title/objective/timer, health
  and armor bars, weapon/ammo, speed, radio, district banner, live
  minimap (200×150) with mission marker, cops, coins and view rect.
- Start screen (Continue / New Game / How to Play), pause (P/Esc),
  Wasted/Busted screen with respawn at Casa del Sol (half cash lost).
- Day cycle (~8 min) with dusk/night tints; prerendered city layer
  (4800×3600 offscreen canvas) so it stays smooth.

## Files (3,070 lines total, all hand-written)

- game/index.html, game/style.css
- game/src/config.js (165) — world, districts, places, weapons, missions, ranks
- game/src/util.js (37) — math + seeded RNG helpers
- game/src/input.js (60) — keyboard + mouse
- game/src/city.js (272) — city generation + prerendered static layer
- game/src/audio.js (209) — WebAudio synth: radio, engine, shots, siren
- game/src/entities.js (201) — traffic AI, parked cars, pedestrians
- game/src/player.js (171) — on-foot movement + driving + enter/exit
- game/src/combat.js (162) — weapons, bullets, melee
- game/src/police.js (236) — wanted, cop cars, foot cops, helicopter, spray
- game/src/missions.js (227) — 8 missions, steps, race, rivals
- game/src/render.js (291) — world + entity + effect drawing
- game/src/ui.js (184) — HUD, minimap, menus, toasts
- game/src/save.js (53) — localStorage save/load
- game/src/shots.js (100) — 4 screenshot scene presets
- game/src/main.js (447) — state, loop, wiring, shops, camera
- main.ts (35), serve.ts (68), shots.json, README.md, LICENSE (MIT, SPDX),
  .makefun/owner.json, vendor/makefun-game.ts (kit, unchanged)

## Verification (all passed)

- Playtest over CDP (headless Chromium, no console errors):
  - Menu → NEW GAME → walking north 380 px in 2 s (190 px/s).
  - Steal a parked car with E → in car, wanted 1 star, 3 cop cars spawn.
  - Drive 3 s → speed 459 px/s, position moved ~970 px.
  - Pistol shot → ammo 12 → 11 (shot fired).
  - Mission 1 end-to-end: talk to Luna (E) → mission starts → steal car
    (step 0→1) → drive to Luna → mission DONE, cash $150→$350 (+$200),
    respect 0→120, autosave missionIndex 1, next job waits for Luna.
  - Pause with P, resume with P (fixed: P used to only work while playing).
  - Fixed during testing: two wrong imports (collideBuildings,
    randomRoadPoint), cop-car ram damage was per-frame (now 0.8 s
    cooldown), crash damage now has a 0.7 s cooldown, cop cars no longer
    drive through buildings, vista camera no longer reset by resize.
- Screenshots (headless Chromium, ?scene=…&snap=1, 1280×800, real renders):
  - 1-chase.jpg 113,078 B — 3-star pursuit on The Strip, cops, HUD, minimap
  - 2-street.jpg 105,859 B — on foot at La Luna Bar, first job
  - 3-race.jpg 109,458 B — Street Kings race, checkpoint 2, 150 s timer
  - 4-vista.jpg 188,513 B — whole island from above, all 6 districts
  - All ≤256 KiB, long side 1280, short side 800. First by name is the cover.
- main.ts: `MAKEFUN_OUTPUT_DIR=out node main.ts` twice → dossier.json
  byte-identical both runs (sha256
  38e7998af3a965e83644539db9e6bf5e29c4cfeb36094ca2efa400f27a08c51d),
  794,743 B (< 1.5 MiB). All 17 source files present in full, nothing
  left out (dossier text 101,644 B).
- Gate limits: game/ 17 files (≤993), 100,593 B (≤48 MiB);
  index.html 3,460 B (≤1 MiB); 4 screenshots (≤4, each ≤256 KiB).
- No network requests: no http(s) URLs, no fetch/XHR in game/ code;
  every script/image is a local file under game/.

## Notes for the main agent

- Local commit only — nothing pushed. Push text files with MCP
  push-files, screenshots (binary) via the GitHub web upload, set About,
  then submit with --recording 01a1fd2e-bbdc-7289-ae9d-ce74236c2eda.
- out/ and out2/ (local main.ts outputs) were NOT committed; regenerate
  with MAKEFUN_OUTPUT_DIR=out node main.ts.
- usage-placeholder.json is a placeholder; overwrite with the real
  muse.db usage rows before sealing.
- The game was verified in headless Chromium (Playwright cache build);
  the desktop Chrome at /opt/meta-chromium/chrome refuses to start
  here (Hatch WebGL domain policy) — use the Playwright Chromium.
