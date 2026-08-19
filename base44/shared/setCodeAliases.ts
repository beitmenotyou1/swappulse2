// Official Pokémon TCG set-code aliases → TCGDex set IDs.
// TCGDex uses its own set IDs (sv01, swsh1, sm1, xy1, bw1, …) which differ from
// the official printed codes on cards (SV01, SSH, SUM, XY, BLW, …) and the
// short codes used for special sets (MEW, PAF, SFA, PRE, …). This map lets the
// card search resolve an official code typed by a collector to the TCGDex set
// ID the catalogue API expects. Keys are lowercase. Extend freely as new sets
// release — the search falls back to the raw token when no alias matches.

export const SET_CODE_ALIASES: Record<string, string> = {
  // --- Scarlet & Violet special sets (main sets SV01–SV10 already match sv01–sv10) ---
  mew: 'sv03.5', // 151
  paf: 'sv04.5', // Paldean Fates
  sfa: 'sv06.5', // Shrouded Fable
  pre: 'sv08.5', // Prismatic Evolutions

  // --- Chinese-exclusive / promo sets (TCGDex uses me* IDs for these) ---
  pbl: 'me05', // Pitch Black (Chinese-exclusive)

  // --- Japanese MEGA-era sets (TCGDex stores these as uppercase M-series IDs) ---
  m2: 'M2',   // Inferno X
  m2a: 'M2a', // MEGA Dream ex (high class pack)
  m3: 'M3',   // Nihil Zero / Munikis Zero
  m4: 'M4',   // Ninja Spinner
  m5: 'M5',   // Abyss Eye
  m6: 'M6',   // Storm Emeralda

  // --- Sword & Shield (TCGDex: swsh1–swsh12, no leading zero) ---
  ssh: 'swsh1',  // Sword & Shield
  rcl: 'swsh2',  // Rebel Clash
  daa: 'swsh3',  // Darkness Ablaze
  bst: 'swsh4',  // Battle Styles
  shf: 'swsh4.5', // Shining Fates
  viv: 'swsh5',  // Vivid Voltage
  cre: 'swsh6',  // Chilling Reign
  evs: 'swsh7',  // Evolving Skies
  fst: 'swsh8',  // Fusion Strike
  brs: 'swsh9',  // Brilliant Stars
  pgo: 'swsh9.5', // Pokémon GO
  asr: 'swsh10', // Astral Radiance
  lor: 'swsh11', // Lost Origin
  crz: 'swsh11.5', // Crown Zenith
  sit: 'swsh12', // Silver Tempest

  // --- Sun & Moon (TCGDex: sm1–sm12, no leading zero) ---
  sum: 'sm1', // Sun & Moon
  gri: 'sm2', // Guardians Rising
  bus: 'sm3', // Burning Shadows
  upr: 'sm4', // Ultra Prism
  ces: 'sm5', // Celestial Storm
  lot: 'sm6', // Lost Thunder
  teu: 'sm7', // Team Up
  unm: 'sm8', // Unbroken Bonds
  unb: 'sm9', // Unified Minds
  cec: 'sm10', // Cosmic Eclipse

  // --- XY (TCGDex: xy1–xy12, no leading zero) ---
  xy: 'xy1',  // XY
  flf: 'xy2', // Flashfire
  ffi: 'xy3', // Furious Fists
  phf: 'xy4', // Phantom Forces
  prc: 'xy5', // Primal Clash
  ros: 'xy6', // Roaring Skies
  aor: 'xy7', // Ancient Origins
  bkt: 'xy8', // BREAKthrough
  bkp: 'xy9', // BREAKpoint
  gen: 'xy10', // Generations
  fco: 'xy11', // Fates Collide
  evo: 'xy12', // Evolutions

  // --- Black & White (TCGDex: bw1–bw11, no leading zero) ---
  blw: 'bw1',  // Black & White
  epo: 'bw2',  // Emerging Powers
  nvi: 'bw3',  // Noble Victories
  nxd: 'bw4',  // Next Destinies
  dex: 'bw5',  // Dark Explorers
  drx: 'bw6',  // Dragons Exalted
  bcr: 'bw7',  // Boundaries Crossed
  pls: 'bw8',  // Plasma Storm
  plf: 'bw9',  // Plasma Freeze
  plb: 'bw10', // Plasma Blast
  ltr: 'bw11', // Legendary Treasures
};

/** Resolve an official Pokémon set code to a TCGDex set ID, or null. */
export function resolveSetAlias(token: string): string | null {
  const k = String(token || '').toLowerCase().trim();
  return SET_CODE_ALIASES[k] || null;
}