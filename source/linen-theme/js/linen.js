var previousScrollY = 0;
var isResizing = false;
var viewportWidth = window.innerWidth;
var isAnchoring = false;
var anchoringId = null;
var anchoringTimer = null;
function triggerAnchoring() {
  if (window.innerWidth > 1280) return;
  isAnchoring = true;
  var header = document.querySelector(".nav-header");
  if (header) {
    header.classList.add("hide");
  }
  clearTimeout(anchoringTimer);
  anchoringTimer = setTimeout(function () {
    isAnchoring = false;
    if (window.scrollY <= 60) {
      var header = document.querySelector(".nav-header");
      if (header) {
        header.classList.remove("hide");
      }
    }
  }, 800);
}

(function addUAClass() {
  const isIOS = /iPhone/.test(window.navigator.userAgent);

  if (isIOS) {
    document.body.classList.add("ios");
  }
})();

function isEqual(obj1, obj2) {
  if (obj1 === obj2) {
    return true;
  }
  if (
    typeof obj1 !== "object" ||
    obj1 === null ||
    typeof obj2 !== "object" ||
    obj2 === null
  ) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let key of keys1) {
    if (!keys2.includes(key) || !isEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

function cloneDeep(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value);
  }

  if (value instanceof RegExp) {
    return new RegExp(value);
  }

  if (Array.isArray(value)) {
    const arrCopy = [];
    for (let i = 0; i < value.length; i++) {
      arrCopy[i] = cloneDeep(value[i]);
    }
    return arrCopy;
  }

  const objCopy = {};
  for (const key in value) {
    if (value.hasOwnProperty(key)) {
      objCopy[key] = cloneDeep(value[key]);
    }
  }
  return objCopy;
}

function debounce(fn, delay) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let firstCall = true;

  return function (...args) {
    if (firstCall) {
      fn.apply(this, args);
      firstCall = false;
    }

    lastArgs = args;
    lastThis = this;

    clearTimeout(timer);
    timer = setTimeout(() => {
      if (lastArgs) {
        fn.apply(lastThis, lastArgs);
      }
      firstCall = true;
    }, delay);
  };
}

function throttle(func, limit) {
  let lastRan = 0;
  let timeoutId = null;
  let lastArgs = null;
  let lastContext = null;

  return function (...args) {
    const now = Date.now();

    lastArgs = args;
    lastContext = this;

    const remaining = limit - (now - lastRan);

    if (lastRan === 0 || remaining <= 0) {
      func.apply(lastContext, lastArgs);
      lastRan = now;
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        func.apply(lastContext, lastArgs);
        lastRan = Date.now();
        timeoutId = null;
      }, remaining);
    }
  };
}

function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => {})
      .catch((err) => {
        console.error("复制失败:", err);
      });
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("复制失败:", err);
    }
    document.body.removeChild(textArea);
  }
}

function highlightAnchor(hash, highlightClass = "anchor-highlight") {
  if (!hash) return;
  const id = hash.replace(/^#/, "");
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove(highlightClass);
    void el.offsetWidth;
    el.classList.add(highlightClass);
  }
}

function initAnchorHighlighter({
  highlightClass = "anchor-highlight",
  duration = 2000,
} = {}) {
  // 动态注入高亮样式
  if (!document.getElementById("anchor-highlight-style")) {
    const style = document.createElement("style");
    style.id = "anchor-highlight-style";
    style.textContent = `
      @keyframes anchorFlash {
        0%   { background-color: var(--linen-accent-soft-strong, rgba(168, 69, 46, 0.14)); }
        100% { background-color: transparent; }
      }
      .${highlightClass} {
        border-radius: 3px;
        animation: anchorFlash ${duration}ms cubic-bezier(0.22, 1, 0.36, 1);
      }
    `;
    document.head.appendChild(style);
  }
  if (location.hash) {
    highlightAnchor(location.hash);
  }
  window.addEventListener("hashchange", () => {
    highlightAnchor(location.hash);
  });
}

