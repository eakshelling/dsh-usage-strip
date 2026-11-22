import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addDays,
  buildDays,
  buildModels,
  foldEvents,
  mergeBuckets,
  resolveRange,
  summarize,
} from '../aggregate.js'

const BJ = 8 * 60 * 60 * 1000

/**
 * Epoch milliseconds for one Beijing wall-clock instant.
 * @param year - full year.
 * @param month - 1-based month.
 * @param day - day of month.
 * @param hour - hour.
 * @param minute - minute.
 * @returns epoch milliseconds.
 */
function bj(year, month, day, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute) - BJ
}

/**
 * One assistant message carrying usage.
 * @param time - epoch milliseconds.
 * @param model - provider model id.
 * @param usage - token usage counts.
 * @returns a durable-session-shaped event.
 */
function message(time, model, usage) {
  return {
    type: 'assistant/message',
    seq: 0,
    time,
    data: {
      usage,
      message: { source: { kind: 'model', provider: 'deepseek-account', model } },
    },
  }
}

const PEAK_MONDAY = bj(2026, 11, 16, 10, 0)
const VALLEY_MONDAY = bj(2026, 11, 16, 20, 0)

test('folds usage into separate peak and valley buckets with exact cost', () => {
  const buckets = foldEvents([
    message(PEAK_MONDAY, 'deepseek-flash', { inputTokens: 1000, cacheReadTokens: 2000, outputTokens: 500 }),
    message(VALLEY_MONDAY, 'deepseek-flash', { inputTokens: 1000, cacheReadTokens: 2000, outputTokens: 500 }),
  ])
  assert.equal(buckets.size, 2)
  const totals = summarize(buckets, '2026-11-16', '2026-11-16')
  assert.equal(totals.tokens, 7000)
  assert.equal(totals.requests, 2)
  assert.equal(totals.input, 2000)
  assert.equal(totals.cacheRead, 4000)
  assert.equal(totals.output, 1000)
  assert.equal(totals.cost, 0.00912)
  assert.equal(totals.unpricedTokens, 0)
  assert.ok(Math.abs(totals.cacheHitRate - 4000 / 6000) < 1e-9)
})

test('ignores events without usage and non-assistant events', () => {
  const buckets = foldEvents([
    { type: 'user/message', seq: 0, time: PEAK_MONDAY, data: { content: [] } },
    { type: 'assistant/message', seq: 1, time: PEAK_MONDAY, data: { message: { source: { kind: 'model', provider: 'p', model: 'deepseek-flash' } } } },
    message(PEAK_MONDAY, 'deepseek-flash', {}),
    message(PEAK_MONDAY, 'deepseek-flash', { inputTokens: 10, outputTokens: 5 }),
  ])
  const totals = summarize(buckets, '2026-11-16', '2026-11-16')
  assert.equal(totals.tokens, 15)
  assert.equal(totals.requests, 1)
})

test('prices cache writes as uncached input', () => {
  const buckets = foldEvents([
    message(VALLEY_MONDAY, 'deepseek-flash', { inputTokens: 0, cacheWriteTokens: 1000, outputTokens: 0 }),
  ])
  const totals = summarize(buckets, '2026-11-16', '2026-11-16')
  assert.equal(totals.cost, 0.001)
  assert.equal(totals.tokens, 1000)
})

test('reasoning tokens are not charged twice', () => {
  const buckets = foldEvents([
    message(VALLEY_MONDAY, 'deepseek-flash', { inputTokens: 0, outputTokens: 500, reasoningTokens: 400 }),
  ])
  const totals = summarize(buckets, '2026-11-16', '2026-11-16')
  assert.equal(totals.tokens, 500)
  assert.equal(totals.output, 500)
})

test('unknown models keep tokens but report no cost', () => {
  const buckets = foldEvents([
    message(VALLEY_MONDAY, 'claude-sonnet', { inputTokens: 100, outputTokens: 50 }),
  ])
  const totals = summarize(buckets, '2026-11-16', '2026-11-16')
  assert.equal(totals.tokens, 150)
  assert.equal(totals.cost, 0)
  assert.equal(totals.unpricedTokens, 150)
  const models = buildModels(buckets, '2026-11-16', '2026-11-16')
  assert.equal(models.length, 1)
  assert.equal(models[0].cost, null)
  assert.equal(models[0].family, null)
  assert.equal(models[0].share, 1)
})

test('merging buckets does not mutate the source map', () => {
  const first = foldEvents([message(PEAK_MONDAY, 'deepseek-flash', { inputTokens: 10, outputTokens: 5 })])
  const second = foldEvents([message(PEAK_MONDAY, 'deepseek-flash', { inputTokens: 10, outputTokens: 5 })])
  const target = new Map()
  mergeBuckets(target, first)
  const before = JSON.stringify([...second.values()])
  mergeBuckets(target, second)
  assert.equal(JSON.stringify([...second.values()]), before)
  const totals = summarize(target, '2026-11-16', '2026-11-16')
  assert.equal(totals.tokens, 30)
})

test('buildDays zero-fills the whole range', () => {
  const buckets = foldEvents([message(PEAK_MONDAY, 'deepseek-flash', { inputTokens: 10, outputTokens: 5 })])
  const rows = buildDays(buckets, '2026-11-15', '2026-11-17')
  assert.deepEqual(rows.map(row => row.day), ['2026-11-15', '2026-11-16', '2026-11-17'])
  assert.equal(rows[0].tokens, 0)
  assert.equal(rows[1].tokens, 15)
  assert.equal(rows[2].tokens, 0)
})

test('resolveRange handles windows and all-time caps', () => {
  const buckets = foldEvents([message(bj(2026, 11, 1, 10, 0), 'deepseek-flash', { inputTokens: 1 })])
  const week = resolveRange(buckets, 7, '2026-11-21')
  assert.equal(week.from, '2026-11-15')
  assert.equal(week.to, '2026-11-21')
  assert.equal(week.span, 7)
  const today = resolveRange(buckets, 1, '2026-11-21')
  assert.equal(today.from, '2026-11-21')
  const all = resolveRange(buckets, 0, '2026-11-21')
  assert.equal(all.allFrom, '2026-11-01')
  assert.equal(all.from, '2026-11-01')
  assert.equal(all.truncated, false)
})

test('addDays crosses month boundaries', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})

test('models are sorted by tokens with a share of the total', () => {
  const buckets = foldEvents([
    message(VALLEY_MONDAY, 'deepseek-flash', { inputTokens: 30 }),
    message(VALLEY_MONDAY, 'deepseek-v4-pro', { inputTokens: 10 }),
  ])
  const models = buildModels(buckets, '2026-11-16', '2026-11-16')
  assert.equal(models.length, 2)
  assert.equal(models[0].model, 'deepseek-flash')
  assert.equal(models[0].share, 0.75)
  assert.equal(models[1].share, 0.25)
  assert.equal(typeof models[1].cost, 'number')
})
