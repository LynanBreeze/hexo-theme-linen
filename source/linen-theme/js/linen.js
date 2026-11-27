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
  let id = hash.replace(/^#/, "");
  try {
    id = decodeURIComponent(id);
  } catch (e) {}
  const el = document.getElementById(id);
  if (!el) return;

  function triggerHighlight() {
    el.classList.remove(highlightClass);
    void el.offsetWidth;
    el.classList.add(highlightClass);

    if (
      el.classList.contains("footnote-anchor-wrap") &&
      typeof el.closest === "function"
    ) {
      const contextBlock = el.closest(
        "p, li, blockquote, dd, td, th, figcaption"
      );
      if (contextBlock) {
        contextBlock.classList.remove("footnote-context-highlight");
        void contextBlock.offsetWidth;
        contextBlock.classList.add("footnote-context-highlight");
      }
    }
  }

  const rect =
    typeof el.getBoundingClientRect === "function"
      ? el.getBoundingClientRect()
      : null;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const inViewport = !rect || !vh || (rect.bottom > 0 && rect.top < vh);

  if (inViewport || typeof IntersectionObserver !== "function") {
    triggerHighlight();
    return;
  }

  // Wait until smooth scroll brings the target into view so the flash
  // does not finish before the user arrives at the anchor.
  let triggered = false;
  let observer = null;
  let fallbackTimer = null;

  const fire = () => {
    if (triggered) return;
    triggered = true;
    if (observer) observer.disconnect();
    if (fallbackTimer) clearTimeout(fallbackTimer);
    triggerHighlight();
  };

  observer = new IntersectionObserver(
    (entries) => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          setTimeout(fire, 120);
          return;
        }
      }
    },
    { threshold: 0.1 }
  );
  observer.observe(el);
  fallbackTimer = setTimeout(fire, 900);
}

