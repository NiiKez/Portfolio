import { describe, expect, it } from 'vitest';

import { isBotUserAgent } from '@/lib/bot-filter';

describe('isBotUserAgent', () => {
  it('does not flag real browser user agents', () => {
    const browsers = [
      // Chrome on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      // Firefox on Linux
      'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
      // Safari on iPhone
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      // Edge on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    ];
    for (const ua of browsers) {
      expect(isBotUserAgent(ua)).toBe(false);
    }
  });

  it('flags crawler / bot user agents', () => {
    const bots = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
      'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
      'Bytespider',
    ];
    for (const ua of bots) {
      expect(isBotUserAgent(ua)).toBe(true);
    }
  });

  it('flags HTTP libraries, CLIs, and headless / automation markers', () => {
    const tools = [
      'curl/8.6.0',
      'Wget/1.21.4',
      'python-requests/2.31.0',
      'Go-http-client/2.0',
      'okhttp/4.12.0',
      'axios/1.6.8',
      'node-fetch/1.0',
      'Java/17.0.2',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/124.0.0.0 Safari/537.36',
    ];
    for (const ua of tools) {
      expect(isBotUserAgent(ua)).toBe(true);
    }
  });

  it('flags named security / recon scanners', () => {
    const scanners = [
      'Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)',
      'fofa',
      'masscan/1.3',
      'Nuclei - Open-source project (github.com/projectdiscovery/nuclei)',
      'sqlmap/1.8',
    ];
    for (const ua of scanners) {
      expect(isBotUserAgent(ua)).toBe(true);
    }
  });

  it('does not flag a missing or empty user agent (positive-match only)', () => {
    expect(isBotUserAgent(null)).toBe(false);
    expect(isBotUserAgent(undefined)).toBe(false);
    expect(isBotUserAgent('')).toBe(false);
  });
});