initAnchorHighlighter({
  duration: 1800,
});

function initImageGridSwitchers() {
  var switchers = document.querySelectorAll(".image-grid.switcher");
  for (var i = 0; i < switchers.length; i++) {
    (function (switcher) {
      var items = switcher.querySelectorAll(".grid-item");
      var buttons = switcher.querySelectorAll(".image-grid-switcher-button");
      var controls = switcher.querySelector(".image-grid-switcher-controls");

      if (controls) {
        if (!controls.style.getPropertyValue("--switcher-item-count")) {
          controls.style.setProperty("--switcher-item-count", buttons.length);
        }
        controls.style.setProperty("--switcher-active-index", 0);
        controls.classList.add("is-ready");
      }

      var setActiveItem = function (activeIndex) {
        if (controls) {
          controls.style.setProperty("--switcher-active-index", activeIndex);
        }

        for (var index = 0; index < items.length; index++) {
          var isActive = index === activeIndex;
          items[index].classList.toggle("active", isActive);
          items[index].setAttribute("aria-hidden", isActive ? "false" : "true");

          if (buttons[index]) {
            buttons[index].classList.toggle("active", isActive);
            buttons[index].setAttribute("aria-selected", isActive ? "true" : "false");
          }
        }
      };

      for (var index = 0; index < buttons.length; index++) {
        (function (buttonIndex) {
          buttons[buttonIndex].addEventListener("click", function () {
            setActiveItem(buttonIndex);
          });
        })(index);
      }
    })(switchers[i]);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initImageGridSwitchers);
} else {
  initImageGridSwitchers();
}

function onScroll() {
  var backToTop = document.querySelector("#back-to-top");
  var header = document.querySelector(".nav-header");
  if (!header) return;

  var rawScrollY = window.scrollY;
  var currentScrollY = Math.max(0, rawScrollY);
  var triggerHeight = window.innerHeight * 1.5;

  if (!window.$gitalkInitiated && currentScrollY > window.innerHeight) {
    typeof loadGitalk !== "undefined" && loadGitalk();
  }

  var isMobilePost =
    window.innerWidth <= 1280 && header.classList.contains("is-post");

  // PC 端没有 header 隐藏逻辑，确保无 hide 类
  if (!isMobilePost && header.classList.contains("hide")) {
    header.classList.remove("hide");
  }

  // 接近顶部时（<= 60px），强制展开并退出，消除 iOS/Mac 橡皮筋回弹误判与闪烁
  if (currentScrollY <= 60) {
    if (isMobilePost) header.classList.remove("hide");
    if (backToTop) backToTop.classList.remove("visible");
    previousScrollY = currentScrollY;
    return;
  }

  if (isMobilePost && isAnchoring) {
    header.classList.add("hide");
    previousScrollY = currentScrollY;
    return;
  }

  var scrollDelta = currentScrollY - previousScrollY;
  // 滤除手指微小抖动
  if (Math.abs(scrollDelta) < 8) {
    return;
  }

  if (scrollDelta < 0) {
    // 向上滑动：即刻平滑展开导航栏
    if (isMobilePost && !document.querySelector(".pswp--open")) {
      header.classList.remove("hide");
    }
    if (backToTop && currentScrollY >= triggerHeight) {
      backToTop.classList.add("visible");
    }
  } else {
    // 向下滑动：离开顶部 60% 视口后平滑收起导航栏
    if (backToTop) backToTop.classList.remove("visible");
    if (isMobilePost && currentScrollY > window.innerHeight * 0.6) {
      header.classList.add("hide");
    }
  }

  previousScrollY = currentScrollY;
}

var isScrollTicking = false;
window.addEventListener(
  "scroll",
  function () {
    if (!isScrollTicking) {
      isScrollTicking = true;
      window.requestAnimationFrame(function () {
        onScroll();
        isScrollTicking = false;
      });
    }
  },
  { passive: true }
);

