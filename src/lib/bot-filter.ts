/**
 * User-agent based bot / scanner filter for the page-view ingest.
 *
 * The beacon fires from real navigations, but automated crawlers, SEO bots,
 * uptime monitors, and security/recon scanners (the sort that find any public
 * host within minutes and probe it — the `fofa.info`-referrer noise) execute
 * enough JS to trip it too. Dropping a request whose User-Agent self-identifies
 * as one of these keeps the admin traffic counts to organic human visits.
 *
 * Deliberately CONSERVATIVE and positive-match only: a request is dropped solely
 * when its UA contains an unambiguous non-human token. A normal browser UA
 * (Chrome/Firefox/Safari/Edge) matches none of these, so a real visitor is never
 * dropped — and a missing UA is NOT treated as a bot, for the same reason (far
 * better to over-count a rare empty-UA visitor than to silently lose one).
 */

// Substrings that only ever appear in non-human user agents: generic crawler
// words, HTTP libraries / CLIs, headless-browser + automation markers, and named
// security / recon / SEO scanners. Matched case-insensitively against the raw UA.
// Short, otherwise-common tokens (`curl`) are word-bounded to avoid matching a
// substring inside a real browser UA.
const BOT_UA_PATTERN =
  /bot\b|crawl|spider|scrape|slurp|headless|phantomjs|puppeteer|playwright|selenium|\bcurl\b|wget|python-requests|aiohttp|httpx|go-http-client|okhttp|java\/|libwww|lwp::|guzzle|axios\/|node-fetch|got \(|masscan|zgrab|nmap|nuclei|sqlmap|nikto|wpscan|fofa|censys|shodan|zmap|semrush|ahrefs|bytespider|dataforseo|uptime|pingdom|statuscake|monitoring/i;

/**
 * Whether a request User-Agent self-identifies as a bot / crawler / scanner and
 * so should not count as a page view. Returns `false` for a missing or empty UA
 * (see module doc: only a positive token match drops a request).
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_PATTERN.test(userAgent);
}
