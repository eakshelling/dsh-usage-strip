/**
 * Development-only audit: read the persisted JSONL logs directly (splitting
 * concatenated Zstandard frames) and print the same aggregates the Host route
 * serves. Used to cross-check the plugin's numbers without a browser.
 *
 * Run: node test/local-audit.mjs
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

import { buildModels, foldEvents, mergeBuckets, summarize } from '../aggregate.js'
import { beijingDay } from '../pricing.js'

const ZSTD_MAGIC = 0xfd2fb528

/**
 * Split a concatenation of independent Zstandard frames.
 * @param buffer - whole file.
 * @returns one buffer per frame.
 */
function splitFrames(buffer) {
  const frames = []
  let pos = 0
  while (pos + 4 <= buffer.length) {
    if (buffer.readUInt32LE(pos) !== ZSTD_MAGIC) throw new Error(`bad zstd magic at ${pos}`)
    const start = pos
    pos += 4
    const descriptor = buffer[pos]
    pos += 1
    const fcsFlag = descriptor >> 6
    const singleSegment = (descriptor >> 5) & 1
    const checksum = (descriptor >> 2) & 1
    const dictFlag = descriptor & 3
    if (!singleSegment) pos += 1
    pos += [0, 1, 2, 4][dictFlag]
    pos += fcsFlag === 0 ? (singleSegment ? 1 : 0) : [0, 2, 4, 8][fcsFlag]
    for (;;) {
      const header = buffer.readUIntLE(pos, 3)
      pos += 3
      const last = header & 1
      const type = (header >> 1) & 3
      const size = header >>> 3
      if (type === 3) throw new Error('reserved zstd block type')
      pos += size
      if (last) break
    }
    if (checksum) pos += 4
    frames.push(buffer.subarray(start, pos))
  }
  return frames
}

/**
 * Decode one compressed JSONL generation into its header and event rows.
 * @param file - session log path.
 * @returns the header object and event list.
 */
function readGeneration(file) {
  const frames = splitFrames(fs.readFileSync(file))
  const text = Buffer.concat(frames.map(frame => zlib.zstdDecompressSync(frame))).toString('utf8')
  const rows = text.split('\n').filter(Boolean).map(line => JSON.parse(line))
  const [header, ...events] = rows
  return { header, events }
}

/**
 * Latest canonical generation in one session directory.
 * @param directory - session directory.
 * @returns the selected file path.
 */
function latestGeneration(directory) {
  const candidates = fs.readdirSync(directory)
    .map(name => ({ name, match: /^session(?:\.v(\d+))?\.jsonl\.zstd$/.exec(name) }))
    .filter(entry => entry.match !== null)
    .map(entry => ({ name: entry.name, version: Number(entry.match[1] || 0) }))
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.version - a.version)
  return path.join(directory, candidates[0].name)
}

const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const root = path.join(home, 'sessions')
const today = beijingDay(Date.now())
const merged = new Map()
const perSession = []
let sessions = 0
let failed = 0
for (const project of fs.readdirSync(root)) {
  const projectDir = path.join(root, project)
  if (!fs.statSync(projectDir).isDirectory()) continue
  for (const id of fs.readdirSync(projectDir)) {
    const sessionDir = path.join(projectDir, id)
    if (!fs.statSync(sessionDir).isDirectory()) continue
    const file = latestGeneration(sessionDir)
    if (file === null) continue
    try {
      const { events } = readGeneration(file)
      let start = 0
      for (let index = 0; index < events.length; index += 1) {
        if (events[index].type === 'session/end-seed') start = index + 1
      }
      const buckets = foldEvents(events.slice(start))
      mergeBuckets(merged, buckets)
      const totals = summarize(buckets, '1970-01-01', today)
      perSession.push({ id, tokens: totals.tokens, cost: totals.cost, requests: totals.requests })
      sessions += 1
    } catch (error) {
      failed += 1
      console.log(`skip ${id}: ${error.message}`)
    }
  }
}

const todayTotals = summarize(merged, today, today)
const all = summarize(merged, '1970-01-01', today)
console.log(JSON.stringify({
  sessions,
  failed,
  today,
  todayTotals,
  allTotals: all,
  perSession: perSession.sort((a, b) => b.tokens - a.tokens),
  modelsToday: buildModels(merged, today, today),
  modelsAll: buildModels(merged, '1970-01-01', today).slice(0, 10),
}, null, 2))
