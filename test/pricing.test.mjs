import test from 'node:test'
import assert from 'node:assert/strict'

import {
  beijingDay,
  currentPricing,
  effectivePrice,
  familyOf,
  isPeakAt,
  nextPeakChangeAt,
  PRICE_CHANGES,
} from '../pricing.js'

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

test('beijingDay uses the UTC+8 calendar day', () => {
  assert.equal(beijingDay(bj(2026, 11, 21, 0, 30)), '2026-11-21')
  assert.equal(beijingDay(bj(2026, 11, 21, 23, 30)), '2026-11-21')
  assert.equal(beijingDay(bj(2026, 11, 22, 0, 0)), '2026-11-22')
})

test('familyOf maps known model ids and rejects unknown ones', () => {
  assert.equal(familyOf('deepseek-flash'), 'flash')
  assert.equal(familyOf('deepseek-v4-flash'), 'flash')
  assert.equal(familyOf('deepseek-v4-flash-vision-exp'), 'flash')
  assert.equal(familyOf('deepseek-v4-pro'), 'pro')
  assert.equal(familyOf('claude-sonnet'), null)
  assert.equal(familyOf(''), null)
})

test('peak boundaries follow Beijing weekday hours', () => {
  const monday = [2026, 11, 16]
  assert.equal(isPeakAt(bj(...monday, 8, 59)), false)
  assert.equal(isPeakAt(bj(...monday, 9, 0)), true)
  assert.equal(isPeakAt(bj(...monday, 11, 59)), true)
  assert.equal(isPeakAt(bj(...monday, 12, 0)), false)
  assert.equal(isPeakAt(bj(...monday, 13, 59)), false)
  assert.equal(isPeakAt(bj(...monday, 14, 0)), true)
  assert.equal(isPeakAt(bj(...monday, 17, 59)), true)
  assert.equal(isPeakAt(bj(...monday, 18, 0)), false)
})

test('weekend valley starts on 2026-08-23', () => {
  assert.equal(isPeakAt(bj(2026, 8, 22, 10, 0)), true)
  assert.equal(isPeakAt(bj(2026, 8, 23, 10, 0)), false)
  assert.equal(isPeakAt(bj(2026, 11, 21, 10, 0)), false)
})

test('statutory holidays are valley after 2026-09-19', () => {
  assert.equal(isPeakAt(bj(2026, 10, 1, 10, 0)), false)
  assert.equal(isPeakAt(bj(2026, 10, 8, 10, 0)), true)
})

test('the peak/off-peak mechanism only applies from 2026-08-17', () => {
  assert.equal(isPeakAt(bj(2026, 8, 14, 10, 0)), false)
  assert.equal(isPeakAt(bj(2026, 8, 17, 10, 0)), true)
})

test('flash prices change on 2026-09-10 while pro stays fixed', () => {
  const before = effectivePrice('2026-09-09', 'flash', false)
  const after = effectivePrice('2026-09-10', 'flash', false)
  assert.deepEqual(before, { hit: 0.05, miss: 1.5, out: 4.5 })
  assert.deepEqual(after, { hit: 0.02, miss: 1, out: 4 })
  assert.deepEqual(effectivePrice('2026-09-09', 'pro', false), effectivePrice('2026-09-10', 'pro', false))
})

test('peak prices double the valley price only after 2026-08-17', () => {
  assert.deepEqual(effectivePrice('2026-08-10', 'flash', true), { hit: 0.05, miss: 1.5, out: 4.5 })
  assert.deepEqual(effectivePrice('2026-09-10', 'flash', true), { hit: 0.04, miss: 2, out: 8 })
  assert.deepEqual(effectivePrice('2026-09-10', 'pro', true), { hit: 0.3, miss: 9, out: 27 })
  assert.equal(effectivePrice('2026-09-10', 'unknown', false), null)
})

test('nextPeakChangeAt finds the next billing boundary', () => {
  assert.equal(nextPeakChangeAt(bj(2026, 11, 16, 8, 0)), bj(2026, 11, 16, 9, 0))
  assert.equal(nextPeakChangeAt(bj(2026, 11, 16, 9, 30)), bj(2026, 11, 16, 12, 0))
  assert.equal(nextPeakChangeAt(bj(2026, 11, 16, 17, 0)), bj(2026, 11, 16, 18, 0))
  assert.equal(nextPeakChangeAt(bj(2026, 11, 20, 18, 30)), bj(2026, 11, 23, 9, 0))
})

test('currentPricing exposes both families and a newest-first timeline', () => {
  const pricing = currentPricing(bj(2026, 11, 21, 12, 0))
  assert.equal(pricing.now.isPeak, false)
  assert.equal(pricing.models.length, 2)
  assert.deepEqual(pricing.models[0].valley, { hit: 0.02, miss: 1, out: 4 })
  assert.deepEqual(pricing.models[1].peak, { hit: 0.3, miss: 9, out: 27 })
  assert.equal(PRICE_CHANGES[0].date, '2026-09-19')
  assert.equal(PRICE_CHANGES.at(-1).date, '2026-08-17')
  assert.equal(pricing.changes[0].title, '法定节假日全天谷价')
  const english = currentPricing(bj(2026, 11, 21, 12, 0), 'en')
  assert.equal(english.changes[0].title, 'Statutory holidays are all-day off-peak')
  assert.ok(english.changes.every(change => change.date && change.title && change.detail))
})
