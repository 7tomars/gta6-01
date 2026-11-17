// A tiny seeded random generator (mulberry32) so a given seed always builds
// the same city and stages the same screenshot scenes.

/** Create a random source from a 32-bit seed: next() in [0,1), range(a,b), pick(list), int(a,b). */
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(a, b) { return a + next() * (b - a); },
    int(a, b) { return a + Math.floor(next() * (b - a + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
  };
}
