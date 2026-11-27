"use strict";

const {
  getLazyloadConfig,
  resolveSiteAsset,
} = require("./assets");

module.exports = function (hexo) {
  return function injectScript(htmlContent, data) {
    if (
      !htmlContent ||
      !/<\/body>/i.test(htmlContent) ||
      !htmlContent.includes("lazyload-wrap")
    ) {
      return htmlContent;
    }

    const page = data?.page || {};
    const {
      loadingImage,
      intersectionRatio,
      showTransition,
      preloadCount,
      keepPlaceholder: configKeepPlaceholder,
    } = getLazyloadConfig(hexo);

    const resolvedLoadingImage = resolveSiteAsset(hexo, loadingImage);
    const lazyloadConfig = {
      intersectionRatio: Number(intersectionRatio) || 0.33,
      preloadCount: Number(preloadCount) || 0,
      showTransition: showTransition !== false,
      keepPlaceholder: Boolean(
        page?.lazyload?.keepPlaceholder ?? configKeepPlaceholder ?? true,
      ),
    };

    const settingsContent = `<script>var $lazyload = ${JSON.stringify(lazyloadConfig)};</script>`;
    const version = String(
      hexo?.theme?.config?.version ||
        hexo?.config?.theme_config?.version ||
        "1.0.0",
    );
    const cssHref = `${resolveSiteAsset(hexo, "/linen-theme/css/lazyload.css")}?v=${encodeURIComponent(version)}`;
    const jsSrc = `${resolveSiteAsset(hexo, "/linen-theme/js/lazyload.js")}?v=${encodeURIComponent(version)}`;

    const headAdditions = [];
    if (!htmlContent.includes("/linen-theme/css/lazyload.css")) {
      headAdditions.push(`<link rel="stylesheet" href="${cssHref}" />`);
    }
    headAdditions.push(settingsContent);
    if (resolvedLoadingImage) {
      headAdditions.push(
        `<link rel="preload" as="image" href="${resolvedLoadingImage}" />`,
      );
    }

    const noscriptMatch = /<noscript>\s*<link[^>]*noscript\.css/i.exec(
      htmlContent,
    );
    const lastHeadClose = htmlContent.lastIndexOf("</head>");
    const headInsertPos =
      noscriptMatch &&
      lastHeadClose !== -1 &&
      noscriptMatch.index < lastHeadClose
        ? noscriptMatch.index
        : lastHeadClose;
    if (headInsertPos !== -1) {
      htmlContent =
        htmlContent.substring(0, headInsertPos) +
        headAdditions.join("") +
        htmlContent.substring(headInsertPos);
    }

    if (!htmlContent.includes("/linen-theme/js/lazyload.js")) {
      const lastBodyClose = htmlContent.lastIndexOf("</body>");
      if (lastBodyClose !== -1) {
        htmlContent =
          htmlContent.substring(0, lastBodyClose) +
          `<script src="${jsSrc}" defer></script>` +
          htmlContent.substring(lastBodyClose);
      }
    }

    return htmlContent;
  };
};
