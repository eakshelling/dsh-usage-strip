/**
 * Pure token-usage aggregation: session events -> buckets -> per-day and
 * per-model views. No I/O, no host services, no clock reads.
 *
 * Buckets are keyed by (Beijing day, provider, model, peak flag) and keep
 * disjoint token counts exactly as the provider reported them:
 * `inputTokens` is uncached input, cache reads/writes are separate, and
 * `outputTokens` already includes reasoning tokens.
 */

import { beijingDay, effectivePrice, familyOf, isPeakAt } from './pricing.js'

const DAY_MS = 24 * 60 * 60 * 1000
const COST_SCALE = 1e6

/**
 * One usage reading as a non-negative integer.
 * @param value - raw provider value.
 * @returns the token count, or 0.
 */
function count(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

/**
 * Round a CNY amount to the ledger precision used by the price list.
 * @param value - unrounded amount.
 * @returns the amount rounded to 6 decimals.
 */
function money(value) {
  return Math.round(value * COST_SCALE) / COST_SCALE
}

/**
 * Format an epoch instant as a Beijing calendar day.
 * @param ms - epoch milliseconds.
 * @returns `YYYY-MM-DD`.
 */
function dayOf(ms) {
  return beijingDay(ms)
}

/**
 * Add whole days to a `YYYY-MM-DD` string.
 * @param day - start day.
 * @param amount - signed day count.
 * @returns the shifted day.
 */
export function addDays(day, amount) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10)
}

/**
 * Fold committed session events into usage buckets.
 *
 * Only `assistant/message` events that carry a provider `usage` report count;
 * a step without usage is not billed and is ignored. The model and provider
 * come from the message source, so a session that mixed routes stays exact.
 *
 * @param events - iterable of durable session events (own events only; callers
 *   must exclude a fork's inherited prefix).
 * @returns a Map of bucket key to bucket value.
 */
export function foldEvents(events) {
  const buckets = new Map()
  for (const event of events) {
    if (!event || event.type !== 'assistant/message') continue
    const data = event.data
    if (!data || typeof data !== 'object') continue
    const usage = data.usage
    if (!usage || typeof usage !== 'object') continue
    const time = Number(event.time)
    if (!Number.isFinite(time)) continue

    const source = data.message && data.message.source
    const model = source && typeof source.model === 'string' ? source.model : ''
    const provider = source && typeof source.provider === 'string' ? source.provider : ''
    const family = familyOf(model)
    const day = dayOf(time)
    const peak = isPeakAt(time)
    const key = `${day}|${provider}|${model}|${peak ? 1 : 0}`

    const input = count(usage.inputTokens)
    const cacheRead = count(usage.cacheReadTokens)
    const cacheWrite = count(usage.cacheWriteTokens)
    const output = count(usage.outputTokens)
    // An empty accounting object carries no billable call; do not let it open a
    // zero-token request row.
    if (input + cacheRead + cacheWrite + output === 0 && count(usage.totalTokens) === 0) continue

    const price = effectivePrice(day, family, peak)
    const cost = price === null
      ? null
      : money((cacheRead / 1e6) * price.hit
        + ((input + cacheWrite) / 1e6) * price.miss
        + (output / 1e6) * price.out)

    let bucket = buckets.get(key)
    if (bucket === undefined) {
      bucket = {
        day,
        model,
        provider,
        family,
        peak,
        input: 0,
        cacheRead: 0,
        cacheWrite: 0,
        output: 0,
        requests: 0,
        cost: 0,
        unpriced: false,
      }
      buckets.set(key, bucket)
    }
    bucket.input += input
    bucket.cacheRead += cacheRead
    bucket.cacheWrite += cacheWrite
    bucket.output += output
    bucket.requests += 1
    if (cost === null) bucket.unpriced = true
    else bucket.cost = money(bucket.cost + cost)
  }
  return buckets
}

/**
 * Merge one bucket map into another in place.
 * @param target - destination map.
 * @param source - buckets to add.
 * @returns the destination map.
 */
export function mergeBuckets(target, source) {
  for (const [key, bucket] of source) {
    const existing = target.get(key)
    if (existing === undefined) {
      target.set(key, {
        ...bucket,
        cost: bucket.cost,
      })
      continue
    }
    existing.input += bucket.input
    existing.cacheRead += bucket.cacheRead
    existing.cacheWrite += bucket.cacheWrite
    existing.output += bucket.output
    existing.requests += bucket.requests
    existing.cost = money(existing.cost + bucket.cost)
    existing.unpriced = existing.unpriced || bucket.unpriced
  }
  return target
}

/**
 * An empty totals record.
 * @returns zeroed counters.
 */
function emptyTotals() {
  return {
    cost: 0,
    tokens: 0,
    input: 0,
    cacheRead: 0,
    cacheWrite: 0,
    output: 0,
    requests: 0,
    unpricedTokens: 0,
    cacheHitRate: 0,
  }
}

