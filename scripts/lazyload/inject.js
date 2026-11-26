"use strict";

const {
  getLazyloadConfig,
  resolveSiteAsset,
} = require("./assets");

module.exports = function (hexo) {
  return function injectScript(htmlContent, data) {
    if (!htmlContent || !/<\/body>/i.test(htmlContent)) {
      return htmlContent;
    }

    const page = data?.page || {};
    const {
      loadingImage,
      errorTipImage,
      intersectionRatio,
      showTransition,
      preloadCount,
      keepPlaceholder: configKeepPlaceholder,
    } = getLazyloadConfig(hexo);

    const resolvedLoadingImage = resolveSiteAsset(hexo, loadingImage);
    const resolvedErrorTipImage = resolveSiteAsset(hexo, errorTipImage);

    const settingsContent = `<script>var $lazyload = {
    intersectionRatio: ${intersectionRatio},
    preloadCount: ${preloadCount},
    showTransition: ${showTransition},
    keepPlaceholder: ${
      page?.lazyload?.keepPlaceholder ?? configKeepPlaceholder ?? true
    }}</script>`;

    const headAdditions = [settingsContent];
    if (resolvedLoadingImage) {
      headAdditions.push(
        `<link rel="preload" as="image" href="${resolvedLoadingImage}" />`,
      );
    }
    if (resolvedErrorTipImage) {
      headAdditions.push(
        `<link rel="preload" as="image" href="${resolvedErrorTipImage}" />`,
      );
    }

    const lastHeadClose = htmlContent.lastIndexOf("</head>");
    if (lastHeadClose !== -1) {
      htmlContent =
        htmlContent.substring(0, lastHeadClose) +
        headAdditions.join("") +
        htmlContent.substring(lastHeadClose);
    }

    return htmlContent;
  };
};
