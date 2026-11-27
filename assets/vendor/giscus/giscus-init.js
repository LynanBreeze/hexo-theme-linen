"use strict";

(function () {
  var configEl = document.getElementById("linen-giscus-config");
  var container = document.getElementById("giscus-container");
  if (!configEl || !container) return;

  var config = null;
  try {
    config = JSON.parse(configEl.textContent || "{}");
  } catch (error) {
    return;
  }

  if (!config.repo || !config.repoId || !config.categoryId) {
    return;
  }

  var GISCUS_ORIGIN = "https://giscus.app";
  // Giscus renders its own ~84px "Loading comments..." spinner before GraphQL
  // resolves and the real comment box (>= 200px) renders. Wait for the real
  // widget height so users never see two consecutive loading indicators.
  var MIN_READY_HEIGHT = 180;
  var IFRAME_LOAD_FALLBACK_MS = 8000;
  var loaded = false;
  var ready = false;
  var frameObserver = null;
  var fallbackTimer = null;

  function getEffectiveColorScheme() {
    var explicit = document.documentElement.getAttribute("data-theme");
    if (explicit === "dark" || explicit === "light") {
      return explicit;
    }
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function resolveLinenThemeCss(scheme) {
    var relPath =
      scheme === "dark" ? config.linenDarkCss : config.linenLightCss;
    var fallback = scheme === "dark" ? "dark_dimmed" : "light";
    if (!relPath) return fallback;
    if (/^https:\/\//i.test(relPath)) return relPath;
    // Giscus fetches custom CSS from https://giscus.app; browsers block http://
    // stylesheets as mixed content, so fall back cleanly on local HTTP servers.
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.protocol === "https:"
    ) {
      try {
        return new URL(relPath, window.location.href).href;
      } catch (error) {
        return fallback;
      }
    }
    return fallback;
  }

  function resolveGiscusTheme(scheme) {
    var explicit = config.theme;
    if (
      explicit &&
      explicit !== "auto" &&
      explicit !== "preferred_color_scheme" &&
      explicit !== "linen"
    ) {
      return explicit;
    }
    var target =
      explicit === "linen"
        ? "linen"
        : scheme === "dark"
          ? config.darkTheme || "linen"
          : config.lightTheme || "linen";
    if (target === "linen") {
      return resolveLinenThemeCss(scheme);
    }
    return target;
  }

  function normalizeLang(rawLang) {
    var value = String(rawLang || "en").trim();
    if (/^zh[-_]?cn$/i.test(value) || value.toLowerCase() === "zh") return "zh-CN";
    if (/^zh[-_]?(tw|hk|hant)$/i.test(value)) return "zh-TW";
    return value || "en";
  }

  function markReady() {
    if (ready) return;
    ready = true;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (frameObserver) {
      frameObserver.disconnect();
      frameObserver = null;
    }
    if (container.classList) {
      container.classList.remove("is-loading", "is-error");
      container.classList.add("is-loaded");
    }
  }

  function markError() {
    if (ready) return;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (frameObserver) {
      frameObserver.disconnect();
      frameObserver = null;
    }
    if (container.classList) {
      container.classList.remove("is-loading");
      container.classList.add("is-error");
    }
    var textEl =
      typeof container.querySelector === "function"
        ? container.querySelector(".giscus-loading-text")
        : null;
    if (textEl && config.errorText) {
      textEl.textContent = config.errorText;
    }
  }

  function syncGiscusTheme(scheme) {
    var iframe = container.querySelector("iframe.giscus-frame");
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      {
        giscus: {
          setConfig: {
            theme: resolveGiscusTheme(scheme || getEffectiveColorScheme()),
          },
        },
      },
      GISCUS_ORIGIN,
    );
  }

  function bindIframeLoad(iframe) {
    if (!iframe || iframe.__linenLoadBound) return;
    iframe.__linenLoadBound = true;
    if (typeof iframe.addEventListener === "function") {
      iframe.addEventListener("load", function () {
        if (!ready && !fallbackTimer) {
          fallbackTimer = setTimeout(markReady, IFRAME_LOAD_FALLBACK_MS);
        }
      });
    }
  }

  function watchGiscusFrame() {
    var existing =
      typeof container.querySelector === "function"
        ? container.querySelector("iframe.giscus-frame")
        : null;
    if (existing) {
      bindIframeLoad(existing);
      return;
    }
    if (typeof MutationObserver !== "function") return;
    frameObserver = new MutationObserver(function () {
      var iframe = container.querySelector("iframe.giscus-frame");
      if (iframe) {
        bindIframeLoad(iframe);
        if (frameObserver) {
          frameObserver.disconnect();
          frameObserver = null;
        }
      }
    });
    frameObserver.observe(container, { childList: true, subtree: true });
  }

  function loadGiscus() {
    if (loaded) return;
    loaded = true;

    watchGiscusFrame();

    var script = document.createElement("script");
    script.src = GISCUS_ORIGIN + "/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";

    script.setAttribute("data-repo", config.repo);
    script.setAttribute("data-repo-id", config.repoId);
    if (config.category) {
      script.setAttribute("data-category", config.category);
    }
    script.setAttribute("data-category-id", config.categoryId);
    script.setAttribute("data-mapping", config.mapping || "pathname");
    if (config.term) {
      script.setAttribute("data-term", config.term);
    }
    script.setAttribute("data-strict", String(config.strict ?? "0"));
    script.setAttribute(
      "data-reactions-enabled",
      String(config.reactionsEnabled ?? "1"),
    );
    script.setAttribute("data-emit-metadata", String(config.emitMetadata ?? "0"));
    script.setAttribute("data-input-position", config.inputPosition || "top");
    script.setAttribute(
      "data-theme",
      resolveGiscusTheme(getEffectiveColorScheme()),
    );
    script.setAttribute("data-lang", normalizeLang(config.lang));

    script.onerror = markError;

    container.appendChild(script);
  }

  window.loadGiscus = loadGiscus;

  window.addEventListener("message", function (event) {
    if (event.origin !== GISCUS_ORIGIN) return;
    if (!event.data || typeof event.data !== "object" || !event.data.giscus) {
      return;
    }
    var payload = event.data.giscus;
    if (
      typeof payload.resizeHeight === "number" &&
      payload.resizeHeight >= MIN_READY_HEIGHT
    ) {
      markReady();
      return;
    }
    if (
      typeof payload.error === "string" &&
      !payload.error.includes("Discussion not found")
    ) {
      markReady();
    }
  });

  window.addEventListener("linen:themechange", function (e) {
    syncGiscusTheme(e && e.detail && e.detail.theme);
  });

  function initObserver() {
    if (typeof IntersectionObserver !== "function") {
      loadGiscus();
      return;
    }
    var observer = new IntersectionObserver(
      function (entries, obs) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            loadGiscus();
            obs.disconnect();
            return;
          }
        }
      },
      { rootMargin: "200px 0px" },
    );

    var initiator = document.getElementById("gitalk-initiator");
    if (initiator) {
      observer.observe(initiator);
    }
    observer.observe(container);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initObserver);
  } else {
    initObserver();
  }
})();
