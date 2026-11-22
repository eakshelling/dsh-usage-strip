/**
 * Host half of the usage strip bundle.
 *
 * Aggregates provider-reported token usage from every persisted Session in the
 * active profile and serves it as read-only JSON on a loopback-only route.
 * The browser half renders the strip below the composer.
 *
 * No model-visible surface is added: no tool, no prompt section, no Session
 * event, and no file is written.
 */

import {
  addDays,
  buildDays,
  buildModels,
  foldEvents,
  mergeBuckets,
  resolveRange,
  summarize,
} from './aggregate.js'
import {
  PLATFORM_USAGE_URL,
  PRICE_SOURCE_URL,
  beijingDay,
  currentPricing,
} from './pricing.js'

/** Exact route served by this plugin. */
const ROUTE_PATH = '/dsh-usage/api.json'
/** Reuse an aggregate result for this long so polling cannot rescan Sessions. */
const RESULT_TTL_MS = 5_000
/** Events read per slice; keeps one huge log from materializing at once. */
const READ_SLICE = 2_000
/** Days requested by the strip; also the fallback for malformed input. */
const DEFAULT_DAYS = 7
/** Query parameter naming one stored Session. */
const SESSION_PARAM = 'session'
/** Stored Session ids are opaque keys; never used as a path segment. */
const SESSION_RE = /^[A-Za-z0-9._:-]{1,200}$/
/** This package's client-module id, used only for a read-only diagnostic. */
const CLIENT_ID = 'dsh-usage-strip'

/** A requested Session is not in the current persistence scan. */
class UnknownSessionError extends Error {
  /**
   * @param sessionId - the id that was requested.
   */
  constructor(sessionId) {
    super(`dsh-usage: unknown session ${sessionId}`)
    this.name = 'UnknownSessionError'
  }
}

/**
 * Stable JSON response.
 * @param status - HTTP status.
 * @param body - JSON-serializable payload.
 * @returns the Fetch response.
 */
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * Report one failure without paths, credentials, or event content.
 * @param code - stable diagnostic code.
 * @param extra - optional non-sensitive counts.
 */
function report(code, extra) {
  console.error('[dsh-usage]', { code, ...extra })
}

/**
 * Hostname part of one Host/Origin authority.
 * @param authority - `host[:port]` or `[IPv6][:port]`.
 * @returns the lower-cased hostname.
 */
function hostnameOf(authority) {
  const value = String(authority || '')
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end > 0 ? value.slice(1, end).toLowerCase() : ''
  }
  return value.split(':')[0].toLowerCase()
}

/**
 * Whether a request authority names this loopback listener.
 * @param authority - the request `Host` header.
 * @param webServer - the Host's web server service.
 * @returns true when the request reaches the same local listener.
 */
function isLocalAuthority(authority, webServer) {
  const host = hostnameOf(authority)
  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') return true
  const configured = String(webServer?.host || '').toLowerCase()
  return configured !== '' && host === configured
}

/**
 * Read one stored Session's own events and fold them into usage buckets.
 *
 * The read starts at `inheritedEventCount` so a forked Session's inherited
 * prefix is never billed twice; the parent Session reports it.
 *
 * @param persistence - the profile's session persistence service.
 * @param id - stored Session id.
 * @param signal - service lifetime cancellation.
 * @returns the folded buckets for this Session plus its latest turn.
 */
