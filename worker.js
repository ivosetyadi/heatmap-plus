// Heatmap+ — a Cloudflare Worker that renders a richer GitHub contribution card
// as an embeddable SVG. No API token needed: it reads the PUBLIC contributions
// calendar at github.com/users/<user>/contributions and computes streaks, totals,
// and the busiest weekday, then draws a themed SVG.
//
// Embed in a README:
//   ![](https://heatmap.apibase.dev/?user=ivosetyadi)
//
// Pure functions (parseContributions, computeStats, renderSVG) are exported so
// they can be unit-tested in Node without a network or the Workers runtime.

// ---- Parsing ------------------------------------------------------------------
// Extract {date, level} for every day cell. GitHub emits data-date before
// data-level on each <td class="ContributionCalendar-day">.
export function parseContributions(html) {
  const days = [];
  const re = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*?data-level="(\d)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    days.push({ date: m[1], level: parseInt(m[2], 10) });
  }
  // Attach exact counts from tooltips when available: "N contributions on ...".
  const counts = {};
  const tip = /<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>\s*(No|[\d,]+) contribution/g;
  let t;
  while ((t = tip.exec(html)) !== null) {
    counts[t[1]] = t[2] === 'No' ? 0 : parseInt(t[2].replace(/,/g, ''), 10);
  }
  // Map tooltip ids to cells by their order of appearance.
  const idRe = /id="(contribution-day-component-\d+-\d+)"/g;
  const ids = [];
  let i;
  while ((i = idRe.exec(html)) !== null) ids.push(i[1]);
  days.forEach((d, idx) => {
    const id = ids[idx];
    d.count = id && counts[id] != null ? counts[id] : d.level > 0 ? 1 : 0;
  });
  return days;
}

export function totalFromHeader(html) {
  const m = html.match(/([\d,]+)\s+contributions?\s+in the last year/i);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}

// ---- Stats --------------------------------------------------------------------
export function computeStats(days, headerTotal) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const total = headerTotal != null ? headerTotal : sorted.reduce((s, d) => s + (d.count || 0), 0);

  let longest = 0,
    run = 0;
  for (const d of sorted) {
    if ((d.count || 0) > 0 || d.level > 0) {
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  // current streak: consecutive active days ending at the most recent cell
  let current = 0;
  for (let k = sorted.length - 1; k >= 0; k--) {
    if ((sorted[k].count || 0) > 0 || sorted[k].level > 0) current++;
    else break;
  }
  // busiest weekday (0=Sun..6=Sat)
  const byDow = [0, 0, 0, 0, 0, 0, 0];
  for (const d of sorted) byDow[new Date(d.date + 'T00:00:00Z').getUTCDay()] += d.count || 0;
  const bestDow = byDow.indexOf(Math.max(...byDow));
  const best = sorted.reduce((a, b) => ((b.count || 0) > (a.count || 0) ? b : a), { count: 0 });

  return { total, longest, current, bestDow, bestDay: best, days: sorted };
}

// ---- Rendering ----------------------------------------------------------------
const THEMES = {
  light: { bg: '#ffffff', border: '#d1d9e0', fg: '#1f2328', muted: '#59636e', accent: '#0969da', cells: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] },
  dark: { bg: '#0d1117', border: '#30363d', fg: '#e6edf3', muted: '#848d97', accent: '#4493f8', cells: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] },
  dracula: { bg: '#282a36', border: '#44475a', fg: '#f8f8f2', muted: '#bd93f9', accent: '#ff79c6', cells: ['#44475a', '#6272a4', '#8be9fd', '#50fa7b', '#f1fa8c'] },
};
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export function renderSVG(user, stats, themeName = 'light') {
  const t = THEMES[themeName] || THEMES.light;
  const W = 495,
    H = 195;
  // mini heatmap: last 182 days as a compact 26x7 grid
  const recent = stats.days.slice(-182);
  const cols = Math.ceil(recent.length / 7);
  const cell = 9,
    gap = 2,
    gx = 32,
    gy = 95;
  let grid = '';
  recent.forEach((d, idx) => {
    const col = Math.floor(idx / 7),
      row = idx % 7;
    const x = gx + col * (cell + gap),
      y = gy + row * (cell + gap);
    grid += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${t.cells[d.level] || t.cells[0]}"/>`;
  });

  const stat = (x, label, value, color) =>
    `<text x="${x}" y="58" font-size="24" font-weight="700" fill="${color}">${esc(value)}</text>` +
    `<text x="${x}" y="76" font-size="11" fill="${t.muted}">${esc(label)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
  <text x="32" y="32" font-size="16" font-weight="700" fill="${t.fg}">${esc(user)}</text>
  <text x="${W - 32}" y="32" text-anchor="end" font-size="12" fill="${t.muted}">GitHub contributions</text>
  ${stat(32, 'contributions / yr', stats.total.toLocaleString('en-US'), t.accent)}
  ${stat(190, 'current streak', stats.current + 'd', t.fg)}
  ${stat(330, 'longest streak', stats.longest + 'd', t.fg)}
  <text x="32" y="${95 + 7 * (cell + gap) + 14}" font-size="11" fill="${t.muted}">Most productive on ${DOW[stats.bestDow]} · last 6 months</text>
  ${grid}
</svg>`;
}

// ---- Worker entrypoint --------------------------------------------------------
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const user = (url.searchParams.get('user') || '').trim();
    const theme = url.searchParams.get('theme') || 'light';
    if (!user || !/^[A-Za-z0-9-]{1,39}$/.test(user)) {
      return new Response('Pass ?user=<github-username>', { status: 400 });
    }
    const upstream = await fetch(`https://github.com/users/${user}/contributions`, {
      headers: { 'User-Agent': 'heatmap-plus', Accept: 'text/html' },
    });
    if (!upstream.ok) {
      return new Response(`GitHub returned ${upstream.status} for "${user}"`, { status: 502 });
    }
    const html = await upstream.text();
    const days = parseContributions(html);
    if (days.length === 0) {
      return new Response(`No contribution data for "${user}"`, { status: 404 });
    }
    const stats = computeStats(days, totalFromHeader(html));
    const svg = renderSVG(user, stats, theme);
    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        // cache at the edge for 2h; README images are hit often
        'cache-control': 'public, max-age=7200, s-maxage=7200',
      },
    });
  },
};
