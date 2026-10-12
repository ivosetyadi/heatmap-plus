// Offline test suite for Heatmap+. No network — uses a synthetic HTML fixture.
import assert from 'node:assert';
import { parseContributions, totalFromHeader, computeStats, renderSVG } from '../lib.js';

let pass = 0;
const ok = (c, m) => {
  assert.ok(c, m);
  pass++;
};

// Build a fixture: 10 days, levels drive activity; tooltips give exact counts.
function cell(ix, date, level) {
  return `<td data-ix="${ix}" data-date="${date}" id="contribution-day-component-0-${ix}" data-level="${level}" class="ContributionCalendar-day"></td>`;
}
function tip(ix, n) {
  const txt = n === 0 ? 'No contributions' : `${n} contribution${n === 1 ? '' : 's'}`;
  return `<tool-tip for="contribution-day-component-0-${ix}">${txt} on date</tool-tip>`;
}
const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'];
const levels = [0, 1, 2, 0, 1, 1, 3, 4, 2, 1]; // active run of 4 at the end
const counts = [0, 2, 5, 0, 1, 3, 9, 20, 6, 4];
const html =
  '<h2>1,234 contributions in the last year</h2>' +
  dates.map((d, ix) => cell(ix, d, levels[ix])).join('') +
  dates.map((d, ix) => tip(ix, counts[ix])).join('');

// --- parse -------------------------------------------------------------------
const days = parseContributions(html);
ok(days.length === 10, `parsed 10 days (got ${days.length})`);
ok(days[0].date === '2026-01-01' && days[0].level === 0, 'first cell parsed');
ok(days[2].count === 5, `count from tooltip (got ${days[2].count})`);

// --- header total ------------------------------------------------------------
ok(totalFromHeader(html) === 1234, 'header total parsed with comma');
ok(totalFromHeader('<p>nothing</p>') === null, 'no header → null');

// --- stats -------------------------------------------------------------------
const s = computeStats(days, totalFromHeader(html));
ok(s.total === 1234, 'total from header preferred');
// levels [0,1,2,0,1,1,3,4,2,1] → active run at the end spans indices 4..9 = 6
ok(s.current === 6, `current streak = 6 (got ${s.current})`);
ok(s.longest === 6, `longest streak = 6 (got ${s.longest})`);
ok(s.bestDay.count === 20, `best day count 20 (got ${s.bestDay.count})`);

// total fallback when no header
const s2 = computeStats(days, null);
ok(s2.total === counts.reduce((a, b) => a + b, 0), 'total falls back to sum of counts');

// --- SVG render --------------------------------------------------------------
const svg = renderSVG('ivosetyadi', s, 'dark');
ok(svg.startsWith('<svg') && svg.includes('</svg>'), 'valid svg envelope');
ok(svg.includes('ivosetyadi'), 'username in svg');
ok(svg.includes('1,234'), 'total rendered with locale comma');
ok((svg.match(/<rect/g) || []).length >= 10, 'heatmap cells drawn');
ok(renderSVG('u', s, 'nope').includes('<svg'), 'unknown theme falls back');

console.log(`✓ ${pass} assertions passed`);