async function readSession(persistence, id, signal) {
  const handle = await persistence.open(id, 'read', { signal })
  const buckets = new Map()
  let turnEvents = []
  try {
    let offset = Number(handle.inheritedEventCount) || 0
    for (;;) {
      if (signal.aborted) throw new Error('dsh-usage: aborted')
      const result = await handle.read(offset, READ_SLICE, { signal })
      const events = result && result.events ? result.events : []
      if (events.length === 0) break
      // A forked/continued Session can carry an inherited prefix terminated by
      // a `session/end-seed` event. Count only the Session's own turns; the
      // handle's inheritedEventCount is not reliable for every generation.
      let own = events
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (events[index] && events[index].type === 'session/end-seed') {
          own = events.slice(index + 1)
          buckets.clear()
          turnEvents = []
          break
        }
      }
      if (own.length > 0) {
        mergeBuckets(buckets, foldEvents(own))
        // Keep only the latest completed/active turn. `turn/start` is the
        // durable boundary; all usage after it belongs to the current turn.
        for (const event of own) {
          if (event.type === 'turn/start') turnEvents = []
          else turnEvents.push(event)
        }
      }
      offset += events.length
      if (events.length < READ_SLICE) break
      await new Promise(resolve => setImmediate(resolve))
    }
  } finally {
    try {
      await handle.close()
    } catch {
      // A close failure must not mask the fold result.
    }
  }
  return { buckets, turn: foldEvents(turnEvents) }
}

/**
 * Parse one aggregate request. Missing or malformed `days` falls back to 7;
 * a malformed `session` is reported instead of being silently ignored.
 * @param url - parsed request URL.
 * @returns normalized query and a bad-session flag.
 */
export function parseQuery(url) {
  const rawDays = url.searchParams.get('days')
  const raw = rawDays === null ? Number.NaN : Number(rawDays)
  const days = raw === 0 ? 0 : raw === 1 || raw === 7 || raw === 30 ? raw : DEFAULT_DAYS
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'zh'
  const rawSession = url.searchParams.get(SESSION_PARAM)
  if (rawSession === null) return { days, lang, sessionId: null, badSession: false }
  const sessionId = rawSession.trim()
  if (!SESSION_RE.test(sessionId)) return { days, lang, sessionId: null, badSession: true }
  return { days, lang, sessionId, badSession: false }
}

/**
 * Build the response payload from one bucket map. Pure apart from the
 * injected client diagnostic, so tests can call it without a Host.
 * @param buckets - merged or single-Session buckets.
 * @param options - days, nowMs, lang, scope, sessionId, sessions, warnings, client, turn.
 * @returns the JSON payload.
 */
export function buildPayload(buckets, options = {}) {
  const days = options.days === undefined ? DEFAULT_DAYS : options.days
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now()
  const lang = options.lang === 'en' ? 'en' : 'zh'
  const scope = options.scope === 'session' ? 'session' : 'all'
  const sessionId = scope === 'session' ? options.sessionId || null : null
  const today = beijingDay(nowMs)
  const range = resolveRange(buckets, days, today)
  const totals = days === 0
    ? summarize(buckets, range.allFrom, range.to)
    : summarize(buckets, range.from, range.to)
  const turnTotals = options.turn instanceof Map && options.turn.size > 0
    ? summarize(options.turn, '1970-01-01', today)
    : null
  const stats = options.sessions || {}
  const total = Number(stats.total)
  const failed = Number(stats.failed)
  return {
    ok: true,
    scope,
    generatedAt: new Date(nowMs).toISOString(),
    timezone: '+08:00',
    today: summarize(buckets, today, today),
    turn: turnTotals === null
      ? null
      : {
        tokens: turnTotals.tokens,
        cost: turnTotals.cost,
        requests: turnTotals.requests,
      },
    sparkline: buildDays(buckets, addDays(today, -6), today)
      .map(row => ({ day: row.day, tokens: row.tokens, cost: row.cost })),
    range: {
      days: range.days,
      from: range.from,
      to: range.to,
      truncated: range.truncated,
      totals,
      series: buildDays(buckets, range.from, range.to),
      models: buildModels(buckets, days === 0 ? range.allFrom : range.from, range.to),
    },
    pricing: currentPricing(nowMs, lang),
    warnings: Array.isArray(options.warnings) ? options.warnings : [],
    meta: {
      scope,
      sessionId,
      sessions: {
        total: Number.isFinite(total) ? total : 0,
        failed: Number.isFinite(failed) ? failed : 0,
      },
      client: options.client || { available: false },
      platformUsageUrl: PLATFORM_USAGE_URL,
      priceSourceUrl: PRICE_SOURCE_URL,
    },
  }
}

