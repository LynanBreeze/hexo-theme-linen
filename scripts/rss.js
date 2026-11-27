const { url_for, full_url_for } = require("hexo-util");

if (
  hexo?.theme?.config?.feed === false ||
  hexo?.config?.theme_config?.feed === false
) {
  return;
}

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

function resolveAssetUrl(rawUrl, siteUrl, root, baseUrl) {
  if (rawUrl == null) return "";
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return "";
  if (/^(?:https?:|data:|mailto:|tel:|#)/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith("/")) {
    const normalizedRoot = root && root.endsWith("/") ? root : `${root || ""}/`;
    if (normalizedRoot !== "/" && trimmed.startsWith(normalizedRoot)) {
      try {
        return new URL(trimmed, siteUrl).href;
      } catch {
        return full_url_for.call(hexo, trimmed);
      }
    }
    return full_url_for.call(hexo, trimmed);
  }
  if (baseUrl) {
    try {
      return new URL(trimmed, baseUrl).href;
    } catch {
      return full_url_for.call(hexo, trimmed);
    }
  }
  return full_url_for.call(hexo, trimmed);
}

function absolutizeImgSrc(html, siteUrl, root, postUrl) {
  return String(html || "").replace(
    /(<img\b[^>]*?\bsrc=)(?:"([^"]+)"|'([^']+)')/gi,
    (match, prefix, doubleQuoted, singleQuoted) => {
      const rawSrc = doubleQuoted ?? singleQuoted ?? "";
      const decodedSrc = rawSrc.replace(/&amp;/g, "&").trim();
      if (!decodedSrc || /^(?:https?:|data:)/i.test(decodedSrc)) {
        return match;
      }
      const absoluteSrc = resolveAssetUrl(decodedSrc, siteUrl, root, postUrl);
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

hexo.extend.generator.register("rss", function (locals) {
  const themeConfig = hexo.theme.config;
  const limit = themeConfig?.feed?.limit ?? 10;
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
  const cssUrl = url_for.bind(hexo)(`/linen-theme/css/rss-${language.startsWith("zh") ? "zh" : "en"}.xsl`);
  const siteUrl = full_url_for.call(hexo, "/");
  const feedIcon = themeConfig?.feed?.icon
    ? full_url_for.call(hexo, themeConfig.feed.icon)
    : "";
  const imageXml = feedIcon
    ? `
  <image>
      <url>${escape(feedIcon)}</url>
      <title>${escape(config.title)}</title>
      <link>${escape(siteUrl)}</link>
    </image>`
    : "";

  const feed = `<?xml version="1.0" encoding="UTF-8" ?>
<?xml-stylesheet type="text/xsl" href="${escape(cssUrl)}"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${escape(config.title)}</title>
  <link>${escape(siteUrl)}</link>
  <description>${escape(config.description || "")}</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${imageXml}
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
      );
      const coverUrl = resolveAssetUrl(
        rawCover || rawThumbnail || rawOgImage,
        siteUrl,
        config.root,
      );

      let postContent = String(post._content || "")
        .replace(
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
              .replace(/<\/p>/g, "</span>")}</span>`;
          },
        )
        .replace(/\s*data-placeholderimg="[^"]*"/g, "");
      let rawHtml = absolutizeImgSrc(
        hexo.render
          .renderSync({
            text: postContent,
            engine: "markdown",
          })
          .replace(
            /<img\b(?![^>]*\bloading=)([^>]*)>/gi,
            '<img loading="lazy"$1>',
          )
          .replace(/<iframe[\s\S]*?<\/iframe>/gi, ""),
        siteUrl,
        config.root,
        postUrl,
      );

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
      <guid>${escape(postUrl)}</guid>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ""}${mediaXml}
      <description><![CDATA[${rawHtml}]]></description>
    </item>`;
    })
    .join("")}
</channel>
</rss>`;

  return {
    path: themeConfig?.feed?.path ?? '/feed.xml',
    data: feed,
  };
});
