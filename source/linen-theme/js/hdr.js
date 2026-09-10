var hdrSupport = false;
var hdrEnabled = false;
var lang = document.documentElement.getAttribute("lang") || "en";

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
const HDRSwitchButton = document.querySelector(".hdr-switch");

function switchHDR() {
  var HDRPath = window.hdrAssetsPrefix || "";
  if (!HDRPath) return;

  var SDRPath = HDRPath.replace("/hdr", "/sdr");
  var articleElement = document.querySelector(".article");
  var targetState = !hdrEnabled;
  if (articleElement) {
    var lazyloadItems = articleElement.querySelectorAll(".lazyload-outer-wrap");
    Array.from(lazyloadItems).forEach((item) => {
      const links = item.querySelectorAll(".gallery-item");
      links.forEach((link) => {
        if (targetState) {
          if (link.href && link.href.includes(SDRPath)) {
            link.href = link.href.replace(SDRPath, HDRPath);
          } else {
            var hrefAttr = link.getAttribute("href");
            if (hrefAttr && hrefAttr.includes(SDRPath)) {
              link.setAttribute("href", hrefAttr.replace(SDRPath, HDRPath));
            }
          }
        } else {
          if (link.href && link.href.includes(HDRPath)) {
            link.href = link.href.replace(HDRPath, SDRPath);
          } else {
            var hrefAttr = link.getAttribute("href");
            if (hrefAttr && hrefAttr.includes(HDRPath)) {
              link.setAttribute("href", hrefAttr.replace(HDRPath, SDRPath));
            }
          }
        }
      });
      const lazyloadItem = item.querySelector(".lazyload-wrap");
      var dcontent = lazyloadItem.getAttribute("data-content") || "";
      if (targetState) {
        if (dcontent.includes(encodeURIComponent(SDRPath))) {
          lazyloadItem.setAttribute(
            "data-content",
            dcontent.replace(
              encodeURIComponent(SDRPath),
              encodeURIComponent(HDRPath)
            )
          );
        }
      } else {
        if (dcontent.includes(encodeURIComponent(HDRPath))) {
          lazyloadItem.setAttribute(
            "data-content",
            dcontent.replace(
              encodeURIComponent(HDRPath),
              encodeURIComponent(SDRPath)
            )
          );
        }
      }
      var encodedHDRPath = encodeURIComponent(HDRPath);
      var encodedSDRPath = encodeURIComponent(SDRPath);
      var isHDRAsset =
        dcontent.includes(encodedHDRPath) ||
        dcontent.includes(encodedSDRPath);
      if (isHDRAsset) {
        lazyloadItem.setAttribute("data-hdr-active", targetState ? "true" : "false");
      } else {
        lazyloadItem.removeAttribute("data-hdr-active");
      }
      var innerWrap = lazyloadItem.querySelector(".inner-wrap");
      var placeholder = lazyloadItem.querySelector(".placeholder");
      var InnerImgs = lazyloadItem.querySelectorAll("img");
      InnerImgs.forEach((img) => {
        if (targetState) {
          if (img.src && img.src.includes(SDRPath)) {
            // Re-enter the lazyload visual state while the replacement image
            // is loading. The placeholder remains underneath the image.
            lazyloadItem.classList.remove("loaded");
            if (innerWrap) {
              innerWrap.classList.remove("loaded");
              innerWrap.style.opacity = "0";
            }
            if (placeholder) placeholder.classList.remove("loaded");
            img.src = img.src.replace(SDRPath, HDRPath);
          }
        } else {
          if (img.src && img.src.includes(HDRPath)) {
            lazyloadItem.classList.remove("loaded");
            if (innerWrap) {
              innerWrap.classList.remove("loaded");
              innerWrap.style.opacity = "0";
            }
            if (placeholder) placeholder.classList.remove("loaded");
            img.src = img.src.replace(HDRPath, SDRPath);
          }
        }
      });
    });
  }
  hdrEnabled = targetState;
  if (HDRSwitchButton) {
    if (targetState) {
      HDRSwitchButton.classList.add("hdr_on");
    } else {
      HDRSwitchButton.classList.remove("hdr_on");
    }
  }
}

if (hdrSupport) {
  switchHDR();
}

HDRSwitchButton && HDRSwitchButton.addEventListener("click", switchHDR);