/**
 * Build the whole plugin service.
 * @param scope - injected context owning the persistence and web server.
 * @returns service operations plus a disposer.
 */
function createService(scope) {
  const persistence = scope.sessionPersistence
  const controller = new AbortController()
  /** @type {Map<string, {key: string, buckets: Map<string, object>, turn: Map<string, object>}>} */
  let sessionCache = new Map()
  /** @type {Map<string, {at: number, data: object}>} */
  const results = new Map()
  let scanFlight = null
  let lastStats = { total: 0, failed: 0, warnings: [] }
  let disposed = false

  /**
   * Cache key for one stored Session observation.
   * @param snapshot - persistence list snapshot.
   * @returns a key that changes whenever the log may have grown.
   */
  function snapshotKey(snapshot) {
    const seeded = snapshot.header && snapshot.header.isSeeded ? 1 : 0
    return `${snapshot.eventCount ?? '?'}:${snapshot.sizeBytes ?? '?'}:${seeded}`
  }

  /**
   * Scan every stored Session, reading only logs that changed since last time.
   * @returns scan statistics.
   */
  async function scan() {
    if (scanFlight !== null) return scanFlight
    scanFlight = (async () => {
      let snapshots = []
      try {
        snapshots = await persistence.list({})
      } catch (error) {
        report('list-failed', { sessions: 0 })
        throw error
      }
      const next = new Map()
      let failed = 0
      const warnings = []
      for (const snapshot of snapshots) {
        if (disposed) break
        const id = String(snapshot.header && snapshot.header.id)
        const key = snapshotKey(snapshot)
        const previous = sessionCache.get(id)
        if (previous !== undefined && previous.key === key) {
          next.set(id, previous)
          continue
        }
        try {
          const result = await readSession(persistence, id, controller.signal)
          next.set(id, { key, buckets: result.buckets, turn: result.turn })
        } catch (error) {
          failed += 1
          warnings.push('session-read-failed')
          if (previous !== undefined) next.set(id, previous)
        }
      }
      sessionCache = next
      lastStats = { total: snapshots.length, failed, warnings: [...new Set(warnings)] }
      return lastStats
    })().finally(() => {
      scanFlight = null
    })
    return scanFlight
  }

  /**
   * Whether the Host's client-module graph already carries this bundle.
   * Read-only diagnostic: a freshly installed client bundle appears here only
   * after the module registry reconciles, and the open page needs a reload to
   * pick it up.
   * @returns availability and registration state.
   */
  function clientStatus() {
    try {
      const registry = typeof scope.get === 'function' ? scope.get('clientModules') : undefined
      if (registry === undefined || typeof registry.graph !== 'function') return { available: false }
      const graph = registry.graph()
      const entries = graph && Array.isArray(graph.entries) ? graph.entries : []
      const entry = entries.find(row => row && row.id === CLIENT_ID)
      return entry === undefined
        ? { available: true, registered: false }
        : { available: true, registered: true, rev: String(entry.rev || '') }
    } catch {
      return { available: false }
    }
  }

  /**
   * Merge cached Sessions, or select one Session, and answer one window.
   * @param days - 1, 7, 30, or 0 for all time.
   * @param nowMs - current epoch milliseconds.
   * @param lang - 'zh' or 'en', used for the price-change timeline copy.
   * @param sessionId - optional stored Session id.
   * @returns the response payload.
   */
  function build(days, nowMs, lang, sessionId) {
    const requested = sessionId === null || sessionId === undefined ? null : String(sessionId)
    if (requested !== null) {
      const entry = sessionCache.get(requested)
      if (entry === undefined) throw new UnknownSessionError(requested)
      return buildPayload(entry.buckets, {
        days,
        nowMs,
        lang,
        scope: 'session',
        sessionId: requested,
        sessions: { total: 1, failed: 0 },
        warnings: [],
        client: clientStatus(),
        turn: entry.turn,
      })
    }
    const merged = new Map()
    for (const entry of sessionCache.values()) mergeBuckets(merged, entry.buckets)
    return buildPayload(merged, {
      days,
      nowMs,
      lang,
      scope: 'all',
      sessionId: null,
      sessions: lastStats,
      warnings: lastStats.warnings,
      client: clientStatus(),
    })
  }

  /**
   * Read one cached window, rebuilding after the TTL.
   * @param days - requested window.
   * @param lang - 'zh' or 'en'.
   * @param sessionId - optional stored Session id.
   * @returns the response payload.
   */
  async function aggregate(days, lang, sessionId) {
    const key = `${sessionId ?? '*'}:${days}:${lang}`
    const cached = results.get(key)
    if (cached !== undefined && Date.now() - cached.at < RESULT_TTL_MS) return cached.data
    await scan()
    if (sessionId !== null && sessionId !== undefined && !sessionCache.has(sessionId)) {
      throw new UnknownSessionError(sessionId)
    }
    const data = build(days, Date.now(), lang, sessionId)
    results.set(key, { at: Date.now(), data })
    return data
  }

  /**
   * Whether a request may read the aggregate data.
   * @param request - incoming Fetch request.
   * @returns false for a cross-origin, forged-Host, or non-local request.
   */
  function allowed(request) {
    const webServer = scope.webServer
    const authority = request.headers.get('host') || ''
    if (!isLocalAuthority(authority, webServer)) return false
    const origin = request.headers.get('origin')
    if (origin !== null) {
      let parsed
      try {
        parsed = new URL(origin)
      } catch {
        return false
      }
      if (parsed.host !== authority) return false
      const expected = webServer?.protocol === 'https:' ? 'https:' : 'http:'
      if (parsed.protocol !== expected) return false
    }
    const site = request.headers.get('sec-fetch-site')
    if (site !== null && site !== 'same-origin' && site !== 'none') return false
    // The connection service's 403 means a forged Host/Origin; its 401 only
    // means the caller carries no browser cookie, which local tooling does not
    // need for this read-only aggregate.
    try {
      const connection = typeof scope.get === 'function' ? scope.get('connection') : undefined
      if (connection !== undefined && typeof connection.requestRejection === 'function') {
        if (connection.requestRejection({ headers: request.headers }) === 403) return false
      }
    } catch {
      // A missing or failing fence must not expose the route to another origin.
    }
    return true
  }

  /**
   * Handle one HTTP GET/HEAD for the aggregate JSON.
   * @param request - incoming Fetch request.
   * @returns the JSON response.
   */
  async function respond(request) {
    if (!allowed(request)) return json(403, { ok: false, code: 'forbidden' })
    let url
    try {
      url = new URL(request.url)
    } catch {
      return json(400, { ok: false, code: 'bad-request' })
    }
    const query = parseQuery(url)
    if (query.badSession) return json(400, { ok: false, code: 'bad-session' })
    try {
      return json(200, await aggregate(query.days, query.lang, query.sessionId))
    } catch (error) {
      if (error instanceof UnknownSessionError) return json(404, { ok: false, code: 'unknown-session' })
      report('aggregate-failed', { reason: error instanceof Error ? error.name : 'unknown' })
      return json(500, { ok: false, code: 'error' })
    }
  }

  /** Release listeners, timers, and in-flight work. */
  function dispose() {
    disposed = true
    controller.abort()
    results.clear()
    sessionCache = new Map()
  }

  return { respond, dispose }
}

/**
 * Mount the Host half.
 * @param ctx - plugin context.
 */
export function apply(ctx) {
  ctx.inject(['sessionPersistence', 'webServer'], (scope) => {
    const service = createService(scope)
    scope.effect(() => () => {
      service.dispose()
    }, 'dsh-usage: aggregate lifetime')
    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      resource: request => service.respond(request),
    }), 'dsh-usage: aggregate route')
  })
}