function initAnchorHighlighter({
  highlightClass = "anchor-highlight",
  duration = 2200,
} = {}) {
  // 动态注入高亮样式
  if (!document.getElementById("anchor-highlight-style")) {
    const style = document.createElement("style");
    style.id = "anchor-highlight-style";
    style.textContent = `
      @keyframes anchorFlash {
        0%   { background-color: var(--linen-accent-soft-strong, rgba(168, 69, 46, 0.14)); }
        45%  { background-color: var(--linen-accent-soft-strong, rgba(168, 69, 46, 0.14)); }
        100% { background-color: transparent; }
      }
      @keyframes footnoteContextFlash {
        0% {
          background-color: var(--linen-accent-soft, rgba(168, 69, 46, 0.08));
          box-shadow: 0 0 0 4px var(--linen-accent-soft, rgba(168, 69, 46, 0.08));
        }
        45% {
          background-color: var(--linen-accent-soft, rgba(168, 69, 46, 0.08));
          box-shadow: 0 0 0 4px var(--linen-accent-soft, rgba(168, 69, 46, 0.08));
        }
        100% {
          background-color: transparent;
          box-shadow: 0 0 0 4px transparent;
        }
      }
      @keyframes footnoteAnchorFlash {
        0% {
          background-color: var(--linen-accent, #a8452e);
          color: var(--linen-on-accent, #fcfbf8);
          transform: scale(1.22);
          box-shadow: 0 0 0 0 var(--linen-accent-focus, rgba(168, 69, 46, 0.45));
        }
        18% {
          background-color: var(--linen-accent, #a8452e);
          color: var(--linen-on-accent, #fcfbf8);
          transform: scale(1.16);
          box-shadow: 0 0 0 8px rgba(168, 69, 46, 0);
        }
        52% {
          background-color: var(--linen-accent, #a8452e);
          color: var(--linen-on-accent, #fcfbf8);
          transform: scale(1.06);
          box-shadow: 0 0 0 3px var(--linen-accent-soft-strong, rgba(168, 69, 46, 0.14));
        }
        100% {
          background-color: transparent;
          color: var(--linen-accent, #a8452e);
          transform: scale(1);
          box-shadow: 0 0 0 0 transparent;
        }
      }
      .${highlightClass} {
        border-radius: 3px;
        animation: anchorFlash ${duration}ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .footnote-context-highlight {
        border-radius: 4px;
        animation: footnoteContextFlash ${duration}ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .footnote-anchor-wrap.${highlightClass} {
        animation: none;
      }
      .footnote-anchor-wrap.${highlightClass} .footnote-href {
        animation: footnoteAnchorFlash ${duration}ms cubic-bezier(0.22, 1, 0.36, 1);
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
  // Clicking a footnote anchor or backref pointing to the current hash does not
  // fire hashchange; re-trigger the highlight so repeated jumps still flash.
  document.addEventListener("click", (e) => {
    const link =
      e.target && typeof e.target.closest === "function"
        ? e.target.closest('a.footnote-backref[href^="#"], a.footnote-href[href^="#"]')
        : null;
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;
    let currentHash = location.hash;
    let targetHash = href;
    try {
      currentHash = decodeURIComponent(currentHash);
      targetHash = decodeURIComponent(targetHash);
    } catch (err) {}
    if (currentHash === targetHash) {
      highlightAnchor(href);
    }
  });
}

initAnchorHighlighter({
  duration: 2200,
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
        var tocBtn = document.getElementById("toc-toggle");
        if (tocBtn) tocBtn.setAttribute("aria-expanded", "false");
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
        var tocBtn = document.getElementById("toc-toggle");
        if (tocBtn) tocBtn.setAttribute("aria-expanded", "false");
      } else {
        tocElement.classList.add("visible");
        maskElement.classList.add("visible");
        setBodyScrollLocked(true);
        target.setAttribute("aria-expanded", "true");
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
      var tocToggleBtn = document.getElementById("toc-toggle");
      if (tocToggleBtn) tocToggleBtn.setAttribute("aria-expanded", "false");
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

var closeFootnotePopover = null;

function closeActiveOverlays() {
  var tocElement = document.getElementById("toc");
  var seriesElement = document.getElementById("series");
  var maskElement = document.getElementById("mask");
  var donateModal = document.getElementById("donate-modal");
  var closedAny = false;

  if (typeof closeFootnotePopover === "function" && closeFootnotePopover()) {
    closedAny = true;
  }

  if (tocElement && tocElement.classList.contains("visible")) {
    tocElement.classList.remove("visible");
    var tocToggleBtn = document.getElementById("toc-toggle");
    if (tocToggleBtn) tocToggleBtn.setAttribute("aria-expanded", "false");
    closedAny = true;
  }
  if (seriesElement && seriesElement.classList.contains("visible")) {
    seriesElement.classList.remove("visible");
    closedAny = true;
  }
  if (donateModal && donateModal.classList.contains("visible")) {
    donateModal.classList.remove("visible");
    closedAny = true;
  }
  if (maskElement && maskElement.classList.contains("visible")) {
    maskElement.classList.remove("visible");
    closedAny = true;
  }
  if (closedAny) {
    setBodyScrollLocked(false);
  }
  return closedAny;
}

var isClickHandlerBound = false;
function bindClickHandler() {
  if (isClickHandlerBound) return;
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeActiveOverlays();
      return;
    }
    if (
      (e.key === "Enter" || e.key === " ") &&
      e.target &&
      e.target.getAttribute &&
      e.target.getAttribute("role") === "button" &&
      e.target.tagName !== "BUTTON" &&
      e.target.tagName !== "A"
    ) {
      e.preventDefault();
      e.target.click();
    }
  });
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

function initFootnotePopover() {
  var footnoteAnchors = Array.prototype.slice.call(
    document.querySelectorAll('a.footnote-href[href^="#"], .footnote-ref a[href^="#"]')
  );
  var commentTriggers = Array.prototype.slice.call(
    document.querySelectorAll(".commented-text[data-comment]")
  ).filter(function (el) {
    return Boolean(String(el.getAttribute("data-comment") || "").trim());
  });

  function getFootnoteTarget(anchor) {
    var href = anchor.getAttribute("href");
    if (!href || href.charAt(0) !== "#") return null;
    var id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch (e) {}
    return id ? document.getElementById(id) : null;
  }

  var validFootnoteAnchors = footnoteAnchors.filter(function (anchor) {
    return Boolean(getFootnoteTarget(anchor));
  });
  if (!validFootnoteAnchors.length && !commentTriggers.length) return;

  var popover = document.getElementById("footnote-popover");
  if (!popover) {
    popover = document.createElement("div");
    popover.id = "footnote-popover";
    popover.className = "footnote-popover";
    popover.setAttribute("role", "tooltip");
    popover.setAttribute("tabindex", "-1");
    popover.setAttribute("aria-hidden", "true");
    popover.innerHTML =
      '<div class="footnote-popover-inner">' +
      '<span class="footnote-popover-index" aria-hidden="true"></span>' +
      '<div class="footnote-popover-body"></div>' +
      "</div>" +
      '<span class="footnote-popover-arrow" aria-hidden="true"></span>';
    document.body.appendChild(popover);
  }

  var indexEl = popover.querySelector(".footnote-popover-index");
  var bodyEl = popover.querySelector(".footnote-popover-body");
  var activeAnchor = null;
  var activeRectIndex = -1;
  var hideTimer = null;
  var repositionRaf = null;
  var lastTouchTime = 0;
  var isPointerInsideAnchor = false;
  var isPointerInsidePopover = false;
  var isPointerDownInPopover = false;
  var lastPopoverPointerUpTime = 0;
  var HIDE_DELAY = 180;

  function hasSelectionInPopover() {
    if (typeof window.getSelection !== "function") return false;
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !String(sel.toString() || "").trim()) {
      return false;
    }
    var anchorNode = sel.anchorNode;
    var focusNode = sel.focusNode;
    return Boolean(
      (anchorNode && popover.contains(anchorNode)) ||
      (focusNode && popover.contains(focusNode))
    );
  }

  function getSafeTop(margin) {
    var safeTop = margin;
    var header = document.querySelector(".nav-header");
    if (header && !header.classList.contains("hide")) {
      var headerStyle = window.getComputedStyle(header);
      if (
        headerStyle.position === "fixed" ||
        headerStyle.position === "sticky"
      ) {
        var headerRect = header.getBoundingClientRect();
        if (headerRect.bottom > 0) {
          safeTop = Math.max(safeTop, headerRect.bottom + 8);
        }
      }
    }
    return safeTop;
  }

  function buildFootnoteFragment(targetEl) {
    var clone = targetEl.cloneNode(true);
    var backrefs = clone.querySelectorAll(".footnote-backref");
    for (var i = 0; i < backrefs.length; i++) {
      if (backrefs[i].parentNode) {
        backrefs[i].parentNode.removeChild(backrefs[i]);
      }
    }
    var elementsWithId = clone.querySelectorAll("[id]");
    for (var j = 0; j < elementsWithId.length; j++) {
      elementsWithId[j].removeAttribute("id");
    }

    while (clone.lastChild) {
      var last = clone.lastChild;
      if (last.nodeType === 3 && !String(last.nodeValue || "").trim()) {
        clone.removeChild(last);
      } else if (
        last.nodeType === 1 &&
        last.tagName === "P" &&
        !String(last.textContent || "").trim() &&
        !last.querySelector("img, svg, math, table, pre, code")
      ) {
        clone.removeChild(last);
      } else {
        break;
      }
    }

    var hasContent =
      Boolean(String(clone.textContent || "").trim()) ||
      Boolean(clone.querySelector("img, svg, math, table, pre, code"));
    if (!hasContent) return null;

    var fragment = document.createDocumentFragment();
    while (clone.firstChild) {
      fragment.appendChild(clone.firstChild);
    }
    return fragment;
  }

  function resolveAnchorRect(anchor, pointerEvent) {
    if (typeof anchor.getClientRects === "function") {
      var rects = anchor.getClientRects();
      if (rects && rects.length > 1) {
        if (
          pointerEvent &&
          typeof pointerEvent.clientX === "number" &&
          typeof pointerEvent.clientY === "number"
        ) {
          var bestIdx = 0;
          var bestDist = Infinity;
          for (var i = 0; i < rects.length; i++) {
            var r = rects[i];
            if (!r.width && !r.height) continue;
            var dx =
              pointerEvent.clientX < r.left
                ? r.left - pointerEvent.clientX
                : pointerEvent.clientX > r.right
                  ? pointerEvent.clientX - r.right
                  : 0;
            var dy =
              pointerEvent.clientY < r.top
                ? r.top - pointerEvent.clientY
                : pointerEvent.clientY > r.bottom
                  ? pointerEvent.clientY - r.bottom
                  : 0;
            var dist = dx * dx + dy * dy;
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = i;
            }
          }
          activeRectIndex = bestIdx;
          return rects[bestIdx];
        }
        if (activeRectIndex >= 0 && activeRectIndex < rects.length) {
          return rects[activeRectIndex];
        }
        activeRectIndex = 0;
        return rects[0];
      }
    }
    activeRectIndex = -1;
    return anchor.getBoundingClientRect();
  }

  function positionPopover(anchor, pointerEvent) {
    var margin = 16;
    var gap = 10;
    var viewportWidth =
      document.documentElement.clientWidth || window.innerWidth;
    var viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    var safeTop = getSafeTop(margin);

    var anchorRect = resolveAnchorRect(anchor, pointerEvent);
    popover.style.top = "0px";
    popover.style.left = "0px";
    var popoverWidth = popover.offsetWidth;
    var popoverHeight = popover.offsetHeight;
    if (!popoverWidth || !popoverHeight) return;

    var spaceAbove = anchorRect.top - safeTop;
    var spaceBelow = viewportHeight - anchorRect.bottom - margin;
    var openBelow =
      spaceAbove < popoverHeight + gap && spaceBelow >= spaceAbove;
    popover.classList.toggle("placement-bottom", openBelow);

    var top = openBelow
      ? anchorRect.bottom + gap
      : anchorRect.top - popoverHeight - gap;
    var maxTop = Math.max(safeTop, viewportHeight - margin - popoverHeight);
    top = Math.min(Math.max(top, safeTop), maxTop);

    var anchorCenter = anchorRect.left + anchorRect.width / 2;
    var centeredLeft = anchorCenter - popoverWidth / 2;
    var maxLeft = viewportWidth - margin - popoverWidth;
    var left =
      maxLeft < margin
        ? (viewportWidth - popoverWidth) / 2
        : Math.min(Math.max(centeredLeft, margin), maxLeft);

    var arrowLeft = Math.min(
      Math.max(anchorCenter - left, 14),
      Math.max(14, popoverWidth - 14)
    );

    popover.style.top = top.toFixed(1) + "px";
    popover.style.left = left.toFixed(1) + "px";
    popover.style.setProperty("--arrow-left", arrowLeft.toFixed(1) + "px");
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hidePopover() {
    clearHideTimer();
    var wasVisible = popover.classList.contains("visible");
    if (activeAnchor) {
      activeAnchor.classList.remove("is-popover-open");
      if (activeAnchor.getAttribute("aria-describedby") === popover.id) {
        activeAnchor.removeAttribute("aria-describedby");
      }
      activeAnchor = null;
      activeRectIndex = -1;
    }
    isPointerInsideAnchor = false;
    isPointerInsidePopover = false;
    isPointerDownInPopover = false;
    popover.classList.remove("visible", "is-comment");
    popover.setAttribute("aria-hidden", "true");
    return wasVisible;
  }

  function scheduleHide() {
    clearHideTimer();
    if (
      isPointerInsidePopover ||
      isPointerInsideAnchor ||
      isPointerDownInPopover ||
      hasSelectionInPopover()
    ) {
      return;
    }
    hideTimer = setTimeout(function () {
      if (
        isPointerInsidePopover ||
        isPointerInsideAnchor ||
        isPointerDownInPopover ||
        hasSelectionInPopover()
      ) {
        return;
      }
      hidePopover();
    }, HIDE_DELAY);
  }

  function activateAnchor(anchor) {
    if (activeAnchor && activeAnchor !== anchor) {
      activeAnchor.classList.remove("is-popover-open");
      if (activeAnchor.getAttribute("aria-describedby") === popover.id) {
        activeAnchor.removeAttribute("aria-describedby");
      }
      activeRectIndex = -1;
    }
    activeAnchor = anchor;
    activeAnchor.classList.add("is-popover-open");
    activeAnchor.setAttribute("aria-describedby", popover.id);
  }

  function showFootnotePopover(anchor, pointerEvent) {
    clearHideTimer();
    var targetEl = getFootnoteTarget(anchor);
    if (!targetEl) return;

    var fragment = buildFootnoteFragment(targetEl);
    if (!fragment) return;

    activateAnchor(anchor);
    popover.classList.remove("is-comment");

    var labelText = String(anchor.textContent || "").trim();
    if (indexEl) {
      indexEl.textContent = labelText;
      indexEl.style.display = labelText ? "" : "none";
    }
    if (bodyEl) {
      bodyEl.innerHTML = "";
      bodyEl.appendChild(fragment);
    }

    positionPopover(anchor, pointerEvent);
    popover.setAttribute("aria-hidden", "false");
    popover.classList.add("visible");
  }

  function showCommentPopover(trigger, pointerEvent) {
    clearHideTimer();
    var commentText = String(trigger.getAttribute("data-comment") || "").trim();
    if (!commentText) return;

    activateAnchor(trigger);
    popover.classList.add("is-comment");

    if (indexEl) {
      indexEl.textContent = "";
      indexEl.style.display = "none";
    }
    if (bodyEl) {
      bodyEl.innerHTML = "";
      bodyEl.textContent = commentText;
    }

    positionPopover(trigger, pointerEvent);
    popover.setAttribute("aria-hidden", "false");
    popover.classList.add("visible");
  }

  closeFootnotePopover = hidePopover;

  document.addEventListener(
    "touchstart",
    function () {
      lastTouchTime = Date.now();
    },
    { passive: true }
  );

  validFootnoteAnchors.forEach(function (anchor) {
    anchor.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "touch" || Date.now() - lastTouchTime < 500) {
        return;
      }
      isPointerInsideAnchor = true;
      showFootnotePopover(anchor, e);
    });

    anchor.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "touch") return;
      isPointerInsideAnchor = false;
      scheduleHide();
    });

    anchor.addEventListener("focusin", function () {
      if (Date.now() - lastTouchTime < 500) return;
      try {
        if (typeof anchor.matches === "function" && !anchor.matches(":focus-visible")) {
          return;
        }
      } catch (e) {}
      showFootnotePopover(anchor);
    });

    anchor.addEventListener("focusout", function (e) {
      if (
        (e.relatedTarget && popover.contains(e.relatedTarget)) ||
        isPointerInsidePopover ||
        isPointerDownInPopover ||
        hasSelectionInPopover()
      ) {
        return;
      }
      scheduleHide();
    });

    // Preserve native anchor jump; dismiss the hover popover immediately on click
    anchor.addEventListener("click", function () {
      hidePopover();
    });
  });

  commentTriggers.forEach(function (trigger) {
    if (!trigger.hasAttribute("tabindex")) {
      trigger.setAttribute("tabindex", "0");
    }

    trigger.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "touch" || Date.now() - lastTouchTime < 500) {
        return;
      }
      isPointerInsideAnchor = true;
      showCommentPopover(trigger, e);
    });

    trigger.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "touch") return;
      isPointerInsideAnchor = false;
      scheduleHide();
    });

    trigger.addEventListener("focusin", function () {
      if (Date.now() - lastTouchTime < 500) return;
      try {
        if (typeof trigger.matches === "function" && !trigger.matches(":focus-visible")) {
          return;
        }
      } catch (e) {}
      showCommentPopover(trigger);
    });

    trigger.addEventListener("focusout", function (e) {
      if (
        (e.relatedTarget && popover.contains(e.relatedTarget)) ||
        isPointerInsidePopover ||
        isPointerDownInPopover ||
        hasSelectionInPopover()
      ) {
        return;
      }
      scheduleHide();
    });

    // Allow tap-to-toggle on touch devices while leaving desktop hover smooth
    trigger.addEventListener("click", function (e) {
      if (Date.now() - lastTouchTime >= 500) return;
      if (activeAnchor === trigger && popover.classList.contains("visible")) {
        hidePopover();
      } else {
        showCommentPopover(trigger, e);
      }
    });
  });

  popover.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "touch") return;
    isPointerInsidePopover = true;
    clearHideTimer();
  });

  popover.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "touch") return;
    isPointerInsidePopover = false;
    scheduleHide();
  });

  popover.addEventListener("pointerdown", function () {
    isPointerDownInPopover = true;
    clearHideTimer();
  });

  function onDocumentPointerUp() {
    if (!isPointerDownInPopover) return;
    isPointerDownInPopover = false;
    lastPopoverPointerUpTime = Date.now();
  }

  document.addEventListener("pointerup", onDocumentPointerUp);
  document.addEventListener("pointercancel", onDocumentPointerUp);

  popover.addEventListener("focusin", function () {
    clearHideTimer();
  });

  popover.addEventListener("focusout", function (e) {
    if (
      (e.relatedTarget &&
        (popover.contains(e.relatedTarget) || e.relatedTarget === activeAnchor)) ||
      isPointerInsidePopover ||
      isPointerInsideAnchor ||
      isPointerDownInPopover ||
      hasSelectionInPopover()
    ) {
      return;
    }
    scheduleHide();
  });

  document.addEventListener("click", function (e) {
    if (!activeAnchor) return;
    if (Date.now() - lastPopoverPointerUpTime < 100) {
      return;
    }
    if (popover.contains(e.target) || activeAnchor.contains(e.target)) {
      return;
    }
    hidePopover();
  });

  function syncPopoverPosition() {
    if (!activeAnchor) return;
    if (repositionRaf) return;
    repositionRaf = window.requestAnimationFrame(function () {
      repositionRaf = null;
      if (!activeAnchor) return;
      var rect = resolveAnchorRect(activeAnchor);
      var viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;
      var safeTop = getSafeTop(16);
      if (rect.bottom < safeTop || rect.top > viewportHeight) {
        hidePopover();
        return;
      }
      positionPopover(activeAnchor);
    });
  }

  window.addEventListener("scroll", syncPopoverPosition, { passive: true });
  window.addEventListener("resize", syncPopoverPosition);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initMaskScrollLock();
    initCopyrightPopover();
    initFootnotePopover();
  });
} else {
  initThemeToggle();
  initMaskScrollLock();
  initCopyrightPopover();
  initFootnotePopover();
}
