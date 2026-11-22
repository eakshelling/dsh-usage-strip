/**
 * DeepSeek token pricing, peak/off-peak time rules, and the official
 * price-change timeline.
 *
 * Prices are CNY per 1,000,000 tokens in [cache hit, cache miss, output]
 * order. The official page lists one amount for the idle (valley) period and
 * twice that amount for the peak period; keep the valley amount here and
 * derive the peak amount.
 *
 * Source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing (checked
 * 2026-11-21) and the official changelog entries of 2026-08-13 / 2026-09-10.
 */

export const PRICE_SOURCE_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing'
export const PLATFORM_USAGE_URL = 'https://platform.deepseek.com/usage'

/** Beijing is UTC+8 all year; never apply daylight saving. */
export const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** 2026-08-17 00:00 Beijing: the peak/off-peak mechanism took effect. */
const PEAK_FROM_MS = Date.UTC(2026, 7, 16, 16, 0, 0)
const PEAK_FROM_DAY = '2026-08-17'
/** 2026-08-23 00:00 Beijing: weekends became all-day valley. */
const WEEKEND_VALLEY_FROM_MS = Date.UTC(2026, 7, 22, 16, 0, 0)
/** 2026-09-19 00:00 Beijing: statutory holidays became all-day valley. */
const HOLIDAY_VALLEY_FROM_MS = Date.UTC(2026, 8, 18, 16, 0, 0)

/**
 * Peak windows in Beijing wall-clock hours: [start, end) in hours.
 * Everything outside them is valley time.
 */
const PEAK_HOURS = [[9, 12], [14, 18]]

/**
 * Days off in 2026 (State Council schedule). Only actual days off need listing:
 * make-up working weekends (2026-01-04, 02-14, 02-28, 05-09, 09-20, 10-10)
 * already fall on weekends and are valley under the weekend rule.
 * Refresh this list each November when the next year's schedule is published.
 */
const HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
]
const HOLIDAY_SET = new Set(HOLIDAYS_2026)

/**
 * Effective valley price versions, oldest first. Each entry applies from its
 * date until the next entry starts. Before 2026-08-17 there was no peak/off-peak
 * pricing; this bundle approximates those days with the then-current valley
 * price, which the README calls out as an estimate.
 */
const PRICE_VERSIONS = [
  { from: '1970-01-01', flash: [0.05, 1.5, 4.5], pro: [0.15, 4.5, 13.5] },
  { from: '2026-09-10', flash: [0.02, 1, 4], pro: [0.15, 4.5, 13.5] },
]

/** Official price changes shown in the panel; newest first, localized. */
export const PRICE_CHANGES = [
  {
    date: '2026-09-10',
    zh: {
      title: 'Flash 系列降价',
      detail: '缓存命中 0.05→0.02、未命中 1.5→1、输出 4.5→4（元/百万 tokens，谷时价；峰时为其 2 倍）。Pro 价目不变。',
    },
    en: {
      title: 'Flash price cut',
      detail: 'Cache hit 0.05→0.02, miss 1.5→1, output 4.5→4 (CNY per 1M tokens, off-peak; peak is 2x). Pro prices unchanged.',
    },
  },
  {
    date: '2026-09-19',
    zh: {
      title: '法定节假日全天谷价',
      detail: '中国法定节假日（含调休上班的周末）全天按空闲时段计价。',
    },
    en: {
      title: 'Statutory holidays are all-day off-peak',
      detail: 'Chinese statutory holidays (including make-up working weekends) bill at the off-peak price all day.',
    },
  },
  {
    date: '2026-08-23',
    zh: {
      title: '周末全天按谷价',
      detail: '周六、周日全天按空闲时段计价。',
    },
    en: {
      title: 'Weekends are all-day off-peak',
      detail: 'Saturday and Sunday bill at the off-peak price all day.',
    },
  },
  {
    date: '2026-08-17',
    zh: {
      title: '峰谷定价生效',
      detail: '空闲时段价格为高峰时段的一半；高峰为北京时间工作日 9:00–12:00、14:00–18:00。',
    },
    en: {
      title: 'Peak/off-peak pricing takes effect',
      detail: 'The off-peak price is half the peak price; peak is Beijing weekday 9:00–12:00 and 14:00–18:00.',
    },
  },
].sort((a, b) => (a.date < b.date ? 1 : -1))

