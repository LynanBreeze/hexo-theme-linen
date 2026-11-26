"use strict";

const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const ejs = require("ejs");
const sass = require("sass");
const { ROOT_DIR, createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");

function renderTemplate(relPath, locals) {
  const fullPath = path.join(ROOT_DIR, relPath);
  return ejs.render(fs.readFileSync(fullPath, "utf8"), locals, {
    filename: fullPath,
  });
}

function makeUrlFor(root = "/") {
  const normalizedRoot = root.endsWith("/") ? root : `${root}/`;
  return (p) => {
    const str = String(p || "");
    if (/^https?:\/\//i.test(str)) return str;
    return `${normalizedRoot}${str.replace(/^\/+/, "")}`;
  };
}

describe("Template Bugfixes & Refactors", () => {
  it("words.ejs counts English/Chinese words accurately, falls back to plain <img>, and formats cleanly", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/helpers/tools.js", hexo);
    const estimateReadingTime = hexo._helpers.estimateReadingTime;

    const zhDict = {
      "common.approximately": "约",
      "common.words": "个字",
      "common.photos": "张图片",
      "common.photo": "张图片",
      "common.minsRead": "分钟阅读",
    };
    const enDict = {
      "common.approximately": "About",
      "common.words": "Words",
      "common.photos": "Photos",
      "common.photo": "Photo",
      "common.minsRead": "min read",
    };

    const enHtml = renderTemplate("layout/partials/words.ejs", {
      post: {
        content:
          '<p>Hello   world\nfrom   Linen!</p><img src="/a.jpg"><img src="/b.jpg"><img class="linen-emoji" src="/e.svg">',
      },
      page: { language: "en" },
      config: { language: "en" },
      count: true,
      readTime: true,
      __: (k) => enDict[k] || k,
      estimateReadingTime,
    }).trim();

    assert.equal(enHtml, "<span>About 1 min read</span> <small>(4 Words, 2 Photos)</small>");

    const zhHtml = renderTemplate("layout/partials/words.ejs", {
      post: {
        content:
          '<p>你好 世界</p><a class="gallery-item" href="/1.jpg"><img src="/1.jpg"></a>',
      },
      page: { language: "zh-CN" },
      config: { language: "zh-CN" },
      count: true,
      readTime: true,
      __: (k) => zhDict[k] || k,
      estimateReadingTime,
    }).trim();

    assert.equal(zhHtml, "<span>约 1 分钟阅读</span> <small>(4 个字，1 张图片)</small>");

    const photoOnlyHtml = renderTemplate("layout/partials/words.ejs", {
      post: {
        content: '<img src="/1.jpg"><img src="/2.jpg">',
      },
      page: { language: "en" },
      config: { language: "en" },
      count: true,
      readTime: true,
      __: (k) => enDict[k] || k,
      estimateReadingTime,
    }).trim();

    assert.equal(photoOnlyHtml, "<span>About 1 min read</span> <small>(2 Photos)</small>");
  });

  it("related-posts.ejs does not double-prefix fallback image under subpath root and strips excerpt HTML", () => {
    const related = [
      {
        source: "_posts/b.md",
        path: "2026/b/",
        title: "Post B",
        excerpt: '<p>See <a href="/x">link</a> and <code>code</code></p>',
        tags: { data: [{ name: "a" }, { name: "b" }] },
        date: new Date("2026-01-02"),
      },
    ];
    const chain = {
      filter: () => chain,
      sort: () => chain,
      limit: () => chain,
      length: related.length,
      each: (fn) => related.forEach(fn),
    };

    const html = renderTemplate("layout/partials/related-posts.ejs", {
      page: {
        source: "_posts/a.md",
        tags: { data: [{ name: "a" }, { name: "b" }] },
      },
      site: { posts: chain },
      url_for: makeUrlFor("/blog/"),
      __: (k) => k,
      strip_html: (s) => String(s || "").replace(/<[^>]+>/g, ""),
    });

    assert.match(html, /src="\/blog\/linen-theme\/img\/related-post\.jpg"/);
    assert.ok(!html.includes("/blog/blog/"));
    assert.match(html, /<span class="link-desc">See link and code<\/span>/);
  });

  it("top-posts.ejs omits cover-img when no cover/thumbnail and strips HTML from excerpt", () => {
    const postWithoutCover = {
      source: "_posts/no-cover.md",
      path: "2026/no-cover/",
      title: "No Cover",
      excerpt: "<p>Hello <code>world</code></p>",
      date: new Date("2026-01-01"),
      categories: [],
    };

    const html = renderTemplate("layout/partials/top-posts.ejs", {
      theme: { topArticles: ["_posts/no-cover.md"] },
      site: {
        posts: {
          findOne: ({ source }) =>
            source === postWithoutCover.source ? postWithoutCover : null,
        },
      },
      url_for: makeUrlFor("/"),
      getPostDate: () => "2026-01-01",
      partial: () => "<span>1 min read</span>",
      strip_html: (s) => String(s || "").replace(/<[^>]+>/g, ""),
    });

    assert.ok(!html.includes("cover-img"));
    assert.ok(!html.includes("undefined"));
    assert.match(html, /<div class="excerpt">Hello world<\/div>/);
  });

  it("header.ejs highlights Home only on home route, sets accessible logo labels, and gates search toggle", () => {
    const baseLocals = {
      theme: {
        navItems: [
          { name: "Home", path: "/" },
          { name: "Archives", path: "/archives/" },
        ],
        logo: { text: "Linen Blog" },
        search: { enable: false },
      },
      config: { title: "Linen Site" },
      url_for: makeUrlFor("/"),
      is_post: () => false,
      is_home: () => false,
      hasTocs: false,
      __: (k) => k,
      getTranslationPage: () => ({
        hasTranslatation: false,
        targetLanguagePath: "",
        targetLanguage: "",
      }),
    };

    const archiveHtml = renderTemplate("layout/partials/header.ejs", {
      ...baseLocals,
      page: { path: "archives/index.html" },
    });

    assert.ok(archiveHtml.includes('aria-label="Linen Blog"'));
    assert.ok(archiveHtml.includes('<a class="navItem" href="/">Home</a>'));
    assert.ok(archiveHtml.includes('<a class="navItem active" href="/archives/">Archives</a>'));
    assert.ok(!archiveHtml.includes('id="search-toggle"'));

    const homeWithSearchHtml = renderTemplate("layout/partials/header.ejs", {
      ...baseLocals,
      theme: { ...baseLocals.theme, search: { enable: true } },
      page: { path: "index.html" },
      is_home: () => true,
    });

    assert.ok(homeWithSearchHtml.includes('<a class="navItem active" href="/">Home</a>'));
    assert.ok(homeWithSearchHtml.includes('id="search-toggle"'));
  });

  it("footer.ejs supports configurable footer.logo and disables image when false", () => {
    const baseLocals = {
      config: { title: "My Site", author: "Alice" },
      theme: { navItems: [] },
      url_for: makeUrlFor("/"),
      __: (k) => k,
      date: () => "2026",
    };

    const defaultHtml = renderTemplate("layout/footer.ejs", baseLocals);
    assert.match(defaultHtml, /src="\/linen-theme\/img\/logo_black\.svg"/);
    assert.match(defaultHtml, /alt="My Site"/);

    const hiddenHtml = renderTemplate("layout/footer.ejs", {
      ...baseLocals,
      theme: { navItems: [], footer: { logo: false } },
    });
    assert.ok(!hiddenHtml.includes("footerLogo"));
  });

  it("page.ejs and 404.ejs render styled standalone markup", () => {
    const pageHtml = renderTemplate("layout/page.ejs", {
      page: { title: "About", content: "<p>Hello</p>" },
    });
    assert.match(pageHtml, /id="page"/);
    assert.match(pageHtml, /id="page-content"/);
    assert.ok(!pageHtml.includes("paginator"));

    const notFoundHtml = renderTemplate("layout/404.ejs", {
      page: {},
      url_for: makeUrlFor("/"),
      __: (k) => k,
    });
    assert.match(notFoundHtml, /class="not-found"/);
    assert.match(notFoundHtml, />404</);
  });
});

describe("scripts/search.js & XSL / Print CSS", () => {
  it("generates search index only when enabled and excludes hidden/unpublished posts", () => {
    const posts = [
      {
        title: "Visible Post",
        subTitle: "Subtitle",
        path: "2026/visible/",
        date: new Date("2026-05-01T00:00:00Z"),
        categories: { data: [{ name: "Notes" }] },
        tags: { data: [{ name: "Linen" }] },
        series: "Travel",
        excerpt: "<p>Excerpt <b>bold</b></p>",
        content:
          '<p>Body text</p><span class="katex-mathml">hidden</span><script>alert(1)</script>',
      },
      {
        title: "Hidden Archive",
        path: "2026/hidden/",
        hide: { archive: true },
        content: "<p>secret</p>",
      },
      {
        title: "Hidden SEO",
        path: "2026/noindex/",
        hide: { seo: true },
        content: "<p>secret</p>",
      },
      {
        title: "Draft",
        path: "2026/draft/",
        published: false,
        content: "<p>draft</p>",
      },
    ];
    const postCollection = {
      sort: () => ({ toArray: () => posts }),
    };

    const disabledHexo = createMockHexo({ themeConfig: { search: { enable: false } } });
    loadHexoScript("scripts/search.js", disabledHexo);
    const disabledOut = disabledHexo._generators["linen-search-index"]({
      posts: postCollection,
    });
    assert.deepEqual(disabledOut, []);

    const enabledHexo = createMockHexo({ themeConfig: { search: { enable: true } } });
    loadHexoScript("scripts/search.js", enabledHexo);
    const enabledOut = enabledHexo._generators["linen-search-index"]({
      posts: postCollection,
    });
    assert.equal(enabledOut.path, "linen-theme/search-index.json");
    const parsed = JSON.parse(enabledOut.data);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].title, "Visible Post");
    assert.equal(parsed[0].date, "2026-05-01");
    assert.deepEqual(parsed[0].tags, ["Linen"]);
    assert.equal(parsed[0].excerpt, "Excerpt bold");
    assert.equal(parsed[0].content, "Body text");
  });

  it("uses Linen styling in RSS/Atom XSL files without third-party RSS.Beauty bloat", () => {
    for (const rel of [
      "source/linen-theme/css/rss-zh.xsl",
      "source/linen-theme/css/rss-en.xsl",
      "source/linen-theme/css/atom.xsl",
    ]) {
      const content = fs.readFileSync(path.join(ROOT_DIR, rel), "utf8");
      assert.ok(content.includes("#fcfbf8"), `${rel} should use Linen light bg`);
      assert.ok(content.includes("#a8452e"), `${rel} should use Linen terracotta accent`);
      assert.ok(!content.includes("RSS.Beauty"), `${rel} should not contain RSS.Beauty`);
      assert.ok(!content.includes("404.li"), `${rel} should not contain third-party personal link`);
      assert.ok(!content.includes("tailwindcss"), `${rel} should not contain Tailwind CSS`);
    }
  });

  it("resets dark theme tokens inside @media print", () => {
    const res = sass.compile(
      path.join(ROOT_DIR, "source/linen-theme/css/linen.scss"),
      { style: "compressed" },
    );
    const printIdx = res.css.indexOf("@media print");
    assert.ok(printIdx !== -1, "@media print block should exist");
    const printChunk = res.css.slice(printIdx);
    assert.ok(
      printChunk.includes(':root[data-theme="dark"]') ||
        printChunk.includes(":root[data-theme=dark]"),
      "@media print should reset [data-theme=dark] to light palette",
    );
    assert.ok(printChunk.includes("color-scheme:light"));
  });
});
