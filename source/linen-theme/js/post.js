(function () {
  "use strict";

  var anchoringId = null;

  function setBodyScrollLocked(locked) {
    if (typeof window.setBodyScrollLocked === "function") {
      window.setBodyScrollLocked(locked);
      return;
    }
    document.body && document.body.classList.toggle("no-scroll", Boolean(locked));
    document.documentElement &&
      document.documentElement.classList.toggle("no-scroll", Boolean(locked));
  }

  function triggerAnchoring() {
    if (window.__linen && typeof window.__linen.triggerAnchoring === "function") {
      window.__linen.triggerAnchoring();
    }
  }

  function clearAnchoring() {
    if (window.__linen && typeof window.__linen.clearAnchoring === "function") {
      window.__linen.clearAnchoring();
    }
  }

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

  function isElementInViewport(el) {
    var rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  var copyFeedbackTimers = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function (err) {
          console.error("Copy failed:", err);
          return false;
        },
      );
    }
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    var ok = false;
    try {
      ok = Boolean(document.execCommand("copy"));
    } catch (err) {
      console.error("Copy failed:", err);
    }
    document.body.removeChild(textArea);
    return Promise.resolve(ok);
  }

  function highlightAnchor(hash, highlightClass) {
    highlightClass = highlightClass || "anchor-highlight";
    if (!hash) return;
    var id = hash.replace(/^#/, "");
    try {
      id = decodeURIComponent(id);
    } catch (e) {}
    var el = document.getElementById(id);
    if (!el) return;

    function triggerHighlight() {
      el.classList.remove(highlightClass);
      void el.offsetWidth;
      el.classList.add(highlightClass);

      if (
        el.classList.contains("footnote-anchor-wrap") &&
        typeof el.closest === "function"
      ) {
        var contextBlock = el.closest(
          "p, li, blockquote, dd, td, th, figcaption",
        );
        if (contextBlock) {
          contextBlock.classList.remove("footnote-context-highlight");
          void contextBlock.offsetWidth;
          contextBlock.classList.add("footnote-context-highlight");
        }
      }
    }

    var rect =
      typeof el.getBoundingClientRect === "function"
        ? el.getBoundingClientRect()
        : null;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var inViewport = !rect || !vh || (rect.bottom > 0 && rect.top < vh);

    if (inViewport || typeof IntersectionObserver !== "function") {
      triggerHighlight();
      return;
    }

    // Wait until smooth scroll brings the target into view so the flash
    // does not finish before the user arrives at the anchor.
    var triggered = false;
    var observer = null;
    var fallbackTimer = null;

    var fire = function () {
      if (triggered) return;
      triggered = true;
      if (observer) observer.disconnect();
      if (fallbackTimer) clearTimeout(fallbackTimer);
      triggerHighlight();
    };

    observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            setTimeout(fire, 120);
            return;
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    fallbackTimer = setTimeout(fire, 900);
  }

  function initAnchorHighlighter() {
    if (location.hash) {
      highlightAnchor(location.hash);
    }
    window.addEventListener("hashchange", function () {
      highlightAnchor(location.hash);
    });
    // Clicking a footnote anchor or backref pointing to the current hash does not
    // fire hashchange; re-trigger the highlight so repeated jumps still flash.
    document.addEventListener("click", function (e) {
      var link =
        e.target && typeof e.target.closest === "function"
          ? e.target.closest(
              'a.footnote-backref[href^="#"], a.footnote-href[href^="#"]',
            )
          : null;
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href) return;
      var currentHash = location.hash;
      var targetHash = href;
      try {
        currentHash = decodeURIComponent(currentHash);
        targetHash = decodeURIComponent(targetHash);
      } catch (err) {}
      if (currentHash === targetHash) {
        highlightAnchor(href);
      }
    });
  }

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
            items[index].setAttribute(
              "aria-hidden",
              isActive ? "false" : "true",
            );

            if (buttons[index]) {
              buttons[index].classList.toggle("active", isActive);
              buttons[index].setAttribute(
                "aria-selected",
                isActive ? "true" : "false",
              );
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

  function positionDonateModal(trigger, modal) {
    var buttonRect = trigger.getBoundingClientRect();
    var modalHeight = modal.offsetHeight || 258;
    var gap = 12;
    var edgePadding = 16;

    var safeTop = edgePadding;
    var header = document.querySelector(".nav-header");
    if (header && !header.classList.contains("hide")) {
      var headerStyle = window.getComputedStyle(header);
      if (
        headerStyle.position === "fixed" ||
        headerStyle.position === "sticky"
      ) {
        var headerRect = header.getBoundingClientRect();
        if (headerRect.bottom > 0) {
          safeTop = Math.max(safeTop, headerRect.bottom + 12);
        }
      }
    }

    var viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
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

  function handlePostClick(e) {
    try {
      var target = e.target;
      if (target && target.nodeType !== 1) {
        target = target.parentElement;
      }
      if (!target) return;

      var tocElement = document.getElementById("toc");
      var maskElement = document.getElementById("mask");
      var donateModal = document.getElementById("donate-modal");

      var contentSwitch =
        closestEl(target, "#content-switch") ||
        (target.id === "content-switch" ? target : null);
      if (contentSwitch) {
        if (document.body.classList.contains("render-raw")) {
          contentSwitch.innerText = contentSwitch.dataset.rawcontentlabel;
        } else {
          contentSwitch.innerText = contentSwitch.dataset.renderedcontentlabel;
        }
        document.body.classList.toggle("render-raw");
      }

      var captionLink =
        closestEl(target, ".caption-link") ||
        (hasClass(target, "caption-link") ? target : null);
      var copyBtn =
        closestEl(target, ".copy-btn") ||
        (hasClass(target, "copy-btn") ? target : null);
      var tocLink =
        closestEl(target, ".toc-item-link, .toc-sub-item-link") ||
        (hasClass(target, "toc-item-link") ||
        hasClass(target, "toc-sub-item-link")
          ? target
          : null);
      var foldToggle =
        closestEl(target, ".fold-toggle") ||
        (hasClass(target, "fold-toggle") ? target : null);

      var headingEl = !closestEl(target, "a")
        ? closestEl(target, "#post h2[id], #post h3[id], #page h2[id], #page h3[id]") ||
          ((target.tagName === "H2" || target.tagName === "H3") && target.id
            ? target
            : null)
        : null;

      if (headingEl && headingEl.id) {
        var newLocation = new URL(location.href);
        newLocation.hash = "#" + headingEl.id;
        history.replaceState(null, "", newLocation.href);
        headingEl.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
        highlightAnchor(headingEl.id);
        return;
      } else if (captionLink) {
        var href = captionLink.getAttribute("href");
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
        return;
      } else if (copyBtn) {
        try {
          var codeBlock = copyBtn.parentElement.querySelector(".code");
          if (!codeBlock) return;
          copyToClipboard(codeBlock.innerText).then(function (ok) {
            if (!ok) return;
            copyBtn.classList.add("copied");
            if (copyFeedbackTimers) {
              var prevTimer = copyFeedbackTimers.get(copyBtn);
              if (prevTimer) clearTimeout(prevTimer);
              copyFeedbackTimers.set(
                copyBtn,
                setTimeout(function () {
                  copyBtn.classList.remove("copied");
                  copyFeedbackTimers.delete(copyBtn);
                }, 1500),
              );
            } else {
              setTimeout(function () {
                copyBtn.classList.remove("copied");
              }, 1500);
            }
          });
          return;
        } catch (error) {}
      } else if (hasClass(target, "placeholder")) {
        e.preventDefault();
        return;
      } else if (tocLink) {
        e.preventDefault();
        if (!window.$gitalkInitiated) {
          typeof window.loadGitalk === "function" && window.loadGitalk();
        }
        var targetId = tocLink.dataset.id;
        var anchor = document.getElementById(targetId);
        if (tocElement?.classList?.contains("visible")) {
          tocElement.classList.remove("visible");
          maskElement?.classList?.remove("visible");
          setBodyScrollLocked(false);
          var tocBtn = document.getElementById("toc-toggle");
          if (tocBtn) tocBtn.setAttribute("aria-expanded", "false");
        }
        var firstTocLink = tocElement
          ? tocElement.querySelector(".toc-item-link")
          : null;
        var isFirstToc = tocLink === firstTocLink;

        if (targetId === "to-page-top" || targetId === "page-top") {
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: "instant",
          });
          clearAnchoring();
        } else {
          anchor &&
            anchor.scrollIntoView({
              behavior: "instant",
              block: "start",
            });
          if (isFirstToc) {
            clearAnchoring();
          } else {
            triggerAnchoring();
          }
        }
        highlightAnchor(targetId);
        if (
          hasClass(tocLink, "toc-item-link") &&
          anchor &&
          isElementInViewport(anchor)
        ) {
          anchoringId = anchor.id;
          var tocItems =
            document.getElementById("toc")?.children?.[1]?.children || [];
          Array.prototype.forEach.call(tocItems, function (tocItem) {
            if (tocItem?.children?.[0]?.dataset?.id === anchoringId) {
              tocItem.className = "toc-item-wrap active";
            } else {
              tocItem.className = "toc-item-wrap";
            }
          });
        } else if (anchoringId) {
          anchoringId = null;
        }
        return;
      } else if (foldToggle) {
        var parentElement = foldToggle.parentElement;
        if (parentElement) {
          parentElement.classList.toggle("folded");
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
          !closestEl(target, "#donate-modal")
        ) {
          donateModal.classList.remove("visible");
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  function initAgeWarning() {
    var ageWarningElement = document.getElementById("post-age-warning");
    if (!ageWarningElement) return;
    var dateElement = document.querySelector("#post .post-meta .date");
    var dateStr = dateElement ? dateElement.getAttribute("datetime") : null;
    if (!dateStr) return;

    var postDate = new Date(dateStr);
    if (isNaN(postDate.getTime())) return;
    var now = new Date();

    var diffTime = now - postDate;
    var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays && diffDays > 180) {
      var daysSpan = ageWarningElement.querySelector(".days-value");
      if (daysSpan) {
        daysSpan.innerText = diffDays;
      }
      ageWarningElement.style.display = "";
    } else {
      ageWarningElement.style.display = "none";
    }
    return diffDays;
  }

  function initFootnotePopover() {
    var footnoteAnchors = Array.prototype.slice.call(
      document.querySelectorAll(
        'a.footnote-href[href^="#"], .footnote-ref a[href^="#"]',
      ),
    );
    var commentTriggers = Array.prototype.slice
      .call(document.querySelectorAll(".commented-text[data-comment]"))
      .filter(function (el) {
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
          (focusNode && popover.contains(focusNode)),
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
        Math.max(14, popoverWidth - 14),
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
      var commentText = String(
        trigger.getAttribute("data-comment") || "",
      ).trim();
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

    if (
      window.__linen &&
      typeof window.__linen.registerOverlayCloser === "function"
    ) {
      window.__linen.registerOverlayCloser(hidePopover);
    } else {
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") hidePopover();
      });
    }

    document.addEventListener(
      "touchstart",
      function () {
        lastTouchTime = Date.now();
      },
      { passive: true },
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
          if (
            typeof anchor.matches === "function" &&
            !anchor.matches(":focus-visible")
          ) {
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
          if (
            typeof trigger.matches === "function" &&
            !trigger.matches(":focus-visible")
          ) {
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
          (popover.contains(e.relatedTarget) ||
            e.relatedTarget === activeAnchor)) ||
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

  var isPostClickBound = false;
  function bindPostClick() {
    if (isPostClickBound) return;
    document.addEventListener("click", handlePostClick, true);
    isPostClickBound = true;
  }

  function initPost() {
    bindPostClick();
    initAnchorHighlighter();
    initImageGridSwitchers();
    initAgeWarning();
    initFootnotePopover();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPost);
  } else {
    initPost();
  }
  window.addEventListener("pageshow", bindPostClick);
})();
