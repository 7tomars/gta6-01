# SUNDARA HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/7tomars/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/7tomars/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01).

An original open-world crime game that runs offline in a desktop browser from
static files — no build step, no network requests, no libraries. Every line of
the game, all of its art (drawn with Canvas), and all of its sound (synthesised
with WebAudio) was written for this entry. The city, characters, vehicles,
names and story are invented: welcome to **Sundara Bay**.

## The game

Riko, a broke courier on the tropical coast of Sundara Bay, owes money to the
Arus Liar crew. A warung owner, a workshop mechanic and a lookout tower carry
the three story missions — deliver a package, steal a golden sports car, then
run and disappear — while the whole city stays open around them: steal any
car, outrun the police, take repeat delivery jobs, and build a career that the
browser saves between visits.

## How to play

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk, or steer a car |
| E | Enter / steal a car, or get out |
| Shift | Run |
| Space | Punch |
| Mouse click | Shoot toward the pointer |
| P / Esc | Pause |
| Enter / click | Start, or continue after Busted / Wasted |

Crime raises the wanted stars (0–5) when citizens or police see it. Patrol
cars give chase and ram; on foot, standing close to an officer fills the bust
meter. Break line of sight and stay unseen to let the heat fade. Getting
busted or wasted costs cash and puts Riko back at his rented room or the
clinic — the career (money and story progress) is saved in `localStorage`.

## Systems in the box

- **A complete city** — a 6×5 road grid with named places (warung, workshop,
  lookout tower, Riko's room), varied buildings, car parks, sidewalks, palms,
  a beach and open water, all generated from one seed.
- **Driving & traffic** — five original vehicle models with their own top
  speeds and colours; AI traffic that follows lanes and turns at junctions;
  parked cars everywhere, all stealable, with simple collision and damage.
- **Pedestrians** — townsfolk who stroll the sidewalks and the beach, flee
  from violence and act as witnesses for the wanted system.
- **Wanted & police** — crime points scaled by who witnessed the act, patrol
  cars that scale with the star level, chases, rams, a bust meter, heat decay.
- **Missions & story** — a three-mission story chain with dialogue banners,
  markers in the world and on the minimap, cash rewards, plus endless
  repeatable delivery side jobs and free-roam progression.
- **Combat** — punches and hitscan pistol shots with particles and sound.
- **HUD & screens** — money, health, wanted stars, mission objective, story
  banners, a live minimap with police / target / objective blips, a title
  screen, pause, BUSTED and WASTED screens.
- **Sound** — a fully synthesised WebAudio soundscape: engine, horn, siren,
  punches, shots, cash, and an original looping background groove. No audio
  files.
- **Save** — money and story progress persist in the browser.

## Run it

Serve the `game/` folder with any static file server and open `index.html`
in desktop Chrome. The kit's helper does exactly that:

```
node serve.ts            # http://localhost:8080
```

The game is plain files under `game/`; there is nothing to install or build.

## Handing it in (make.fun gta6-01)

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with
`vendor/makefun-game.ts`:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It is deterministic: two runs write byte-identical output. The four files in
`screenshots/` are real renders of this game's own shot scenes
(`game/src/shots.js`, staged via `?shot=cover|chase|mission|beach&seed=1`).

## Source layout

One file, one job, all under `game/src/`:

- `config.js` — every name, tuning number and colour
- `random.js` — the seeded RNG that makes the city deterministic
- `input.js` — keyboard and mouse, as one control block per step
- `world.js` — the city: roads, buildings, places, beach, collision helpers
- `cars.js` — vehicle models, parked cars, traffic AI, driving physics
- `peds.js` — pedestrians and their reactions
- `police.js` — wanted points, stars, patrol cars, chases, the bust meter
- `combat.js` — punches, shots, particles, witnesses
- `missions.js` — the story chain and side jobs
- `audio.js` — the WebAudio synthesiser (effects and music)
- `save.js` — the saved career
- `render.js` — drawing the world
- `hud.js` — HUD, minimap and the title / pause / end screens
- `shots.js` — the staged screenshot scenes
- `main.js` — game state, the fixed-step loop, the screens' flow

## Why this entry

Most browser crime-game demos show one system: a car, a city, or a walker.
Sundara Heat wires **all** of the genre's systems together in one small,
dependency-free package (~85 KB of source) — traffic, pedestrians, stealing,
police that respond to witnessed crime, a story with progression, combat, a
minimap HUD, saves and synthesised sound — and its screenshots show exactly
that: the chase, the mission, the beach, the city alive around them.

## License

MIT — see `LICENSE`.
