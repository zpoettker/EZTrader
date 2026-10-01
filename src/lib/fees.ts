// Round-trip fee per contract, keyed by product (e.g. MNQ). Tradovate exports
// don't include fees, so they're entered by the user and remembered per browser.
const FEES_KEY = 'eztrader:fees-per-contract'

export type FeeMap = Record<string, string>

export function loadFees(): FeeMap {
  try {
    return JSON.parse(localStorage.getItem(FEES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveFees(fees: FeeMap) {
  try {
    localStorage.setItem(FEES_KEY, JSON.stringify(fees))
  } catch {}
}
