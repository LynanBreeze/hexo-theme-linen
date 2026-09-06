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
        0%   { background-color: rgba(70, 148, 255, 0.2); }
        100% { background-color: transparent; }
      }
      .${highlightClass} {
        animation: anchorFlash ${duration}ms ease;
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
  duration: 4000,
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMaskScrollLock);
} else {
  initMaskScrollLock();
}