/** Label per pricing family. */
export const FAMILY_LABELS = {
  flash: 'DeepSeek Flash',
  pro: 'DeepSeek V4 Pro',
}

/**
 * Map one model id to a pricing family.
 * @param model - provider model id from the assistant message source.
 * @returns 'flash', 'pro', or null when the model has no built-in price.
 */
export function familyOf(model) {
  const value = String(model || '').toLowerCase()
  if (value.includes('pro')) return 'pro'
  if (value.includes('flash')) return 'flash'
  return null
}

/**
 * Format an epoch-millisecond instant as the Beijing calendar day.
 * @param ms - epoch milliseconds.
 * @returns `YYYY-MM-DD` in Beijing time.
 */
export function beijingDay(ms) {
  return new Date(Number(ms) + BEIJING_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * Whether an instant falls in a peak (billed at 2x) period.
 * @param ms - epoch milliseconds.
 * @returns true inside a peak window on an eligible day.
 */
export function isPeakAt(ms) {
  const time = Number(ms)
  if (!Number.isFinite(time) || time < PEAK_FROM_MS) return false
  const local = new Date(time + BEIJING_OFFSET_MS)
  const day = local.toISOString().slice(0, 10)
  const weekday = local.getUTCDay()
  if (time >= WEEKEND_VALLEY_FROM_MS && (weekday === 0 || weekday === 6)) return false
  if (time >= HOLIDAY_VALLEY_FROM_MS && HOLIDAY_SET.has(day)) return false
  const hour = local.getUTCHours()
  return PEAK_HOURS.some(([start, end]) => hour >= start && hour < end)
}

/**
 * Find the next instant at which the peak/off-peak state changes.
 * @param ms - epoch milliseconds to start from.
 * @returns epoch milliseconds of the next boundary, or null when none is found
 *   within 15 days.
 */
export function nextPeakChangeAt(ms) {
  const time = Number(ms)
  if (!Number.isFinite(time)) return null
  const current = isPeakAt(time)
  const dayStart = Math.floor((time + BEIJING_OFFSET_MS) / DAY_MS) * DAY_MS - BEIJING_OFFSET_MS
  for (let offset = 0; offset <= 15; offset += 1) {
    for (const hour of [0, 9, 12, 14, 18]) {
      const candidate = dayStart + offset * DAY_MS + hour * HOUR_MS
      if (candidate <= time + 1) continue
      if (isPeakAt(candidate) !== current) return candidate
    }
  }
  return null
}

/**
 * Select the price version in force for one Beijing day.
 * @param day - `YYYY-MM-DD`.
 * @returns the version record.
 */
function versionFor(day) {
  let selected = PRICE_VERSIONS[0]
  for (const version of PRICE_VERSIONS) {
    if (day >= version.from) selected = version
  }
  return selected
}

/**
 * Price one pricing family for one day and billing period.
 * @param day - Beijing `YYYY-MM-DD` of the billed call.
 * @param family - 'flash', 'pro', or null.
 * @param peak - whether the call happened in a peak period.
 * @returns `{ hit, miss, out }` in CNY per million tokens, or null.
 */
export function effectivePrice(day, family, peak) {
  if (family !== 'flash' && family !== 'pro') return null
  const prices = versionFor(day)[family]
  const multiplier = peak && day >= PEAK_FROM_DAY ? 2 : 1
  return {
    hit: prices[0] * multiplier,
    miss: prices[1] * multiplier,
    out: prices[2] * multiplier,
  }
}

/**
 * Current display data for the panel's price card.
 * @param nowMs - current epoch milliseconds.
 * @param lang - 'zh' or 'en'; unknown values fall back to Chinese.
 * @returns current billing state, per-family prices, and the change timeline.
 */
export function currentPricing(nowMs, lang = 'zh') {
  const day = beijingDay(nowMs)
  const models = ['flash', 'pro'].map(family => ({
    family,
    label: FAMILY_LABELS[family],
    valley: effectivePrice(day, family, false),
    peak: effectivePrice(day, family, true),
  }))
  const language = lang === 'en' ? 'en' : 'zh'
  return {
    now: { isPeak: isPeakAt(nowMs), nextChangeAt: nextPeakChangeAt(nowMs) },
    models,
    changes: PRICE_CHANGES.map(change => ({
      date: change.date,
      title: change[language].title,
      detail: change[language].detail,
    })),
    sourceUrl: PRICE_SOURCE_URL,
  }
}
