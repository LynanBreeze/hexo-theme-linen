"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");

describe("scripts/shared-link.js", () => {
  it("transforms ![$card](/path) (and $shared alias) into internal .shared-link cards and skips code fences/inline code", () => {
    const posts = [
      {
        title: "Kyoto Autumn Notes",
        subTitle: "2024",
        path: "2026/11/kyoto-autumn/",
        slug: "kyoto-autumn",
        source: "_posts/kyoto-autumn.md",
        cover: "/img/kyoto.jpg",
        excerpt: "<p>Maple leaves &amp; &ldquo;quiet&rdquo; temples.</p>",
        content: "",
      },
      {
        title: "无图笔记",
        path: "2026/11/旅行记录/",
        slug: "旅行记录",
        source: "_posts/旅行记录.md",
        excerpt: "<p>一段没有封面的摘要</p>",
        content: "",
      },
      {
        title: "Current Post",
        path: "2026/11/current/",
        slug: "current",
        source: "_posts/current.md",
        content: [
          "Intro with inline `![$card](/2026/11/kyoto-autumn/)` code.",
          "",
          "![$card](/2026/11/kyoto-autumn/)",
          "",
          "![$card](/2026/11/%E6%97%85%E8%A1%8C%E8%AE%B0%E5%BD%95/#day-2)",
          "",
          '![$shared](kyoto-autumn "Custom Title | Custom Summary")',
          "",
          "![$card | Override Only](/about/)",
          "",
          "![$card](/missing-page/)",
          "",
          "```markdown",
          "![$card](/2026/11/kyoto-autumn/)",
          "```",
        ].join("\n"),
      },
    ];
    const pages = [
      {
        title: "About Me",
        path: "about/index.html",
        source: "about/index.md",
        description: "Personal site introduction.",
        content: "",
      },
    ];

    const hexo = createMockHexo({
      config: { root: "/blog/" },
      locals: { posts, pages },
    });
    loadHexoScript("scripts/shared-link.js", hexo);

    const beforePost = hexo._filters.before_post_render[0];
    const afterRenderHtml = hexo._filters["after_render:html"][0];

    const current = posts[2];
    beforePost(current);

    // Code spans and fenced code blocks must stay untouched
    assert.ok(current.content.includes("`![$card](/2026/11/kyoto-autumn/)`"));
    assert.ok(
      current.content.includes("```markdown\n![$card](/2026/11/kyoto-autumn/)\n```"),
    );
    // Non-code directives become placeholders (never raw <img> so lazyload skips them)
    assert.ok(current.content.includes("linen-shared-link-placeholder"));
    assert.ok(!current.content.includes("<img"));

    // Simulate markdown rendering wrapping one placeholder in <p>...</p>
    const renderedHtml = current.content.replace(
      /(<div class="linen-shared-link-placeholder"[^>]*><\/div>)/,
      "<p>$1</p>",
    );

    const outputHtml = afterRenderHtml(renderedHtml);

    assert.ok(!outputHtml.includes("linen-shared-link-placeholder"));
    // 1. Standard internal post card with cover + subTitle + decoded excerpt + /blog/ root
    assert.ok(
      outputHtml.includes(
        '<a href="/blog/2026/11/kyoto-autumn/"><div class="shared-link"><div class="cover-img"><img no-lazy class="not-gallery-item" src="/blog/img/kyoto.jpg" alt="" loading="lazy"></div><div class="link-content"><span class="link-title">Kyoto Autumn Notes <span class="sub-title">2024</span></span><span class="link-desc">Maple leaves &amp; “quiet” temples.</span></div></div></a>',
      ),
    );
    // 2. Percent-encoded CJK path + hash preserved + coverless post omits .cover-img
    assert.ok(
      outputHtml.includes(
        '<a href="/blog/2026/11/旅行记录/#day-2"><div class="shared-link"><div class="link-content"><span class="link-title">无图笔记</span><span class="link-desc">一段没有封面的摘要</span></div></div></a>',
      ),
    );
    // 3. Slug match + custom title & desc override
    assert.ok(
      outputHtml.includes(
        '<span class="link-title">Custom Title</span><span class="link-desc">Custom Summary</span>',
      ),
    );
    // 4. Matches Hexo page + alt pipe title override + page description fallback
    assert.ok(
      outputHtml.includes(
        '<a href="/blog/about/index.html"><div class="shared-link"><div class="link-content"><span class="link-title">Override Only</span><span class="link-desc">Personal site introduction.</span></div></div></a>',
      ),
    );
    // 5. Missing route degrades gracefully without leaving broken markup
    assert.ok(
      outputHtml.includes(
        '<a href="/blog/missing-page/"><div class="shared-link"><div class="link-content"><span class="link-title">missing-page</span></div></div></a>',
      ),
    );
  });

  it("resolves ![$card](/path) placeholders cleanly inside RSS feed generation", () => {
    const targetPost = {
      title: "Guide Post",
      path: "2026/05/guide/",
      source: "_posts/guide.md",
      date: new Date("2026-05-01T00:00:00Z"),
      excerpt: "<p>Guide summary</p>",
      content: "<p>Full guide</p>",
    };
    const referringPost = {
      title: "Referring Post",
      path: "2026/05/ref/",
      source: "_posts/ref.md",
      date: new Date("2026-05-02T00:00:00Z"),
      content: "See also:\n\n![$card](/2026/05/guide/)",
    };

    const hexo = createMockHexo({
      config: { url: "https://example.com", root: "/" },
      locals: { posts: [referringPost, targetPost], pages: [] },
    });
    loadHexoScript("scripts/shared-link.js", hexo);
    loadHexoScript("scripts/rss.js", hexo);

    // Phase 1: before_post_render -> placeholder -> after_post_render snapshot
    hexo._filters.before_post_render.forEach((fn) => fn(referringPost));
    hexo._filters.after_post_render.forEach((fn) => fn(referringPost));

    // Phase 2: RSS generator resolves placeholder and converts card to RSS link
    const rssOut = hexo._generators.rss({
      posts: {
        sort: () => ({
          toArray: () => [referringPost, targetPost],
        }),
      },
      pages: [],
    });
    const xml = rssOut.data;
    assert.ok(!xml.includes("linen-shared-link-placeholder"));
    assert.ok(
      xml.includes(
        '<p><a href="https://example.com/2026/05/guide/">Guide Post</a><br>Guide summary</p>',
      ),
    );
  });
});
