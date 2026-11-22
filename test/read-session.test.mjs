import assert from 'node:assert/strict'
import test from 'node:test'

import { readSession } from '../host.js'
import { summarize } from '../aggregate.js'

const DAY = '2026-11-22'
const TIME = Date.parse('2026-11-22T10:00:00+08:00')

function usageEvent(tokens, model = 'deepseek-flash') {
  return {
    type: 'assistant/message',
    time: TIME,
    data: {
      usage: {
        inputTokens: tokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
      },
      message: { source: { provider: 'deepseek-account', model } },
    },
  }
}

function persistenceFor(events, inheritedEventCount) {
  return {
    async open() {
      return {
        inheritedEventCount,
        async read(offset, length) {
          return { events: events.slice(offset, offset + length) }
        },
        async close() {},
      }
    },
  }
}

const noLog = () => {}

test('reads from zero and drops the inherited seed prefix', async () => {
  const events = [
    usageEvent(10),
    usageEvent(20),
    { type: 'session/end-seed' },
    usageEvent(5),
    usageEvent(7),
  ]
  const result = await readSession(
    persistenceFor(events, 3),
    'session-test',
    new AbortController().signal,
    noLog,
  )
  assert.equal(summarize(result.buckets, '1970-01-01', DAY).tokens, 12)
  assert.equal(summarize(result.turn, '1970-01-01', DAY).tokens, 12)
})

test('without a seed, inheritedEventCount is not used as a start offset', async () => {
  const events = [usageEvent(10), usageEvent(20)]
  const result = await readSession(
    persistenceFor(events, 1),
    'session-test',
    new AbortController().signal,
    noLog,
  )
  assert.equal(summarize(result.buckets, '1970-01-01', DAY).tokens, 30)
})

test('seed in the first read slice excludes earlier slices', async () => {
  const events = Array.from({ length: 1999 }, () => ({ type: 'noop' }))
  events.push({ type: 'session/end-seed' })
  events.push(usageEvent(9))
  const result = await readSession(
    persistenceFor(events, 2000),
    'session-test',
    new AbortController().signal,
    noLog,
  )
  assert.equal(summarize(result.buckets, '1970-01-01', DAY).tokens, 9)
})

test('the latest turn starts at the last turn/start', async () => {
  const events = [
    usageEvent(10),
    { type: 'turn/start' },
    usageEvent(20),
    { type: 'turn/start' },
    usageEvent(30),
  ]
  const result = await readSession(
    persistenceFor(events, 0),
    'session-test',
    new AbortController().signal,
    noLog,
  )
  assert.equal(summarize(result.turn, '1970-01-01', DAY).tokens, 30)
})
