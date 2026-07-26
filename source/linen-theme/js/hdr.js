var hdrSupport = false;
var hdrEnabled = false;
var lang = document.documentElement.getAttribute("lang") || "en";

function testHDRSupport() {
  const ua = navigator.userAgent;
  
  // 1. Exclude WeChat
  if (/MicroMessenger/i.test(ua)) {
    return false;
  }
  
  // 2. Exclude extremely small screen devices
  if (window.screen.width <= 330) {
    return false;
  }

  // 3. Exclude macOS Safari (Option A) due to EDR image rendering inconsistencies
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  if (isMac && isSafari) {
    return false;
  }

  // 4. Modern standard: check dynamic-range media query
  if (window.matchMedia) {
    const hasHDR = window.matchMedia("(dynamic-range: high)").matches;
    if (hasHDR) return true;
  }

  // 5. Legacy fallback: check 10-bit color depth
  return window.screen.colorDepth >= 30;
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
              link.setAttribute("href", HDRPath);
            }
          }
        } else {
          if (link.href && link.href.includes(HDRPath)) {
            link.href = link.href.replace(HDRPath, SDRPath);
          } else {
            var hrefAttr = link.getAttribute("href");
            if (hrefAttr && hrefAttr.includes(HDRPath)) {
              link.setAttribute("href", SDRPath);
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
      var InnerImgs = lazyloadItem.querySelectorAll("img");
      InnerImgs.forEach((img) => {
        if (targetState) {
          if (img.src && img.src.includes(SDRPath)) {
            img.src = img.src.replace(SDRPath, HDRPath);
          }
        } else {
          if (img.src && img.src.includes(HDRPath)) {
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
