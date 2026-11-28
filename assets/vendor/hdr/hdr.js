(function () {
  "use strict";

  var hdrSupport = false;
  var hdrEnabled = false;
  var hdrAutoEnableMinWidth = 500;
  var scriptEl =
    document.currentScript || document.getElementById("linen-hdr-script");
  var scriptHdrAssetsPrefix =
    (scriptEl && scriptEl.dataset && scriptEl.dataset.hdrAssetsPrefix) || "";

  window.hdrEnabled = false;

  function testHDRSupport() {
    // `dynamic-range: high` describes the combination of the user agent and the
    // current output device. `screen.colorDepth` alone is not sufficient: a
    // 10-bit framebuffer can still be SDR, and some HDR displays report 8-bit
    // color depth (for example, through FRC or an OS compositor).
    if (
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(dynamic-range: high)").matches
    ) {
      return false;
    }

    // There is no web API that exposes "ISO 21496-1 gain map decoding" as a
    // standalone feature. `dynamic-range-limit: no-limit` is the closest
    // standards-based signal: the property applies to HDR images and browsers
    // that implement it have an HDR image rendering pipeline.
    if (
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("dynamic-range-limit: no-limit")
    ) {
      return true;
    }

    // Do not use a user-agent or color-depth fallback here. Both are only
    // heuristics and can report support when the browser will actually decode
    // an ISO gain map as its SDR base image.
    return false;
  }

  hdrSupport = testHDRSupport();
  var HDRSwitchButton = document.querySelector(".hdr-switch");

  function switchHDR() {
    var HDRPath = scriptHdrAssetsPrefix || window.hdrAssetsPrefix || "";
    if (!HDRPath) return;

    var SDRPath = HDRPath.replace("/hdr", "/sdr");
    if (SDRPath === HDRPath) return;
    var encodedHDRPath = encodeURIComponent(HDRPath);
    var encodedSDRPath = encodeURIComponent(SDRPath);
    var livePhotoHDR = "/livePhoto/hdr/";
    var livePhotoSDR = "/livePhoto/sdr/";
    var encodedLivePhotoHDR = encodeURIComponent(livePhotoHDR);
    var encodedLivePhotoSDR = encodeURIComponent(livePhotoSDR);

    function swapStr(str, from, to) {
      if (!str || !from || from === to || !str.includes(from)) return str;
      return str.split(from).join(to);
    }

    function swapAssetValue(value, toHDR, isEncoded) {
      if (!value) return value;
      var from = toHDR
        ? isEncoded
          ? encodedSDRPath
          : SDRPath
        : isEncoded
          ? encodedHDRPath
          : HDRPath;
      var to = toHDR
        ? isEncoded
          ? encodedHDRPath
          : HDRPath
        : isEncoded
          ? encodedSDRPath
          : SDRPath;
      var next = swapStr(value, from, to);
      if (next !== value) return next;
      var lpFrom = toHDR
        ? isEncoded
          ? encodedLivePhotoSDR
          : livePhotoSDR
        : isEncoded
          ? encodedLivePhotoHDR
          : livePhotoHDR;
      var lpTo = toHDR
        ? isEncoded
          ? encodedLivePhotoHDR
          : livePhotoHDR
        : isEncoded
          ? encodedLivePhotoSDR
          : livePhotoSDR;
      return swapStr(value, lpFrom, lpTo);
    }

    var articleElement = document.querySelector(".article");
    var targetState = !hdrEnabled;
    if (articleElement) {
      var lazyloadItems = articleElement.querySelectorAll(".lazyload-outer-wrap");
      Array.from(lazyloadItems).forEach(function (item) {
        var links = item.querySelectorAll(".gallery-item");
        links.forEach(function (link) {
          var hrefAttr = link.getAttribute("href");
          if (hrefAttr) {
            var nextHref = swapAssetValue(hrefAttr, targetState, false);
            if (nextHref !== hrefAttr) {
              link.setAttribute("href", nextHref);
            }
          } else if (link.href) {
            var nextLinkHref = swapAssetValue(link.href, targetState, false);
            if (nextLinkHref !== link.href) {
              link.href = nextLinkHref;
            }
          }

          var livePhotoPicUrl = link.getAttribute("data-live-photo-pic-url");
          if (livePhotoPicUrl) {
            var nextPicUrl = swapAssetValue(livePhotoPicUrl, targetState, false);
            if (nextPicUrl !== livePhotoPicUrl) {
              link.setAttribute("data-live-photo-pic-url", nextPicUrl);
            }
          }

          var livePhotoSrc = link.getAttribute("data-live-photo-src");
          if (livePhotoSrc) {
            var nextLivePhotoSrc = swapAssetValue(livePhotoSrc, targetState, true);
            if (nextLivePhotoSrc !== livePhotoSrc) {
              link.setAttribute("data-live-photo-src", nextLivePhotoSrc);
            }
          }
        });
        var lazyloadItem = item.querySelector(".lazyload-wrap");
        if (!lazyloadItem) return;
        var dcontent = lazyloadItem.getAttribute("data-content") || "";
        var nextDcontent = swapAssetValue(dcontent, targetState, true);
        if (nextDcontent !== dcontent) {
          lazyloadItem.setAttribute("data-content", nextDcontent);
        }
        var isHDRAsset =
          dcontent.includes(encodedHDRPath) ||
          dcontent.includes(encodedSDRPath) ||
          dcontent.includes(encodedLivePhotoHDR) ||
          dcontent.includes(encodedLivePhotoSDR);
        if (isHDRAsset) {
          lazyloadItem.setAttribute(
            "data-hdr-active",
            targetState ? "true" : "false",
          );
        } else {
          lazyloadItem.removeAttribute("data-hdr-active");
        }
        var InnerImgs = lazyloadItem.querySelectorAll("img");
        InnerImgs.forEach(function (img) {
          if (img.src) {
            var nextImgSrc = swapAssetValue(img.src, targetState, false);
            if (nextImgSrc !== img.src) {
              img.src = nextImgSrc;
            }
          }
        });
        var innerIframes = lazyloadItem.querySelectorAll(
          'iframe[src*="/static/live-photo/"]',
        );
        innerIframes.forEach(function (iframe) {
          var currentIframeSrc = iframe.getAttribute("src") || iframe.src || "";
          var nextIframeSrc = swapAssetValue(currentIframeSrc, targetState, false);
          if (nextIframeSrc && nextIframeSrc !== currentIframeSrc) {
            iframe.setAttribute("src", nextIframeSrc);
          }
        });
      });
    }
    hdrEnabled = targetState;
    window.hdrEnabled = targetState;
    if (HDRSwitchButton) {
      if (targetState) {
        HDRSwitchButton.classList.add("hdr_on");
      } else {
        HDRSwitchButton.classList.remove("hdr_on");
      }
    }
  }

  if (hdrSupport && window.innerWidth >= hdrAutoEnableMinWidth) {
    switchHDR();
  }

  if (HDRSwitchButton) {
    HDRSwitchButton.addEventListener("click", switchHDR);
  }
})();
