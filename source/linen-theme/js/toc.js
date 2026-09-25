document.addEventListener("DOMContentLoaded", () => {
  const tocContainer = document.getElementById("toc");
  if (!tocContainer) return;

  const contentContainer =
    document.getElementById("page-content") ||
    document.getElementById("post") ||
    document.body;

  const headerElements = Array.from(
    contentContainer.querySelectorAll("h2, h3"),
  );
  if (headerElements.length === 0) return;

  // 1. Ensure every heading has a valid ID, filling in missing IDs in the DOM.
  headerElements.forEach((header, index) => {
    if (!header.id) {
      const text = (header.textContent || "").trim();
      header.id =
        text.replace(/\s+/g, "-").toLowerCase() || `heading-${index}`;
    }
  });

  // 2. Parse the TOC DOM and build lookup maps.
  const tocItemWraps = Array.from(
    tocContainer.querySelectorAll(".toc-item-wrap"),
  );
  const tocItemsMap = new Map(); // h2Id -> { wrap, link, subMap: Map(h3Id -> link) }
  const h3ToH2Map = new Map(); // h3Id -> h2Id

  tocItemWraps.forEach((wrap) => {
    const h2Link = wrap.querySelector(".toc-item-link");
    if (!h2Link) return;
    const h2Id = h2Link.dataset.id;
    if (!h2Id) return;

    const subMap = new Map();
    const subLinks = Array.from(wrap.querySelectorAll(".toc-sub-item-link"));
    subLinks.forEach((subLink) => {
      const h3Id = subLink.dataset.id;
      if (h3Id) {
        subMap.set(h3Id, subLink);
        h3ToH2Map.set(h3Id, h2Id);
      }
    });

    tocItemsMap.set(h2Id, {
      wrap,
      link: h2Link,
      subMap,
    });
  });

  // 3. Build the ordered list of content headings.
  let currentH2Id = null;
  const headers = headerElements.map((header) => {
    const isH2 = header.tagName === "H2";
    if (isH2) {
      currentH2Id = header.id;
    }
    return {
      id: header.id,
      isH2,
      h2Id: isH2 ? header.id : h3ToH2Map.get(header.id) || currentH2Id,
      element: header,
    };
  });

  // Offset used to account for the fixed top navigation bar.
  const TOP_OFFSET = 80;

  let lastActiveH2Id = null;
  let lastActiveH3Id = null;

  // Keep the active TOC item visible without affecting the page scroll position.
  function scrollIntoTocView(element) {
    if (!element || !tocContainer) return;
    const containerRect = tocContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    if (elementRect.top < containerRect.top) {
      tocContainer.scrollTop -= containerRect.top - elementRect.top + 20;
    } else if (elementRect.bottom > containerRect.bottom) {
      tocContainer.scrollTop += elementRect.bottom - containerRect.bottom + 20;
    }
  }

  // 5. Determine the currently active H2 / H3.
  function determineActive() {
    // At the bottom of the page, the last heading may not reach the top trigger
    // line. In that case, the last heading represents the current section.
    const scrollElement = document.scrollingElement || document.documentElement;
    const isAtBottom =
      window.scrollY + window.innerHeight >= scrollElement.scrollHeight - 1;
    if (isAtBottom) {
      const lastHeader = headers[headers.length - 1];
      if (lastHeader) {
        return lastHeader.isH2
          ? { h2Id: lastHeader.id, h3Id: null }
          : { h2Id: lastHeader.h2Id, h3Id: lastHeader.id };
      }
    }

    // Find the last heading above the viewport trigger line (top <= TOP_OFFSET).
    let activeHeading = null;
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const rect = header.element.getBoundingClientRect();
      if (rect.top <= TOP_OFFSET) {
        activeHeading = header;
      } else {
        break;
      }
    }

    // If no heading has reached the trigger line, activate the first H2.
    if (!activeHeading) {
      const firstH2 = headers.find((h) => h.isH2);
      return {
        h2Id: firstH2 ? firstH2.id : null,
        h3Id: null,
      };
    }

    if (activeHeading.isH2) {
      return {
        h2Id: activeHeading.id,
        h3Id: null,
      };
    }

    return {
      h2Id: activeHeading.h2Id,
      h3Id: activeHeading.id,
    };
  }

  // 6. Apply the active state to the TOC DOM.
  function updateActive() {
    const { h2Id, h3Id } = determineActive();

    if (lastActiveH2Id === h2Id && lastActiveH3Id === h3Id) {
      return;
    }

    lastActiveH2Id = h2Id;
    lastActiveH3Id = h3Id;

    let targetElementToScroll = null;

    tocItemsMap.forEach((item, currentH2Id) => {
      const isH2Active = currentH2Id === h2Id;
      if (isH2Active) {
        item.wrap.classList.add("active");
        targetElementToScroll = item.wrap;
      } else {
        item.wrap.classList.remove("active");
      }

      // Match H3 items only within the active H2 to prevent cross-section residue.
      item.subMap.forEach((subLink, currentH3Id) => {
        if (isH2Active && currentH3Id === h3Id) {
          subLink.classList.add("active");
          targetElementToScroll = subLink;
        } else {
          subLink.classList.remove("active");
        }
      });
    });

    if (targetElementToScroll) {
      scrollIntoTocView(targetElementToScroll);
    }
  }

  // 7. Throttle scroll updates with requestAnimationFrame.
  let isTicking = false;
  function requestUpdate() {
    if (isTicking) return;
    isTicking = true;
    window.requestAnimationFrame(() => {
      updateActive();
      isTicking = false;
    });
  }

  // 8. Listen for viewport changes and scrolling.
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      () => {
        requestUpdate();
      },
      {
        rootMargin: `-${TOP_OFFSET}px 0px 0px 0px`,
        threshold: [0, 1],
      },
    );
    headerElements.forEach((header) => observer.observe(header));
  }

  // Run once on initialization.
  updateActive();
});
