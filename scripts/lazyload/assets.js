"use strict";

const fs = require("fs");
const path = require("path");
const { defaultConfig } = require("./config");

const CLIENT_SCRIPT_PATH = path.join(__dirname, "client.js");

let cachedClientScript = null;

function getLazyloadConfig(hexo) {
  return {
    ...defaultConfig,
    ...(hexo?.config?.theme_config?.lazyload || {}),
    ...(hexo?.theme?.config?.lazyload || {}),
  };
}

function resolveSiteAsset(hexo, assetPath) {
  if (
    !assetPath ||
    /^(https?:)?\/\//i.test(assetPath) ||
    /^data:/i.test(assetPath)
  ) {
    return assetPath;
  }
  if (!assetPath.startsWith("/")) return assetPath;

  const rootSegments = String(hexo?.config?.root || "")
    .split("/")
    .filter(Boolean)
    .join("/");
  const root = rootSegments ? `/${rootSegments}/` : "/";
  return `${root}${assetPath.replace(/^\/+/, "")}`;
}

function buildLazyloadStyles(hexo) {
  const { loadingImage, errorTipImage, placeholderRatio, showTransition } =
    getLazyloadConfig(hexo);

  const resolvedLoadingImage = resolveSiteAsset(hexo, loadingImage);
  const resolvedErrorTipImage = resolveSiteAsset(hexo, errorTipImage);

  const placeholderImage =
    /^(https?:\/\/|\/|data:image|\.\.\/)/i.test(resolvedLoadingImage) ||
    /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(resolvedLoadingImage)
      ? `url(${resolvedLoadingImage})`
      : resolvedLoadingImage;

  return `.lazyload-outer-wrap .caption{
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
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 0;
    display: block;
    padding-bottom: ${(100 / Number(placeholderRatio)).toFixed(5)}%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-color: var(--linen-surface, #f4f2ec);
    border-radius: inherit;
  }
  @keyframes linen-lazyload-shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  .lazyload-wrap .placeholder::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 20%,
      var(--linen-shimmer-highlight, rgba(255, 255, 255, 0.55)) 50%,
      transparent 80%
    );
    transform: translateX(-100%);
    animation: linen-lazyload-shimmer 2.2s ease-in-out infinite;
    pointer-events: none;
  }
  ${
    resolvedLoadingImage
      ? `.lazyload-wrap .placeholder::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(40px, 34%);
    height: min(40px, 34%);
    transform: translate(-50%, -50%);
    background-image: ${placeholderImage};
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.75;
    pointer-events: none;
  }`
      : ""
  }
  .lazyload-wrap .placeholder.loaded::before,
  .lazyload-wrap .placeholder.loaded::after,
  .lazyload-wrap .placeholder[style*="background-image"]::before,
  .lazyload-wrap .placeholder[style*="background-image"]::after,
  .lazyload-wrap .placeholder:has(canvas)::before,
  .lazyload-wrap .placeholder:has(canvas)::after {
    display: none;
    animation: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .lazyload-wrap .placeholder::before {
      display: none;
      animation: none;
    }
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
    background-color: var(--linen-surface, #f4f2ec);
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
    filter: var(--linen-icon-invert, none);
  }
  .lazyload-wrap .error-wrap .error-tip::before{
    content: '';
    display: block;
    width: 100%;
    padding-top: 26.79640719%;
  }
  .lazyload-wrap .error-wrap .retry-btn{
    margin-top: 1.5em;
    background-color: var(--linen-bg-elevated, #ffffff);
    border: 1px solid var(--linen-border-strong, rgba(34, 33, 31, 0.2));
    border-radius: var(--linen-radius-md, 4px);
    box-sizing: border-box;
    color: var(--linen-ink, #22211f);
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
    border-color: var(--linen-accent-border, rgba(168, 69, 46, 0.28));
    color: var(--linen-accent, #a8452e);
    background-color: var(--linen-accent-soft, rgba(168, 69, 46, 0.08));
  }`;
}

function getLazyloadClientScript() {
  if (cachedClientScript === null) {
    cachedClientScript = fs.readFileSync(CLIENT_SCRIPT_PATH, "utf-8");
  }
  return cachedClientScript;
}

module.exports = {
  getLazyloadConfig,
  resolveSiteAsset,
  buildLazyloadStyles,
  getLazyloadClientScript,
};
