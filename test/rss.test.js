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
});
