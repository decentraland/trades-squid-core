const SHARED_PORTAL_HOST = 'https://shared.portal.sqd.dev'
const PUBLIC_PORTAL_HOST = 'https://portal.sqd.dev'

/**
 * The SQD Network Portal stream this squid ingests from.
 *
 * Prefers the SHARED portal over the public one. The shared endpoint is authenticated and raises
 * the per-query size cap (the public one rejects anything over 256 KiB with `400 Query is too
 * large`, which is what stalled the marketplace squid's Polygon reindex). This squid's filters are
 * small, so the cap is not the reason here — the shared endpoint is simply the one with capacity:
 * the public stream intermittently answers `503 No available workers to serve the request`.
 *
 * Falls back to the public endpoint when no key is configured, so a deployment whose environment
 * does not map the key yet keeps ingesting instead of crash-looping on boot. Once
 * `SQD_PORTAL_API_KEY` is wired for every trades service, that branch is dead code and can go.
 *
 * The host is overridable because this endpoint has already moved once: a replacement should not
 * require shipping new code. The key is env-only and must never be committed.
 */
export function portalSource(dataset: string): {
  url: string
  http: { headers?: Record<string, string>; retryAttempts: number }
} {
  // Only SQD_PORTAL_API_KEY authenticates the shared endpoint.
  //
  // SQUID_API_KEY is deliberately NOT read here. It carries the key for a different SQD product (the
  // v2 archive), and only held a Portal key while both shared one variable. Reading it as a fallback
  // is what took this squid down on its first deploy: the environment did not define the Portal key
  // yet, so the fallback found the archive key, concluded a key was available, sent it to the shared
  // endpoint and got `403` on every batch — a crash loop. With no key at all the public endpoint
  // would have served the same data unauthenticated, so guessing was worse than not guessing.
  const apiKey = process.env.SQD_PORTAL_API_KEY
  const host = process.env.SQD_PORTAL_URL || (apiKey ? SHARED_PORTAL_HOST : PUBLIC_PORTAL_HOST)

  if (!apiKey) {
    console.log(
      '[portal] No SQD_PORTAL_API_KEY set: falling back to the public Portal endpoint, which is rate limited and caps queries at 256 KiB'
    )
  }

  return {
    url: `${host}/datasets/${dataset}`,
    http: {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- HTTP header name
      ...(apiKey ? { headers: { 'x-api-key': apiKey } } : {}),
      // Portal answers a transient 503 when no worker is free; retrying forever keeps the
      // processor alive across those instead of exiting and relying on the container restart.
      //
      // Needs portal-client >= 0.7.0, which is why it is pinned as a direct dependency. Before
      // that, `request()` resolved this as `options.retryAttempts ?? 6` against the PER-REQUEST
      // options, so the client-level value never reached it: the option looked set and the real
      // budget was six attempts.
      retryAttempts: Infinity
    }
  }
}
