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
<rss version="2.0">
<channel>
  <title>${escape(config.title)}</title>
  <link>${escape(siteUrl)}</link>
  <description>${escape(config.description || "")}</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${imageXml}
  ${posts
    .map((post) => {
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
      const rawHtml = hexo.render
        .renderSync({
          text: postContent,
          engine: "markdown",
        })
        .replace(
          /<img\b(?![^>]*\bloading=)([^>]*)>/gi,
          '<img loading="lazy"$1>',
        )
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
        .replace(/\]\]>/g, "]]]]><![CDATA[>");
      const postUrl = full_url_for.call(hexo, post.path);
      const pubDate = toRfc822Date(post.date);

      return `
    <item>
      <title>${escape(`${post.title}${post?.subTitle ? `(${post.subTitle})` : ""}`)}</title>
      <link>${escape(postUrl)}</link>
      <guid>${escape(postUrl)}</guid>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ""}
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
