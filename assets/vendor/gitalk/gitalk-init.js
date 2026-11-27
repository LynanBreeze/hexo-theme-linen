"use strict";

(function () {
  var configEl = document.getElementById("linen-gitalk-config");
  if (!configEl) return;

  var config = null;
  try {
    config = JSON.parse(configEl.textContent || "{}");
  } catch (error) {
    return;
  }

  window.$gitalkInitiated = false;

  function hashPathname(pathname) {
    var hash = 2166136261;
    for (var i = 0; i < pathname.length; i++) {
      hash ^= pathname.charCodeAt(i);
      hash +=
        (hash << 1) +
        (hash << 4) +
        (hash << 7) +
        (hash << 8) +
        (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  function loadGitalk() {
    if (window.$gitalkInitiated) {
      return;
    }
    window.$gitalkInitiated = true;

    if (config.cssUrl) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = config.cssUrl;
      document.head.appendChild(link);
    }

    var script = document.createElement("script");
    script.src = config.jsUrl;
    var pageId =
      location.pathname.length > 40
        ? hashPathname(location.pathname)
        : location.pathname;

    script.onload = function () {
      var gitalk = new Gitalk({
        clientID: config.clientID,
        clientSecret: config.clientSecret,
        repo: config.repo,
        owner: config.owner,
        admin: config.admin,
        id: pageId,
        distractionFreeMode: false,
        proxy: config.proxy,
        language: config.language,
        pagerDirection: config.pagerDirection || "last",
      });

      gitalk.render("gitalk-container");

      var container = document.getElementById("gitalk-container");
      if (!container) return;

      var expandComment = function () {
        var comment = container.querySelector(".gt-header-comment");
        if (comment && !comment.classList.contains("is-expanded")) {
          comment.classList.add("is-expanded");
        }
      };

      // Focus the textarea and expand when clicking on the comment box wrapper
      container.addEventListener("click", function (e) {
        var comment = e.target.closest(".gt-header-comment");
        if (comment) {
          expandComment();
          if (e.target === comment) {
            var textarea = comment.querySelector(".gt-header-textarea");
            if (textarea) textarea.focus();
          }
        }
      });

      // Expand once interacted with and keep expanded permanently
      container.addEventListener("focusin", function (e) {
        if (e.target && e.target.classList.contains("gt-header-textarea")) {
          expandComment();
        }
      });

      container.addEventListener("input", function (e) {
        if (e.target && e.target.classList.contains("gt-header-textarea")) {
          expandComment();
        }
      });

      var githubUserHrefRe =
        /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9_-]{0,38}))\/?$/i;
      var normalizeMentions = function () {
        var links = container.querySelectorAll(
          ".gt-comment-body a:not(.user-mention), .gt-header-preview a:not(.user-mention)",
        );
        for (var i = 0; i < links.length; i++) {
          var link = links[i];
          var text = (link.textContent || "").trim();
          var href = (link.getAttribute("href") || "").trim();
          var match = href.match(githubUserHrefRe);
          if (
            (link.getAttribute("data-hovercard-type") === "user" &&
              text.charAt(0) === "@") ||
            (match && text.toLowerCase() === "@" + match[1].toLowerCase())
          ) {
            link.classList.add("user-mention");
          }
        }
      };

      normalizeMentions();
      var mentionObserver = new MutationObserver(normalizeMentions);
      mentionObserver.observe(container, { childList: true, subtree: true });
    };

    document.body.appendChild(script);
  }

  window.loadGitalk = loadGitalk;

  function initObserver() {
    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          loadGitalk();
          obs.unobserve(entry.target);
        }
      });
    });
    var target = document.getElementById("gitalk-initiator");
    var gitalkContainer = document.getElementById("gitalk-container");
    if (target) {
      observer.observe(target);
    }
    if (gitalkContainer) {
      observer.observe(gitalkContainer);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initObserver);
  } else {
    initObserver();
  }
})();
