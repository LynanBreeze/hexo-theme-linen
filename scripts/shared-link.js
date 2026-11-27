"use strict";

const PLACEHOLDER_CLASS = "linen-shared-link-placeholder";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtmlEntities(str) {
  return String(str || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(
      /&(amp|lt|gt|quot|apos|ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip);/gi,
      (_, name) =>
        ({
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
          ldquo: "“",
          rdquo: "”",
          lsquo: "‘",
          rsquo: "’",
          mdash: "—",
          ndash: "–",
          hellip: "…",
        })[name.toLowerCase()] || " ",
    );
}

function safeDecodeURIComponent(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function normalizeRoot(root) {
  let r = String(root || "/").trim();
  if (!r.startsWith("/")) r = `/${r}`;
  if (!r.endsWith("/")) r = `${r}/`;
  return r;
}

function splitHrefParts(rawHref) {
  let value = String(rawHref || "").trim();
  let hash = "";
  let query = "";

  const hashIdx = value.indexOf("#");
  if (hashIdx !== -1) {
    hash = value.slice(hashIdx);
    value = value.slice(0, hashIdx);
  }

  const queryIdx = value.indexOf("?");
  if (queryIdx !== -1) {
    query = value.slice(queryIdx);
    value = value.slice(0, queryIdx);
  }

  return { pathPart: value, query, hash };
}

function normalizeLookupPath(rawPath, root = "/") {
  let value = String(rawPath || "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return "";
    }
  }

  const { pathPart } = splitHrefParts(value);
  value = safeDecodeURIComponent(pathPart).replace(/\\/g, "/");

  const normRoot = normalizeRoot(root);
  if (normRoot !== "/") {
    const rootNoTrailing = normRoot.slice(0, -1);
    if (value === rootNoTrailing) {
      value = "";
    } else if (value.startsWith(normRoot)) {
      value = value.slice(normRoot.length);
    }
  }

  value = value
    .replace(/^\/+/, "")
    .replace(/\/index\.html$/i, "")
    .replace(/^index\.html$/i, "")
    .replace(/\/+$/, "");

  return value;
}

function toArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.toArray === "function") return collection.toArray();
  if (Array.isArray(collection.data)) return collection.data;
  if (typeof collection.each === "function") {
    const out = [];
    collection.each((item) => out.push(item));
    return out;
  }
  return [];
}

function buildInternalPostIndex(postsCollection, pagesCollection, root = "/") {
  const byPath = new Map();
  const byPathLower = new Map();
  const bySource = new Map();
  const bySlug = new Map();
  const ambiguousSlugs = new Set();

  const registerItem = (item) => {
    if (!item || typeof item !== "object") return;

    const addPathKey = (raw) => {
      const key = normalizeLookupPath(raw, root);
      if (!key) return;
      if (!byPath.has(key)) byPath.set(key, item);
      const lower = key.toLowerCase();
      if (!byPathLower.has(lower)) byPathLower.set(lower, item);
    };

    if (item.path) addPathKey(item.path);
    if (item.permalink) addPathKey(item.permalink);

    if (item.source) {
      const srcNorm = safeDecodeURIComponent(String(item.source))
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\.[^/.]+$/, "");
      if (srcNorm && !bySource.has(srcNorm)) {
        bySource.set(srcNorm, item);
      }
      const withoutPostsPrefix = srcNorm.replace(/^_posts\//i, "");
      if (withoutPostsPrefix && !bySource.has(withoutPostsPrefix)) {
        bySource.set(withoutPostsPrefix, item);
      }
      const withoutIndex = withoutPostsPrefix.replace(/\/index$/i, "");
      if (withoutIndex && !bySource.has(withoutIndex)) {
        bySource.set(withoutIndex, item);
      }
    }

    const slug = String(item.slug || "").trim();
    if (slug) {
      const slugKey = safeDecodeURIComponent(slug).replace(/^\/+|\/+$/g, "");
      if (slugKey) {
        if (bySlug.has(slugKey) && bySlug.get(slugKey) !== item) {
          ambiguousSlugs.add(slugKey);
        } else {
          bySlug.set(slugKey, item);
        }
      }
    }
  };

  for (const post of toArray(postsCollection)) registerItem(post);
  for (const page of toArray(pagesCollection)) registerItem(page);

  for (const slugKey of ambiguousSlugs) {
    bySlug.delete(slugKey);
  }

  return { byPath, byPathLower, bySource, bySlug, root: normalizeRoot(root) };
}