var resizeTimer = null;
window.addEventListener("resize", function () {
  if (window.innerWidth === viewportWidth) return;

  const body = document.body;
  body.classList.add("resizing");
  viewportWidth = window.innerWidth;

  if (window.innerWidth > 1280) {
    const header = document.querySelector(".nav-header");
    if (header) header.classList.remove("hide");
  }

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () {
    body.classList.remove("resizing");
  }, 200);
});

function onclickPostItem(element) {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";
  if (text.length > 0) {
    return;
  }
  const href = element.getAttribute("href");
  if (href) {
    location.href = href;
  }
}

function setBodyScrollLocked(locked) {
  var body = document.body;
  var html = document.documentElement;
  if (locked) {
    body && body.classList.add("no-scroll");
    html && html.classList.add("no-scroll");
  } else {
    body && body.classList.remove("no-scroll");
    html && html.classList.remove("no-scroll");
  }
}

function handleClick(e) {
  try {
    var target = e.target;
    var tocElement = document.getElementById("toc");
    var seriesElement = document.getElementById("series");
    var maskElement = document.getElementById("mask");
    var bodyElement = document.body;
    var donateModal = document.getElementById("donate-modal");
    if (/content-switch/.test(target.id)) {
      if (document.body.classList.contains("render-raw")) {
        target.innerText = target.dataset.rawcontentlabel;
      } else {
        target.innerText = target.dataset.renderedcontentlabel;
      }
      document.body.classList.toggle("render-raw");
    }
    if (/close-series-popup-icon/.test(target.className)) {
      seriesElement?.classList?.remove("visible");
      maskElement.classList.remove("visible");
      setBodyScrollLocked(false);
    } else if (["H2", "H3"].includes(target.tagName) && target.id) {
      const newLocation = new URL(location.href);
      newLocation.hash = `#${target.id}`;
      history.replaceState(null, "", newLocation.href);
      target.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
      highlightAnchor(target.id);
      return;
    } else if (
      target?.className === "caption-link" ||
      target.parentElement?.className === "caption-link"
    ) {
      const href =
        target.getAttribute("href") ||
        target.parentElement.getAttribute("href");
      window.open(href);
      return;
    } else if (target.className === "copy-btn") {
      try {
        var codeBlock = target.parentElement.querySelector(".code");
        copyToClipboard(codeBlock.innerText);
        target.classList.add("copied");
        setTimeout(() => {
          target.classList.remove("copied");
        }, 500);
        return;
      } catch (error) {}
    } else if (target.id === "back-to-top") {
      e.preventDefault();
      const newLocation = new URL(location.href);
      newLocation.hash = "";
      history.replaceState(null, "", newLocation.href);
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
      return;
    } else if (target?.className?.includes("placeholder")) {
      e.preventDefault();
      return;
    } else if (
      target?.className?.includes("toc-item-link") ||
      target?.className?.includes("toc-sub-item-link")
    ) {
      e.preventDefault();
      if (!window.$gitalkInitiated) {
        typeof loadGitalk !== "undefined" && loadGitalk();
      }
      const targetId = target.dataset.id;
      const anchor = document.getElementById(targetId);
      if (tocElement?.classList?.contains("visible")) {
        tocElement.classList.remove("visible");
        maskElement.classList.remove("visible");
        setBodyScrollLocked(false);
      }
      const firstTocLink = tocElement
        ? tocElement.querySelector(".toc-item-link")
        : null;
      const isFirstToc =
        target === firstTocLink ||
        target.closest(".toc-item-link") === firstTocLink;

      if (targetId === "to-page-top" || targetId === "page-top") {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "instant",
        });
        isAnchoring = false;
        clearTimeout(anchoringTimer);
        var header = document.querySelector(".nav-header");
        if (header) {
          header.classList.remove("hide");
        }
      } else {
        anchor &&
          anchor.scrollIntoView({
            behavior: "instant",
            block: "start",
          });
        if (isFirstToc) {
          isAnchoring = false;
          clearTimeout(anchoringTimer);
          var header = document.querySelector(".nav-header");
          if (header) {
            header.classList.remove("hide");
          }
        } else {
          triggerAnchoring();
        }
      }
      highlightAnchor(targetId);
      if (
        target.className?.includes("toc-item-link") &&
        anchor &&
        isElementInViewport(anchor)
      ) {
        anchoringId = anchor.id;
        const tocItems =
          document.getElementById("toc")?.children?.[1]?.children || [];
        Array.prototype.forEach.call(tocItems, (tocItem) => {
          if (tocItem?.children?.[0]?.dataset?.id === anchoringId) {
            tocItem.className = "toc-item-wrap active";
          } else {
            tocItem.className = "toc-item-wrap";
          }
        });
      } else {
        if (anchoringId) {
          anchoringId = null;
        }
      }
      return;
    } else if (target.id === "toc-toggle") {
      if (tocElement?.classList?.contains("visible")) {
        tocElement.classList.remove("visible");
        maskElement.classList.remove("visible");
        setBodyScrollLocked(false);
      } else {
        tocElement.classList.add("visible");
        maskElement.classList.add("visible");
        setBodyScrollLocked(true);
      }
      return;
    } else if (
      target.tagName !== "H1" &&
      (target.className === "series-name" ||
        target?.parentElement?.className === "series-name" ||
        target.className === "series-name-content" ||
        target?.parentElement?.className === "series-name-content")
    ) {
      seriesElement?.classList?.add("visible");
      maskElement?.classList?.add("visible");
      donateModal?.classList?.remove("visible");
      setBodyScrollLocked(true);
      return;
    } else if (target?.className?.includes("series-item-link")) {
      e.preventDefault();
      seriesElement?.classList?.remove("visible");
      maskElement.classList.remove("visible");
      setBodyScrollLocked(false);
      const href =
        target.getAttribute("href") ||
        target.parentElement.getAttribute("href");
      location.href = href;
      return;
    } else if (target.id === "mask") {
      tocElement?.classList?.remove("visible");
      seriesElement?.classList?.remove("visible");
      maskElement.classList.remove("visible");
      setBodyScrollLocked(false);
      return;
    } else if (target?.className?.includes("fold-toggle")) {
      const parentElement = target.parentElement;
      if (parentElement.classList.contains("folded")) {
        parentElement.classList.remove("folded");
      } else {
        parentElement.classList.add("folded");
      }
      return;
    } else if (target.id === "page-donates") {
      target?.children?.[0]?.classList?.add("visible");
      return;
    } else {
      if (
        donateModal &&
        donateModal.classList.contains("visible") &&
        target.tagName !== "IMG"
      ) {
        donateModal.classList.remove("visible");
      }
      return;
    }
  } catch (error) {
    console.log(error);
  }
}

