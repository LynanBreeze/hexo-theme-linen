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

  it("snapshots clean pre-lazyload HTML at after_post_render priority 1.5 with footnotes, MathML, and clean images", () => {
    const { processPost } = require("../scripts/lazyload/process");
    const hexo = createMockHexo({
      config: {
        title: "Full Pipeline",
        url: "https://example.com",
        root: "/",
        language: "zh-CN",
        theme_config: {
          latex: { enable: true },
          lazyload: { enable: true },
          photoswipe: true,
          comment: { client_id: "cid" },
        },
      },
      themeConfig: {
        latex: { enable: true },
        feed: { limit: 10 },
        comment: { client_id: "cid" },
      },
      render: {
        renderSync: ({ text }) => {
          const m = String(text || "").match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
          if (m) return `<p><img src="${m[2]}" alt="${m[1]}"></p>`;
          return `<p>${String(text || "").trim()}</p>`;
        },
      },
    });

    loadHexoScript("scripts/latex.js", hexo);
    loadHexoScript("scripts/markdown-it-image-grid.js", hexo);
    loadHexoScript("scripts/footnote.js", hexo);
    loadHexoScript("scripts/rss.js", hexo);
    loadHexoScript("scripts/custom.js", hexo);
    hexo.extend.filter.register("after_post_render", processPost, 10);

    const post = {
      source: "_posts/pipeline.md",
      path: "2026/pipeline/",
      title: "Pipeline Post",
      date: new Date("2026-11-26T08:00:00Z"),
      content: [
        "公式 $E=mc^2$ 与脚注[^1]。",
        "",
        '<img src="/img/pic.png" alt="示例 $hide-placeholder" data-placeholderimg="blurhash:abc">',
        "",
        ":::image-grid switcher",
        "白天 | ![日景](/img/day.jpg)",
        "夜晚 | ![夜景](/img/night.jpg)",
        ":::",
        "",
        '<iframe src="https://example.com/embed"></iframe>',
        '<figure class="highlight js"><table><tr><td class="code">1</td></tr></table></figure>',
        "",
        "[^1]: 这是脚注内容",
      ].join("\n"),
    };

    const runOrdered = (list) =>
      [...list]
        .sort((a, b) => (a._priority ?? 10) - (b._priority ?? 10))
        .forEach((fn) => fn.call(hexo, post));

    runOrdered(hexo._filters.before_post_render);
    // Simulate markdown rendering wrapping plain text while preserving blocks
    post.content = post.content;
    runOrdered(hexo._filters.after_post_render);

    // Webpage post.content has lazyload wrappers, copy-btn, gitalk-initiator, and full KaTeX HTML
    assert.ok(post.content.includes("lazyload-outer-wrap"));
    assert.ok(post.content.includes("copy-btn"));
    assert.ok(post.content.includes("gitalk-initiator"));
    assert.ok(post.content.includes("katex-html"));

    // RSS output uses priority 1.5 snapshot: clean XML, no lazyload/copy-btn/gitalk/iframe/switcher controls
    const out = hexo._generators.rss({
      posts: { sort: () => ({ toArray: () => [post] }) },
    });
    assert.ok(out.data.includes('id="fn-1"'), "RSS should preserve rendered footnotes");
    assert.ok(out.data.includes("这是脚注内容"));
    assert.ok(out.data.includes("<math "), "RSS should preserve MathML from KaTeX");
    assert.ok(!out.data.includes("katex-html"), "RSS must strip CSS-dependent katex-html");
    assert.ok(!out.data.includes("lazyload-outer-wrap"), "RSS must not include lazyload wrappers");
    assert.ok(!out.data.includes("copy-btn"), "RSS must not include copy-btn");
    assert.ok(!out.data.includes("gitalk-initiator"), "RSS must not include gitalk-initiator");
    assert.ok(!out.data.includes("<iframe"), "RSS must strip iframes");
    assert.ok(!out.data.includes("image-grid-switcher-controls"), "RSS must strip switcher buttons");
    assert.ok(
      !/<span[^>]*\bgrid-item\b[^>]*\baria-hidden="true"/i.test(out.data),
      "RSS switcher images should not stay hidden",
    );
    assert.ok(!out.data.includes("$hide-placeholder"), "RSS must strip lazyload alt directives");
    assert.ok(!out.data.includes("data-placeholderimg"), "RSS must strip placeholder attrs");
    assert.ok(out.data.includes('src="https://example.com/img/pic.png"'));
    assert.ok(out.data.includes('src="https://example.com/img/day.jpg"'));
    assert.ok(out.data.includes('src="https://example.com/img/night.jpg"'));
    assert.ok(
      out.data.includes('</span><br><span class="grid-item"'),
      "Adjacent grid items should be separated by <br> in RSS",
    );
  });

  it("supports follow_challenge, assetDomainMap, Live Photo iframes, shared-link cards, and warm db.json lazyload unwrap", () => {
    const hexo = createMockHexo({
      config: {
        title: "Lynan's Page",
        url: "https://lynan.cn",
        root: "/",
        language: "zh-CN",
      },
      themeConfig: {
        feed: {
          limit: 10,
          icon: "https://r2-assets.thelynan.com/favicon.svg",
          follow_challenge: {
            feedId: "87515885886472192",
            userId: "42003325751014400",
          },
          assetDomainMap: {
            "https://lynan.cn": {
              "https://r2-assets.thelynan.com": "https://r2-assets.lynan.cn",
            },
            "https://cn.thelynan.com": {
              "https://r2-assets.thelynan.com": "https://r2-assets-cn.thelynan.com",
            },
          },
        },
      },
    });
    loadHexoScript("scripts/rss.js", hexo);

    // Simulate a warm db.json cached post (after_post_render did NOT run, only post.content exists with lazyload wrappers)
    const cachedPost = {
      source: "_posts/cached.md",
      path: "cached/",
      title: "Cached Post",
      date: new Date("2026-11-26T08:00:00Z"),
      cover: "https://r2-assets.thelynan.com/u/cover.jpg",
      content: [
        '<p><span class="lazyload-outer-wrap" style="width: 100%;"><a class="gallery-item" href="https://r2-assets.thelynan.com/u/p1.jpg"><noscript><img src="https://r2-assets.thelynan.com/u/p1.jpg" alt="P1"></noscript><span class="lazyload-wrap" data-content="abc"><span class="placeholder"></span></span></a></span></p>',
        '<p><span class="lazyload-outer-wrap" style="width: 100%;"><a class="gallery-item live-photo-gallery-item" data-live-photo-pic-url="https://r2-assets.thelynan.com/u/live.jpg"></a><span class="lazyload-wrap" data-content="xyz"><span class="placeholder"></span></span><noscript>[This iframe content needs to be loaded by JavaScript.]</noscript></span></p>',
        '<iframe src="/static/live-photo/?picUrl=https%3A%2F%2Fr2-assets.thelynan.com%2Fu%2Flive2.jpg"></iframe>',
        '<a href="/other-post/"><div class="shared-link"><div class="link-content"><span class="link-title">Related Guide</span><span class="link-desc">Short summary</span></div></div></a>',
        '<div class="copy-btn"></div><div id="gitalk-initiator"></div>',
      ].join("\n"),
    };

    const out = hexo._generators.rss({
      posts: { sort: () => ({ toArray: () => [cachedPost] }) },
    });

    assert.ok(out.data.includes("<follow_challenge>"));
    assert.ok(out.data.includes("<feedId>87515885886472192</feedId>"));
    assert.ok(out.data.includes("<userId>42003325751014400</userId>"));
    assert.ok(out.data.includes("<url>https://r2-assets.lynan.cn/favicon.svg</url>"));
    assert.ok(out.data.includes('url="https://r2-assets.lynan.cn/u/cover.jpg"'));
    assert.ok(out.data.includes('src="https://r2-assets.lynan.cn/u/p1.jpg"'));
    assert.ok(out.data.includes('src="https://r2-assets.lynan.cn/u/live.jpg"'));
    assert.ok(out.data.includes('src="https://r2-assets.lynan.cn/u/live2.jpg"'));
    assert.ok(!out.data.includes("r2-assets.thelynan.com"), "All asset domains should be rewritten");
    assert.ok(!out.data.includes("lazyload-outer-wrap"), "Cached lazyload wrappers must be unwrapped");
    assert.ok(!out.data.includes("copy-btn"));
    assert.ok(!out.data.includes("gitalk-initiator"));
    assert.ok(
      out.data.includes(
        '<p><a href="https://lynan.cn/other-post/">Related Guide</a><br>Short summary</p>',
      ),
      "Shared link cards should be simplified for RSS readers",
    );
  });
});