function findInternalPost(index, rawHref) {
  if (!index || !rawHref) return null;
  const key = normalizeLookupPath(rawHref, index.root);
  if (!key) return null;

  return (
    index.byPath.get(key) ||
    index.byPathLower.get(key.toLowerCase()) ||
    index.bySource.get(key) ||
    index.bySlug.get(key) ||
    null
  );
}

function buildUrl(targetPath, root = "/") {
  const str = String(targetPath || "").trim();
  if (!str) return "";
  if (/^(?:https?:|mailto:|tel:|\/\/|#)/i.test(str)) return str;

  const normRoot = normalizeRoot(root);
  if (normRoot !== "/" && str.startsWith(normRoot)) {
    return str;
  }
  return `${normRoot}${str.replace(/^\/+/, "")}`;
}

function resolveCoverUrl(rawCover, targetPost, root = "/") {
  const cover = String(rawCover || "").trim();
  if (!cover) return "";
  if (/^(?:https?:|data:|\/\/)/i.test(cover)) return cover;
  if (cover.startsWith("/")) return buildUrl(cover, root);

  const postPath = String(targetPost?.path || "").trim();
  if (postPath) {
    const dir = postPath.endsWith("/")
      ? postPath
      : postPath.replace(/[^/]+$/, "");
    const cleanCover = cover.replace(/^\.\//, "");
    return buildUrl(`${dir}${cleanCover}`, root);
  }
  return buildUrl(cover, root);
}

function extractPlainExcerpt(item) {
  const raw = item?.excerpt || item?.description || "";
  if (!raw) return "";
  const cleaned = String(raw)
    .replace(/<span class="katex-mathml">[\s\S]*?<\/span>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(cleaned).replace(/\s+/g, " ").trim();
}

function parseSharedLinkDirectives(altText, titleText) {
  let customTitle = "";
  let customDesc = "";

  const alt = String(altText || "").trim();
  const pipeIdx = alt.indexOf("|");
  if (pipeIdx !== -1) {
    const parts = alt
      .slice(pipeIdx + 1)
      .split("|")
      .map((s) => s.trim());
    if (parts[0]) customTitle = parts[0];
    if (parts[1]) customDesc = parts.slice(1).join(" | ").trim();
  }

  const rawTitle = String(titleText || "").trim();
  if (rawTitle) {
    const titleParts = rawTitle.split("|").map((s) => s.trim());
    if (titleParts[0] && !customTitle) customTitle = titleParts[0];
    if (titleParts[1] && !customDesc) {
      customDesc = titleParts.slice(1).join(" | ").trim();
    }
  }

  return { customTitle, customDesc };
}

function buildPlaceholderTag(href, customTitle, customDesc) {
  let attrs = `class="${PLACEHOLDER_CLASS}" data-href="${escapeHtml(href)}"`;
  if (customTitle) attrs += ` data-title="${escapeHtml(customTitle)}"`;
  if (customDesc) attrs += ` data-desc="${escapeHtml(customDesc)}"`;
  return `<div ${attrs}></div>`;
}

function replaceSharedLinkInTextSegment(segment) {
  // Match ![$card](/path) or ![$card | Title | Desc](/path "Title | Desc")
  // (also accepts $shared / $shared-link as aliases) while skipping inline code spans (`...`).
  const tokenRe =
    /(`+)[\s\S]*?\1|!\[\s*\$(?:card|shared(?:-link)?)(?:\s*\|([^\]]*))?\s*\]\(\s*(?:<([^>\n]+)>|([^\s)\n]+))(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/gi;

  return segment.replace(
    tokenRe,
    (match, codeTicks, altExtra, angleHref, plainHref, dqTitle, sqTitle) => {
      if (codeTicks) return match;
      const rawHref = (angleHref || plainHref || "").trim();
      if (!rawHref) return match;

      const { customTitle, customDesc } = parseSharedLinkDirectives(
        altExtra !== undefined ? `$card|${altExtra}` : "$card",
        dqTitle !== undefined ? dqTitle : sqTitle,
      );
      return buildPlaceholderTag(rawHref, customTitle, customDesc);
    },
  );
}

function replaceSharedLinkMarkdown(markdown) {
  if (!markdown || !/\$(?:card|shared)/i.test(markdown)) return markdown;

  const lines = String(markdown).split("\n");
  const out = [];
  let buffer = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;

  const flush = () => {
    if (!buffer.length) return;
    out.push(replaceSharedLinkInTextSegment(buffer.join("\n")));
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const clean = line.replace(/\r$/, "");
    if (!inFence) {
      const open = clean.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (open) {
        flush();
        inFence = true;
        fenceChar = open[1][0];
        fenceLen = open[1].length;
        out.push(line);
        continue;
      }
      buffer.push(line);
    } else {
      out.push(line);
      const close = clean.match(
        new RegExp(`^\\s{0,3}${fenceChar}{${fenceLen},}\\s*$`),
      );
      if (close) {
        inFence = false;
        fenceChar = "";
        fenceLen = 0;
      }
    }
  }
  flush();
  return out.join("\n");
}

function getAttr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const m = tag.match(re);
  if (!m) return "";
  return decodeHtmlEntities(m[1] !== undefined ? m[1] : m[2] || "");
}

function renderSharedLinkCard({ href, title, subTitle, desc, cover }) {
  const coverHtml = cover
    ? `<div class="cover-img"><img no-lazy class="not-gallery-item" src="${escapeHtml(cover)}" alt="" loading="lazy"></div>`
    : "";
  const subTitleHtml = subTitle
    ? ` <span class="sub-title">${escapeHtml(subTitle)}</span>`
    : "";
  const descHtml = desc
    ? `<span class="link-desc">${escapeHtml(desc)}</span>`
    : "";
  return `<a href="${escapeHtml(href)}"><div class="shared-link">${coverHtml}<div class="link-content"><span class="link-title">${escapeHtml(title)}${subTitleHtml}</span>${descHtml}</div></div></a>`;
}

function resolveSharedLinkPlaceholders(html, postIndex, root = "/") {
  if (!html || !html.includes(PLACEHOLDER_CLASS)) return html;

  const normRoot = normalizeRoot(root || postIndex?.root || "/");
  const placeholderRe = new RegExp(
    `(?:<p>\\s*)?<div\\b[^>]*\\bclass=["'][^"']*\\b${PLACEHOLDER_CLASS}\\b[^"']*["'][^>]*><\\/div>(?:\\s*<\\/p>)?`,
    "gi",
  );

  return String(html).replace(placeholderRe, (tag) => {
    const rawHref = getAttr(tag, "data-href").trim();
    const customTitle = getAttr(tag, "data-title").trim();
    const customDesc = getAttr(tag, "data-desc").trim();
    if (!rawHref) return "";

    const { query, hash } = splitHrefParts(rawHref);
    const target = findInternalPost(postIndex, rawHref);

    const resolvedHref = target?.path
      ? `${buildUrl(target.path, normRoot)}${query}${hash}`
      : buildUrl(rawHref, normRoot);

    const fallbackTitle =
      normalizeLookupPath(rawHref, normRoot) || rawHref.replace(/^\/+/, "");
    const title = customTitle || String(target?.title || "").trim() || fallbackTitle;
    const subTitle = customTitle ? "" : String(target?.subTitle || "").trim();
    const desc = customDesc || (target ? extractPlainExcerpt(target) : "");
    const cover = target
      ? resolveCoverUrl(target.thumbnail || target.cover || "", target, normRoot)
      : "";

    return renderSharedLinkCard({
      href: resolvedHref,
      title,
      subTitle,
      desc,
      cover,
    });
  });
}

function registerSharedLink(hexoInstance) {
  let cachedIndex = null;

  const invalidateIndex = () => {
    cachedIndex = null;
  };

  const getPostIndex = () => {
    if (!cachedIndex) {
      const posts = hexoInstance.locals?.get?.("posts");
      const pages = hexoInstance.locals?.get?.("pages");
      const root = hexoInstance.config?.root || "/";
      cachedIndex = buildInternalPostIndex(posts, pages, root);
    }
    return cachedIndex;
  };

  hexoInstance.extend.filter.register(
    "before_post_render",
    function (data) {
      if (data && typeof data.content === "string") {
        data.content = replaceSharedLinkMarkdown(data.content);
      }
      return data;
    },
    5,
  );

  hexoInstance.extend.filter.register(
    "after_post_render",
    function (data) {
      invalidateIndex();
      return data;
    },
    1,
  );

  hexoInstance.extend.filter.register(
    "before_generate",
    function () {
      invalidateIndex();
    },
    1,
  );

  hexoInstance.extend.filter.register(
    "after_render:html",
    function (html) {
      if (typeof html !== "string" || !html.includes(PLACEHOLDER_CLASS)) {
        return html;
      }
      const root = hexoInstance.config?.root || "/";
      return resolveSharedLinkPlaceholders(html, getPostIndex(), root);
    },
    1,
  );
}

if (typeof hexo !== "undefined") {
  registerSharedLink(hexo);
}

module.exports = {
  PLACEHOLDER_CLASS,
  replaceSharedLinkMarkdown,
  buildInternalPostIndex,
  findInternalPost,
  resolveSharedLinkPlaceholders,
  registerSharedLink,
};
