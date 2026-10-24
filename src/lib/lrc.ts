export interface LyricLine {
  time: number; // seconds
  text: string;
}

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** Parse LRC text into time-sorted lines. Supports multiple tags per line and [offset:ms]. */
export function parseLrc(source: string): LyricLine[] {
  const lines: LyricLine[] = [];
  let offset = 0;
  for (const raw of source.split(/\r?\n/)) {
    const off = raw.match(/^\[offset:\s*([+-]?\d+)\]/i);
    if (off) {
      offset = Number(off[1]) / 1000;
      continue;
    }
    const tags = [...raw.matchAll(TIME_TAG)];
    if (!tags.length) continue;
    const text = raw.replace(TIME_TAG, "").replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, "").replace(/^v\d+:/i, "").trim();
    for (const t of tags) {
      const frac = t[3] ? Number(t[3]) / 10 ** t[3].length : 0;
      lines.push({ time: Number(t[1]) * 60 + Number(t[2]) + frac, text });
    }
  }
  return lines
    .map((l) => ({ ...l, time: Math.max(0, l.time - offset) }))
    .sort((a, b) => a.time - b.time);
}

/** Index of the line active at `time`, or -1 before the first line. Binary search. */
export function activeLineIndex(lines: LyricLine[], time: number): number {
  let lo = 0,
    hi = lines.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= time) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
