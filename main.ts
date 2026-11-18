// Launch-day Twitch curve forecaster — an entry for make.fun's
// gta6-twitch-ccu-forecast-01 bounty ("Forecast GTA VI's launch-day Twitch
// viewers hour by hour", $250).
//
// Method: a big console launch's release-day viewer curve, hour by hour, has a
// shape that repeats from launch to launch — a rolling midnight unlock ramps
// up as each region wakes, peaks in the US evening and decays overnight. The
// case file carries dozens of past launches (comparables) with hourly counts
// around their release days. For every forecast hour this program pools the
// comparables' log-ratios log(viewers_h / viewers_hour1) for that hour,
// fits a centre (median) and a spread (from the interquartile range), and
// writes the five scored quantiles of the case's own curve as
// p1 * exp(centre + z_tau * spread), p1 being the case's known hour-1 print.
// Where a comparable lacks an hour it simply does not vote; where no
// comparable votes, the program falls back to a persistence curve with a
// random-walk spread, so every case always gets a valid forecast.
//
// Node 22, standard library only, no network. Reads every <id>.in in
// $MAKEFUN_INPUT_DIR (else /input), writes <id>.out to $MAKEFUN_OUTPUT_DIR
// (else /output). Deterministic: two runs write the same bytes.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95];
const Z = [-1.644854, -0.674490, 0, 0.674490, 1.644854];
/** Fallback spread (log units per sqrt hour) when a pool is empty. */
const FALLBACK_SIGMA = 0.15;
/** Smallest spread worth reporting for an hour, in log units. */
const MIN_SIGMA = 0.05;

interface HourPoint { from: string; viewers: number }
interface Comparable { day_start: string; unlock?: string; hourly: HourPoint[] }
interface CaseFile {
  levels: number[];
  known: Array<{ hour: number; viewers: number }>;
  forecast: Array<{ hour: number }>;
  comparables: Comparable[];
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** One pooled vote: a log-ratio and the weight its comparable carries. */
interface Vote { v: number; w: number }

/** The weighted value at position q (0..1) of a pool sorted by value. */
function quantileOf(pool: Vote[], q: number): number {
  if (pool.length === 0) return 0;
  if (pool.length === 1) return pool[0].v;
  const total = pool.reduce((s, x) => s + x.w, 0);
  const target = q * total;
  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += pool[i].w;
    if (acc >= target) {
      if (i === 0) return pool[0].v;
      const prevAcc = acc - pool[i].w;
      const span = pool[i].w === 0 ? 1 : pool[i].w;
      const frac = Math.min(1, Math.max(0, (target - prevAcc) / span));
      return pool[i - 1].v + (pool[i].v - pool[i - 1].v) * frac;
    }
  }
  return pool[pool.length - 1].v;
}

/**
 * How much a comparable's curve should count. GTA VI unlocks at midnight
 * local time, rolling across regions, so a comparable that unlocked the same
 * way carries a full vote; one with a single global unlock time carries half.
 */
function weightOf(comp: Comparable): number {
  const text = (comp.unlock ?? '').toLowerCase();
  return text.includes('midnight') || text.includes('rolling') ? 1 : 0.5;
}

/**
 * One comparable's release-day curve as a map from hour index (0 = the day's
 * first hour) to its viewer count, read off its hourly points.
 */
function dayCurve(comp: Comparable): Map<number, number> {
  const start = Date.parse(comp.day_start);
  const curve = new Map<number, number>();
  for (const pt of comp.hourly) {
    const idx = Math.round((Date.parse(pt.from) - start) / 3600000);
    if (idx >= 0 && idx < 24 && pt.viewers > 0 && !curve.has(idx)) curve.set(idx, pt.viewers);
  }
  return curve;
}

/**
 * Pools of log-ratios per forecast hour: for hour H (2..24), the values
 * log(curve[H-1] / curve[0]) over every comparable that has both hours.
 */
function ratioPools(comparables: Comparable[]): Map<number, Vote[]> {
  const pools = new Map<number, Vote[]>();
  for (const comp of comparables) {
    const curve = dayCurve(comp);
    const base = curve.get(0);
    if (base === undefined || base <= 0) continue;
    const w = weightOf(comp);
    for (let idx = 1; idx < 24; idx++) {
      const v = curve.get(idx);
      if (v === undefined || v <= 0) continue;
      const hour = idx + 1;
      const pool = pools.get(hour) ?? [];
      pool.push({ v: Math.log(v / base), w });
      pools.set(hour, pool);
    }
  }
  for (const pool of pools.values()) pool.sort((a, b) => a.v - b.v);
  return pools;
}

/** The five quantiles of one forecast hour, in viewers. */
function hourQuantiles(p1: number, hour: number, pool: Vote[] | undefined): number[] {
  let centre: number;
  let sigma: number;
  if (pool !== undefined && pool.length >= 8) {
    centre = quantileOf(pool, 0.5);
    const iqr = quantileOf(pool, 0.75) - quantileOf(pool, 0.25);
    sigma = Math.max(MIN_SIGMA, iqr / 1.349);
  } else {
    centre = 0;
    sigma = FALLBACK_SIGMA * Math.sqrt(hour - 1);
  }
  return Z.map((z) => round2(p1 * Math.exp(centre + z * sigma)));
}

function forecastCase(c: CaseFile): { hours: Array<{ hour: number; q: number[] }> } {
  if (c.levels.length !== LEVELS.length || c.levels.some((t, j) => t !== LEVELS[j])) {
    throw new Error(`case asks for levels ${JSON.stringify(c.levels)}, not ${JSON.stringify(LEVELS)}`);
  }
  const first = c.known.find((k) => k.hour === 1);
  if (first === undefined) throw new Error('case has no hour-1 print');
  const p1 = Math.max(1, first.viewers);
  const pools = ratioPools(c.comparables ?? []);
  const hours = c.forecast.map(({ hour }) => ({ hour, q: hourQuantiles(p1, hour, pools.get(hour)) }));
  return { hours };
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as CaseFile;
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify(forecastCase(c))}\n`);
}