var isClickHandlerBound = false;
function bindClickHandler() {
  if (isClickHandlerBound) return;
  document.addEventListener("click", handleClick, true);
  isClickHandlerBound = true;
}

window.addEventListener("load", bindClickHandler);
window.addEventListener("pageshow", () => {
  bindClickHandler();
});

function initAgeWarning() {
  const ageWarningElement = document.getElementById("post-age-warning");
  if (!ageWarningElement) return;
  const dateElement = document.querySelector("#post .post-meta .date");
  const dateStr = dateElement ? dateElement.getAttribute("datetime") : null;
  if (!dateStr) return;

  const postDate = new Date(dateStr);
  if (isNaN(postDate.getTime())) return;
  const now = new Date();

  const diffTime = now - postDate;

  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays && diffDays > 180) {
    const daysSpan = ageWarningElement.querySelector(".days-value");
    if (daysSpan) {
      daysSpan.innerText = diffDays;
    }
  } else {
    if (ageWarningElement) {
      ageWarningElement.style.display = "none";
    }
  }
  return diffDays;
}

initAgeWarning();

function initMaskScrollLock() {
  var mask = document.getElementById("mask");
  if (!mask) return;
  mask.addEventListener(
    "touchmove",
    function (e) {
      if (mask.classList.contains("visible")) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

function initTravelRoutes() {
  var contentEl = document.querySelector(
    "#post.layout-style-journal #page-content, #post.travel-post #page-content"
  );
  if (!contentEl) return;

  var ROUTE_HEADING_RE = /^(?:路线|路线规划|Route|Route Planning)$/i;
  var PALETTE = [
    "#c97a63",
    "#a8452e",
    "#8a9a86",
    "#c4b7a6",
    "#b87d56",
    "#6d8b74",
    "#d49a79",
    "#9c8f84",
  ];
  var isEnglish = /^en/i.test(document.documentElement.lang || "");

  function getHeadingText(heading) {
    var clone = heading.cloneNode(true);
    clone
      .querySelectorAll(".headerlink, .header-anchor")
      .forEach(function (el) {
        el.remove();
      });
    return (clone.textContent || "")
      .replace(/^[#¶\s]+|[#¶\s]+$/g, "")
      .trim();
  }

  function parseZhNum(str) {
    var map = {
      半: 0.5,
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    if (Object.prototype.hasOwnProperty.call(map, str)) return map[str];
    if (/^十[一二三四五六七八九]$/.test(str)) return 10 + map[str[1]];
    return null;
  }

  function parseDuration(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) return null;

    var compound = trimmed.match(
      /^(\d+(?:\.\d+)?)\s*(日|天)\s*\d+(?:\.\d+)?\s*(?:晚|夜)$/
    );
    if (compound) {
      var val = Number(compound[1]);
      if (isFinite(val) && val > 0) {
        return {
          label: trimmed,
          weight: val,
          unitKind: "day",
          unitText: compound[2],
        };
      }
    }

    if (/^(半日|半天|half\s+day)$/i.test(trimmed)) {
      var isEn = /day/i.test(trimmed);
      return {
        label: trimmed,
        weight: 0.5,
        unitKind: "day",
        unitText: isEn ? "days" : trimmed.slice(-1) === "日" ? "日" : "天",
      };
    }

    var zhNum = trimmed.match(
      /^(十?[一二两三四五六七八九]|十)\s*(日|天|晚|夜)(半)?$/
    );
    if (zhNum) {
      var base = parseZhNum(zhNum[1]);
      if (base) {
        var unitChar = zhNum[2];
        return {
          label: trimmed,
          weight: base + (zhNum[3] ? 0.5 : 0),
          unitKind: unitChar === "晚" || unitChar === "夜" ? "night" : "day",
          unitText: unitChar,
        };
      }
    }

    var num = trimmed.match(
      /^(\d+(?:\.\d+)?)\s*(日|天|晚|夜|小时|days?|nights?|hours?|hrs?|d|h)$/i
    );
    if (num) {
      var n = Number(num[1]);
      if (isFinite(n) && n > 0) {
        var lower = num[2].toLowerCase();
        var unitKind = "day";
        var unitText = num[2];
        if (lower === "晚" || lower === "夜" || lower.indexOf("night") === 0) {
          unitKind = "night";
          unitText = lower.indexOf("night") === 0 ? "nights" : num[2];
        } else if (
          lower === "小时" ||
          lower.indexOf("hour") === 0 ||
          lower.indexOf("hr") === 0 ||
          lower === "h"
        ) {
          unitKind = "hour";
          unitText = lower === "小时" ? "小时" : "hours";
        } else if (lower.indexOf("day") === 0 || lower === "d") {
          unitKind = "day";
          unitText = "days";
        }
        return { label: trimmed, weight: n, unitKind: unitKind, unitText: unitText };
      }
    }

    return null;
  }

  function parseItem(rawHtml) {
    var content = String(rawHtml || "").trim();
    if (/^<p>[\s\S]*<\/p>$/i.test(content) && !/<\/p>\s*<p>/i.test(content)) {
      content = content.replace(/^<p>|<\/p>$/gi, "").trim();
    }

    var note = "";
    var duration = null;

    var paren = content.match(
      /^(.*?)[\s]*(?:（([^（）]+)）|\(([^()]+)\))\s*$/
    );
    if (paren && paren[1].trim()) {
      var inner = (paren[2] || paren[3] || "").trim();
      var pd = parseDuration(inner);
      if (pd) {
        duration = pd;
      } else {
        note = inner;
      }
      content = paren[1].trim();
    }

    if (!duration) {
      var tail = content.match(
        /^(.*?)(?:[\s·•\-—:：,，/]+)(\d+(?:\.\d+)?\s*(?:日|天)\s*\d+(?:\.\d+)?\s*(?:晚|夜)|\d+(?:\.\d+)?\s*(?:日|天|晚|夜|小时|days?|nights?|hours?|hrs?|d|h)|(?:半日|半天|half\s+day)|(?:十?[一二两三四五六七八九]|十)\s*(?:日|天|晚|夜)(?:半)?)\s*$/i
      );
      if (tail && tail[1].trim()) {
        var td = parseDuration(tail[2]);
        if (td) {
          duration = td;
          content = tail[1].trim();
        }
      }
    }

    if (!duration) {
      var compact = content.match(
        /^(.*?)(\d+(?:\.\d+)?\s*(?:日|天)\s*\d+(?:\.\d+)?\s*(?:晚|夜)|\d+(?:\.\d+)?\s*(?:日|天|晚|夜|小时)|半日|半天)$/
      );
      if (compact && compact[1].trim()) {
        var cd = parseDuration(compact[2]);
        if (cd) {
          duration = cd;
          content = compact[1].trim();
        }
      }
    }

    var place = content.replace(/[\s·•\-—:：,，/]+$/, "").trim();
    if (!place) {
      return { place: rawHtml.trim(), duration: null, note: "" };
    }
    return { place: place, duration: duration, note: note };
  }

  function getCols(count) {
    if (count <= 2) return 2;
    if (count === 3 || count === 5 || count === 6 || count === 9) return 3;
    return 4;
  }

  contentEl.querySelectorAll("h2, h3").forEach(function (heading) {
    if (!ROUTE_HEADING_RE.test(getHeadingText(heading))) return;

    var next = heading.nextElementSibling;
    while (next && next.id === "gitalk-initiator") {
      next = next.nextElementSibling;
    }
    if (!next || (next.tagName !== "UL" && next.tagName !== "OL")) return;
    if (next.classList.contains("travel-route-grid")) return;
    if (next.querySelector("ul, ol, img, iframe, table, pre, blockquote, figure")) {
      return;
    }

    var lis = Array.prototype.slice.call(next.children).filter(function (el) {
      return el.tagName === "LI";
    });
    if (lis.length < 2) return;

    var stops = lis.map(function (li) {
      return parseItem(li.innerHTML);
    });
    var withDuration = stops.filter(function (s) {
      return !!s.duration;
    });
    var showBar = withDuration.length >= 2;
    var cols = getCols(stops.length);

    var block = document.createElement("div");
    block.className = "travel-route-block" + (showBar ? " has-bar" : "");
    block.style.setProperty("--route-cols", String(cols));

    if (showBar) {
      var unitKinds = new Set(
        withDuration.map(function (s) {
          return s.duration.unitKind;
        })
      );

      if (
        withDuration.length === stops.length &&
        unitKinds.size === 1 &&
        (unitKinds.has("day") || unitKinds.has("night"))
      ) {
        var total = Number(
          withDuration
            .reduce(function (sum, s) {
              return sum + s.duration.weight;
            }, 0)
            .toFixed(2)
        );
        var firstUnit = withDuration[0].duration.unitText;
        var useEn = isEnglish || /^[a-z]+$/i.test(firstUnit);
        var summary = document.createElement("div");
        summary.className = "travel-route-summary";
        summary.textContent = useEn
          ? stops.length + " STOPS · " + total + " " + firstUnit.toUpperCase()
          : stops.length + " 站 · 共 " + total + " " + firstUnit;
        block.appendChild(summary);
      }

      var bar = document.createElement("div");
      bar.className = "travel-route-bar";
      bar.setAttribute("aria-hidden", "true");
      stops.forEach(function (stop, idx) {
        if (!stop.duration) return;
        var seg = document.createElement("span");
        var color = PALETTE[idx % PALETTE.length];
        var flexWeight = stop.duration.weight;
        if (unitKinds.size > 1 && stop.duration.unitKind === "hour") {
          flexWeight = Math.max(stop.duration.weight / 24, 0.25);
        }
        seg.className = "travel-route-seg";
        seg.style.flex = String(flexWeight);
        seg.style.setProperty("--stop-color", color);
        var plainPlace = stop.place.replace(/<[^>]*>/g, "").trim();
        seg.title = plainPlace + " · " + stop.duration.label;
        bar.appendChild(seg);
      });
      block.appendChild(bar);
    }

    var grid = document.createElement("ul");
    grid.className = "travel-route-grid";
    stops.forEach(function (stop, idx) {
      var color = PALETTE[idx % PALETTE.length];
      var li = document.createElement("li");
      li.className = "travel-route-item";
      li.style.setProperty("--stop-color", color);

      var top = document.createElement("div");
      top.className = "travel-route-item-top";
      var idxSpan = document.createElement("span");
      idxSpan.className = "travel-route-index";
      idxSpan.textContent = String(idx + 1).padStart(2, "0");
      var dot = document.createElement("span");
      dot.className = "travel-route-dot";
      dot.setAttribute("aria-hidden", "true");
      top.appendChild(idxSpan);
      top.appendChild(dot);

      var placeDiv = document.createElement("div");
      placeDiv.className = "travel-route-place";
      placeDiv.innerHTML = stop.place;

      li.appendChild(top);
      li.appendChild(placeDiv);

      if (stop.duration) {
        var daysSpan = document.createElement("span");
        daysSpan.className = "travel-route-days";
        daysSpan.textContent = stop.duration.label;
        li.appendChild(daysSpan);
      }

      if (stop.note) {
        var noteSpan = document.createElement("span");
        noteSpan.className = "travel-route-note";
        noteSpan.textContent = stop.note;
        li.appendChild(noteSpan);
      }

      grid.appendChild(li);
    });

    block.appendChild(grid);
    next.parentNode.replaceChild(block, next);
  });
}

function initCopyrightPopover() {
  var containers = document.querySelectorAll(".copyright-popover-container");
  if (!containers.length) return;

  function updatePosition(container) {
    var popover = container.querySelector(".copyright-popover-content");
    if (!popover) return;

    var vw = document.documentElement.clientWidth || window.innerWidth;
    var margin = 16;
    var popoverWidth = popover.offsetWidth;
    if (!popoverWidth) return;

    var containerRect = container.getBoundingClientRect();
    var anchorCenter = containerRect.left + containerRect.width / 2;
    var centeredLeft = anchorCenter - popoverWidth / 2;
    var minLeft = margin;
    var maxLeft = vw - margin - popoverWidth;
    var clampedLeft =
      maxLeft < minLeft
        ? (vw - popoverWidth) / 2
        : Math.min(Math.max(centeredLeft, minLeft), maxLeft);
    var shift = clampedLeft - centeredLeft;

    container.style.setProperty("--popover-shift", shift.toFixed(1) + "px");
  }

  function updateAll() {
    containers.forEach(updatePosition);
  }

  containers.forEach(function (container) {
    container.addEventListener("mouseenter", function () {
      updatePosition(container);
    });
    container.addEventListener("focusin", function () {
      updatePosition(container);
    });
    container.addEventListener(
      "touchstart",
      function () {
        updatePosition(container);
      },
      { passive: true }
    );
  });

  updateAll();
  window.addEventListener("load", updateAll);
  window.addEventListener("resize", updateAll);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    initMaskScrollLock();
    initTravelRoutes();
    initCopyrightPopover();
  });
} else {
  initMaskScrollLock();
  initTravelRoutes();
  initCopyrightPopover();
}
