// Live smoke test: fetch real contributions and render an SVG. Not part of CI.
import { parseContributions, totalFromHeader, computeStats, renderSVG } from '../worker.js';
import { writeFileSync } from 'node:fs';

const user = process.argv[2] || 'ivosetyadi';
const theme = process.argv[3] || 'light';
const res = await fetch(`https://github.com/users/${user}/contributions`, { headers: { 'User-Agent': 'heatmap-plus' } });
const html = await res.text();
const days = parseContributions(html);
const stats = computeStats(days, totalFromHeader(html));
const svg = renderSVG(user, stats, theme);
const out = process.argv[4] || `./${user}.svg`;
writeFileSync(out, svg);
console.log(JSON.stringify({ user, days: days.length, total: stats.total, current: stats.current, longest: stats.longest, bestDow: stats.bestDow, bestDayCount: stats.bestDay.count, svgBytes: svg.length, out }, null, 2));
