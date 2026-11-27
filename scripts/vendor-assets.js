"use strict";

const fs = require("fs");
const path = require("path");
const { resolveIsMapSeries } = require("./lib/site-data");

const VENDOR_DIR = path.join(__dirname, "../assets/vendor");
const FONTS_DIR = path.join(__dirname, "../assets/fonts");
const CJK_RE = /[\u4e00-\u9fff]/;
const CJK_FONT_FILES = [
  "SourceHanSerifSC-Regular.woff2",
  "SourceHanSerifSC-Bold.woff2",
];

function pushAssetFile(assets, routePath, fullPath) {
  if (fs.existsSync(fullPath)) {
    assets.push({
      path: routePath,
      data: () => fs.createReadStream(fullPath),
    });
  }
}

function pushFile(assets, routePath, relPath) {
  pushAssetFile(assets, routePath, path.join(VENDOR_DIR, relPath));
}

function pushCombinedFiles(assets, routePath, relPaths) {
  const fullPaths = relPaths
    .map((relPath) => path.join(VENDOR_DIR, relPath))
    .filter((fullPath) => fs.existsSync(fullPath));
  if (!fullPaths.length) return;
  assets.push({
    path: routePath,
    data: () =>
      fullPaths.map((fullPath) => fs.readFileSync(fullPath, "utf8")).join("\n"),
  });
}

function siteNeedsCjkFonts(hexoInstance, posts, pages) {
  const langs = []
    .concat(hexoInstance?.config?.language || [])
    .filter(Boolean);
  if (langs.some((lang) => /^zh/i.test(String(lang)))) {
    return true;
  }

  const configTexts = [
    hexoInstance?.config?.title,
    hexoInstance?.config?.subtitle,
    hexoInstance?.config?.description,
    hexoInstance?.config?.author,
  ];
  if (configTexts.some((t) => typeof t === "string" && CJK_RE.test(t))) {
    return true;
  }

  for (const item of [...posts, ...pages]) {
    if (
      (typeof item?.language === "string" && /^zh/i.test(item.language)) ||
      (typeof item?.title === "string" && CJK_RE.test(item.title)) ||
      (typeof item?.subTitle === "string" && CJK_RE.test(item.subTitle)) ||
      (typeof item?.content === "string" && CJK_RE.test(item.content)) ||
      (typeof item?.raw === "string" && CJK_RE.test(item.raw))
    ) {
      return true;
    }
  }
  return false;
}

function pushDir(assets, routePrefix, relDir) {
  const dirPath = path.join(VENDOR_DIR, relDir);
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    pushFile(
      assets,
      `${routePrefix}/${entry.name}`,
      path.join(relDir, entry.name),
    );
  }
}

function resolveCommentProvider(commentConfig) {
  const raw = String(commentConfig?.provider || "")
    .trim()
    .toLowerCase();
  if (
    raw === "giscus" ||
    (!raw && (commentConfig?.repo_id || commentConfig?.category_id))
  ) {
    return "giscus";
  }
  return "gitalk";
}

