# 📈 Heatmap+

A **richer GitHub contribution card** as an embeddable SVG — total contributions, current & longest streak, busiest weekday, and a mini heatmap. Drop it in any README.

Part of [DevGuard Tools](https://ivosetyadi.github.io). Runs on a single Cloudflare Worker, **no API token required** — it reads the public contributions calendar.

## Embed

```markdown
![My GitHub activity](https://heatmap.apibase.dev/?user=ivosetyadi)
```

### Themes

```markdown
![](https://heatmap.apibase.dev/?user=ivosetyadi&theme=light)
![](https://heatmap.apibase.dev/?user=ivosetyadi&theme=dark)
![](https://heatmap.apibase.dev/?user=ivosetyadi&theme=dracula)
```

| Param | Default | Values |
|-------|---------|--------|
| `user` | _(required)_ | any GitHub username |
| `theme` | `light` | `light` \| `dark` \| `dracula` |

## What it shows

- **Total contributions** in the last year
- **Current streak** and **longest streak** (consecutive active days)
- **Most productive weekday**
- A compact 6-month heatmap

Cards are edge-cached for 2 hours.

## How it works

The Worker fetches `github.com/users/<user>/contributions` (public, unauthenticated), parses the day cells, computes the stats, and renders an SVG. The parsing, stats, and rendering are pure functions — see `test/run.mjs` (15 assertions, no network).

## Develop

```bash
npm test                               # unit tests (offline)
node test/live.mjs ivosetyadi dark out.svg   # render a real card
npm run deploy                         # wrangler deploy (needs Cloudflare auth)
```

## License

MIT © Ivo Setyadi
