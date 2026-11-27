<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <xsl:variable name="title">
      <xsl:value-of select="/rss/channel/title"/>
    </xsl:variable>
    <xsl:variable name="description">
      <xsl:value-of select="/rss/channel/description"/>
    </xsl:variable>
    <xsl:variable name="link">
      <xsl:value-of select="/rss/channel/link"/>
    </xsl:variable>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="color-scheme" content="light dark"/>
        <title><xsl:value-of select="$title"/> — RSS</title>
        <style>
          :root {
            --bg: #fcfbf8;
            --bg-elevated: #ffffff;
            --surface: #f4f2ec;
            --surface-alt: #eae7df;
            --ink: #22211f;
            --ink-muted: #56534e;
            --ink-subtle: #716c64;
            --border: rgba(34, 33, 31, 0.11);
            --border-subtle: rgba(34, 33, 31, 0.07);
            --accent: #a8452e;
            --accent-dark: #8c3623;
            --accent-soft: rgba(168, 69, 46, 0.08);
            --accent-border: rgba(168, 69, 46, 0.28);
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #171614;
              --bg-elevated: #201f1c;
              --surface: #252420;
              --surface-alt: #2e2c27;
              --ink: #e8e5de;
              --ink-muted: #b0aca2;
              --ink-subtle: #969188;
              --border: rgba(232, 229, 222, 0.12);
              --border-subtle: rgba(232, 229, 222, 0.07);
              --accent: #d97757;
              --accent-dark: #e69275;
              --accent-soft: rgba(217, 119, 87, 0.14);
              --accent-border: rgba(217, 119, 87, 0.32);
            }
          }
          *, *::before, *::after { box-sizing: border-box; }
          html {
            background-color: var(--bg);
            color: var(--ink);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.7;
            -webkit-font-smoothing: antialiased;
          }
          body { margin: 0; padding: 0; }
          a { color: var(--accent); text-decoration: none; }
          a:hover { color: var(--accent-dark); text-decoration: underline; text-underline-offset: 0.22em; }
          .page {
            max-width: 820px;
            margin: 0 auto;
            padding: clamp(28px, 5vw, 56px) clamp(18px, 4vw, 32px) 64px;
          }
          .feed-header {
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border);
          }
          .feed-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 10px;
            border-radius: 999px;
            background-color: var(--accent-soft);
            border: 1px solid var(--accent-border);
            color: var(--accent);
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.04em;
            margin-bottom: 14px;
          }
          .feed-title {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(26px, 4vw, 34px);
            font-weight: 700;
            line-height: 1.3;
            letter-spacing: -0.01em;
          }
          .feed-title a { color: var(--ink); }
          .feed-title a:hover { color: var(--accent); text-decoration: none; }
          .feed-desc {
            margin: 10px 0 0;
            font-size: 15.5px;
            color: var(--ink-muted);
          }
          .feed-note {
            margin: 16px 0 0;
            font-size: 13.5px;
            color: var(--ink-subtle);
          }
          .subscribe-bar {
            margin-top: 16px;
            padding: 12px 14px;
            border-radius: 8px;
            background-color: var(--surface);
            border: 1px solid var(--border-subtle);
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            font-size: 13px;
          }
          .subscribe-bar[hidden] { display: none; }
          .subscribe-label { color: var(--ink-muted); margin-right: 4px; }
          .subscribe-pill, .copy-btn {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background-color: var(--bg-elevated);
            color: var(--ink);
            font-size: 12.5px;
            font-weight: 500;
            cursor: pointer;
            font-family: inherit;
            transition: border-color 160ms ease, color 160ms ease, background-color 160ms ease;
          }
          .subscribe-pill:hover, .copy-btn:hover {
            border-color: var(--accent-border);
            color: var(--accent);
            text-decoration: none;
          }
          .entries {
            margin-top: 28px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .entry {
            border: 1px solid var(--border);
            border-radius: 8px;
            background-color: var(--bg-elevated);
            overflow: hidden;
          }
          .entry details summary {
            list-style: none;
            cursor: pointer;
            padding: 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            transition: background-color 160ms ease;
          }
          .entry details summary::-webkit-details-marker { display: none; }
          .entry details summary:hover { background-color: var(--surface); }
          .entry details[open] summary {
            background-color: var(--surface);
            border-bottom: 1px solid var(--border-subtle);
          }
          .entry-title {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 19px;
            font-weight: 700;
            line-height: 1.4;
            color: var(--ink);
          }
          .entry-date {
            font-size: 12.5px;
            color: var(--ink-subtle);
          }
          .entry-body {
            padding: 18px 20px 20px;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 16px;
            line-height: 1.78;
            color: var(--ink);
            overflow-wrap: break-word;
          }
          .entry-body img, .entry-body video { max-width: 100%; height: auto; border-radius: 4px; }
          .entry-body pre {
            overflow-x: auto;
            padding: 12px 14px;
            border-radius: 6px;
            background-color: var(--surface);
            border: 1px solid var(--border-subtle);
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13.5px;
            line-height: 1.55;
          }
          .entry-body blockquote {
            margin: 1em 0;
            padding: 0.2em 1em;
            border-left: 3px solid var(--accent);
            color: var(--ink-muted);
          }
          .entry-body table {
            width: 100%;
            margin: 1.2em 0;
            border-collapse: collapse;
            font-size: 0.92em;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .entry-body th, .entry-body td {
            border: 1px solid var(--border);
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
          }
          .entry-body th { background-color: var(--surface); font-weight: 600; }
          .entry-readmore {
            display: inline-block;
            margin-top: 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 13.5px;
            font-weight: 600;
          }
          .feed-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--border);
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 10px;
            font-size: 13px;
            color: var(--ink-subtle);
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="feed-header">
            <div class="feed-badge">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                <circle cx="6.18" cy="17.82" r="2.18"/>
                <path d="M4 4.44v2.8A12.76 12.76 0 0 1 16.76 20h2.8A15.56 15.56 0 0 0 4 4.44zm0 5.6v2.8A7.16 7.16 0 0 1 11.16 20h2.8A9.96 9.96 0 0 0 4 10.04z"/>
              </svg>
              <span>RSS FEED</span>
            </div>
            <h1 class="feed-title">
              <a href="{$link}" target="_blank" rel="noopener noreferrer">
                <xsl:value-of select="$title" disable-output-escaping="yes"/>
              </a>
            </h1>
            <xsl:if test="string-length(normalize-space($description)) &gt; 0">
              <p class="feed-desc">
                <xsl:value-of select="$description" disable-output-escaping="yes"/>
              </p>
            </xsl:if>
            <p class="feed-note">
              This is the RSS feed for <a href="{$link}" target="_blank" rel="noopener noreferrer"><xsl:value-of select="$title"/></a>. Copy this URL into your RSS reader to subscribe.
            </p>
            <div class="subscribe-bar" id="subscribe-links" hidden="hidden">
              <span class="subscribe-label">Subscribe via:</span>
              <a class="subscribe-pill" data-href="https://feedly.com/i/subscription/feed/" target="_blank" rel="noopener noreferrer">Feedly</a>
              <a class="subscribe-pill" data-href="https://www.inoreader.com/feed/" target="_blank" rel="noopener noreferrer">Inoreader</a>
              <a class="subscribe-pill" data-href="https://www.newsblur.com/?url=" target="_blank" rel="noopener noreferrer">NewsBlur</a>
              <a class="subscribe-pill" data-href="follow://add?url=" rel="noopener noreferrer">Follow</a>
              <a class="subscribe-pill" data-href="feed:" data-raw="true" rel="noopener noreferrer">RSS Reader</a>
              <button type="button" class="copy-btn" id="copy-feed-url">Copy Feed URL</button>
            </div>
            <script>
              document.addEventListener('DOMContentLoaded', function () {
                var url = new URL(location.href);
                var feed = url.searchParams.get('url') || location.href;
                document.querySelectorAll('a[data-href]').forEach(function (a) {
                  var raw = a.getAttribute('data-raw');
                  a.href = a.getAttribute('data-href') + (raw ? feed : encodeURIComponent(feed));
                });
                var bar = document.getElementById('subscribe-links');
                if (bar) bar.removeAttribute('hidden');
                var copyBtn = document.getElementById('copy-feed-url');
                if (copyBtn &amp;&amp; navigator.clipboard) {
                  copyBtn.addEventListener('click', function () {
                    navigator.clipboard.writeText(feed).then(function () {
                      copyBtn.textContent = 'Copied';
                      setTimeout(function () { copyBtn.textContent = 'Copy Feed URL'; }, 1600);
                    });
                  });
                }
              });
            </script>
          </header>

          <section class="entries">
            <xsl:choose>
              <xsl:when test="/rss/channel/item">
                <xsl:for-each select="/rss/channel/item">
                  <article class="entry">
                    <details>
                      <summary>
                        <xsl:if test="title">
                          <h2 class="entry-title">
                            <xsl:value-of select="title" disable-output-escaping="yes"/>
                          </h2>
                        </xsl:if>
                        <xsl:if test="pubDate">
                          <time class="entry-date"><xsl:value-of select="pubDate"/></time>
                        </xsl:if>
                      </summary>
                      <div class="entry-body">
                        <xsl:if test="description">
                          <xsl:value-of select="description" disable-output-escaping="yes"/>
                        </xsl:if>
                        <xsl:if test="link">
                          <div>
                            <a class="entry-readmore" href="{link}" target="_blank" rel="noopener noreferrer">Read More →</a>
                          </div>
                        </xsl:if>
                      </div>
                    </details>
                  </article>
                </xsl:for-each>
              </xsl:when>
              <xsl:when test="/atom:feed/atom:entry">
                <xsl:for-each select="/atom:feed/atom:entry">
                  <article class="entry">
                    <details>
                      <summary>
                        <xsl:if test="atom:title">
                          <h2 class="entry-title">
                            <xsl:value-of select="atom:title" disable-output-escaping="yes"/>
                          </h2>
                        </xsl:if>
                        <xsl:if test="atom:updated">
                          <time class="entry-date"><xsl:value-of select="atom:updated"/></time>
                        </xsl:if>
                      </summary>
                      <div class="entry-body">
                        <xsl:choose>
                          <xsl:when test="atom:summary">
                            <xsl:value-of select="atom:summary" disable-output-escaping="yes"/>
                          </xsl:when>
                          <xsl:when test="atom:content">
                            <xsl:value-of select="atom:content" disable-output-escaping="yes"/>
                          </xsl:when>
                        </xsl:choose>
                        <xsl:if test="atom:link/@href">
                          <div>
                            <a class="entry-readmore" href="{atom:link/@href}" target="_blank" rel="noopener noreferrer">Read More →</a>
                          </div>
                        </xsl:if>
                      </div>
                    </details>
                  </article>
                </xsl:for-each>
              </xsl:when>
            </xsl:choose>
          </section>

          <footer class="feed-footer">
            <span>
              <a href="{$link}" target="_blank" rel="noopener noreferrer"><xsl:value-of select="$title"/></a>
            </span>
            <span>Powered by <a href="https://hexo.io/" target="_blank" rel="noopener noreferrer">Hexo</a> &amp; <a href="https://github.com/LynanBreeze/hexo-theme-linen" target="_blank" rel="noopener noreferrer">Linen</a></span>
          </footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
