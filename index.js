/**
 * Compatibility entry. The Host implementation lives in `host.js`; this file
 * keeps direct `index.js` imports working for tests and local tooling.
 */

export { apply, buildPayload, parseQuery } from './host.js'
