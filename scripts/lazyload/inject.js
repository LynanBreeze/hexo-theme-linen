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
    } = {
      ...defaultConfig,
      ...(hexo?.config?.theme_config?.lazyload || {}),
    };

    const placeholderImage = /^(https?:\/\/|\/|data:image)/i.test(loadingImage) || loadingImage?.startsWith('../img')
      ? `url(${loadingImage})`
      : loadingImage;

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
    ${loadingImage ? `background-image: ${placeholderImage};` : ""}
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
    background-color: #f5f5f5;
    opacity: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .lazyload-wrap .error-wrap .error-tip{
    width: 60%;
    background-size: cover;
    background-image: url(${errorTipImage});
  }
  .lazyload-wrap .error-wrap .error-tip::before{
    content: '';
    display: block;
    width: 100%;
    padding-top: 26.79640719%;
  }
  .lazyload-wrap .error-wrap .retry-btn{
    margin-top: 2em;
    background-image: linear-gradient(#f7f8fa ,#e7e9ec);
    border-color: #adb1b8 #a2a6ac #8d9096;
    border-style: solid;
    border-width: 1px;
    border-radius: 3px;
    box-shadow: rgba(255,255,255,.6) 0 1px 0 inset;
    box-sizing: border-box;
    color: #0f1111;
    display: inline-block;
    font-family: "Amazon Ember",Arial,sans-serif;
    font-size: 14px;
    height: 29px;
    font-size: 13px;
    outline: 0;
    overflow: hidden;
    padding: 0 11px;
    text-align: center;
  }`;

    let settingsContent = `<script>var $lazyload = {
    intersectionRatio: ${intersectionRatio},
    preloadCount: ${preloadCount}, 
    keepPlaceholder: ${
      page?.lazyload?.keepPlaceholder ?? false
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
        `<link rel="preload" as="image" href="${loadingImage}" />`,
        htmlContent,
      );
      htmlContent = appendToHead(
        `<link rel="preload" as="image" href="${errorTipImage}" />`,
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
