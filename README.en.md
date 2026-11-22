# Usage & Cost (DSH plugin)

[中文](README.md) · [MIT License](LICENSE) · [GitHub](https://github.com/Eakshell/dsh-usage-strip) · [npm](https://www.npmjs.com/package/dsh-usage-strip)

A compact usage strip below the DSH Web composer. By default it shows **`total ≈¥… today … tok ≈¥…`**: total is this chat's cumulative estimated cost, today is this chat's token count and estimated cost for the current Beijing calendar day. Click it for a panel that mirrors the [DeepSeek Platform usage page](https://platform.deepseek.com/usage): daily trend, per-model breakdown, cache hit / miss / output composition, request count, and token price changes (current peak/valley rates, next switch, official price-change timeline).

The plugin only reads locally persisted DSH session logs. It makes no network requests, requires no login, and uploads nothing. Costs are estimates based on official prices, not an official bill; the project is not affiliated with DeepSeek.

## Features

- **Compact strip**: when a chat is selected it shows `total ≈¥1.46 today 23.4K tok ≈¥0.03` with a 7-day mini bar chart; refreshes every 30 seconds and when the page becomes visible. With no selected chat it shows the global `today …`.
- **Detail panel** (click the strip):
  - Scope: this chat / all local sessions; this chat defaults to all-time, all sessions defaults to the last 7 days;
  - Range: today / last 7 days / last 30 days / all;
  - For this chat + all-time, two cards side by side: **built-in reading** (DSH's built-in token count + an estimate at current peak/valley rates weighted by the log's model mix) and **exact log cost** (per-event official prices, requests, cache hit rate, plus today's cost);
  - KPI row: estimated cost, total tokens, requests, token-weighted cache hit rate;
  - Token composition (cache read / uncached input / output);
  - Daily stacked usage + cost or effective unit-price curve (toggle; unit price = daily cost ÷ tokens × 1M, so it reflects peak/valley and official changes);
  - Per-model table (requests, hit, miss, output, total, cost, share);
  - Price card: current period and next switch, Flash / Pro valley and peak rates, official change timeline.
- Theme and language follow DSH; no external dependencies and no build step.

## Data

| Item | Definition |
|---|---|
| Source | Cost, daily/model detail, and the strip's total/today come from `assistant/message.usage` in locally persisted DSH session logs (provider-reported values). The panel's “built-in reading” for this chat + all-time uses DSH's `tokenUsage` projection (same source as the built-in usage pill). |
| Scope | Current chat by default; the panel can switch to all saved local sessions (including subagent sessions). Excludes other clients, API keys, and the website. |
| Day boundary | Beijing time (UTC+8). |
| Tokens | The built-in reading sums `uncachedInputTokens + cacheReadTokens + cacheWriteTokens + outputTokens` (reasoning is included once); the strip and 7/30-day ranges use log totals. |
| Today | This chat's `assistant/message.usage` total for today (Beijing time); resets at midnight. |
| Built-in estimate | Built-in token count × current peak/valley rate and log model shares; does not backfill historical price changes; only for this chat + all-time. |
| Exact cost | Each log event priced at the official rates for its event day; not an official bill. |
| Peak/valley | Beijing weekdays 09:00–12:00 and 14:00–18:00 are peak (2× price), effective 2026-08-17; weekends are all-valley from 2026-08-23; statutory holidays are all-valley from 2026-09-19. |
| Forked sessions | Reads from `inheritedEventCount` and skips the inherited `session/end-seed` prefix, so parent history is not billed twice. |

## Install

Install from the DSH plugin market by searching for `dsh-usage-strip`. The npm package is [`dsh-usage-strip`](https://www.npmjs.com/package/dsh-usage-strip), version `1.3.0`.

For local development, install this directory with `plugin_manager`'s `install_bundle` (absolute path), or use **Plugins → Add plugin** and select the directory, then enable it.

Refresh the page after installing; restart DSH if the client bundle does not load. The plugin row id is `dsh-usage-strip`.

## Price maintenance

Prices and holidays live in [`pricing.js`](pricing.js):

- `PRICE_VERSIONS`: valley rates by effective date; peak is automatically 2×;
- `PRICE_CHANGES`: official change timeline shown in the panel;
- `HOLIDAYS_2026`: statutory holidays (all-valley); add the next year after the State Council publishes it.

Official source: <https://api-docs.deepseek.com/zh-cn/quick_start/pricing>.

## Limitations

- Only local DSH sessions are counted; other clients are not covered. Cost is an estimate, not a platform bill.
- The strip appears only below the composer of a selected chat; the empty home screen shows nothing.
- This chat's panel defaults to all-time: everything persisted for that session. A brand-new session that has not been persisted shows “this chat is being measured…” and does not fall back to all-session numbers.
- The strip's “today” is this chat's usage today (Beijing time); with no usage today it shows 0 while total cost still renders.
- The all-time chart draws only the most recent 90 days; KPI and model totals still cover all time.
- Before 2026-08-17 there was no peak/valley pricing; historical cost uses the valley rate as an approximation.
- Forked sessions skip inherited parent history; if the parent log was deleted, that part is undercounted.
- The first scan of a large local log set may take a moment; afterwards only changed sessions are reread.
- The HTTP route binds to loopback and checks same-origin; other local processes can still read aggregate usage data (never credentials).
- No session events are appended, no files are written, and no model-visible content is added (no tool, no prompt section).

## Privacy & disclaimer

- Reads local persisted session logs only; no network, no uploads, no writes to sessions, no model-visible additions.
- Costs are estimated from official prices, not an official bill; not affiliated with DeepSeek.
- The route listens on loopback only and checks same-origin; other local processes can read aggregates (no credentials).
- No telemetry or third-party tracking.

## Development & tests

```powershell
node --check host.js
node --check client.js
node --check aggregate.js
node --check pricing.js
node test/pricing.test.mjs
node test/aggregate.test.mjs
node test/payload.test.mjs
node test/local-audit.mjs   # reads local session logs to cross-check aggregates (development)
```

API: `GET /dsh-usage/api.json?days=1|7|30|0[&session=<id>]` (loopback-only, same-origin, read-only). Without `session` it covers all sessions; with `session` it covers that session only; unknown ids return 404.

## Files

| File | Purpose |
|---|---|
| `host.js` | Host half: session reading, aggregation, HTTP route |
| `index.js` | Compatibility entry re-exporting `host.js` |
| `aggregate.js` | Pure functions: event folding, buckets, range summaries |
| `pricing.js` | Price versions, peak/valley/holiday rules, change timeline |
| `client.js` | Browser half: strip, panel, charts, styles, dictionaries |
| `locale/*.json` | Plugin-manager metadata and detail-document entry |
| `icon.svg` / `assets/icon-180.png` | Plugin icon; PNG for the market listing |
| `LICENSE` | MIT license |
| `README.md` / `README.en.md` | Chinese / English documentation |

## License

[MIT](LICENSE) © 2026 Eakshell
