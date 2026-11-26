// One id per browser tab, sent as X-Client-Id so WebSocket events can tell
// this tab apart from the same user's other tabs. crypto.randomUUID is not
// available on plain-HTTP deployments, getRandomValues is.
export const CLIENT_ID = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
  b.toString(16).padStart(2, '0')
).join('');
