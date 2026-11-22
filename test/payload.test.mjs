import test from 'node:test'
import assert from 'node:assert/strict'

import { foldEvents } from '../aggregate.js'
import { buildPayload, parseQuery } from '../index.js'

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

const NOW = bj(2026, 11, 16, 10, 30)

/**
 * URL for a query string.
 * @param value - query string without `?`, or an empty string.
 * @returns a parsed URL.
 */
function url(value) {
  return new URL(`http://127.0.0.1:64090/dsh-usage/api.json${value ? `?${value}` : ''}`)
}

test('parseQuery defaults days, language, and scope', () => {
  assert.deepEqual(parseQuery(url('')), { days: 7, lang: 'zh', sessionId: null, badSession: false })
  assert.deepEqual(parseQuery(url('days=30&lang=en')), { days: 30, lang: 'en', sessionId: null, badSession: false })
})

test('parseQuery keeps a valid session id and rejects a malformed one', () => {
  assert.deepEqual(parseQuery(url('days=0&session=abc-123')), { days: 0, lang: 'zh', sessionId: 'abc-123', badSession: false })
  assert.equal(parseQuery(url('session=..%2Fetc')).badSession, true)
  assert.equal(parseQuery(url(`session=${'x'.repeat(201)}`)).badSession, true)
})

test('parseQuery maps an unknown days value to the default', () => {
  assert.equal(parseQuery(url('days=99')).days, 7)
  assert.equal(parseQuery(url('days=-1')).days, 7)
})

test('buildPayload scopes totals and metadata to one session', () => {
  const buckets = foldEvents([
    message(NOW, 'deepseek-flash', { inputTokens: 1000, cacheReadTokens: 2000, outputTokens: 500 }),
  ])
  const data = buildPayload(buckets, {
    days: 0,
    nowMs: NOW,
    lang: 'zh',
    scope: 'session',
    sessionId: 'abc-123',
    sessions: { total: 1, failed: 0 },
  })
  assert.equal(data.ok, true)
  assert.equal(data.scope, 'session')
  assert.equal(data.meta.scope, 'session')
  assert.equal(data.meta.sessionId, 'abc-123')
  assert.deepEqual(data.meta.sessions, { total: 1, failed: 0 })
  assert.equal(data.range.totals.tokens, 3500)
  assert.equal(data.range.totals.requests, 1)
  assert.ok(data.range.totals.cost > 0)
  assert.equal(data.today.tokens, 3500)
})

test('buildPayload reports the latest turn separately', () => {
  const buckets = foldEvents([
    message(NOW, 'deepseek-flash', { inputTokens: 1000, cacheReadTokens: 2000, outputTokens: 500 }),
    message(NOW + 60_000, 'deepseek-flash', { inputTokens: 200, cacheReadTokens: 800, outputTokens: 100 }),
  ])
  const turn = foldEvents([
    message(NOW + 60_000, 'deepseek-flash', { inputTokens: 200, cacheReadTokens: 800, outputTokens: 100 }),
  ])
  const data = buildPayload(buckets, {
    days: 0,
    nowMs: NOW + 60_000,
    lang: 'zh',
    scope: 'session',
    sessionId: 'abc-123',
    turn,
  })
  assert.equal(data.turn.tokens, 1100)
  assert.equal(data.turn.requests, 1)
  assert.ok(data.turn.cost > 0)
})

test('buildPayload keeps all-session scope and zeroes a missing session id', () => {
  const data = buildPayload(new Map(), {
    days: 7,
    nowMs: NOW,
    lang: 'en',
    scope: 'all',
    sessions: { total: 12, failed: 1 },
    warnings: ['one'],
  })
  assert.equal(data.scope, 'all')
  assert.equal(data.meta.sessionId, null)
  assert.deepEqual(data.meta.sessions, { total: 12, failed: 1 })
  assert.deepEqual(data.warnings, ['one'])
  assert.equal(data.range.totals.tokens, 0)
  assert.equal(typeof data.pricing.now.isPeak, 'boolean')
})
