const {
  getSiteData,
  resolvePostLayoutStyle,
  resolvePostBreakoutConfig,
  resolveIsMapSeries,
} = require("../lib/site-data");

const EN_SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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

function encodePathSegments(rawPath) {
  return String(rawPath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

hexo.extend.helper.register("take", function (arr, n = 1) {
  return arr.slice(0, Math.max(0, n));
});

hexo.extend.helper.register("takeLast", function (arr, n = 1) {
  return arr.slice(-Math.max(0, n));
});

hexo.extend.helper.register("getPageTitle", function () {
  const page = this.page;
  const config = this.config;
  let pageTitle = page.title || config.title || "";
  if (this.is_archive()) {
    pageTitle = this.__("common.archives");
  }
  if (this.is_tag()) {
    pageTitle = this.__("common.tag") + ": " + page.tag;
  }
  if (this.is_category()) {
    pageTitle = this.__("common.category") + ": " + page.category;
  }
  if (this.is_month()) {
    pageTitle += ": " + page.month + "/" + page.year;
  } else if (this.is_year()) {
    pageTitle += ": " + page.year;
  }
  if (this.is_home()) {
    pageTitle += this.is_home_first_page() ? "" : " - " + page.current;
  }
  if (!this.is_post() && !!page.series) {
    pageTitle = this.__("common.series") + ": " + page.series;
  }
  if (page.subTitle) {
    pageTitle += `(${page.subTitle})`;
  }
  return pageTitle;
});

hexo.extend.helper.register("getSeriesInfo", function (seriesName) {
  const seriesInfo = getSiteData(hexo, "series");
  return seriesInfo?.[seriesName] || {};
});

hexo.extend.helper.register("getPostLayoutStyle", function (post, seriesInfoArg) {
  return resolvePostLayoutStyle(post, this, seriesInfoArg, hexo);
});

hexo.extend.helper.register("getPostBreakoutConfig", function (post, seriesInfoArg) {
  return resolvePostBreakoutConfig(post, this, seriesInfoArg, hexo);
});

hexo.extend.helper.register("isMapSeries", function (seriesName, seriesInfoArg) {
  return resolveIsMapSeries(seriesName, this, seriesInfoArg, hexo);
});

hexo.extend.helper.register("getCategoryInfo", function (categoryName) {
  const categoriesInfo = getSiteData(hexo, "categories");
  return categoriesInfo?.[categoryName] || {};
});

hexo.extend.helper.register("getTagInfo", function (tagName) {
  const tagsInfo = getSiteData(hexo, "tags");
  return tagsInfo?.[tagName] || {};
});

hexo.extend.helper.register("getTranslationPage", function () {
  try {
    const page = this.page;
    const config = this.config;
    const translations = page.translations || [];
    const currentLanguage = page.language || config.language;
    const targetLanguage =
      translations.length >= 1
        ? translations[0]
        : currentLanguage === "en"
          ? "zh-CN"
          : "en";
    const categoriesInfo = getSiteData(hexo, "categories");
    const tagsInfo = getSiteData(hexo, "tags");
    const localeMap =
      this.theme?.siteOriginLocaleMap ||
      config?.theme_config?.siteOriginLocaleMap ||
      {};
    let hasTranslatation = Object.keys(localeMap).length
      ? this.is_post()
        ? translations.length >= 1
        : !page?.series || Boolean(page?.seriesInfo?.mappingName)
      : false;
    let origin = localeMap?.[targetLanguage] || config.url;
    // `url_for` includes the current site's `root` (for example, the GitHub
    // Pages repository path). The locale origin may already include its own
    // root, so only append the page path portion to avoid duplicating it.
    const rootPath = String(config.root || "/").replace(/^\/+|\/+$/g, "");
    const siteRoot = rootPath ? `/${rootPath}/` : "/";
    let pagePath = this.url_for(page.path);
    if (siteRoot !== "/" && pagePath.startsWith(siteRoot)) {
      pagePath = pagePath.slice(siteRoot.length - 1);
    }
    const originBase = String(origin || "").replace(/\/+$/, "");
    let targetLanguagePath = `${originBase}/${String(pagePath).replace(/^\/+/, "")}`;
    if (page?.seriesInfo?.mappingName) {
      targetLanguagePath = `${originBase}/series/${encodePathSegments(page.seriesInfo.mappingName)}/`;
    }
    if (this.is_category()) {
      if (categoriesInfo?.[page.category]?.mappingName) {
        targetLanguagePath = `${originBase}/categories/${encodePathSegments(
          categoriesInfo[page.category].mappingName,
        )}/`;
      } else {
        hasTranslatation = false;
      }
    }
    if (this.is_tag()) {
      if (tagsInfo?.[page.tag]?.mappingName) {
        targetLanguagePath = `${originBase}/tags/${encodePathSegments(tagsInfo[page.tag].mappingName)}/`;
      } else {
        hasTranslatation = false;
      }
    }
    return {
      hasTranslatation,
      targetLanguage,
      targetLanguagePath,
    };
  } catch (error) {
    console.log(error);
    return {
      hasTranslatation: false,
      targetLanguage: "",
      targetLanguagePath: "",
    };
  }
});

hexo.extend.helper.register("getPageDescription", function (maxLength = 220) {
  const page = this.page || {};
  const config = this.config || {};
  const raw =
    page.description ||
    page.seriesInfo?.description ||
    page.excerpt ||
    config.description ||
    "";
  const plain = String(raw)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLength > 0 && plain.length > maxLength) {
    return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
  }
  return plain;
});

hexo.extend.helper.register("getPostDate", function (post, lang) {
  let rawDate = null;
  let postLang = null;

  if (
    post instanceof Date ||
    typeof post === "string" ||
    typeof post === "number"
  ) {
    rawDate = post;
  } else if (post && typeof post === "object") {
    if (
      typeof post.format === "function" &&
      typeof post.isValid === "function"
    ) {
      rawDate = post;
    } else {
      rawDate = post.date;
      postLang = post.lang || post.language;
    }
  } else {
    rawDate = this?.page?.date;
    postLang = this?.page?.lang || this?.page?.language;
  }

  if (!rawDate) return "";

  let year;
  let monthIndex;
  let day;

  if (
    typeof rawDate === "object" &&
    typeof rawDate.format === "function" &&
    typeof rawDate.year === "function" &&
    typeof rawDate.month === "function" &&
    typeof rawDate.date === "function"
  ) {
    if (typeof rawDate.isValid === "function" && !rawDate.isValid()) return "";
    year = rawDate.year();
    monthIndex = rawDate.month();
    day = rawDate.date();
  } else if (
    typeof rawDate === "string" &&
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/.test(rawDate.trim())
  ) {
    const dateParts = rawDate.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    year = Number(dateParts[1]);
    monthIndex = Number(dateParts[2]) - 1;
    day = Number(dateParts[3]);
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return "";
  } else {
    const parsed = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return "";
    year = parsed.getFullYear();
    monthIndex = parsed.getMonth();
    day = parsed.getDate();
  }

  const language =
    lang ||
    postLang ||
    this?.page?.lang ||
    this?.page?.language ||
    this?.config?.language;

  if (language?.startsWith("zh")) {
    return `${monthIndex + 1} 月 ${day} 日，${year}`;
  }

  return `${EN_SHORT_MONTHS[monthIndex]} ${day}, ${year}`;
});

hexo.extend.helper.register(
  "estimateReadingTime",
  function (text, photos, content, options = {}) {
    const {
      chineseCPM = 260,
      englishWPM = 200,
      codeWPM = 100,
      imgSec = 2,
    } = options;

    const safeText = decodeHtmlEntities(String(text || "")).replace(
      /&[a-zA-Z]+;/g,
      " ",
    );
    const safeContent = String(content || "");

    // Strip Hexo highlight line-number gutter cells before counting code tokens
    const contentWithoutGutter = safeContent.replace(
      /<td\b[^>]*\bclass="[^"]*\bgutter\b[^"]*"[^>]*>[\s\S]*?<\/td>/gi,
      "",
    );
    const codeBlocks = Array.from(
      contentWithoutGutter.matchAll(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi),
    );
    let codeWords = 0;
    if (codeBlocks.length) {
      codeBlocks.forEach((block) => {
        const codeText = block[0].replace(/<[^>]+>/g, " ").trim();
        if (codeText) {
          codeWords += codeText.split(/\s+/).length;
        }
      });
    }

    // Plain text content (with non-body elements stripped)
    const englishWords = (safeText.match(/[a-zA-Z]+/g) || []).length;

    // Match CJK characters
    const chineseChars = (safeText.match(/[\u4e00-\u9fff]/g) || []).length;

    // Image reading time (converted to minutes)
    const imgTime = (photos * imgSec) / 60;

    // Estimate total reading time
    const timeEnglish = englishWords / englishWPM;
    const timeChinese = chineseChars / chineseCPM;
    const timeCode = codeWords / codeWPM;

    const totalTime = timeEnglish + timeChinese + timeCode + imgTime;

    return Math.max(1, Math.round(totalTime)); // Minimum 1 minute
  },
);

hexo.extend.helper.register("extractTocFromHtml", function (htmlString) {
  if (!htmlString || typeof htmlString !== "string") return [];
  // Match h2 and h3 headings and capture their id attributes
  const headingRegex = /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi;

  const toc = [];
  let currentH2 = null;

  let match;
  while ((match = headingRegex.exec(htmlString)) !== null) {
    const tag = match[1].toLowerCase(); // h2 or h3
    const attrs = match[2] || "";
    if (/\bclass=(?:"[^"]*\bhidden\b[^"]*"|'[^']*\bhidden\b[^']*')/i.test(attrs)) {
      continue;
    }
    const idMatch = attrs.match(/\sid=(?:"([^"]*)"|'([^']*)')/i);
    const id = idMatch ? (idMatch[1] ?? idMatch[2]) : undefined;
    let content = match[3].trim(); // Extract inner heading content

    // Strip hidden KaTeX MathML so plain text extraction does not duplicate formulas
    content = content.replace(/<span class="katex-mathml">[\s\S]*?<\/span>/g, "");

    // Strip remaining HTML tags and decode entities to get clean plain heading text
    content = decodeHtmlEntities(content.replace(/<[^>]*>/g, "")).trim();

    if (tag === "h2") {
      // Create a new top-level h2 entry
      currentH2 = {
        title: content,
        id: id,
        children: [],
      };
      toc.push(currentH2);
    } else if (tag === "h3" && id && currentH2) {
      // Attach h3 under the current h2's children list
      currentH2.children.push({
        title: content,
        id: id,
      });
    }
  }

  return toc;
});
