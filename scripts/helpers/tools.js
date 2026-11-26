const moment = require("moment");
const {
  getSiteData,
  resolvePostLayoutStyle,
  resolvePostBreakoutConfig,
  resolveIsMapSeries,
} = require("../lib/site-data");

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
  }
  if (this.is_year()) {
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
    let hasTranslatation = Object.keys(
      config?.theme_config?.siteOriginLocaleMap || {},
    ).length
      ? this.is_post()
        ? translations.length >= 1
        : !page?.series || page?.seriesInfo?.mappingName
      : false;
    let origin =
      config?.theme_config?.siteOriginLocaleMap?.[targetLanguage] || config.url;
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
      targetLanguagePath = `${originBase}/series/${page?.seriesInfo?.mappingName}/`;
    }
    if (this.is_category()) {
      if (categoriesInfo?.[page.category]?.mappingName) {
        targetLanguagePath = `${originBase}/categories/${
          categoriesInfo?.[page.category]?.mappingName
        }/`;
      } else {
        hasTranslatation = false;
      }
    }
    if (this.is_tag()) {
      if (tagsInfo?.[page.tag]?.mappingName) {
        targetLanguagePath = `${originBase}/tags/${tagsInfo?.[page.tag]?.mappingName}/`;
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

  // 统一转成 moment，避免 generator 阶段是原生 Date
  const date =
    typeof rawDate === "string"
      ? moment(new Date(rawDate))
      : moment(rawDate);
  if (!date.isValid()) return "";

  const language =
    lang ||
    postLang ||
    this?.page?.lang ||
    this?.page?.language ||
    this?.config?.language;

  if (language?.startsWith("zh")) {
    return date.format("M 月 D 日，YYYY");
  }

  return date.format("MMM D, YYYY");
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

    // 移除 HTML 标签，保留文本

    // 匹配代码块内容 <pre><code>...</code></pre>
    const codeBlocks = Array.from(content.matchAll(/<pre>[\s\S]*?<\/pre>/gi));
    let codeWords = 0;
    if (codeBlocks.length) {
      codeBlocks.forEach((block) => {
        const codeText = block[0].replace(/<[^>]+>/g, " ");
        codeWords += codeText.trim().split(/\s+/).length;
      });
    }

    // 文本内容（去掉无关元素）
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;

    // 匹配中文字符
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;

    // 匹配图片 <img>
    const imgTime = (photos * imgSec) / 60; // 转成分钟

    // 计算阅读时间
    const timeEnglish = englishWords / englishWPM;
    const timeChinese = chineseChars / chineseCPM;
    const timeCode = codeWords / codeWPM;

    const totalTime = timeEnglish + timeChinese + timeCode + imgTime;

    return Math.max(1, Math.round(totalTime)); // 最少 1 分钟
  },
);

hexo.extend.helper.register("extractTocFromHtml", function (htmlString) {
  // 匹配 h2 和 h3 的正则表达式，增加捕获 id 处理
  const headingRegex = /<(h2|h3)(?:[^>]*?\s+id="([^"]*)")?[^>]*>(.*?)<\/\1>/gi;

  const toc = [];
  let currentH2 = null;

  let match;
  while ((match = headingRegex.exec(htmlString)) !== null) {
    const tag = match[1]; // h2 或 h3
    let id = match[2]; // 已存在的 id
    let content = match[3].trim(); // 提取标签内容

    // 移除 KaTeX 隐藏的 MathML，避免纯文本提取出现重复公式内容
    content = content.replace(/<span class="katex-mathml">[\s\S]*?<\/span>/g, "");

    // 去除所有 HTML 标签，提取纯文本内容
    content = content.replace(/<[^>]*>/g, "");

    if (tag === "h2") {
      // 创建新的 h2 结构
      currentH2 = {
        title: content,
        id: id,
        children: [],
      };
      toc.push(currentH2);
    } else if (tag === "h3" && id && currentH2) {
      // 将 h3 添加到当前 h2 的 children 数组中
      currentH2.children.push({
        title: content,
        id: id,
      });
    }
  }

  return toc;
});