function registerVendorAssets(hexoInstance) {
  hexoInstance.extend.generator.register(
    "linen-vendor-assets",
    function (locals) {
      const assets = [];
      const posts = locals?.posts
        ? typeof locals.posts.toArray === "function"
          ? locals.posts.toArray()
          : locals.posts
        : [];
      const pages = locals?.pages
        ? typeof locals.pages.toArray === "function"
          ? locals.pages.toArray()
          : locals.pages
        : [];

      const themeConfig =
        hexoInstance?.theme?.config ||
        hexoInstance?.config?.theme_config ||
        {};

      // 1. Comments (Gitalk or Giscus)
      const commentConfig =
        themeConfig?.comment ?? hexoInstance?.config?.theme_config?.comment;
      if (commentConfig && typeof commentConfig === "object") {
        const anyPostUsesComment =
          commentConfig.enable !== false
            ? posts.length === 0 || posts.some((p) => p?.comment !== false)
            : posts.some((p) => p?.comment === true);

        if (anyPostUsesComment) {
          const provider = resolveCommentProvider(commentConfig);
          if (provider === "giscus") {
            pushFile(
              assets,
              "linen-theme/js/giscus-init.js",
              "giscus/giscus-init.js",
            );
            pushCombinedFiles(
              assets,
              "linen-theme/css/giscus-linen-light.css",
              ["giscus/giscus-linen-light.css", "giscus/giscus-linen-base.css"],
            );
            pushCombinedFiles(
              assets,
              "linen-theme/css/giscus-linen-dark.css",
              ["giscus/giscus-linen-dark.css", "giscus/giscus-linen-base.css"],
            );
          } else {
            pushFile(
              assets,
              "linen-theme/js/gitalk-init.js",
              "gitalk/gitalk-init.js",
            );
            pushFile(
              assets,
              "linen-theme/js/gitalk/gitalk.min.js",
              "gitalk/gitalk.min.js",
            );
            pushCombinedFiles(assets, "linen-theme/js/gitalk/gitalk.css", [
              "gitalk/gitalk.css",
              "gitalk/gitalk-linen.css",
            ]);
          }
        }
      }

      // 2. PhotoSwipe lightbox
      const photoswipeConfig =
        themeConfig?.photoswipe ??
        hexoInstance?.config?.theme_config?.photoswipe;
      const photoswipeEnabled =
        photoswipeConfig === true ||
        (photoswipeConfig &&
          typeof photoswipeConfig === "object" &&
          photoswipeConfig.enable !== false);
      if (photoswipeEnabled) {
        pushFile(
          assets,
          "linen-theme/js/photoswipe-init.js",
          "photoswipe/photoswipe-init.js",
        );
        pushFile(
          assets,
          "linen-theme/js/photoswipe/photoswipe.esm.min.js",
          "photoswipe/photoswipe.esm.min.js",
        );
        pushFile(
          assets,
          "linen-theme/js/photoswipe/photoswipe-lightbox.esm.min.js",
          "photoswipe/photoswipe-lightbox.esm.min.js",
        );
        pushFile(
          assets,
          "linen-theme/js/photoswipe/photoswipe-dynamic-caption-plugin.esm.js",
          "photoswipe/photoswipe-dynamic-caption-plugin.esm.js",
        );
        pushFile(
          assets,
          "linen-theme/css/photoswipe.css",
          "photoswipe/photoswipe.css",
        );
        pushFile(
          assets,
          "linen-theme/css/photoswipe-dynamic-caption-plugin.css",
          "photoswipe/photoswipe-dynamic-caption-plugin.css",
        );
      }

      // 3. Travel Map & Leaflet fallback
      const seriesNames = new Set();
      for (const post of posts) {
        if (post?.series && !post?.hide?.archive) {
          seriesNames.add(post.series);
        }
      }
      const hasMapSeries = Array.from(seriesNames).some((name) =>
        resolveIsMapSeries(name, hexoInstance, undefined, hexoInstance),
      );
      if (hasMapSeries) {
        pushFile(assets, "linen-theme/js/leaflet.js", "map/leaflet.js");
        pushFile(assets, "linen-theme/js/travel-map.js", "map/travel-map.js");
        pushFile(assets, "linen-theme/css/leaflet.css", "map/leaflet.css");
        pushFile(
          assets,
          "linen-theme/img/travel-map-fallback.svg",
          "map/travel-map-fallback.svg",
        );
        pushDir(assets, "linen-theme/css/images", "map/images");
      }

      // 4. Local Search
      const searchConfig =
        themeConfig?.search || hexoInstance?.config?.theme_config?.search || {};
      if (searchConfig.enable) {
        pushFile(assets, "linen-theme/js/search.js", "search/search.js");
      }

      // 5. HDR Switch
      const hasHdrSwitch = [...posts, ...pages].some((item) =>
        Boolean(item?.hdrSwitch),
      );
      if (hasHdrSwitch) {
        pushFile(assets, "linen-theme/js/hdr.js", "hdr/hdr.js");
      }

      // 6. CJK Serif Webfonts (emit only for zh / CJK sites, without overwriting site overrides)
      if (siteNeedsCjkFonts(hexoInstance, posts, pages)) {
        const baseDir = hexoInstance?.base_dir || "";
        for (const fontFile of CJK_FONT_FILES) {
          const siteOverridePath = baseDir
            ? path.join(baseDir, "source/linen-theme/fonts", fontFile)
            : "";
          if (!siteOverridePath || !fs.existsSync(siteOverridePath)) {
            pushAssetFile(
              assets,
              `linen-theme/fonts/${fontFile}`,
              path.join(FONTS_DIR, fontFile),
            );
          }
        }
      }

      return assets;
    },
  );
}

if (typeof hexo !== "undefined") {
  registerVendorAssets(hexo);
}

module.exports = registerVendorAssets;
module.exports.resolveCommentProvider = resolveCommentProvider;
module.exports.siteNeedsCjkFonts = siteNeedsCjkFonts;