/**
 * Add one bucket into a totals record.
 * @param totals - destination totals, mutated.
 * @param bucket - bucket to add.
 */
function accumulate(totals, bucket) {
  const tokens = bucket.input + bucket.cacheRead + bucket.cacheWrite + bucket.output
  totals.tokens += tokens
  totals.input += bucket.input
  totals.cacheRead += bucket.cacheRead
  totals.cacheWrite += bucket.cacheWrite
  totals.output += bucket.output
  totals.requests += bucket.requests
  totals.cost = money(totals.cost + bucket.cost)
  if (bucket.unpriced) totals.unpricedTokens += tokens
}

/**
 * Finalize a totals record with the token-weighted cache hit rate.
 * @param totals - mutated totals.
 * @returns the same record.
 */
function finish(totals) {
  const prompt = totals.input + totals.cacheRead + totals.cacheWrite
  totals.cacheHitRate = prompt === 0 ? 0 : totals.cacheRead / prompt
  return totals
}

/**
 * Whether a bucket falls inside an inclusive day range.
 * @param bucket - bucket to test.
 * @param from - first day.
 * @param to - last day.
 * @returns true when inside.
 */
function inRange(bucket, from, to) {
  return bucket.day >= from && bucket.day <= to
}

/**
 * Build day rows for an inclusive range, zero-filled so the chart keeps a
 * continuous axis.
 * @param buckets - all buckets.
 * @param from - first day.
 * @param to - last day.
 * @returns one row per day.
 */
export function buildDays(buckets, from, to) {
  const rows = new Map()
  for (let day = from; day <= to; day = addDays(day, 1)) {
    rows.set(day, {
      day,
      tokens: 0,
      input: 0,
      cacheRead: 0,
      cacheWrite: 0,
      output: 0,
      requests: 0,
      cost: 0,
      unpricedTokens: 0,
      cacheHitRate: 0,
    })
  }
  for (const bucket of buckets.values()) {
    if (!inRange(bucket, from, to)) continue
    const row = rows.get(bucket.day)
    if (row === undefined) continue
    accumulate(row, bucket)
  }
  for (const row of rows.values()) finish(row)
  return [...rows.values()]
}

/**
 * Build model rows for an inclusive range, sorted by token count.
 * @param buckets - all buckets.
 * @param from - first day.
 * @param to - last day.
 * @returns model rows with share of total tokens.
 */
export function buildModels(buckets, from, to) {
  const rows = new Map()
  let total = 0
  for (const bucket of buckets.values()) {
    if (!inRange(bucket, from, to)) continue
    const key = `${bucket.provider}\u0000${bucket.model}`
    let row = rows.get(key)
    if (row === undefined) {
      row = {
        model: bucket.model || 'unknown',
        provider: bucket.provider,
        family: bucket.family,
        ...emptyTotals(),
      }
      rows.set(key, row)
    }
    accumulate(row, bucket)
    total += bucket.input + bucket.cacheRead + bucket.cacheWrite + bucket.output
  }
  const list = [...rows.values()]
  for (const row of list) {
    finish(row)
    row.share = total === 0 ? 0 : row.tokens / total
    if (row.family === null) row.cost = null
  }
  return list.sort((a, b) => b.tokens - a.tokens || a.model.localeCompare(b.model))
}

/**
 * Summarize an inclusive range.
 * @param buckets - all buckets.
 * @param from - first day.
 * @param to - last day.
 * @returns totals for the range.
 */
export function summarize(buckets, from, to) {
  const totals = emptyTotals()
  for (const bucket of buckets.values()) {
    if (!inRange(bucket, from, to)) continue
    accumulate(totals, bucket)
  }
  return finish(totals)
}

/**
 * Resolve the inclusive range for a requested window.
 * @param buckets - all buckets, used to find the first recorded day.
 * @param days - 1, 7, 30, or 0 for all time.
 * @param today - the current Beijing day.
 * @param maxSeriesDays - cap on the returned series length (default 366).
 * @returns the range, the range length in days, and whether the series is capped.
 */
export function resolveRange(buckets, days, today, maxSeriesDays = 366) {
  if (days === 0) {
    let first = today
    for (const bucket of buckets.values()) {
      if (bucket.day < first) first = bucket.day
    }
    let from = first
    let truncated = false
    let span = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / DAY_MS) + 1
    if (span > maxSeriesDays) {
      from = addDays(today, -(maxSeriesDays - 1))
      span = maxSeriesDays
      truncated = true
    }
    return { days: 0, from, to: today, allFrom: first, span, truncated }
  }
  const window = days === 1 || days === 7 || days === 30 ? days : 7
  const from = addDays(today, -(window - 1))
  return { days: window, from, to: today, allFrom: from, span: window, truncated: false }
}
