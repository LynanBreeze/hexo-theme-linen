(function () {
  "use strict";

  var previousScrollY = 0;
  var viewportWidth = window.innerWidth;
  var isAnchoring = false;
  var anchoringTimer = null;
  var overlayClosers = [];

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
        var navHeader = document.querySelector(".nav-header");
        if (navHeader) {
          navHeader.classList.remove("hide");
        }
      }
    }, 800);
  }

  function clearAnchoring() {
    isAnchoring = false;
    clearTimeout(anchoringTimer);
    var header = document.querySelector(".nav-header");
    if (header) {
      header.classList.remove("hide");
    }
  }

  (function addUAClass() {
    var isIOS = /iPhone/.test(window.navigator.userAgent);
    if (isIOS) {
      document.body.classList.add("ios");
    }
  })();

  function onScroll() {
    var backToTop = document.querySelector("#back-to-top");
    var header = document.querySelector(".nav-header");
    if (!header) return;

    var rawScrollY = window.scrollY;
    var currentScrollY = Math.max(0, rawScrollY);
    var triggerHeight = window.innerHeight * 1.5;

    if (!window.$gitalkInitiated && currentScrollY > window.innerHeight) {
      typeof window.loadGitalk === "function" && window.loadGitalk();
    }

    var isMobilePost =
      window.innerWidth <= 1280 && header.classList.contains("is-post");

    // Desktop does not auto-hide the header; ensure .hide is cleared
    if (!isMobilePost && header.classList.contains("hide")) {
      header.classList.remove("hide");
    }

    // Near the top (<= 60px), force header visible to prevent iOS/macOS rubber-band flicker
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
    // Ignore minor touch scroll jitter
    if (Math.abs(scrollDelta) < 8) {
      return;
    }

    if (scrollDelta < 0) {
      // Scrolling up: smoothly reveal header
      if (isMobilePost && !document.querySelector(".pswp--open")) {
        header.classList.remove("hide");
      }
      if (backToTop && currentScrollY >= triggerHeight) {
        backToTop.classList.add("visible");
      }
    } else {
      // Scrolling down: hide header once past 60% of the viewport height
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
    { passive: true },
  );

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (window.innerWidth === viewportWidth) return;

    var body = document.body;
    body.classList.add("resizing");
    viewportWidth = window.innerWidth;

    if (window.innerWidth > 1280) {
      var header = document.querySelector(".nav-header");
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
  window.setBodyScrollLocked = setBodyScrollLocked;

  function closestEl(el, selector) {
    return el && typeof el.closest === "function" ? el.closest(selector) : null;
  }

  function hasClass(el, className) {
    return Boolean(
      el &&
        el.classList &&
        typeof el.classList.contains === "function" &&
        el.classList.contains(className),
    );
  }

  function handleGlobalClick(e) {
    try {
      var target = e.target;
      if (target && target.nodeType !== 1) {
        target = target.parentElement;
      }
      if (!target) return;

      var tocElement = document.getElementById("toc");
      var seriesElement = document.getElementById("series");
      var maskElement = document.getElementById("mask");
      var donateModal = document.getElementById("donate-modal");

      var closeSeriesBtn =
        closestEl(target, ".close-series-popup-icon, .close-series-popup-icon-wrap") ||
        (hasClass(target, "close-series-popup-icon") ||
        hasClass(target, "close-series-popup-icon-wrap")
          ? target
          : null);
      var backToTopBtn =
        closestEl(target, "#back-to-top") ||
        (target.id === "back-to-top" ? target : null);
      var tocToggleBtnEl =
        closestEl(target, "#toc-toggle") ||
        (target.id === "toc-toggle" ? target : null);
      var seriesTrigger =
        target.tagName !== "H1"
          ? closestEl(target, ".series-name") ||
            (hasClass(target, "series-name") ? target : null)
          : null;
      if (seriesTrigger && seriesTrigger.tagName === "H1") {
        seriesTrigger = null;
      }
      var seriesItemLink =
        closestEl(target, ".series-item-link") ||
        (hasClass(target, "series-item-link") ? target : null);

      if (closeSeriesBtn) {
        seriesElement?.classList?.remove("visible");
        maskElement?.classList?.remove("visible");
        setBodyScrollLocked(false);
      } else if (backToTopBtn) {
        e.preventDefault();
        var newLocation = new URL(location.href);
        newLocation.hash = "";
        history.replaceState(null, "", newLocation.href);
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "smooth",
        });
      } else if (tocToggleBtnEl) {
        if (tocElement?.classList?.contains("visible")) {
          tocElement.classList.remove("visible");
          maskElement?.classList?.remove("visible");
          setBodyScrollLocked(false);
          tocToggleBtnEl.setAttribute("aria-expanded", "false");
        } else {
          tocElement?.classList?.add("visible");
          maskElement?.classList?.add("visible");
          setBodyScrollLocked(true);
          tocToggleBtnEl.setAttribute("aria-expanded", "true");
        }
      } else if (seriesTrigger) {
        seriesElement?.classList?.add("visible");
        maskElement?.classList?.add("visible");
        donateModal?.classList?.remove("visible");
        setBodyScrollLocked(true);
      } else if (seriesItemLink) {
        seriesElement?.classList?.remove("visible");
        maskElement?.classList?.remove("visible");
        setBodyScrollLocked(false);
      } else if (target.id === "mask") {
        tocElement?.classList?.remove("visible");
        seriesElement?.classList?.remove("visible");
        maskElement?.classList?.remove("visible");
        setBodyScrollLocked(false);
        var tocToggleBtn = document.getElementById("toc-toggle");
        if (tocToggleBtn) tocToggleBtn.setAttribute("aria-expanded", "false");
      }
    } catch (error) {
      console.log(error);
    }
  }

  function closeActiveOverlays() {
    var tocElement = document.getElementById("toc");
    var seriesElement = document.getElementById("series");
    var maskElement = document.getElementById("mask");
    var donateModal = document.getElementById("donate-modal");
    var closedAny = false;

    for (var i = 0; i < overlayClosers.length; i++) {
      if (typeof overlayClosers[i] === "function" && overlayClosers[i]()) {
        closedAny = true;
      }
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

  window.__linen = {
    setBodyScrollLocked: setBodyScrollLocked,
    triggerAnchoring: triggerAnchoring,
    clearAnchoring: clearAnchoring,
    registerOverlayCloser: function (fn) {
      if (typeof fn === "function") {
        overlayClosers.push(fn);
      }
    },
  };

  var isClickHandlerBound = false;
  function bindClickHandler() {
    if (isClickHandlerBound) return;
    document.addEventListener("click", handleGlobalClick, true);
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
      { passive: false },
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
        { passive: true },
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
        toggleBtn.setAttribute(
          "aria-pressed",
          theme === "dark" ? "true" : "false",
        );
      }
    }

    function emitChange(theme) {
      try {
        window.dispatchEvent(
          new CustomEvent("linen:themechange", { detail: { theme: theme } }),
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

  function initSite() {
    initThemeToggle();
    initMaskScrollLock();
    initCopyrightPopover();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSite);
  } else {
    initSite();
  }
})();
