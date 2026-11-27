(function () {
  "use strict";

  var modal = document.getElementById("search-modal");
  var toggleBtn = document.getElementById("search-toggle");
  if (!modal) return;

  var input = modal.querySelector("#search-input");
  var resultsEl = modal.querySelector("#search-results");
  var closeBtn = modal.querySelector(".search-close");
  var indexUrl = modal.getAttribute("data-index-url") || "/linen-theme/search-index.json";
  var siteRoot = modal.getAttribute("data-site-root") || "/";
  if (siteRoot.slice(-1) !== "/") siteRoot += "/";

  var labels = {
    loading: modal.getAttribute("data-label-loading") || "Loading...",
    error: modal.getAttribute("data-label-error") || "Failed to load search index",
    empty: modal.getAttribute("data-label-empty") || "No matching posts found",
    hint: modal.getAttribute("data-label-hint") || "Type to search",
  };

  var indexData = null;
  var loadingPromise = null;
  var activeIndex = -1;
  var previousFocus = null;

  function setScrollLocked(locked) {
    if (typeof window.setBodyScrollLocked === "function") {
      window.setBodyScrollLocked(locked);
      return;
    }
    document.body.classList.toggle("no-scroll", locked);
    document.documentElement.classList.toggle("no-scroll", locked);
  }

  function renderStatus(message) {
    resultsEl.textContent = "";
    var status = document.createElement("div");
    status.className = "search-status";
    status.textContent = message;
    resultsEl.appendChild(status);
    activeIndex = -1;
  }

  function appendHighlighted(container, text, terms) {
    var source = String(text || "");
    if (!source || !terms.length) {
      container.appendChild(document.createTextNode(source));
      return;
    }
    var escaped = terms
      .map(function (t) {
        return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .filter(Boolean);
    if (!escaped.length) {
      container.appendChild(document.createTextNode(source));
      return;
    }
    var re = new RegExp("(" + escaped.join("|") + ")", "gi");
    var parts = source.split(re);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (i % 2 === 1) {
        var mark = document.createElement("mark");
        mark.textContent = part;
        container.appendChild(mark);
      } else {
        container.appendChild(document.createTextNode(part));
      }
    }
  }

  function buildSnippet(item, terms) {
    var body = item.excerpt || item.content || "";
    if (!body) return "";
    var lower = body.toLowerCase();
    var matchPos = -1;
    for (var i = 0; i < terms.length; i++) {
      var idx = lower.indexOf(terms[i]);
      if (idx !== -1 && (matchPos === -1 || idx < matchPos)) {
        matchPos = idx;
      }
    }
    if (matchPos === -1 && item.content && item.excerpt) {
      body = item.content;
      lower = body.toLowerCase();
      for (var j = 0; j < terms.length; j++) {
        var cIdx = lower.indexOf(terms[j]);
        if (cIdx !== -1 && (matchPos === -1 || cIdx < matchPos)) {
          matchPos = cIdx;
        }
      }
    }
    if (matchPos <= 40) {
      return body.slice(0, 150) + (body.length > 150 ? "…" : "");
    }
    var start = Math.max(0, matchPos - 36);
    var end = Math.min(body.length, start + 150);
    return (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
  }

  function prepareIndexItem(item) {
    if (!item || typeof item !== "object") return null;
    item._title = String(item.title || "").toLowerCase();
    item._subTitle = String(item.subTitle || "").toLowerCase();
    item._meta = []
      .concat(item.tags || [], item.categories || [], item.series ? [item.series] : [])
      .join(" ")
      .toLowerCase();
    item._excerpt = String(item.excerpt || "").toLowerCase();
    item._content = String(item.content || "").toLowerCase();
    return item;
  }

  function scoreItem(item, terms) {
    var title = item._title != null ? item._title : String(item.title || "").toLowerCase();
    var subTitle = item._subTitle != null ? item._subTitle : String(item.subTitle || "").toLowerCase();
    var meta =
      item._meta != null
        ? item._meta
        : []
            .concat(item.tags || [], item.categories || [], item.series ? [item.series] : [])
            .join(" ")
            .toLowerCase();
    var excerpt = item._excerpt != null ? item._excerpt : String(item.excerpt || "").toLowerCase();
    var content = item._content != null ? item._content : String(item.content || "").toLowerCase();

    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      var termScore = 0;
      if (title.indexOf(term) !== -1) termScore += 10;
      if (subTitle.indexOf(term) !== -1) termScore += 6;
      if (meta.indexOf(term) !== -1) termScore += 5;
      if (excerpt.indexOf(term) !== -1) termScore += 3;
      if (content.indexOf(term) !== -1) termScore += 1;
      if (termScore === 0) return 0;
      total += termScore;
    }
    return total;
  }

  function updateActiveItem(nextIndex) {
    var items = resultsEl.querySelectorAll(".search-result-item");
    if (!items.length) {
      activeIndex = -1;
      return;
    }
    if (nextIndex < 0) nextIndex = items.length - 1;
    if (nextIndex >= items.length) nextIndex = 0;
    activeIndex = nextIndex;
    for (var i = 0; i < items.length; i++) {
      var isActive = i === activeIndex;
      items[i].classList.toggle("active", isActive);
      items[i].setAttribute("aria-selected", isActive ? "true" : "false");
    }
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function runSearch(rawQuery) {
    var query = String(rawQuery || "").trim();
    if (!query) {
      renderStatus(labels.hint);
      return;
    }
    if (!indexData) {
      renderStatus(labels.loading);
      return;
    }

    var terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    var matches = [];
    for (var i = 0; i < indexData.length; i++) {
      var item = indexData[i];
      var score = scoreItem(item, terms);
      if (score > 0) {
        matches.push({ item: item, score: score });
      }
    }

    matches.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.item.date || "").localeCompare(String(a.item.date || ""));
    });

    if (!matches.length) {
      renderStatus(labels.empty);
      return;
    }

    resultsEl.textContent = "";
    var frag = document.createDocumentFragment();
    var limit = Math.min(matches.length, 20);
    for (var j = 0; j < limit; j++) {
      var post = matches[j].item;
      var link = document.createElement("a");
      link.className = "search-result-item";
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", "false");
      link.href = siteRoot + String(post.path || "").replace(/^\/+/, "");

      var titleEl = document.createElement("div");
      titleEl.className = "search-result-title";
      appendHighlighted(titleEl, post.title || "", terms);
      if (post.subTitle) {
        var subEl = document.createElement("span");
        subEl.className = "sub-title";
        appendHighlighted(subEl, post.subTitle, terms);
        titleEl.appendChild(subEl);
      }
      link.appendChild(titleEl);

      var metaParts = [];
      if (post.date) metaParts.push(post.date);
      if (post.series) metaParts.push(post.series);
      if (post.tags && post.tags.length) {
        metaParts.push("#" + post.tags.slice(0, 3).join(" #"));
      }
      if (metaParts.length) {
        var metaEl = document.createElement("div");
        metaEl.className = "search-result-meta";
        for (var m = 0; m < metaParts.length; m++) {
          var span = document.createElement("span");
          span.textContent = metaParts[m];
          metaEl.appendChild(span);
        }
        link.appendChild(metaEl);
      }

      var snippet = buildSnippet(post, terms);
      if (snippet) {
        var snippetEl = document.createElement("div");
        snippetEl.className = "search-result-snippet";
        appendHighlighted(snippetEl, snippet, terms);
        link.appendChild(snippetEl);
      }

      frag.appendChild(link);
    }

    resultsEl.appendChild(frag);
    updateActiveItem(0);
  }

  function ensureIndexLoaded() {
    if (indexData) return Promise.resolve(indexData);
    if (loadingPromise) return loadingPromise;

    renderStatus(labels.loading);
    loadingPromise = fetch(indexUrl, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        indexData = Array.isArray(data)
          ? data.map(prepareIndexItem).filter(Boolean)
          : [];
        return indexData;
      })
      .catch(function () {
        loadingPromise = null;
        renderStatus(labels.error);
        return null;
      });
    return loadingPromise;
  }

  function openModal() {
    if (!modal.hidden) return;
    previousFocus = document.activeElement;
    modal.hidden = false;
    setScrollLocked(true);
    if (input) {
      input.focus();
      input.select();
    }
    ensureIndexLoaded().then(function (data) {
      if (data && !modal.hidden) {
        runSearch(input ? input.value : "");
      }
    });
  }

  function closeModal() {
    if (modal.hidden) return false;
    modal.hidden = true;
    setScrollLocked(false);
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
    return true;
  }

  if (
    window.__linen &&
    typeof window.__linen.registerOverlayCloser === "function"
  ) {
    window.__linen.registerOverlayCloser(closeModal);
  }

  function trapFocus(e) {
    var focusable = modal.querySelectorAll(
      'input:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !modal.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !modal.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      openModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", function (e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  if (input) {
    var inputDebounceTimer = null;
    input.addEventListener("input", function () {
      clearTimeout(inputDebounceTimer);
      inputDebounceTimer = setTimeout(function () {
        runSearch(input.value);
      }, 120);
    });
  }

  document.addEventListener("keydown", function (e) {
    var key = e.key;
    if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === "k") {
      e.preventDefault();
      if (modal.hidden) {
        openModal();
      } else {
        closeModal();
      }
      return;
    }

    if (modal.hidden) return;

    if (key === "Tab") {
      trapFocus(e);
    } else if (key === "Escape") {
      e.preventDefault();
      closeModal();
    } else if (key === "ArrowDown") {
      e.preventDefault();
      updateActiveItem(activeIndex + 1);
    } else if (key === "ArrowUp") {
      e.preventDefault();
      updateActiveItem(activeIndex - 1);
    } else if (key === "Enter") {
      var activeItem = resultsEl.querySelector(".search-result-item.active");
      if (activeItem && activeItem.href) {
        e.preventDefault();
        window.location.href = activeItem.href;
      }
    }
  });
})();
