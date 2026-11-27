"use strict";

const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const ejs = require("ejs");
const { ROOT_DIR, createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");

function renderTemplate(relPath, locals) {
  const fullPath = path.join(ROOT_DIR, relPath);
  return ejs.render(fs.readFileSync(fullPath, "utf8"), locals, {
    filename: fullPath,
  });
}

describe("SEO, Date Helper, HoverTexts, ImageGrid & Archive Fixes", () => {
  it("getPageDescription strips HTML tags and share-meta emits canonical + Twitter cards", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/helpers/tools.js", hexo);

    const ctx = {
      page: {
        path: "2026/hello/index.html",
        title: "Hello",
        excerpt: "<p>Intro to <code>Linen</code> &amp; <a href='/x'>Hexo</a>\nline 2</p>",
        cover: "/img/cover.jpg",
        language: "en",
      },
      config: { title: "Linen Blog", language: "en", description: "Fallback" },
      theme: {},
      is_post: () => true,
      is_archive: () => false,
      is_tag: () => false,
      is_category: () => false,
      is_month: () => false,
      is_year: () => false,
      is_home: () => false,
      is_home_first_page: () => false,
      __: (k) => k,
      full_url_for: (p) => `https://example.com/${String(p || "").replace(/^\/+/, "")}`,
    };

    const desc = hexo._helpers.getPageDescription.call(ctx);
    assert.equal(desc, "Intro to Linen & Hexo line 2");

    const html = renderTemplate("layout/partials/share-meta.ejs", {
      ...ctx,
      getPageTitle: () => hexo._helpers.getPageTitle.call(ctx),
      getPageDescription: () => hexo._helpers.getPageDescription.call(ctx),
    });

    assert.ok(html.includes('<link rel="canonical" href="https://example.com/2026/hello/">'));
    assert.ok(html.includes('<meta property="og:url" content="https://example.com/2026/hello/">'));
    assert.ok(html.includes('<meta property="og:description" content="Intro to Linen &amp; Hexo line 2">'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
    assert.ok(html.includes('<meta name="twitter:image" content="https://example.com/img/cover.jpg">'));

    const ldMatch = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    assert.ok(ldMatch, "Post share-meta should emit BlogPosting JSON-LD");
    const postLd = JSON.parse(ldMatch[1]);
    assert.equal(postLd["@type"], "BlogPosting");
    assert.equal(postLd.headline, "Hello");
    assert.equal(postLd.url, "https://example.com/2026/hello/");
    assert.deepEqual(postLd.image, ["https://example.com/img/cover.jpg"]);
    assert.equal(postLd.publisher, undefined, "BlogPosting should not emit invalid Person publisher");

    // CI clone mtime should not inflate dateModified when front-matter omits updated:
    const ciCloneCtx = {
      ...ctx,
      config: { title: "Linen Blog", author: "Lynan", language: "en", description: "Fallback" },
      page: {
        ...ctx.page,
        date: new Date("2025-01-10T00:00:00.000Z"),
        updated: new Date("2026-11-27T00:00:00.000Z"),
        raw: "---\ntitle: Hello\ndate: 2025-01-10\n---\nBody with updated: fake",
      },
    };
    const ciHtml = renderTemplate("layout/partials/share-meta.ejs", {
      ...ciCloneCtx,
      getPageTitle: () => hexo._helpers.getPageTitle.call(ciCloneCtx),
      getPageDescription: () => hexo._helpers.getPageDescription.call(ciCloneCtx),
    });
    const ciLd = JSON.parse(
      ciHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    );
    assert.equal(ciLd.datePublished, "2025-01-10T00:00:00.000Z");
    assert.equal(ciLd.dateModified, "2025-01-10T00:00:00.000Z");
    assert.equal(ciLd.publisher, undefined);
    assert.deepEqual(ciLd.author, { "@type": "Person", name: "Lynan" });

    // Explicit updated: in front-matter should populate dateModified
    const updatedCtx = {
      ...ciCloneCtx,
      page: {
        ...ciCloneCtx.page,
        raw: "---\ntitle: Hello\ndate: 2025-01-10\nupdated: 2026-06-01\n---\nBody",
        updated: new Date("2026-06-01T00:00:00.000Z"),
      },
    };
    const updatedHtml = renderTemplate("layout/partials/share-meta.ejs", {
      ...updatedCtx,
      getPageTitle: () => hexo._helpers.getPageTitle.call(updatedCtx),
      getPageDescription: () => hexo._helpers.getPageDescription.call(updatedCtx),
    });
    const updatedLd = JSON.parse(
      updatedHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    );
    assert.equal(updatedLd.dateModified, "2026-06-01T00:00:00.000Z");

    const homeCtx = {
      ...ctx,
      page: { path: "index.html" },
      is_post: () => false,
      is_home: () => true,
      is_home_first_page: () => true,
    };
    const homeHtml = renderTemplate("layout/partials/share-meta.ejs", {
      ...homeCtx,
      getPageTitle: () => hexo._helpers.getPageTitle.call(homeCtx),
      getPageDescription: () => hexo._helpers.getPageDescription.call(homeCtx),
    });
    const homeLdMatch = homeHtml.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    assert.ok(homeLdMatch, "Home share-meta should emit WebSite JSON-LD");
    assert.equal(JSON.parse(homeLdMatch[1])["@type"], "WebSite");

    // Monthly archive page has both is_month() and is_year() true in Hexo — must not duplicate year
    const monthTitle = hexo._helpers.getPageTitle.call({
      ...ctx,
      page: { month: 5, year: 2026 },
      is_post: () => false,
      is_archive: () => true,
      is_month: () => true,
      is_year: () => true,
    });
    assert.equal(monthTitle, "common.archives: 5/2026");

    // estimateReadingTime skips Hexo highlight .gutter line numbers & empty <pre>
    const gutterHtml =
      '<figure class="highlight js"><table><tr><td class="gutter"><pre>' +
      Array.from({ length: 300 }, (_, i) => i + 1).join("\n") +
      '</pre></td><td class="code"><pre>const x = 1;</pre></td></tr></table></figure><pre>   </pre>';
    assert.equal(
      hexo._helpers.estimateReadingTime.call(ctx, "hello world", 0, gutterHtml),
      1,
      "Line numbers in .gutter must not inflate reading time",
    );

    // extractTocFromHtml supports multiline headings, uppercase tags, single-quoted ids, entity decoding, and skips .hidden
    const toc = hexo._helpers.extractTocFromHtml(
      "<h2 id='to-page-top'>Overview</h2><h2 id='secret' class='hidden'>Skip Me</h2><H2 id='sec-1'>A &lt; B &amp; C\nOne</H2><h3 id=\"sub-1\">Sub</h3>",
    );
    assert.equal(toc.length, 2);
    assert.equal(toc[0].id, "to-page-top");
    assert.equal(toc[1].id, "sec-1");
    assert.equal(toc[1].title, "A < B & C\nOne");
    assert.equal(toc[1].children[0].id, "sub-1");

    // getTranslationPage reads theme.siteOriginLocaleMap and URL-encodes mappingName
    const transCtx = {
      theme: { siteOriginLocaleMap: { en: "https://en.example.com" } },
      config: { language: "zh-CN", root: "/", url: "https://zh.example.com" },
      page: { path: "series/用户指南/", series: "用户指南", seriesInfo: { mappingName: "User Guide" } },
      is_post: () => false,
      is_category: () => false,
      is_tag: () => false,
      url_for: (p) => `/${String(p).replace(/^\/+/, "")}`,
    };
    const trans = hexo._helpers.getTranslationPage.call(transCtx);
    assert.equal(trans.hasTranslatation, true);
    assert.equal(trans.targetLanguagePath, "https://en.example.com/series/User%20Guide/");
  });

  it("getPostDate accepts both post objects and raw date strings/Date values", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/helpers/tools.js", hexo);

    const ctxZh = { page: { language: "zh-CN" }, config: { language: "zh-CN" } };
    const ctxEn = { page: { language: "en" }, config: { language: "en" } };

    assert.equal(
      hexo._helpers.getPostDate.call(ctxZh, { date: "2026-05-03" }),
      "5 月 3 日，2026",
    );
    assert.equal(
      hexo._helpers.getPostDate.call(ctxZh, "2026-05-03"),
      "5 月 3 日，2026",
    );
    assert.equal(
      hexo._helpers.getPostDate.call(ctxEn, new Date("2026-05-03T00:00:00Z")),
      "May 3, 2026",
    );
    // Moment-like objects (Hexo post.date) preserve timezone-aware year/month/date
    const momentLike = {
      format: () => "2026-12-01",
      isValid: () => true,
      year: () => 2026,
      month: () => 11,
      date: () => 1,
    };
    assert.equal(
      hexo._helpers.getPostDate.call(ctxZh, { date: momentLike }),
      "12 月 1 日，2026",
    );
    assert.equal(
      hexo._helpers.getPostDate.call(ctxEn, { date: momentLike }),
      "Dec 1, 2026",
    );
    assert.equal(hexo._helpers.getPostDate.call(ctxZh, "not-a-date"), "");
  });

  it("hoverTexts.js escapes regex metacharacters and HTML attributes safely", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/hoverTexts.js", hexo);
    const filter = hexo._filters.before_post_render[0];

    const data = {
      content: "Use C++ and foo(bar) here. Also C++ again.",
      customComments: [
        { text: "C++", index: 1, comment: 'Say "hi" <script>' },
        { text: "foo(bar)", index: 0, comment: "Call site" },
      ],
    };

    filter.call(hexo, data);
    assert.ok(
      data.content.includes(
        'Use C++ and <span class="commented-text" data-comment="Call site">foo(bar)</span> here. Also <span class="commented-text" data-comment="Say &quot;hi&quot; &lt;script&gt;">C++</span> again.',
      ),
    );

    const protectedData = {
      content: [
        "```js",
        "const token = 'Linen';",
        "```",
        "Inline `Linen` and ![Linen cover](/Linen.jpg) and [link](https://example.com/Linen) and <a title=\"Linen\">real Linen</a>.",
      ].join("\n"),
      customComments: [{ text: "Linen", index: 0, comment: "Theme name" }],
    };
    filter.call(hexo, protectedData);
    assert.ok(protectedData.content.includes("const token = 'Linen';"));
    assert.ok(protectedData.content.includes("`Linen`"));
    assert.ok(protectedData.content.includes("![Linen cover](/Linen.jpg)"));
    assert.ok(protectedData.content.includes("[link](https://example.com/Linen)"));
    assert.ok(
      protectedData.content.includes(
        '<a title="Linen">real <span class="commented-text" data-comment="Theme name">Linen</span></a>',
      ),
    );
  });

  it("markdown-it-image-grid.js prioritizes explicit switcher label and ignores pipes inside image markdown", () => {
    const hexo = createMockHexo({
      render: {
        renderSync: ({ text }) => {
          const m = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
          if (m) return `<p><img src="${m[2]}" alt="${m[1]}"><br /></p>`;
          return `<p>${text}</p>`;
        },
      },
    });
    loadHexoScript("scripts/markdown-it-image-grid.js", hexo);
    const filter = hexo._filters.before_post_render[0];

    const data = {
      content: [
        ":::image-grid switcher",
        "Daytime | ![Mountain Photo](/day.jpg)",
        "![Beijing | Palace](/palace.jpg)",
        ":::",
      ].join("\n"),
    };

    filter.call(hexo, data);
    assert.ok(data.content.includes('data-switch-label="Daytime"'));
    assert.ok(data.content.includes(">Daytime</button>"));
    assert.ok(data.content.includes('src="/palace.jpg"'));
    assert.ok(data.content.includes('data-switch-label="Beijing | Palace"'));
    assert.ok(!data.content.includes("<br"));

    // Must not transform :::image-grid inside fenced code blocks (including inside blockquotes)
    const fencedData = {
      content: [
        "```markdown",
        ":::image-grid",
        "![a](/a.jpg)",
        ":::",
        "```",
        "",
        "> ```markdown",
        "> :::image-grid",
        "> ![q](/q.jpg)",
        "> :::",
        "> ```",
        "",
        ":::image-grid",
        "![b](/b.jpg)",
        ":::",
      ].join("\n"),
    };
    filter.call(hexo, fencedData);
    assert.ok(
      fencedData.content.includes("```markdown\n:::image-grid\n![a](/a.jpg)\n:::\n```"),
      "Fenced code block containing :::image-grid must remain untouched",
    );
    assert.ok(
      fencedData.content.includes("> ```markdown\n> :::image-grid\n> ![q](/q.jpg)\n> :::\n> ```"),
      "Blockquoted fenced code block containing :::image-grid must remain untouched",
    );
    assert.equal(
      (fencedData.content.match(/class="image-grid"/g) || []).length,
      1,
      "Only the real :::image-grid outside code fence should be transformed",
    );
  });

  it("site-info.ejs links to /archives/#archives and archive.ejs uses category.path while filtering hide.archive", () => {
    const sitePosts = [
      {
        title: "Public",
        series: "Travel",
        date: { year: () => 2026 },
        categories: [{ name: "Photo Notes" }],
      },
      {
        title: "Hidden",
        series: "Secret",
        hide: { archive: true },
        date: { year: () => 2026 },
        categories: [{ name: "Hidden Cat" }],
      },
    ];

    const siteInfoHtml = renderTemplate("layout/partials/site-info.ejs", {
      theme: {},
      config: { author: "Lynan" },
      site: {
        posts: {
          filter: (fn) => {
            const arr = sitePosts.filter(fn);
            arr.sort = () => arr;
            return arr;
          },
        },
        categories: { length: 1 },
        tags: { length: 2 },
      },
      is_home_first_page: () => false,
      url_for: (p) => p,
      __: (k) => k,
    });
    assert.ok(siteInfoHtml.includes('href="/archives/#archives"'));
    assert.ok(!siteInfoHtml.includes("/archives/#posts"));
    assert.ok(siteInfoHtml.includes("1 common.series"));

    const archiveHtml = renderTemplate("layout/archive.ejs", {
      site: {
        posts: sitePosts,
        categories: {
          toArray: () => [
            {
              name: "Photo Notes",
              path: "categories/photo-notes/",
              length: 1,
              posts: [sitePosts[0]],
            },
            {
              name: "Hidden Cat",
              path: "categories/hidden-cat/",
              length: 1,
              posts: [sitePosts[1]],
            },
          ],
        },
        tags: {
          toArray: () => [
            {
              name: "PublicTag",
              path: "tags/public-tag/",
              length: 1,
              posts: [sitePosts[0]],
            },
            {
              name: "HiddenTag",
              path: "tags/hidden-tag/",
              length: 1,
              posts: [sitePosts[1]],
            },
          ],
        },
      },
      list_tags: () => "",
      is_year: () => false,
      url_for: (p) => p,
      __: (k) => k,
    });

    assert.ok(archiveHtml.includes('href="/categories/photo-notes/"'));
    assert.ok(!archiveHtml.includes("Hidden Cat"));
    assert.ok(archiveHtml.includes("Travel"));
    assert.ok(!archiveHtml.includes("Secret"));
    assert.ok(archiveHtml.includes('href="/tags/public-tag/">PublicTag</a>'));
    assert.ok(!archiveHtml.includes("HiddenTag"));
  });

  it("layout.ejs links noscript.css in <head> independently of lazyload and noscript.css avoids hardcoded #333", () => {
    const layoutSource = fs.readFileSync(
      path.join(ROOT_DIR, "layout/layout.ejs"),
      "utf8",
    );
    assert.ok(layoutSource.includes("linen-theme/css/noscript.css"));
    assert.ok(!layoutSource.includes('<noscript id="noscript-styles"></noscript>'));

    const noscriptCss = fs.readFileSync(
      path.join(ROOT_DIR, "source/linen-theme/css/noscript.css"),
      "utf8",
    );
    assert.ok(!noscriptCss.includes("color: #333"));
    assert.ok(noscriptCss.includes("#theme-toggle"));
    assert.ok(noscriptCss.includes("#search-toggle"));
  });

  it("font-version.js hashes both letters.txt and site font files and replaces CSS placeholder", () => {
    const os = require("os");
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "linen-fontver-"));
    try {
      fs.mkdirSync(path.join(tmpBase, "custom-scripts/font"), { recursive: true });
      fs.mkdirSync(path.join(tmpBase, "source/linen-theme/fonts"), { recursive: true });
      fs.writeFileSync(path.join(tmpBase, "custom-scripts/font/letters.txt"), "abc");
      fs.writeFileSync(path.join(tmpBase, "source/linen-theme/fonts/a.woff2"), "font-v1");

      const mockHexo = createMockHexo({ base_dir: tmpBase });
      loadHexoScript("scripts/font-version.js", mockHexo);

      mockHexo._filters.before_generate[0]();
      const css1 = mockHexo._filters["after_render:css"][0](
        'url("../fonts/a.woff2?v=__LINEN_FONT_VERSION__")',
      );
      assert.match(css1, /\?v=[a-f0-9]{8}"\)$/);

      fs.writeFileSync(path.join(tmpBase, "source/linen-theme/fonts/a.woff2"), "font-v2");
      mockHexo._filters.before_generate[0]();
      const css2 = mockHexo._filters["after_render:css"][0](
        'url("../fonts/a.woff2?v=__LINEN_FONT_VERSION__")',
      );
      assert.notEqual(css1, css2, "Font file changes should bust version hash");
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
