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

  // 1. 保证所有标题均具备有效 ID（补全缺失的 ID 并写回 DOM）
  headerElements.forEach((header, index) => {
    if (!header.id) {
      const text = (header.textContent || "").trim();
      header.id =
        text.replace(/\s+/g, "-").toLowerCase() || `heading-${index}`;
    }
  });

  // 2. 解析 TOC 目录的 DOM 结构建立映射字典
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

  // 3. 构建正文标题列表
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

  // 顶部导航栏避让阈值
  const TOP_OFFSET = 80;

  let lastActiveH2Id = null;
  let lastActiveH3Id = null;

  // 4. 目录容器内部滚动居中/可见，避免触发外部 window 的异常抖动
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

  // 5. 计算当前应当激活的 H2 / H3
  function determineActive() {
    // 优先兼容外部锚定参数 window.anchoringId
    const currentAnchoringId =
      typeof window !== "undefined" && "anchoringId" in window
        ? window.anchoringId
        : null;

    if (currentAnchoringId) {
      if (tocItemsMap.has(currentAnchoringId)) {
        return {
          h2Id: currentAnchoringId,
          h3Id: null,
        };
      }
      if (h3ToH2Map.has(currentAnchoringId)) {
        return {
          h2Id: h3ToH2Map.get(currentAnchoringId),
          h3Id: currentAnchoringId,
        };
      }
    }

    // 根据滚动位置，查找位于视口顶部触发线（top <= TOP_OFFSET）之上的最后一个标题
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

    // 若未滚动到任何标题（如文章开头前言），激活第一个 H2
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

  // 6. 执行高亮更新与 DOM 渲染
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

      // 仅在当前 H2 为 active 时匹配子项 H3，彻底杜绝跨章节残留
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

  // 7. 使用 requestAnimationFrame 优化滚动触发频率
  let isTicking = false;
  function requestUpdate() {
    if (isTicking) return;
    isTicking = true;
    window.requestAnimationFrame(() => {
      updateActive();
      isTicking = false;
    });
  }

  // 8. 监听视口变化与滚动
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

  // 初始执行一次
  updateActive();
});
