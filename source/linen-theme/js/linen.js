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

function positionDonateModal(trigger, modal) {
  var buttonRect = trigger.getBoundingClientRect();
  var modalHeight = modal.offsetHeight || 258;
  var gap = 12;
  var edgePadding = 16;

  var safeTop = edgePadding;
  var header = document.querySelector(".nav-header");
  if (header && !header.classList.contains("hide")) {
    var headerStyle = window.getComputedStyle(header);
    if (headerStyle.position === "fixed" || headerStyle.position === "sticky") {
      var headerRect = header.getBoundingClientRect();
      if (headerRect.bottom > 0) {
        safeTop = Math.max(safeTop, headerRect.bottom + 12);
      }
    }
  }

  var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  var spaceAbove = buttonRect.top - safeTop;
  var spaceBelow = viewportHeight - buttonRect.bottom - edgePadding;
  var requiredSpace = modalHeight + gap;

  var openBelow = spaceAbove < requiredSpace && spaceBelow >= spaceAbove;
  modal.classList.toggle("placement-bottom", openBelow);

  if (!openBelow && spaceAbove < requiredSpace) {
    var scrollDeltaUp = buttonRect.top - requiredSpace - safeTop;
    if (scrollDeltaUp < 0) {
      window.scrollBy({ top: scrollDeltaUp, behavior: "smooth" });
    }
  } else if (openBelow && spaceBelow < requiredSpace) {
    var scrollDeltaDown =
      buttonRect.bottom + requiredSpace - (viewportHeight - edgePadding);
    if (scrollDeltaDown > 0) {
      window.scrollBy({ top: scrollDeltaDown, behavior: "smooth" });
    }
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
      var modal = donateModal || target?.children?.[0];
      if (!modal) return;
      if (modal.classList.contains("visible")) {
        modal.classList.remove("visible");
        return;
      }
      positionDonateModal(target, modal);
      void modal.offsetHeight;
      modal.classList.add("visible");
      return;
    } else {
      if (
        donateModal &&
        donateModal.classList.contains("visible") &&
        !target.closest("#donate-modal")
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindClickHandler);
} else {
  bindClickHandler();
}
window.addEventListener("pageshow", bindClickHandler);

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

function initThemeToggle() {
  var STORAGE_KEY = "linen-theme-scheme";
  var root = document.documentElement;
  var toggleBtn = document.getElementById("theme-toggle");
  var mediaQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function getEffectiveTheme() {
    var explicit = root.getAttribute("data-theme");
    if (explicit === "dark" || explicit === "light") {
      return explicit;
    }
    return mediaQuery && mediaQuery.matches ? "dark" : "light";
  }

  function syncUi(theme) {
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    }
  }

  function emitChange(theme) {
    try {
      window.dispatchEvent(
        new CustomEvent("linen:themechange", { detail: { theme: theme } })
      );
    } catch (e) {}
  }

  function applyTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute("content", theme);
    }
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }
    syncUi(theme);
    emitChange(theme);
  }

  syncUi(getEffectiveTheme());

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      var next = getEffectiveTheme() === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
  }

  if (mediaQuery) {
    var onMediaChange = function () {
      var explicit = root.getAttribute("data-theme");
      if (explicit !== "dark" && explicit !== "light") {
        var effective = getEffectiveTheme();
        syncUi(effective);
        emitChange(effective);
      }
    };
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onMediaChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(onMediaChange);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initMaskScrollLock();
    initCopyrightPopover();
  });
} else {
  initThemeToggle();
  initMaskScrollLock();
  initCopyrightPopover();
}
