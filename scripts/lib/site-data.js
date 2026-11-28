"use strict";

const fs = require("fs");
const path = require("path");

const LEGACY_JOURNAL_SERIES = ["旅行", "Travel"];

const jsonCache = new Map();
const imgsCache = new Map();
const imgsIndexCache = new Map();
const registeredHexos = new WeakSet();

function clearCache() {
  jsonCache.clear();
  imgsCache.clear();
  imgsIndexCache.clear();
}

function registerCacheInvalidation(hexoInstance) {
  if (!hexoInstance || typeof hexoInstance !== "object") return;
  if (registeredHexos.has(hexoInstance)) return;
  registeredHexos.add(hexoInstance);
  if (hexoInstance.extend?.filter?.register) {
    hexoInstance.extend.filter.register("before_generate", clearCache);
  }
}

function readJsonCached(filePath) {
  if (jsonCache.has(filePath)) {
    return jsonCache.get(filePath);
  }
  let value = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (parsed && typeof parsed === "object") {
      value = parsed;
    }
  } catch (error) {
    value = {};
  }
  jsonCache.set(filePath, value);
  return value;
}

function getThemeConfig(ctx, hexoInstance) {
  return (
    hexoInstance?.theme?.config ||
    ctx?.theme?.config ||
    (ctx?.theme && typeof ctx.theme === "object" && !ctx.theme.base
      ? ctx.theme
      : null) ||
    hexoInstance?.config?.theme_config ||
    ctx?.config?.theme_config ||
    (typeof hexo !== "undefined"
      ? hexo?.theme?.config || hexo?.config?.theme_config
      : null) ||
    {}
  );
}

function getBaseDir(ctx, hexoInstance) {
  return (
    hexoInstance?.base_dir ||
    ctx?.base_dir ||
    (typeof hexo !== "undefined" ? hexo?.base_dir : "") ||
    ""
  );
}

function getSiteData(ctx, name, hexoArg) {
  const hexoInstance =
    hexoArg ||
    (ctx?.locals?.get ? ctx : typeof hexo !== "undefined" ? hexo : null);
  if (hexoInstance) {
    registerCacheInvalidation(hexoInstance);
  }

  const baseDir = getBaseDir(ctx, hexoInstance);
  const fromAssetsDb = baseDir
    ? readJsonCached(path.join(baseDir, `assets-db/${name}.json`))
    : {};

  let fromHexoData = {};
  try {
    const dataMap = hexoInstance?.locals?.get?.("data");
    if (dataMap && dataMap[name] && typeof dataMap[name] === "object") {
      fromHexoData = dataMap[name];
    }
  } catch (error) {
    fromHexoData = {};
  }

  if (!Object.keys(fromHexoData).length) {
    return fromAssetsDb;
  }
  if (!Object.keys(fromAssetsDb).length) {
    return fromHexoData;
  }
  return { ...fromAssetsDb, ...fromHexoData };
}

function getAssetsDbImgs(baseDir, hexoInstance) {
  if (hexoInstance) {
    registerCacheInvalidation(hexoInstance);
  }
  if (!baseDir) return [];
  const dirPath = path.join(baseDir, "assets-db/imgs");
  if (imgsCache.has(dirPath)) {
    return imgsCache.get(dirPath);
  }

  let merged = [];
  const subDirs = [dirPath, path.join(baseDir, "assets-db/livePhotos")];
  for (const subDir of subDirs) {
    try {
      const files = fs.readdirSync(subDir);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));
      for (const file of jsonFiles) {
        const fullPath = path.join(subDir, file);
        const content = fs.readFileSync(fullPath, "utf-8");
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            merged = merged.concat(data);
          } else {
            console.warn(`[linen] ${file} is not an array, skipping`);
          }
        } catch (err) {
          console.error(`❌ JSON parse error in ${file}:`, err);
        }
      }
    } catch (error) {
      // Directory may not exist; skip cleanly
    }
  }

  imgsCache.set(dirPath, merged);
  return merged;
}

function getUrlPathKey(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const u = new URL(rawUrl);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch (e) {
    return "";
  }
}

function getAssetsDbImgsIndex(baseDir, hexoInstance) {
  if (hexoInstance) {
    registerCacheInvalidation(hexoInstance);
  }
  const cacheKey = baseDir ? path.join(baseDir, "assets-db/imgs") : "";
  if (cacheKey && imgsIndexCache.has(cacheKey)) {
    return imgsIndexCache.get(cacheKey);
  }

  const list = getAssetsDbImgs(baseDir, hexoInstance);
  const byUrl = new Map();
  const byPathKey = new Map();

  for (const item of list) {
    if (!item || typeof item.url !== "string" || !item.url) continue;
    if (!byUrl.has(item.url)) {
      byUrl.set(item.url, item);
    }
    const pathKey = getUrlPathKey(item.url);
    if (pathKey && !byPathKey.has(pathKey)) {
      byPathKey.set(pathKey, item);
    }
  }

  const index = {
    list,
    byUrl,
    byPathKey,
    findByUrl(src) {
      if (!src || typeof src !== "string") return undefined;
      if (byUrl.has(src)) return byUrl.get(src);
      const pathKey = getUrlPathKey(src);
      return pathKey ? byPathKey.get(pathKey) : undefined;
    },
  };

  if (cacheKey) {
    imgsIndexCache.set(cacheKey, index);
  }
  return index;
}

