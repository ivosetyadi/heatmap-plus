// Heatmap+ — GitHub Action mode.
// Generates the contribution SVG and writes it into the repo (optionally
// committing it), so a README can reference a static file with no hosting.
// Reuses the same pure functions as the Cloudflare Worker.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { parseContributions, totalFromHeader, computeStats, renderSVG } from './lib.js';

const log = (m) => process.stdout.write(m + '\n');

function ownerFromRepo() {
  return (process.env.GITHUB_REPOSITORY || '/').split('/')[0];
}

async function run() {
  const user = (process.env.INPUT_USER || ownerFromRepo() || '').trim();
  const theme = process.env.INPUT_THEME || 'light';
  const outFile = process.env.INPUT_OUTPUT || 'heatmap.svg';
  const doCommit = (process.env.INPUT_COMMIT || 'true') === 'true';
  const message = process.env.INPUT_COMMIT_MESSAGE || 'chore: update contribution heatmap [skip ci]';

  if (!/^[A-Za-z0-9-]{1,39}$/.test(user)) throw new Error(`Invalid user "${user}"`);

  const res = await fetch(`https://github.com/users/${user}/contributions`, { headers: { 'User-Agent': 'heatmap-plus' } });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for "${user}"`);
  const html = await res.text();
  const days = parseContributions(html);
  if (!days.length) throw new Error(`No contribution data for "${user}"`);
  const stats = computeStats(days, totalFromHeader(html));
  const svg = renderSVG(user, stats, theme);

  const unchanged = existsSync(outFile) && readFileSync(outFile, 'utf8') === svg;
  writeFileSync(outFile, svg);
  log(`Wrote ${outFile} (${svg.length} bytes) — ${user}: ${stats.total} contributions, ${stats.current}d streak.`);

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) writeFileSync(summary, `### Heatmap+ updated\n\n- **${user}** · ${stats.total} contributions · current streak ${stats.current}d · longest ${stats.longest}d\n`, { flag: 'a' });

  if (doCommit) {
    if (unchanged) {
      log('No change — skipping commit.');
      return;
    }
    try {
      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
      execSync(`git add ${JSON.stringify(outFile)}`);
      // commit only if staged changes exist
      try {
        execSync('git diff --cached --quiet');
        log('Nothing staged — skipping commit.');
        return;
      } catch {
        /* there are staged changes */
      }
      execSync(`git commit -m ${JSON.stringify(message)}`);
      execSync('git push');
      log('Committed and pushed updated heatmap.');
    } catch (e) {
      log(`::warning::Could not commit: ${e.message}. The SVG was still written — add your own commit step.`);
    }
  }
}

run().catch((e) => {
  log(`::error::Heatmap+ action failed: ${e.message}`);
  process.exit(1);
});
