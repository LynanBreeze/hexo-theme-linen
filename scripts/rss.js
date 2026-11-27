const { url_for, full_url_for } = require("hexo-util");
const {
  buildInternalPostIndex,
  resolveSharedLinkPlaceholders,
} = require("./shared-link");

if (
  hexo?.theme?.config?.feed === false ||
  hexo?.config?.theme_config?.feed === false
) {
  return;
}

const rssSnapshotMap = new Map();

function escape(value) {
  if (value == null) return "";
  const str = String(value);

  const re = /[&<>"'`]/g;

  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
  };

  return str.replace(re, (ch) => map[ch]);
}

function decodeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#96;/g, "`")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getAttribute(html, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return html.match(pattern)?.[2] || "";
}

function stripHtml(value) {
  return decodeHtmlAttribute(String(value || "").replace(/<[^>]*>/g, "")).trim();
}

function getClassContent(html, className) {
  const pattern = new RegExp(
    `<[^>]*\\bclass\\s*=\\s*(["'])[^"']*\\b${className}\\b[^"']*\\1[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "i",
  );
  return stripHtml(html.match(pattern)?.[2] || "");
}

function toRfc822Date(dateValue) {
  if (!dateValue) return "";
  const d =
    typeof dateValue.toDate === "function"
      ? dateValue.toDate()
      : new Date(dateValue);
  return Number.isNaN(d.getTime()) ? "" : d.toUTCString();
}

function stripSwitcherLabel(line) {
  const contentStart = line.search(/!\[|<img\b|<iframe\b/i);
  const delimiterIndex = line.indexOf("|");
  if (
    delimiterIndex > -1 &&
    (contentStart === -1 || delimiterIndex < contentStart)
  ) {
    return line.slice(delimiterIndex + 1).trim();
  }
  return line;
}

function resolveDomainReplacements(feedConfig, configUrl) {
  const rawMap = feedConfig?.assetDomainMap || feedConfig?.asset_domain_map;
  if (!rawMap || typeof rawMap !== "object") {
    return [];
  }

  const normalizedSiteUrl = String(configUrl || "").replace(/\/+$/, "");
  const entries = Object.entries(rawMap);
  const hasNestedObjects = entries.some(
    ([, val]) => val && typeof val === "object" && !Array.isArray(val),
  );

  let targetMap = null;
  if (hasNestedObjects) {
    const matched =
      rawMap[configUrl] ||
      rawMap[normalizedSiteUrl] ||
      rawMap[`${normalizedSiteUrl}/`];
    if (matched && typeof matched === "object") {
      targetMap = matched;
    }
  } else {
    targetMap = rawMap;
  }

  if (!targetMap) return [];
  return Object.entries(targetMap).filter(
    ([from, to]) =>
      typeof from === "string" && from && typeof to === "string" && to,
  );
}

function applyDomainReplacements(value, replacements) {
  let out = String(value || "");
  if (!out || !replacements || !replacements.length) {
    return out;
  }
  for (const [from, to] of replacements) {
    out = out.split(from).join(to);
  }
  return out;
}

function replaceLivePhotoIframes(html, baseUrl, replacements) {
  return String(html || "").replace(/<iframe\b[\s\S]*?<\/iframe>/gi, (iframe) => {
    const src = decodeHtmlAttribute(getAttribute(iframe, "src"));
    if (!src.includes("/static/live-photo/")) return iframe;

    let picUrl = "";
    try {
      const parsed = new URL(src, baseUrl || "https://example.invalid");
      picUrl =
        parsed.searchParams.get("picUrl") ||
        parsed.searchParams.get("photoSrc") ||
        "";
    } catch {
      return iframe;
    }

    return picUrl
      ? `<br><img src="${escape(applyDomainReplacements(picUrl, replacements))}" alt=""><br>`
      : iframe;
  });
}

function replaceSharedLinkCards(html, baseUrl) {
  return String(html || "").replace(
    /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\bshared-link\b[^"']*\1[^>]*>(?:(?!<\/a>)[\s\S])*?<\/a>/gi,
    (linkCard) => {
      const href = decodeHtmlAttribute(getAttribute(linkCard, "href"));
      const title = getClassContent(linkCard, "link-title");
      const desc = getClassContent(linkCard, "link-desc");
      if (!href || !title) return linkCard;

      let url = href;
      try {
        url = new URL(href, baseUrl).href;
      } catch {}

      return `<p><a href="${escape(url)}">${escape(title)}</a>${desc ? `<br>${escape(desc)}` : ""}</p>`;
    },
  );
}

const IMAGE_MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

function getImageMimeType(url) {
  if (!url) return "image/jpeg";
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.[a-z0-9]+$/);
    if (match && IMAGE_MIME_TYPES[match[0]]) {
      return IMAGE_MIME_TYPES[match[0]];
    }
  } catch {
    // Fall back to default image MIME type when URL parsing fails.
  }
  return "image/jpeg";
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function resolveAssetUrl(rawUrl, siteUrl, root, baseUrl, replacements) {
  if (rawUrl == null) return "";
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return "";

  let resolved = "";
  if (/^(?:https?:|data:|mailto:|tel:|#)/i.test(trimmed)) {
    resolved = trimmed;
  } else if (trimmed.startsWith("//")) {
    resolved = `https:${trimmed}`;
  } else if (trimmed.startsWith("/")) {
    const normalizedRoot = root && root.endsWith("/") ? root : `${root || ""}/`;
    if (normalizedRoot !== "/" && trimmed.startsWith(normalizedRoot)) {
      try {
        resolved = new URL(trimmed, siteUrl).href;
      } catch {
        resolved = full_url_for.call(hexo, trimmed);
      }
    } else {
      resolved = full_url_for.call(hexo, trimmed);
    }
  } else if (baseUrl) {
    try {
      resolved = new URL(trimmed, baseUrl).href;
    } catch {
      resolved = full_url_for.call(hexo, trimmed);
    }
  } else {
    resolved = full_url_for.call(hexo, trimmed);
  }

  return applyDomainReplacements(resolved, replacements);
}

function absolutizeImgSrc(html, siteUrl, root, postUrl, replacements) {
  return String(html || "").replace(
    /(<img\b[^>]*?\bsrc=)(?:"([^"]+)"|'([^']+)')/gi,
    (match, prefix, doubleQuoted, singleQuoted) => {
      const rawSrc = doubleQuoted ?? singleQuoted ?? "";
      const decodedSrc = rawSrc.replace(/&amp;/g, "&").trim();
      if (!decodedSrc || /^data:/i.test(decodedSrc)) {
        return match;
      }
      if (/^https?:/i.test(decodedSrc)) {
        const replaced = applyDomainReplacements(decodedSrc, replacements);
        if (replaced === decodedSrc) return match;
        const quote = doubleQuoted != null ? '"' : "'";
        return `${prefix}${quote}${escape(replaced)}${quote}`;
      }
      const absoluteSrc = resolveAssetUrl(
        decodedSrc,
        siteUrl,
        root,
        postUrl,
        replacements,
      );
      const quote = doubleQuoted != null ? '"' : "'";
      return `${prefix}${quote}${escape(absoluteSrc)}${quote}`;
    },
  );
}

function startsWithImageUrl(html, targetUrl) {
  const match = String(html || "").match(
    /^\s*(?:<(?:p|figure|div|a)\b[^>]*>\s*)*<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')/i,
  );
  if (!match) return false;
  const firstSrc = (match[1] || match[2] || "").replace(/&amp;/g, "&");
  return firstSrc === targetUrl;
}

function replaceBalancedSpanByClass(html, classRe, replacer) {
  const openTagRe = /<span\b[^>]*>/gi;
  let result = "";
  let cursor = 0;
  let match;

  while ((match = openTagRe.exec(html)) !== null) {
    if (match.index < cursor) continue;
    const openTag = match[0];
    if (!classRe.test(openTag)) continue;

    const start = match.index;
    const tokenRe = /<(\/?)span\b[^>]*>/gi;
    tokenRe.lastIndex = start;
    let depth = 0;
    let end = -1;
    let token;

    while ((token = tokenRe.exec(html)) !== null) {
      if (token[1]) {
        depth--;
        if (depth === 0) {
          end = token.index + token[0].length;
          break;
        }
      } else {
        depth++;
      }
    }

    if (end === -1) continue;

    const fullBlock = html.slice(start, end);
    result += html.slice(cursor, start) + replacer(fullBlock);
    cursor = end;
    openTagRe.lastIndex = end;
  }

  return cursor === 0 ? html : result + html.slice(cursor);
}

function unwrapLazyloadWrappers(html, replacements) {
  if (!html || !html.includes("lazyload-outer-wrap")) return html;
  return replaceBalancedSpanByClass(
    html,
    /\bclass=["'][^"']*\blazyload-outer-wrap\b[^"']*["']/i,
    (block) => {
      const livePhotoPic = decodeHtmlAttribute(
        getAttribute(block, "data-live-photo-pic-url"),
      );
      if (livePhotoPic) {
        return `<br><img src="${escape(applyDomainReplacements(livePhotoPic, replacements))}" alt=""><br>`;
      }
      const noscriptMatch = block.match(/<noscript>([\s\S]*?)<\/noscript>/i);
      if (noscriptMatch) {
        const inner = noscriptMatch[1].trim();
        if (/^<(?:img|video)\b/i.test(inner)) {
          return inner;
        }
      }
      return "";
    },
  );
}

function simplifyKatexForRss(html) {
  if (!html || !html.includes("katex")) return html;
  return replaceBalancedSpanByClass(
    html,
    /\bclass=["'][^"']*\bkatex(?:-display)?\b[^"']*["']/i,
    (block) => {
      const mathMatch = block.match(/<math\b[\s\S]*?<\/math>/i);
      return mathMatch ? mathMatch[0] : block;
    },
  );
}

function cleanImgDirectivesForRss(html) {
  return String(html || "").replace(/<img\b[^>]*>/gi, (tag) => {
    let cleaned = tag
      .replace(/\s+data-placeholderimg\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\s+data-keep-placeholder\s*=\s*(?:"[^"]*"|'[^']*'|[\w-]+)/gi, "")
      .replace(/\s+(?:hide-placeholder|no-lazy|no-link)\b(?=\s|>|\/)/gi, "")
      .replace(/(\balt\s*=\s*["'])([^"']*)(["'])/gi, (_, open, altVal, close) => {
        const nextAlt = altVal
          .replace(/\$placeholder=\S+=placeholder/gi, "")
          .replace(/\$aspect-ratio=\S+=aspect-ratio/gi, "")
          .replace(/(?:^|\s+)\$?(?:no-lazy|no-link|hide-placeholder)\b/gi, "")
          .trim();
        return `${open}${nextAlt}${close}`;
      });

    if (!/\bloading\s*=/i.test(cleaned)) {
      cleaned = cleaned.replace(/^<img\b/i, '<img loading="lazy"');
    }
    return cleaned;
  });
}

function sanitizeHtmlForRss(html, siteUrl, root, configUrl, postUrl, replacements) {
  let out = String(html || "");
  out = unwrapLazyloadWrappers(out, replacements);
  out = out
    .replace(/<div\s+class=["']copy-btn["']><\/div>/gi, "")
    .replace(/<div\s+class=["']fold-toggle["']><\/div>/gi, "")
    .replace(/<div\s+id=["']gitalk-initiator["']><\/div>/gi, "");
  out = replaceLivePhotoIframes(out, configUrl || siteUrl, replacements);
  out = replaceSharedLinkCards(out, configUrl || siteUrl);
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  out = replaceBalancedSpanByClass(
    out,
    /\bclass=["'][^"']*\bimage-grid-switcher-controls\b[^"']*["']/i,
    () => "",
  );
  out = out.replace(
    /(<span\b[^>]*\bclass=["'][^"']*\bgrid-item\b[^"']*["'][^>]*?)\s+aria-hidden=["']true["']/gi,
    "$1",
  );
  out = out.replace(
    /<\/span>\s*(?=<span\b[^>]*\bclass=["'][^"']*\bgrid-item\b)/gi,
    "</span><br>",
  );
  out = simplifyKatexForRss(out);
  out = cleanImgDirectivesForRss(out);
  out = applyDomainReplacements(out, replacements);
  out = absolutizeImgSrc(out, siteUrl, root, postUrl, replacements);
  return out.trim();
}

function getPostSnapshotKey(post) {
  return post?.source || post?.path || "";
}

// Capture clean rendered HTML after latex restoration (priority 1) and before
// custom/folded/lazyload DOM mutations (priority >= 2).
hexo.extend.filter.register(
  "after_post_render",
  function (data) {
    const key = getPostSnapshotKey(data);
    if (key && typeof data?.content === "string") {
      rssSnapshotMap.set(key, data.content);
    }
    return data;
  },
  1.5,
);

hexo.extend.generator.register("rss", function (locals) {
  const themeConfig = hexo.theme.config;
  if (themeConfig?.feed === false) return;
  const feedConfig =
    themeConfig?.feed && typeof themeConfig.feed === "object"
      ? themeConfig.feed
      : {};
  const limit = feedConfig.limit ?? 10;
  const rawSorted = locals.posts.sort("-date");
  const allPosts =
    typeof rawSorted.toArray === "function"
      ? rawSorted.toArray()
      : typeof rawSorted.limit === "function"
        ? rawSorted.limit(Infinity)
        : Array.isArray(rawSorted)
          ? rawSorted
          : [];
  const posts = allPosts
    .filter((post) => {
      if (!post || post.published === false) return false;
      if (post.hide && (post.hide.rss || post.hide.archive || post.hide.seo)) {
        return false;
      }
      return true;
    })
    .slice(0, limit);
  const config = hexo.config;
  const language = config.language || "";
  const cssUrl = url_for.bind(hexo)(
    `/linen-theme/css/rss-${language.startsWith("zh") ? "zh" : "en"}.xsl`,
  );
  const siteUrl = full_url_for.call(hexo, "/");
  const replacements = resolveDomainReplacements(feedConfig, config.url);
  const feedIcon = feedConfig.icon
    ? applyDomainReplacements(
        full_url_for.call(hexo, feedConfig.icon),
        replacements,
      )
    : "";
  const followChallenge =
    feedConfig.follow_challenge || feedConfig.followChallenge;
  const followChallengeXml =
    followChallenge?.feedId && followChallenge?.userId
      ? `
  <follow_challenge>
    <feedId>${escape(followChallenge.feedId)}</feedId>
    <userId>${escape(followChallenge.userId)}</userId>
  </follow_challenge>`
      : "";
  const imageXml = feedIcon
    ? `
  <image>
      <url>${escape(feedIcon)}</url>
      <title>${escape(config.title)}</title>
      <link>${escape(siteUrl)}</link>
    </image>`
    : "";

  const feedPath = feedConfig.path ?? "/feed.xml";
  const feedSelfUrl = full_url_for.call(hexo, feedPath);
  const languageXml = language
    ? `\n  <language>${escape(language)}</language>`
    : "";
  const latestPostDate =
    posts.map((post) => toRfc822Date(post.date)).find(Boolean) || "";
  const lastBuildDate = latestPostDate || new Date().toUTCString();
  const sharedLinkIndex = buildInternalPostIndex(
    allPosts,
    locals.pages,
    config.root,
  );

  const feed = `<?xml version="1.0" encoding="UTF-8" ?>
<?xml-stylesheet type="text/xsl" href="${escape(cssUrl)}"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${escape(config.title)}</title>
  <link>${escape(siteUrl)}</link>
  <atom:link href="${escape(feedSelfUrl)}" rel="self" type="application/rss+xml" />
  <description>${escape(config.description || "")}</description>${languageXml}
  <lastBuildDate>${lastBuildDate}</lastBuildDate>${followChallengeXml}${imageXml}
  ${posts
    .map((post) => {
      const postUrl = full_url_for.call(hexo, post.path);
      const titleText = `${post.title}${post?.subTitle ? `(${post.subTitle})` : ""}`;
      const rawThumbnail = String(post.thumbnail || "").trim();
      const rawCover = String(post.cover || "").trim();
      const rawOgImage = String(post.ogImage || "").trim();
      const thumbnailUrl = resolveAssetUrl(
        rawThumbnail || rawCover || rawOgImage,
        siteUrl,
        config.root,
        undefined,
        replacements,
      );
      const coverUrl = resolveAssetUrl(
        rawCover || rawThumbnail || rawOgImage,
        siteUrl,
        config.root,
        undefined,
        replacements,
      );

      const snapshotKey = getPostSnapshotKey(post);
      const snapshotHtml = snapshotKey
        ? rssSnapshotMap.get(snapshotKey)
        : undefined;
      let rawHtml = "";

      if (typeof snapshotHtml === "string") {
        const resolvedSnapshot = resolveSharedLinkPlaceholders(
          snapshotHtml,
          sharedLinkIndex,
          config.root,
        );
        rawHtml = sanitizeHtmlForRss(
          resolvedSnapshot,
          siteUrl,
          config.root,
          config.url,
          postUrl,
          replacements,
        );
      } else if (typeof post.content === "string" && post.content.trim()) {
        const resolvedContent = resolveSharedLinkPlaceholders(
          post.content,
          sharedLinkIndex,
          config.root,
        );
        rawHtml = sanitizeHtmlForRss(
          resolvedContent,
          siteUrl,
          config.root,
          config.url,
          postUrl,
          replacements,
        );
      } else {
        const postContent = String(post._content || "").replace(
          /:::image-grid(?:\s+([\w-]+))?([\s\S]*?):::/g,
          (match, grid, content) => {
            const gridClass = grid ? ` ${grid}` : "";
            const normalizedContent =
              grid === "switcher"
                ? content
                    .split("\n")
                    .map((line) => stripSwitcherLabel(line.trim()))
                    .join("\n")
                : content;
            return `<span class="image-grid${gridClass}">${hexo.render
              .renderSync({
                text: normalizedContent,
                engine: "markdown",
              })
              .replace(/<p>/g, '<span class="grid-item">')
              .replace(/<\/p>\s*(?=<p>)/g, "</span><br>")
              .replace(/<\/p>/g, "</span>")}</span>`;
          },
        );
        const renderedFallback = hexo.render.renderSync({
          text: postContent,
          engine: "markdown",
        });
        rawHtml = sanitizeHtmlForRss(
          renderedFallback,
          siteUrl,
          config.root,
          config.url,
          postUrl,
          replacements,
        );
      }

      if (isHttpUrl(coverUrl) && !startsWithImageUrl(rawHtml, coverUrl)) {
        const coverImgHtml = `<p><img src="${escape(coverUrl)}" alt="${escape(titleText)}" /></p>`;
        rawHtml = rawHtml ? `${coverImgHtml}\n${rawHtml}` : coverImgHtml;
      }

      rawHtml = rawHtml.replace(/\]\]>/g, "]]]]><![CDATA[>");

      const mediaTags = [];
      if (isHttpUrl(thumbnailUrl)) {
        mediaTags.push(`<media:thumbnail url="${escape(thumbnailUrl)}" />`);
      }
      if (isHttpUrl(coverUrl)) {
        const coverMimeType = getImageMimeType(coverUrl);
        mediaTags.push(
          `<media:content url="${escape(coverUrl)}" medium="image" type="${coverMimeType}" />`,
        );
        mediaTags.push(
          `<enclosure url="${escape(coverUrl)}" length="0" type="${coverMimeType}" />`,
        );
      }
      const mediaXml = mediaTags.length
        ? `\n      ${mediaTags.join("\n      ")}`
        : "";
      const pubDate = toRfc822Date(post.date);

      return `
    <item>
      <title>${escape(titleText)}</title>
      <link>${escape(postUrl)}</link>
      <guid isPermaLink="true">${escape(postUrl)}</guid>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ""}${mediaXml}
      <description><![CDATA[${rawHtml}]]></description>
    </item>`;
    })
    .join("")}
</channel>
</rss>`;

  return {
    path: feedPath,
    data: feed,
  };
});
