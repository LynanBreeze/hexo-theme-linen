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
  var loaded = false;

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

  function resolveGiscusTheme(scheme) {
    if (config.theme && config.theme !== "auto" && config.theme !== "preferred_color_scheme") {
      return config.theme;
    }
    return scheme === "dark"
      ? config.darkTheme || "dark_dimmed"
      : config.lightTheme || "light";
  }

  function normalizeLang(rawLang) {
    var value = String(rawLang || "en").trim();
    if (/^zh[-_]?cn$/i.test(value) || value.toLowerCase() === "zh") return "zh-CN";
    if (/^zh[-_]?(tw|hk|hant)$/i.test(value)) return "zh-TW";
    return value || "en";
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

  function loadGiscus() {
    if (loaded) return;
    loaded = true;

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
    script.setAttribute("data-loading", "lazy");

    container.appendChild(script);
  }

  window.loadGiscus = loadGiscus;

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
