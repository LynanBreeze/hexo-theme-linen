const fs = require("hexo-fs");
const lazyLoadPath = __dirname + "/client.js";
const path = require("path");

const { defaultConfig } = require("./config");

module.exports = function (hexo) {
  return function injectScript(htmlContent, data) {
    const page = data?.page || {};
    const {
      loadingImage,
      errorTipImage,
      intersectionRatio,
      placeholderRatio,
      showTransition,
      preloadCount,
      keepPlaceholder: configKeepPlaceholder,
    } = {
      ...defaultConfig,
      ...(hexo?.config?.theme_config?.lazyload || {}),
    };

    const resolveSiteAsset = (assetPath) => {
      if (!assetPath || /^(https?:)?\/\//i.test(assetPath) || /^data:/i.test(assetPath)) {
        return assetPath;
      }
      if (!assetPath.startsWith("/")) return assetPath;

      const rootSegments = String(hexo.config.root || "")
        .split("/")
        .filter(Boolean)
        .join("/");
      const root = rootSegments ? `/${rootSegments}/` : "/";
      return `${root}${assetPath.replace(/^\/+/, "")}`;
    };
    const resolvedLoadingImage = resolveSiteAsset(loadingImage);
    const resolvedErrorTipImage = resolveSiteAsset(errorTipImage);

    const placeholderImage =
      /^(https?:\/\/|\/|data:image|\.\.\/)/i.test(resolvedLoadingImage) ||
      /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(resolvedLoadingImage)
        ? `url(${resolvedLoadingImage})`
        : resolvedLoadingImage;

    const injectedStyles = `.lazyload-outer-wrap .caption{
    width: 100%;
    text-align: center;
    display: block;
  }
  .lazyload-outer-wrap{
    display: block;
    margin-top: 1em;
    margin-bottom: 1em;
  }
  .lazyload-wrap {
    position: relative;
    display: block;
    border-radius: 0.1em;
  }
  .lazyload-wrap .placeholder {
    width: 100%;
    height: 0;
    display: block;
    padding-bottom: ${(100 / Number(placeholderRatio)).toFixed(5)}%;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    ${resolvedLoadingImage ? `background-image: ${placeholderImage};` : ""}
    background-color: #fff;
  }
  .lazyload-wrap .placeholder canvas{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  .lazyload-wrap .inner-wrap video, .lazyload-wrap .inner-wrap iframe{
    width: 100%;
    height: 100%;
    border-radius: inherit;
  }
  .lazyload-wrap .inner-wrap, .lazyload-wrap .error-wrap{
    opacity: 0;
    ${showTransition ? "transition: opacity ease-in-out 0.3s;" : ""}
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    will-change: opacity;
    border-radius: inherit;
  }
  .lazyload-wrap .gallery-item{
    border-radius: inherit;
  }
  .lazyload-wrap .inner-wrap.loaded{
    opacity: 1;
  }
  .lazyload-wrap img{
    object-fit: contain;
    display: block;
    margin: 0 auto !important;
    height: 100% !important;
    border-radius: inherit;
  }
  .lazyload-wrap .placeholder.loaded {
    background-image: none !important;
    background-color: unset !important;
  }
  .lazyload-wrap.loaded .inner-wrap {
    opacity: 1;
  }
  .lazyload-wrap .error-wrap{
    background-color: #f7f6f2;
    opacity: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .lazyload-wrap .error-wrap .error-tip{
    width: 60%;
    background-size: cover;
    background-image: url(${resolvedErrorTipImage});
  }
  .lazyload-wrap .error-wrap .error-tip::before{
    content: '';
    display: block;
    width: 100%;
    padding-top: 26.79640719%;
  }
  .lazyload-wrap .error-wrap .retry-btn{
    margin-top: 1.5em;
    background-color: #ffffff;
    border: 1px solid rgba(34, 33, 31, 0.18);
    border-radius: 4px;
    box-sizing: border-box;
    color: #22211f;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
    font-size: 13px;
    font-weight: 500;
    height: 32px;
    padding: 0 14px;
    text-align: center;
    transition: border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .lazyload-wrap .error-wrap .retry-btn:hover{
    border-color: rgba(168, 69, 46, 0.35);
    color: #a8452e;
    background-color: rgba(168, 69, 46, 0.06);
  }`;

    let settingsContent = `<script>var $lazyload = {
    intersectionRatio: ${intersectionRatio},
    preloadCount: ${preloadCount},
    showTransition: ${showTransition},
    keepPlaceholder: ${
      page?.lazyload?.keepPlaceholder ?? configKeepPlaceholder ?? true
    }}</script>`;

    const injectExtraScript = function (filePath) {
      if (!fs.exists(filePath)) throw new TypeError(filePath + " not found!");
      const sourceCode = fs.readFileSync(filePath, { escape: true });
      fs.writeFileSync(
        path.join(hexo.theme_dir, "source/linen-theme/js/lazyload.js"),
        sourceCode,
      );
    };
    const injectExtraStyles = function (sourceCode) {
      fs.writeFileSync(
        path.join(hexo.theme_dir, "source/linen-theme/css/lazyload.css"),
        sourceCode,
      );
    };
    const appendToHead = function (content, htmlContent) {
      const lastIndex = htmlContent.lastIndexOf("</head>");
      return (
        htmlContent.substring(0, lastIndex) +
        content +
        htmlContent.substring(lastIndex, htmlContent.length)
      );
    };
    if (/<\/body>/gi.test(htmlContent)) {
      htmlContent = appendToHead(settingsContent, htmlContent);
      htmlContent = appendToHead(
        `<link rel="preload" as="image" href="${resolvedLoadingImage}" />`,
        htmlContent,
      );
      htmlContent = appendToHead(
        `<link rel="preload" as="image" href="${resolvedErrorTipImage}" />`,
        htmlContent,
      );
      injectExtraScript(lazyLoadPath);
      injectExtraStyles(injectedStyles);
      htmlContent = htmlContent.replace(
        '<noscript id="noscript-styles"></noscript>',
        `<noscript id="noscript-styles"><style>${fs.readFileSync(
          path.join(hexo.theme_dir, "source/linen-theme/css/noscript.css"),
        )}</style></noscript>`,
      );
    }
    return htmlContent;
  };
};