function normalizeLayoutStyle(style) {
  if (typeof style !== "string") return "";
  const normalized = style.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "travel") return "journal";
  return normalized;
}

function resolvePostLayoutStyle(post, ctx, seriesInfoArg, hexoInstance) {
  const p = post || ctx?.page || {};
  const fromPost = normalizeLayoutStyle(p?.layoutStyle);
  if (fromPost) return fromPost;

  const seriesName = p?.series;
  const seriesInfo =
    seriesInfoArg ||
    (seriesName
      ? getSiteData(ctx, "series", hexoInstance)?.[seriesName] || {}
      : {});

  const fromSeriesInfo = normalizeLayoutStyle(seriesInfo?.layoutStyle);
  if (fromSeriesInfo) return fromSeriesInfo;

  const themeConfig = getThemeConfig(ctx, hexoInstance);
  const postConfig = themeConfig?.post || {};

  if (
    seriesName &&
    postConfig?.seriesLayoutStyle &&
    Object.prototype.hasOwnProperty.call(
      postConfig.seriesLayoutStyle,
      seriesName,
    )
  ) {
    const fromSeriesMap = normalizeLayoutStyle(
      postConfig.seriesLayoutStyle[seriesName],
    );
    if (fromSeriesMap) return fromSeriesMap;
  }

  if (seriesName && LEGACY_JOURNAL_SERIES.includes(seriesName)) {
    return "journal";
  }

  return normalizeLayoutStyle(postConfig?.layoutStyle) || "editorial";
}

function resolvePostBreakoutConfig(post, ctx, seriesInfoArg, hexoInstance) {
  const p = post || ctx?.page || {};
  const themeConfig = getThemeConfig(ctx, hexoInstance);
  const postConfig = themeConfig?.post || {};
  const seriesName = p?.series;
  const seriesInfo =
    seriesInfoArg ||
    (seriesName
      ? getSiteData(ctx, "series", hexoInstance)?.[seriesName] || {}
      : {});

  const resolveEnable = (val) => {
    if (typeof val === "boolean") return val;
    if (val && typeof val === "object" && typeof val.enable === "boolean") {
      return val.enable;
    }
    return undefined;
  };

  const resolveWidth = (val) => {
    if (
      val &&
      typeof val === "object" &&
      typeof val.proseWidth === "string" &&
      val.proseWidth.trim()
    ) {
      return val.proseWidth.trim();
    }
    return "";
  };

  const candidates = [
    p?.editorialBreakout,
    seriesInfo?.editorialBreakout,
    postConfig?.editorialBreakout,
    themeConfig?.editorialBreakout,
  ];

  let enable = false;
  for (const candidate of candidates) {
    const resolved = resolveEnable(candidate);
    if (resolved !== undefined) {
      enable = resolved;
      break;
    }
  }

  const proseWidth =
    (typeof p?.proseWidth === "string" && p.proseWidth.trim()) ||
    resolveWidth(p?.editorialBreakout) ||
    (typeof seriesInfo?.proseWidth === "string" &&
      seriesInfo.proseWidth.trim()) ||
    resolveWidth(seriesInfo?.editorialBreakout) ||
    resolveWidth(postConfig?.editorialBreakout) ||
    (typeof postConfig?.proseWidth === "string" &&
      postConfig.proseWidth.trim()) ||
    resolveWidth(themeConfig?.editorialBreakout) ||
    "";

  return { enable, proseWidth };
}

function resolveIsMapSeries(seriesName, ctx, seriesInfoArg, hexoInstance) {
  if (!seriesName) return false;
  const themeConfig = getThemeConfig(ctx, hexoInstance);
  const seriesInfo =
    seriesInfoArg ||
    getSiteData(ctx, "series", hexoInstance)?.[seriesName] ||
    {};

  if (typeof seriesInfo?.map === "boolean") {
    return seriesInfo.map;
  }

  if (Array.isArray(themeConfig?.series?.mapSeries)) {
    return themeConfig.series.mapSeries.includes(seriesName);
  }

  const fromSeriesInfo = normalizeLayoutStyle(seriesInfo?.layoutStyle);
  if (fromSeriesInfo) {
    return fromSeriesInfo === "journal";
  }

  const seriesLayoutMap = themeConfig?.post?.seriesLayoutStyle || {};
  if (Object.prototype.hasOwnProperty.call(seriesLayoutMap, seriesName)) {
    return normalizeLayoutStyle(seriesLayoutMap[seriesName]) === "journal";
  }

  return LEGACY_JOURNAL_SERIES.includes(seriesName);
}

if (typeof hexo !== "undefined") {
  registerCacheInvalidation(hexo);
}

module.exports = {
  LEGACY_JOURNAL_SERIES,
  clearCache,
  registerCacheInvalidation,
  getSiteData,
  getAssetsDbImgs,
  getAssetsDbImgsIndex,
  normalizeLayoutStyle,
  resolvePostLayoutStyle,
  resolvePostBreakoutConfig,
  resolveIsMapSeries,
};
