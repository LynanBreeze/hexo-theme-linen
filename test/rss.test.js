"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");

describe("scripts/rss.js", () => {
  it("generates RFC 822 pubDate, full subpath URLs, omits empty image, and escapes CDATA", () => {
    const hexo = createMockHexo({
      config: {
        title: "Blog & Notes",
        description: "Desc <test>",
        url: "https://example.com/blog",
        root: "/blog/",
        language: "zh-CN",
      },
      themeConfig: { feed: { limit: 5 } },
    });

    loadHexoScript("scripts/rss.js", hexo);
    const out = hexo._generators.rss({
      posts: {
        sort: () => ({
          limit: () => [
            {
              title: "Post <1>",
              subTitle: "Sub",
              path: "2026/post-1/",
              date: new Date("2026-11-26T08:00:00Z"),
              _content: "Hello ]]> <img src=\"/a.jpg\">",
            },
          ],
        }),
      },
    });

    assert.equal(out.path, "/feed.xml");
    assert.ok(!out.data.includes("<image>"), "Should omit <image> without icon");
    assert.ok(out.data.includes("<link>https://example.com/blog/</link>"));
    assert.ok(
      out.data.includes("<link>https://example.com/blog/2026/post-1/</link>"),
      "Subpath must not be duplicated",
    );
    assert.ok(
      out.data.includes("<pubDate>Thu, 26 Nov 2026 08:00:00 GMT</pubDate>"),
      "pubDate must be RFC 822",
    );
    assert.ok(
      out.data.includes("]]]]><![CDATA[>"),
      "CDATA terminator must be escaped",
    );
  });

  it("includes <image> with absolute URL when feed.icon is configured", () => {
    const hexo = createMockHexo({
      config: { url: "https://example.com", root: "/", language: "en" },
      themeConfig: { feed: { icon: "/img/icon.png" } },
    });

    loadHexoScript("scripts/rss.js", hexo);
    const out = hexo._generators.rss({
      posts: { sort: () => ({ limit: () => [] }) },
    });

    assert.ok(out.data.includes("<image>"));
    assert.ok(out.data.includes("<url>https://example.com/img/icon.png</url>"));
  });

  it("filters hidden/unpublished posts, strips switcher labels, and respects theme.config.feed === false", () => {
    const disabledHexo = createMockHexo({
      themeConfig: { feed: false },
    });
    loadHexoScript("scripts/rss.js", disabledHexo);
    assert.equal(disabledHexo._generators.rss, undefined);

    const hexo = createMockHexo({
      config: { url: "https://example.com", root: "/", language: "zh-CN" },
      themeConfig: { feed: { limit: 10 } },
    });
    loadHexoScript("scripts/rss.js", hexo);

    const out = hexo._generators.rss({
      posts: {
        sort: () => ({
          toArray: () => [
            {
              title: "Public",
              path: "2026/public/",
              date: new Date("2026-11-26T08:00:00Z"),
              _content: ":::image-grid switcher\nDay | ![Photo](/day.jpg)\n:::",
            },
            {
              title: "Hidden Archive",
              path: "2026/hidden-a/",
              hide: { archive: true },
              date: new Date("2026-11-25T08:00:00Z"),
              _content: "secret",
            },
            {
              title: "Hidden RSS",
              path: "2026/hidden-r/",
              hide: { rss: true },
              date: new Date("2026-11-24T08:00:00Z"),
              _content: "secret",
            },
            {
              title: "Draft",
              path: "2026/draft/",
              published: false,
              date: new Date("2026-11-23T08:00:00Z"),
              _content: "draft",
            },
          ],
        }),
      },
    });

    assert.ok(out.data.includes("<title>Public</title>"));
    assert.ok(!out.data.includes("Hidden Archive"));
    assert.ok(!out.data.includes("Hidden RSS"));
    assert.ok(!out.data.includes("Draft"));
    assert.ok(!out.data.includes("Day |"));
    assert.ok(out.data.includes("![Photo](/day.jpg)"));
  });

  it("emits Media RSS thumbnail/content/enclosure and prepends cover image to description", () => {
    const hexo = createMockHexo({
      config: {
        title: "Photo Blog",
        url: "https://example.com/blog",
        root: "/blog/",
        language: "zh-CN",
      },
      themeConfig: { feed: { limit: 10 } },
    });
    loadHexoScript("scripts/rss.js", hexo);

    const out = hexo._generators.rss({
      posts: {
        sort: () => ({
          toArray: () => [
            {
              title: "With Cover & Thumb",
              path: "2026/with-both/",
              date: new Date("2026-11-26T08:00:00Z"),
              thumbnail: "/img/thumb.png",
              cover: "/blog/img/cover.webp",
              _content: "Body with <img src=\"/img/inline.jpg\"> and <img src=\"local.jpg\"> and <img src=\"//cdn.example.com/p.png\"> and <img src=\"data:image/gif;base64,R0lGODlh\">",
            },
            {
              title: "With OgImage Only",
              path: "2026/og-only/",
              date: new Date("2026-11-25T08:00:00Z"),
              ogImage: "https://cdn.example.com/og-card?w=1200&q=80",
              _content: "Text only post",
            },
            {
              title: "Already Has Cover",
              path: "2026/dup-cover/",
              date: new Date("2026-11-24T08:00:00Z"),
              cover: "/img/same.jpg",
              _content: "<img src=\"/img/same.jpg\" alt=\"same\"> Hello",
            },
            {
              title: "No Cover",
              path: "2026/no-cover/",
              date: new Date("2026-11-23T08:00:00Z"),
              _content: "Plain text",
            },
          ],
        }),
      },
    });

    assert.ok(
      out.data.includes('<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">'),
      "Should declare Media RSS namespace",
    );

    const items = out.data.match(/<item>[\s\S]*?<\/item>/g) || [];
    assert.equal(items.length, 4);

    // 1. Both thumbnail and cover + inline relative img absolutization
    const [withBoth, ogOnly, dupCover, noCover] = items;
    assert.ok(
      withBoth.includes('<media:thumbnail url="https://example.com/blog/img/thumb.png" />'),
      "media:thumbnail should prefer post.thumbnail",
    );
    assert.ok(
      withBoth.includes(
        '<media:content url="https://example.com/blog/img/cover.webp" medium="image" type="image/webp" />',
      ),
      "media:content should use cover without duplicating subpath root",
    );
    assert.ok(
      withBoth.includes(
        '<enclosure url="https://example.com/blog/img/cover.webp" length="0" type="image/webp" />',
      ),
      "enclosure should use cover and inferred webp MIME type",
    );
    assert.ok(
      withBoth.includes(
        '<description><![CDATA[<p><img src="https://example.com/blog/img/cover.webp" alt="With Cover &amp; Thumb" /></p>\n',
      ),
      "cover image should be prepended to description",
    );
    assert.ok(
      withBoth.includes('src="https://example.com/blog/img/inline.jpg"'),
      "root-relative inline img should be absolutized",
    );
    assert.ok(
      withBoth.includes('src="https://example.com/blog/2026/with-both/local.jpg"'),
      "post-relative inline img should resolve against post URL",
    );
    assert.ok(
      withBoth.includes('src="https://cdn.example.com/p.png"'),
      "protocol-relative inline img should use https",
    );
    assert.ok(
      withBoth.includes('src="data:image/gif;base64,R0lGODlh"'),
      "data URI inline img should stay untouched",
    );

    // 2. ogImage fallback with query string escaping and default image/jpeg MIME
    assert.ok(
      ogOnly.includes(
        '<media:thumbnail url="https://cdn.example.com/og-card?w=1200&amp;q=80" />',
      ),
    );
    assert.ok(
      ogOnly.includes(
        '<enclosure url="https://cdn.example.com/og-card?w=1200&amp;q=80" length="0" type="image/jpeg" />',
      ),
    );
    assert.ok(
      ogOnly.includes(
        '<description><![CDATA[<p><img src="https://cdn.example.com/og-card?w=1200&amp;q=80" alt="With OgImage Only" /></p>\n',
      ),
    );

    // 3. Avoid duplicating cover image when body already starts with it
    const dupMatches =
      dupCover.match(/https:\/\/example\.com\/blog\/img\/same\.jpg/g) || [];
    // 1 in media:thumbnail + 1 in media:content + 1 in enclosure + 1 in body = 4 (not 5)
    assert.equal(dupMatches.length, 4, "Should not duplicate leading cover image in description");

    // 4. Post without cover/thumbnail/ogImage omits media tags
    assert.ok(!noCover.includes("<media:thumbnail"));
    assert.ok(!noCover.includes("<media:content"));
    assert.ok(!noCover.includes("<enclosure"));
    assert.ok(noCover.includes("<description><![CDATA[<p>Plain text</p>]]></description>"));
  });
});
