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
const { buildLazyloadStyles } = require("../scripts/lazyload/assets");
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

    // 3. Map series WITH coordinates omits HTML excerpt from data-places JSON payload and still lists unmapped posts
    const mappedPost = {
      ...basePost,
      mapPlace: { coordinate: [35.68, 139.76], location: "Tokyo" },
    };
    const unmappedPost = {
      ...basePost,
      title: "Packing Gear Guide",
      path: "/2026/packing/",
    };
    const mappedHtml = renderTemplate("layout/series.ejs", {
      page: {
        series: "Travel",
        seriesInfo: { description: "Trips" },
        seriesPosts: [mappedPost, unmappedPost],
        posts: [mappedPost, unmappedPost],
        language: "en",
      },
      config: { language: "en" },
      theme: { version: "1.0.60" },
      site: { posts: [mappedPost, unmappedPost] },
      isMapSeries: () => true,
      url_for: (p) => p,
      date: () => "2026-04-01",
      getPostDate: () => "Apr 1, 2026",
      partial: () => "",
      __: (k) => k,
    });
    assert.ok(
      mappedHtml.includes("Packing Gear Guide"),
      "Map series must still display unmapped posts in the card list",
    );

    const dataPlacesMatch = mappedHtml.match(/data-places="([^"]+)"/);
    assert.ok(dataPlacesMatch, "data-places attribute should be present");
    const parsedPlaces = JSON.parse(decodeURIComponent(dataPlacesMatch[1]));
    assert.equal(parsedPlaces.length, 1);
    assert.equal(parsedPlaces[0].excerpt, undefined);
    assert.equal(parsedPlaces[0].lat, 35.68);
    assert.ok(mappedHtml.includes("<h1>Places I have been</h1>"), "Travel map heading should use <h1>");
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
      assert.ok(!postData.content.includes("data-fancybox"));
      assert.ok(
        postData.content.includes('data-blurhash="blurhash:L6PZfSi_.AyE_3t7t7R**0o#DgR4"'),
        "processPost should emit data-blurhash directly at build time",
      );

      const inlineBlurhashPost = {
        content:
          '<p><img src="https://cdn.example.com/photos/inline.jpg" data-placeholderimg="blurhash:LKO2?U%2Tw=w]~RBVZRi};RPxuwH" alt="inline"></p>',
      };
      processPost.call(ctx, inlineBlurhashPost);
      assert.ok(
        inlineBlurhashPost.content.includes('data-blurhash="blurhash:LKO2?U%2Tw=w]~RBVZRi};RPxuwH"'),
      );
      assert.ok(!inlineBlurhashPost.content.includes("data-placeholderimg"));

      const coverListBlurhash = processCovers.call(
        ctx,
        '<div class="cover-img"><img src="https://cdn.example.com/photos/a.jpg" alt=""></div>',
        { page: {} },
      );
      assert.ok(
        coverListBlurhash.includes('data-blurhash="blurhash:L6PZfSi_.AyE_3t7t7R**0o#DgR4"'),
        "processCovers should emit data-blurhash directly on .lazyload-wrap",
      );
      assert.ok(!coverListBlurhash.includes("data-placeholderimg"));

      const exifData = {
        content: '<p><img src="https://cdn.example.com/photos/b.jpg" alt="photo"></p>',
      };
      idx.byUrl.get("https://cdn.example.com/photos/b.jpg").exif = "{Leica}{100}";
      idx.byUrl.get("https://cdn.example.com/photos/b.jpg").location = "https://maps.example.com";
      idx.byUrl.get("https://cdn.example.com/photos/b.jpg").locationText = "Tokyo";
      processPost.call(ctx, exifData);
      assert.ok(exifData.content.includes('data-pswp-exif="{Leica}{100}"'));
      assert.ok(exifData.content.includes('data-pswp-location="{https://maps.example.com}{Tokyo}"'));
      assert.ok(!exifData.content.includes("data-pspw-"));

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
    assert.ok(clientCode.includes("new WeakSet()"), "client.js should track loading queue with WeakSet");
    assert.ok(clientCode.includes("element.dataset.blurhash"), "client.js should fast-path build-time data-blurhash");
    assert.ok(clientCode.includes("width > 0"));
    assert.ok(clientCode.includes('getAttribute("data-keep-placeholder")'));
    assert.ok(clientCode.includes("!showTransition || !inViewport"));
    assert.ok(clientCode.includes("isOversizedVisible"));

    const injectScript = require("../scripts/lazyload/inject")(
      createMockHexo({ config: { root: "/blog/" }, themeConfig: { version: "1.2.3" } }),
    );
    const noImgHtml = injectScript("<html><head></head><body><p>Plain</p></body></html>", { page: {} });
    assert.ok(!noImgHtml.includes("$lazyload"), "Must skip injecting $lazyload on pages without .lazyload-wrap");
    assert.ok(!noImgHtml.includes("lazyload.css"), "Must skip lazyload.css on pages without .lazyload-wrap");
    assert.ok(!noImgHtml.includes("lazyload.js"), "Must skip lazyload.js on pages without .lazyload-wrap");
    const withImgHtml = injectScript(
      '<html><head><noscript><link rel="stylesheet" href="/blog/linen-theme/css/noscript.css" /></noscript></head><body><span class="lazyload-wrap"></span></body></html>',
      { page: {} },
    );
    assert.ok(withImgHtml.includes("var $lazyload = {"));
    assert.ok(
      withImgHtml.includes('<link rel="stylesheet" href="/blog/linen-theme/css/lazyload.css?v=1.2.3" />'),
      "Must inject lazyload.css with subpath root when .lazyload-wrap is present",
    );
    assert.ok(
      withImgHtml.indexOf("lazyload.css") < withImgHtml.indexOf("noscript.css"),
      "lazyload.css must precede noscript.css in <head>",
    );
    assert.ok(
      withImgHtml.includes('<script src="/blog/linen-theme/js/lazyload.js?v=1.2.3" defer></script></body>'),
      "Must inject deferred lazyload.js before </body> when .lazyload-wrap is present",
    );
    assert.ok(!withImgHtml.includes("error-tip.svg"), "Must not preload error-tip.svg");

    const pswpInit = fs.readFileSync(
      path.join(ROOT_DIR, "assets/vendor/photoswipe/photoswipe-init.js"),
      "utf8",
    );
    assert.ok(
      !pswpInit.includes('import PhotoSwipe from "./photoswipe/photoswipe.esm.min.js"'),
      "photoswipe-init.js must not eagerly import 188KB photoswipe.esm.min.js",
    );
    assert.ok(
      pswpInit.includes('() => import("./photoswipe/photoswipe.esm.min.js")'),
      "photoswipe-init.js should dynamically import PhotoSwipe core on open",
    );

    const travelMapJs = fs.readFileSync(
      path.join(ROOT_DIR, "assets/vendor/map/travel-map.js"),
      "utf8",
    );
    assert.ok(
      travelMapJs.includes("unbindCardEvents"),
      "travel-map.js should unbind card listeners when falling back from MapLibre to Leaflet",
    );

    const postJs = fs.readFileSync(
      path.join(ROOT_DIR, "source/linen-theme/js/post.js"),
      "utf8",
    );
    assert.ok(
      postJs.includes("selection.isCollapsed"),
      "post.js should skip heading anchor jump when user is selecting text",
    );

    const lazyHexo = createMockHexo({ themeConfig: { lazyload: { enable: true } } });
    loadHexoScript("scripts/lazyload/index.js", lazyHexo);
    const lazyAssets = lazyHexo._generators["linen-lazyload-assets"]().map((a) => a.path);
    assert.ok(lazyAssets.includes("linen-theme/img/lazyload/error-tip.svg"));

    const tocJs = fs.readFileSync(path.join(ROOT_DIR, "source/linen-theme/js/toc.js"), "utf8");
    assert.ok(tocJs.includes("isTocVisible"), "toc.js should skip scroll layout work when mobile drawer is hidden");
  });

  it("supports per-image hide-placeholder via alt directive, HTML attr, and assets-db, and hides blurhash canvas on load", () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "linen-lazy-ph-"));
    try {
      const imgsDir = path.join(tmpBase, "assets-db/imgs");
      fs.mkdirSync(imgsDir, { recursive: true });
      fs.writeFileSync(
        path.join(imgsDir, "transparent.json"),
        JSON.stringify([
          {
            url: "https://cdn.example.com/icons/logo.png",
            width: 400,
            height: 200,
            hidePlaceholder: true,
          },
        ]),
      );

      clearCache();
      const ctx = {
        base_dir: tmpBase,
        config: {
          theme: "linen",
          language: "zh-CN",
          theme_config: { photoswipe: true, lazyload: { enable: true } },
        },
      };

      const postData = {
        content: [
          '<p><img src="/img/alpha.png" alt="透明图 $hide-placeholder"></p>',
          '<p><img src="/img/beta.png" hide-placeholder alt="Beta"></p>',
          '<p><img src="/img/gamma.png" data-keep-placeholder="true" alt="Gamma"></p>',
          '<p><img src="https://cdn.example.com/icons/logo.png" alt="Logo"></p>',
        ].join("\n"),
      };
      processPost.call(ctx, postData);

      // 1. Markdown alt directive
      assert.ok(postData.content.includes('<span class="caption" >透明图</span>'));
      assert.ok(!postData.content.includes("$hide-placeholder"));
      assert.ok(!postData.content.includes("%24hide-placeholder"));

      // 2. HTML attributes & assets-db metadata emit data-keep-placeholder
      const falseMatches =
        postData.content.match(/data-keep-placeholder="false"/g) || [];
      assert.equal(falseMatches.length, 3);
      assert.ok(postData.content.includes('data-keep-placeholder="true"'));
      assert.ok(!postData.content.includes("<noscript><img src=\"/img/beta.png\" hide-placeholder"));

      // 3. processCovers also honors assets-db hidePlaceholder
      const coverHtml = processCovers.call(
        ctx,
        '<div class="cover-img"><img src="https://cdn.example.com/icons/logo.png" alt=""></div>',
        { page: {} },
      );
      assert.ok(coverHtml.includes('data-keep-placeholder="false"'));

      // 4. Generated CSS hides blurhash canvas once .placeholder.loaded is applied
      const css = buildLazyloadStyles(createMockHexo());
      assert.ok(css.includes(".lazyload-wrap .placeholder.loaded canvas"));
    } finally {
      clearCache();
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
