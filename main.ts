// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// This entry is Sundara Heat, an original open-world crime game built for this bounty:
// a sun-soaked coastal city (Sundara Bay) explored on foot and by car, with traffic,
// pedestrians, a wanted system and police, a three-mission story, combat, a HUD with a
// live minimap, synthesized sound, and a career saved in the browser. All of its code
// under game/ was written for this entry in plain JavaScript with no library at all.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const ENTRY_TITLE = 'Sundara Heat — an original open-world crime game set in Sundara Bay';
const ENTRY_VERSION = '2.0-rebuild';
console.log(`Handing in: ${ENTRY_TITLE} (v${ENTRY_VERSION})`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Deterministic hand-in manifest (rebuild addition): walk the copied tree in
// explicitly sorted order and count files per top-level folder. The walk is
// sorted before counting, so the summary line is identical on every run and
// the hand-in fails loudly here — not at the scorer — if a folder is missing.
function sortedFiles(root) {
  const found = [];
  const walk = (dir, prefix) => {
    const entries = readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (entry.isDirectory()) walk(join(dir, entry.name), prefix + entry.name + '/');
      else found.push(prefix + entry.name);
    }
  };
  walk(root, '');
  return found.sort();
}

const manifest = {
  game: sortedFiles(join(out, 'game')),
  screenshots: sortedFiles(join(out, 'screenshots')),
};
if (manifest.game.length === 0) throw new Error('hand-in manifest: game/ copied empty');
console.log(
  `Manifest v${ENTRY_VERSION}: game=${manifest.game.length} files, screenshots=${manifest.screenshots.length} files, first=${manifest.game[0]}`,
);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
