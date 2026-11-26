"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const ejs = require("ejs");
const { ROOT_DIR, createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");
const { getAssetsDbImgsIndex, clearCache } = require("../scripts/lib/site-data");
const { processPost, processCovers } = require("../scripts/lazyload/process");
const latex = require("../scripts/latex");

function renderTemplate(relPath, locals) {
  const fullPath = path.join(ROOT_DIR, relPath);
  return ejs.render(fs.readFileSync(fullPath, "utf8"), locals, {
    filename: fullPath,
  });
}

describe("Series Template, Lazyload Pipeline & LaTeX Config Fixes", () => {
  it("series.ejs closes .cover-info properly when coverInfo is absent and falls back to post list when map series has no coordinates", () => {
    const basePost = {
      title: "Trip 1",
      path: "2026/trip-1/",
      date: new Date("2026-04-01"),
      excerpt: "<p>Long HTML excerpt</p>",
      series: "Travel",
    };

    // 1. Cover without coverInfo should have balanced <div> tags
    const coverHtml = renderTemplate("layout/series.ejs", {
      page: {
        series: "Notes",
        seriesInfo: { cover: "/img/series.jpg", description: "My notes" },
        seriesPosts: [basePost],
        posts: [basePost],
        language: "en",
      },
      config: { language: "en" },
      theme: { version: "1.0.60" },
      site: { posts: [basePost] },
      isMapSeries: () => false,
      url_for: (p) => p,
      date: () => "2026-04-01",
      getPostDate: () => "Apr 1, 2026",
      partial: () => "<div class=\"stub\"></div>",
      __: (k) => k,
    });

    const openDivs = (coverHtml.match(/<div\b/g) || []).length;
    const closeDivs = (coverHtml.match(/<\/div>/g) || []).length;
    assert.equal(openDivs, closeDivs, "series.ejs <div> tags must be balanced without coverInfo");

    // 2. Map series with zero coordinates should fall back to normal header + post list instead of blank page
    const fallbackHtml = renderTemplate("layout/series.ejs", {
      page: {
        series: "Travel",
        seriesInfo: { description: "Trips" },
        seriesPosts: [basePost],
        posts: [basePost],
        language: "en",
      },
      config: { language: "en" },
      theme: { version: "1.0.60" },
      site: { posts: [basePost] },
      isMapSeries: () => true,
      url_for: (p) => p,
      date: () => "2026-04-01",
      getPostDate: () => "Apr 1, 2026",
      partial: (name) => `<div data-partial="${name}"></div>`,
      __: (k) => k,
    });

    assert.ok(fallbackHtml.includes('data-partial="partials/taxonomy-header"'));
    assert.ok(fallbackHtml.includes('id="recent-posts"'));
    assert.ok(!fallbackHtml.includes('id="travel-map"'));

    // 3. Map series WITH coordinates omits HTML excerpt from data-places JSON payload
    const mappedPost = {
      ...basePost,
      mapPlace: { coordinate: [35.68, 139.76], location: "Tokyo" },
    };
    const mappedHtml = renderTemplate("layout/series.ejs", {
      page: {
        series: "Travel",
        seriesInfo: { description: "Trips" },
        seriesPosts: [mappedPost],
        posts: [mappedPost],
        language: "en",
      },
      config: { language: "en" },
      theme: { version: "1.0.60" },
      site: { posts: [mappedPost] },
      isMapSeries: () => true,
      url_for: (p) => p,
      date: () => "2026-04-01",
      getPostDate: () => "Apr 1, 2026",
      partial: () => "",
      __: (k) => k,
    });

    const dataPlacesMatch = mappedHtml.match(/data-places="([^"]+)"/);
    assert.ok(dataPlacesMatch, "data-places attribute should be present");
    const parsedPlaces = JSON.parse(decodeURIComponent(dataPlacesMatch[1]));
    assert.equal(parsedPlaces.length, 1);
    assert.equal(parsedPlaces[0].excerpt, undefined);
    assert.equal(parsedPlaces[0].lat, 35.68);
  });

  it("lazyload process uses O(1) img index, omits href on no-link spans, and skips blurhash cover background-image", () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "linen-lazy-"));
    try {
      const imgsDir = path.join(tmpBase, "assets-db/imgs");
      fs.mkdirSync(imgsDir, { recursive: true });
      fs.writeFileSync(
        path.join(imgsDir, "gallery.json"),
        JSON.stringify([
          {
            url: "https://cdn.example.com/photos/a.jpg",
            width: 1600,
            height: 1000,
            placeholder: "blurhash:L6PZfSi_.AyE_3t7t7R**0o#DgR4",
          },
          {
            url: "https://cdn.example.com/photos/b.jpg",
            width: 800,
            height: 600,
            placeholder: "https://cdn.example.com/photos/b-thumb.jpg",
          },
        ]),
      );

      clearCache();
      const idx = getAssetsDbImgsIndex(tmpBase);
      assert.equal(
        idx.findByUrl("https://other.example.org/photos/a.jpg")?.width,
        1600,
      );

      const ctx = {
        base_dir: tmpBase,
        config: {
          theme: "linen",
          language: "zh-CN",
          theme_config: { photoswipe: true, lazyload: { enable: true } },
        },
      };

      const postData = {
        content:
          '<p><img src="https://cdn.example.com/photos/a.jpg" alt="test $no-link"></p>',
      };
      processPost.call(ctx, postData);
      assert.ok(postData.content.includes('<span class="gallery-item"'));
      assert.ok(!postData.content.includes('<span class="gallery-item" href='));
      assert.ok(!postData.content.includes('target="_blank"'));

      const coverHtmlBlurhash = processCovers.call(
        ctx,
        '<div class="post-cover-img-wrap"><img src="https://cdn.example.com/photos/a.jpg"></div>',
        { page: { cover: "https://cdn.example.com/photos/a.jpg" } },
      );
      assert.ok(!coverHtmlBlurhash.includes("url(blurhash:"));

      const coverHtmlUrl = processCovers.call(
        ctx,
        '<div class="post-cover-img-wrap"><img src="https://cdn.example.com/photos/b.jpg"></div>',
        { page: { cover: "https://cdn.example.com/photos/b.jpg" } },
      );
      assert.ok(
        coverHtmlUrl.includes(
          'style="background-image: url(https://cdn.example.com/photos/b-thumb.jpg)"',
        ),
      );
    } finally {
      clearCache();
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it("latex.js reads hexo.theme.config.latex as well as hexo.config.theme_config.latex", () => {
    const mockHexo = createMockHexo({
      themeConfig: { latex: { enable: true } },
    });
    assert.equal(latex.isLatexEnabled({}, mockHexo), true);
  });

  it("lazyload/client.js fixes iframe closing tag typo and shares one IntersectionObserver", () => {
    const clientCode = fs.readFileSync(
      path.join(ROOT_DIR, "scripts/lazyload/client.js"),
      "utf8",
    );
    assert.ok(!clientCode.includes('.replace("iframe>", "iframe>")'));
    assert.ok(clientCode.includes("getSharedObserver"));
    assert.ok(clientCode.includes("width > 0"));
  });
});
