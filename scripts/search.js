"use strict";

function stripHtmlForSearch(html) {
  if (!html) return "";
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<span class="katex-mathml">[\s\S]*?<\/span>/gi, " ")
    .replace(/<span class="pswp-caption-content">[\s\S]*?<\/span>/gi, " ")
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTermNames(collection) {
  if (!collection) return [];
  if (Array.isArray(collection.data)) {
    return collection.data.map((item) => item?.name).filter(Boolean);
  }
  if (typeof collection.map === "function") {
    return collection.map((item) => item?.name || item).filter(Boolean);
  }
  return [];
}

function formatIsoDate(dateValue) {
  if (!dateValue) return "";
  if (typeof dateValue.format === "function") {
    return dateValue.format("YYYY-MM-DD");
  }
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

hexo.extend.generator.register("linen-search-index", function (locals) {
  const searchConfig =
    hexo.theme.config?.search || hexo.config?.theme_config?.search || {};
  if (!searchConfig.enable) {
    return [];
  }

  const indexPath = String(
    searchConfig.path || "linen-theme/search-index.json",
  ).replace(/^\/+/, "");
  const includeContent = searchConfig.content !== false;
  const maxContentLength = Number(searchConfig.maxContentLength) || 2000;

  const rawPosts = locals.posts ? locals.posts.sort("-date") : [];
  const posts =
    typeof rawPosts.toArray === "function" ? rawPosts.toArray() : rawPosts;

  const records = [];
  for (const post of posts) {
    if (!post || post.published === false) continue;
    if (post.hide && (post.hide.archive || post.hide.seo)) continue;

    const excerptText = stripHtmlForSearch(post.excerpt || "");
    let contentText = "";
    if (includeContent) {
      contentText = stripHtmlForSearch(post.content || "");
      if (contentText.length > maxContentLength) {
        contentText = contentText.slice(0, maxContentLength);
      }
    }

    records.push({
      title: String(post.title || ""),
      subTitle: post.subTitle ? String(post.subTitle) : "",
      path: String(post.path || "").replace(/^\/+/, ""),
      date: formatIsoDate(post.date),
      categories: extractTermNames(post.categories),
      tags: extractTermNames(post.tags),
      series: post.series ? String(post.series) : "",
      excerpt: excerptText.slice(0, 320),
      content: contentText,
    });
  }

  return {
    path: indexPath,
    data: JSON.stringify(records),
  };
});
