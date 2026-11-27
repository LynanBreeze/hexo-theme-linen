import PhotoSwipeLightbox from "./photoswipe/photoswipe-lightbox.esm.min.js";
import PhotoSwipe from "./photoswipe/photoswipe.esm.min.js";
import PhotoSwipeDynamicCaption from "./photoswipe/photoswipe-dynamic-caption-plugin.esm.js";

const initScriptEl = document.getElementById("linen-photoswipe-init");
const hdrAssetsPrefix = initScriptEl?.dataset?.hdrAssetsPrefix || "";
const useMsrcPlaceholder =
  initScriptEl?.dataset?.useMsrcPlaceholder === "true";

let isPswpOpening = false;
const hiddenLivePhotoTriggers = new Map();

const getSafeAreaHeight = () => {
  const el = document.getElementById("safe-area-test");
  if (!el) return 0;
  const height = window.getComputedStyle(el).height;
  return parseInt(height, 10) || 0;
};

const smallScreenPadding = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const largeScreenPadding = {
  top: 40,
  bottom: 52 + getSafeAreaHeight(),
  left: 0,
  right: 0,
};

const isHDRScreen =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(dynamic-range: high)").matches;

let pendingOpenPromise = null;

const lightbox = new PhotoSwipeLightbox({
  gallery: "#post",
  children: "a.gallery-item",
  bgOpacity: 1,
  pswpModule: PhotoSwipe,
  arrowPrevSVG:
    '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  arrowNextSVG:
    '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  closeSVG:
    '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>',
  zoomSVG:
    '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/><path class="pswp__zoom-icn-bar-v" d="M11 8v6"/></svg>',
  openPromise: () => {
    if (pendingOpenPromise) {
      const promise = pendingOpenPromise;
      pendingOpenPromise = null;
      return promise;
    }

    const currentIndex = lightbox.options && lightbox.options.index;
    if (
      typeof currentIndex === "number" &&
      currentIndex >= 0 &&
      typeof prepareGalleryItemOpenPromise === "function"
    ) {
      const itemData = lightbox.getItemData(currentIndex);
      const target = itemData && itemData.element;
      return prepareGalleryItemOpenPromise(target);
    }
  },
  paddingFn: (viewportSize) => {
    return viewportSize.x <= 600 ? smallScreenPadding : largeScreenPadding;
  },
});

const isSafari = !!(navigator.vendor && navigator.vendor.match(/apple/i));
lightbox.on("lazyLoadSlide", (event) => {
  const imageSrc = event.itemData && event.itemData.src;
  if (isSafari && imageSrc && imageSrc.includes("/hdr/")) {
    // Let PhotoSwipe's main Content create and reuse its placeholder image.
    // The bundled Lightbox preloader uses a separate, older Content class.
    event.preventDefault();
  }
});

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const sanitizeExternalUrl = (rawUrl) => {
  try {
    const parsed = new URL(String(rawUrl || "").trim(), location.href);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href
      : "";
  } catch (error) {
    return "";
  }
};

const getExif = (element) => {
  const exifString =
    (element &&
      element.dataset &&
      (element.dataset.pswpExif || element.dataset.pspwExif)) ||
    "";
  const locationString =
    (element &&
      element.dataset &&
      (element.dataset.pswpLocation || element.dataset.pspwLocation)) ||
    "";
  const matches = [...exifString.matchAll(/\{([^}]*)\}/g)].map(
    (match) => match[1],
  );
  if (matches && matches.length) {
    const locationMatches = [...locationString.matchAll(/\{([^}]*)\}/g)].map(
      (match) => match[1],
    );
    const gearKeys = ["camera", "lens"];
    const specKeys = ["focusLength", "aperture", "shutterSpeed", "iso", "ev"];
    const [
      camera,
      iso,
      focusLength,
      aperture,
      shutterSpeed,
      ev,
      lens,
      isHDR,
    ] = matches;
    const isHDRActive =
      isHDRScreen &&
      (!!isHDR ||
        (hdrAssetsPrefix &&
          element &&
          element.href &&
          element.href.includes(hdrAssetsPrefix))) &&
      window.hdrEnabled
        ? "HDR"
        : "";
    const safeLocationUrl =
      locationMatches && locationMatches.length === 2
        ? sanitizeExternalUrl(locationMatches[0])
        : "";
    const exifObj = {
      camera,
      iso,
      focusLength,
      aperture,
      shutterSpeed,
      ev,
      lens,
      hdr: isHDRActive,
      location:
        locationMatches && locationMatches.length === 2 && locationMatches[1]
          ? {
              url: safeLocationUrl,
              title: locationMatches[1],
            }
          : null,
    };
    const altTextMap = {
      camera: "Camera",
      iso: "ISO",
      focusLength: "Focus Length",
      aperture: "Aperture",
      shutterSpeed: "Shutter Speed",
      ev: "Exposure Value",
      lens: "Lens",
      hdr: "HDR Photo",
      location: "Location",
    };
    const renderItems = (keys) =>
      keys
        .map((key) =>
          exifObj[key]
            ? `<span class="${key}" title="${altTextMap[key]}">${typeof exifObj[key] === "boolean" ? "" : escapeHtml(exifObj[key])}</span>`
            : "",
        )
        .join("");
    const gearHtml = renderItems(gearKeys);
    const locationHtml = exifObj.location
      ? exifObj.location.url
        ? `<a class="exif-location-link" href="${escapeHtml(exifObj.location.url)}" target="_blank" rel="noopener noreferrer"><span class="location" title="${altTextMap.location}">${escapeHtml(exifObj.location.title)}</span></a>`
        : `<span class="location" title="${altTextMap.location}">${escapeHtml(exifObj.location.title)}</span>`
      : "";
    const specsHtml =
      renderItems(specKeys) +
      (exifObj.hdr
        ? `<span class="hdr" title="${altTextMap.hdr}">${escapeHtml(exifObj.hdr)}</span>`
        : "") +
      locationHtml;
    if (!gearHtml && !specsHtml) return "";
    return `<div class="img-exif">${gearHtml ? `<div class="img-exif-gear">${gearHtml}</div>` : ""}${specsHtml ? `<div class="img-exif-specs">${specsHtml}</div>` : ""}</div>`;
  }
  return "";
};

new PhotoSwipeDynamicCaption(lightbox, {
  type: "auto",
});

const normalizeUrl = (url) => {
  try {
    return new URL(url, location.href).href;
  } catch (error) {
    return url;
  }
};

const pauseLivePhotos = () => {
  document.querySelectorAll(".pswp-live-photo-video").forEach((video) => {
    video.pause();
    const livePhotoWrap = video.closest(".pswp-live-photo-wrap");
    if (livePhotoWrap) {
      livePhotoWrap.classList.remove("is-playing");
    }
  });
};

const setPswpLivePhotoClosing = (enabled) => {
  if (lightbox && lightbox.pswp && lightbox.pswp.element) {
    lightbox.pswp.element.classList.toggle("is-closing-live-photo", enabled);
  }
};

const setPswpLivePhotoOpening = (enabled) => {
  if (lightbox && lightbox.pswp && lightbox.pswp.element) {
    lightbox.pswp.element.classList.toggle("is-opening-live-photo", enabled);
    if (!enabled) {
      lightbox.pswp.element.classList.remove("is-live-photo-trigger-visible");
    }
  }
};

const revealOpeningLivePhotoTrigger = () => {
  if (!lightbox || !lightbox.pswp || !lightbox.pswp.element) {
    return;
  }

  if (!lightbox.pswp.element.classList.contains("is-opening-live-photo")) {
    return;
  }

  window.requestAnimationFrame(() => {
    if (!lightbox || !lightbox.pswp || !lightbox.pswp.element) {
      return;
    }
    lightbox.pswp.element.classList.add("is-live-photo-trigger-visible");
    window.setTimeout(() => {
      setPswpLivePhotoOpening(false);
    }, 360);
  });
};

const getCurrentGalleryElement = () =>
  lightbox &&
  lightbox.pswp &&
  lightbox.pswp.currSlide &&
  lightbox.pswp.currSlide.data &&
  lightbox.pswp.currSlide.data.element;

const isLivePhotoGalleryElement = (element) =>
  element &&
  element.classList &&
  element.classList.contains("live-photo-gallery-item");

const setPageLivePhotoTriggerHidden = (galleryElement) => {
  const scrollTarget = getScrollTarget(galleryElement);
  const iframe =
    scrollTarget &&
    scrollTarget.querySelector &&
    scrollTarget.querySelector('iframe[src*="/static/live-photo/"]');
  let iframeDocument = null;
  try {
    iframeDocument = iframe && iframe.contentDocument;
  } catch (error) {
    return;
  }

  const trigger = iframeDocument && iframeDocument.querySelector(".live-trigger");
  if (!trigger || hiddenLivePhotoTriggers.has(trigger)) {
    return;
  }

  hiddenLivePhotoTriggers.set(trigger, {
    opacity: trigger.style.opacity,
    transition: trigger.style.transition,
    pointerEvents: trigger.style.pointerEvents,
    visibility: trigger.style.visibility,
  });
  trigger.style.opacity = "0";
  trigger.style.transition = "none";
  trigger.style.pointerEvents = "none";
  trigger.style.visibility = "hidden";
};

const restorePageLivePhotoTriggers = () => {
  hiddenLivePhotoTriggers.forEach((previousStyle, trigger) => {
    trigger.style.opacity = previousStyle.opacity;
    trigger.style.transition = previousStyle.transition;
    trigger.style.pointerEvents = previousStyle.pointerEvents;
    trigger.style.visibility = previousStyle.visibility;
  });
  hiddenLivePhotoTriggers.clear();
};

const prepareCurrentLivePhotoClose = () => {
  const currentElement = getCurrentGalleryElement();
  const isLivePhoto = isLivePhotoGalleryElement(currentElement);
  setPswpLivePhotoClosing(isLivePhoto);
  if (isLivePhoto) {
    setPageLivePhotoTriggerHidden(currentElement);
  }
};

const getScrollTarget = (galleryElement) => {
  if (
    !galleryElement ||
    !galleryElement.classList ||
    !galleryElement.classList.contains("live-photo-gallery-item")
  ) {
    return galleryElement;
  }

  return galleryElement.closest(".lazyload-outer-wrap") || galleryElement;
};

const getLivePhotoThumbElement = (itemData) => {
  const galleryElement = itemData && itemData.element;
  if (
    !galleryElement ||
    !galleryElement.classList ||
    !galleryElement.classList.contains("live-photo-gallery-item")
  ) {
    return null;
  }

  const thumbId = galleryElement.dataset && galleryElement.dataset.pswpThumbId;
  return (
    (thumbId && document.getElementById(thumbId)) ||
    (galleryElement.closest(".lazyload-outer-wrap") &&
      galleryElement
        .closest(".lazyload-outer-wrap")
        .querySelector(".lazyload-wrap")) ||
    null
  );
};

const syncSwitcherWithGalleryElement = (galleryElement) => {
  const gridItem =
    galleryElement &&
    galleryElement.closest &&
    galleryElement.closest(".image-grid.switcher .grid-item");
  const switcher =
    gridItem &&
    gridItem.closest &&
    gridItem.closest(".image-grid.switcher");
  if (!gridItem || !switcher) {
    return;
  }

  const items = Array.from(switcher.children).filter(
    (child) => child.classList && child.classList.contains("grid-item"),
  );
  const activeIndex = items.indexOf(gridItem);
  const controls = switcher.querySelector(".image-grid-switcher-controls");
  const buttons = Array.from(
    switcher.querySelectorAll(".image-grid-switcher-button"),
  );

  if (activeIndex < 0) {
    return;
  }

  if (controls && controls.style) {
    controls.style.setProperty("--switcher-active-index", activeIndex);
  }

  items.forEach((item, index) => {
    const isActive = index === activeIndex;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-hidden", isActive ? "false" : "true");
  });

  buttons.forEach((button, index) => {
    const isActive = index === activeIndex;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
};

const getLivePhotoHtml = (iframeSrc) => {
  const livePhotoUrl = new URL(iframeSrc, location.href);
  const picUrl =
    livePhotoUrl.searchParams.get("picUrl") ||
    livePhotoUrl.searchParams.get("photoSrc") ||
    "";
  const videoUrl =
    livePhotoUrl.searchParams.get("videoUrl") ||
    livePhotoUrl.searchParams.get("videoSrc") ||
    "";
  const isMuted = livePhotoUrl.searchParams.has("muted");
  const shouldLoop = livePhotoUrl.searchParams.has("loop");
  const volumeParam = livePhotoUrl.searchParams.get("volume");
  const rawVolume =
    volumeParam === null || volumeParam === "" ? 100 : Number(volumeParam);
  const volume = Number.isFinite(rawVolume)
    ? Math.min(Math.max(rawVolume, 0), 100)
    : 100;

  if (!picUrl || !videoUrl) {
    return `<div class="pswp-live-photo-wrap"><img class="pswp-live-photo-img" src="${escapeHtml(picUrl)}" draggable="false" alt="" /></div>`;
  }

  return `<div class="pswp-live-photo-wrap" data-volume="${volume}">
      <img class="pswp-live-photo-img" src="${escapeHtml(picUrl)}" draggable="false" alt="" />
      <video class="pswp-live-photo-video" src="${escapeHtml(videoUrl)}" playsinline webkit-playsinline preload="metadata"${isMuted ? " muted" : ""}${shouldLoop ? " loop" : ""}></video>
      <button class="pswp-live-photo-trigger" type="button" aria-label="Play Live Photo">
        <span class="icon-wrap">
          <span class="trigger-icon ready"></span>
          <span class="progress-circle loaded" aria-hidden="true">
            <svg width="25" height="25" viewBox="0 0 25 25" focusable="false">
              <circle cx="12.5" cy="12.5" r="11" stroke="#eee" stroke-width="3" fill="none"></circle>
              <circle cx="12.5" cy="12.5" r="11" stroke="#232323" stroke-width="3" fill="none" stroke-linecap="round"></circle>
            </svg>
          </span>
        </span>
        <span class="trigger-text">LIVE</span>
      </button>
    </div>`;
};

const isElementInImageGridItem = (element) => {
  const gridItem =
    element && element.closest && element.closest(".grid-item");
  return Boolean(
    gridItem && gridItem.closest && gridItem.closest(".image-grid"),
  );
};

let headerWasHiddenByLightbox = false;

const isImageBlockedByFixedHeader = (element) => {
  if (!element) return false;
  const header = document.querySelector(".nav-header");
  if (!header) return false;
  const style = window.getComputedStyle(header);
  if (style.position !== "fixed" || header.classList.contains("hide")) {
    return false;
  }
  const headerHeight = header.offsetHeight || 65;
  const target = getScrollTarget(element) || element;
  const rect = target.getBoundingClientRect();
  return rect.top < headerHeight && rect.bottom > 0;
};

const hideFixedHeaderOnGalleryClick = (target) => {
  if (!isImageBlockedByFixedHeader(target)) {
    return false;
  }
  const header = document.querySelector(".nav-header");
  if (!header) return false;
  headerWasHiddenByLightbox = true;
  header.classList.add("hide");
  return true;
};

const getFixedHeaderHeight = () => {
  const header = document.querySelector(".nav-header");
  if (!header) return 0;
  const style = window.getComputedStyle(header);
  if (style.position !== "fixed" || header.classList.contains("hide")) {
    return 0;
  }
  return header.offsetHeight || 65;
};

const getScrollDelta = (element) => {
  if (!element) {
    return {
      deltaX: 0,
      deltaY: 0,
      targetScrollLeft: null,
      scrollContainer: null,
      target: null,
    };
  }
  const target = getScrollTarget(element) || element;
  const rect = target.getBoundingClientRect();
  const windowHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const windowWidth =
    window.innerWidth || document.documentElement.clientWidth;

  const scrollContainer =
    target.closest &&
    target.closest(".image-grid.scroll, .image-grid.slider");
  let deltaX = 0;
  let targetScrollLeft = null;

  if (scrollContainer) {
    const snapTarget =
      (target.closest && target.closest(".grid-item")) || target;
    const snapRect = snapTarget.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetCenter = snapRect.left + snapRect.width / 2;
    const containerCenter = containerRect.left + containerRect.width / 2;
    const rawTargetScrollLeft =
      scrollContainer.scrollLeft + (targetCenter - containerCenter);
    const maxScrollLeft = Math.max(
      0,
      scrollContainer.scrollWidth - scrollContainer.clientWidth,
    );
    targetScrollLeft = Math.round(
      Math.max(0, Math.min(maxScrollLeft, rawTargetScrollLeft)),
    );
    deltaX = targetScrollLeft - scrollContainer.scrollLeft;
  } else {
    if (rect.left < 0) {
      deltaX = rect.left;
    } else if (rect.right > windowWidth) {
      deltaX = rect.right - windowWidth;
    }
  }

  const headerHeight = getFixedHeaderHeight();
  const topSafePadding = headerHeight > 0 ? headerHeight + 16 : 16;
  // Exception: if the item is only partially outside the viewport vertically, skip vertical scrolling
  const isCompletelyOutsideVertically =
    rect.bottom <= 0 || rect.top >= windowHeight;
  let deltaY = 0;

  if (isCompletelyOutsideVertically) {
    if (rect.top < topSafePadding) {
      deltaY = rect.top - topSafePadding;
    } else if (rect.bottom > windowHeight) {
      const desiredDeltaY = rect.bottom - windowHeight + 16;
      const maxAllowedDeltaY = rect.top - topSafePadding;
      deltaY = Math.min(desiredDeltaY, maxAllowedDeltaY);
    }
  }

  return { deltaX, deltaY, targetScrollLeft, scrollContainer, target };
};

const suspendedScrollSnapState = new WeakMap();

const suspendScrollSnap = (container) => {
  if (!container || !container.style) return () => {};
  let state = suspendedScrollSnapState.get(container);
  if (!state) {
    state = {
      original: container.style.scrollSnapType,
      token: 0,
    };
    suspendedScrollSnapState.set(container, state);
  }
  const token = ++state.token;
  container.style.scrollSnapType = "none";
  // Force style flush so WebKit disables mandatory snapping before programmatic scrollTo starts
  void container.offsetWidth;

  return (finalScrollLeft) => {
    const currentState = suspendedScrollSnapState.get(container);
    if (!currentState || currentState.token !== token) {
      return;
    }
    if (
      typeof finalScrollLeft === "number" &&
      Math.abs(container.scrollLeft - finalScrollLeft) > 1
    ) {
      container.scrollLeft = finalScrollLeft;
    }
    window.requestAnimationFrame(() => {
      const latestState = suspendedScrollSnapState.get(container);
      if (!latestState || latestState.token !== token) {
        return;
      }
      container.style.scrollSnapType = latestState.original;
      suspendedScrollSnapState.delete(container);
    });
  };
};

const waitForScrollEnd = (
  scrollContainer,
  needsScrollX,
  needsScrollY,
  targetScrollLeft,
) => {
  return new Promise((resolve) => {
    let resolved = false;
    let rafId = null;
    let startTimer = null;
    let maxTimer = null;

    let hasMoved = false;
    let doneX = !needsScrollX;
    let doneY = !needsScrollY;
    let idleStartTime = null;
    let lastX = scrollContainer ? scrollContainer.scrollLeft : 0;
    let lastY = window.pageYOffset;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(startTimer);
      clearTimeout(maxTimer);
      if (scrollContainer) {
        scrollContainer.removeEventListener("scrollend", onContainerScrollEnd);
      }
      window.removeEventListener("scrollend", onWindowScrollEnd);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    };

    const onContainerScrollEnd = () => {
      doneX = true;
      if (doneX && doneY) {
        finish();
      }
    };

    const onWindowScrollEnd = () => {
      doneY = true;
      if (doneX && doneY) {
        finish();
      }
    };

    maxTimer = setTimeout(finish, 800);

    startTimer = setTimeout(() => {
      if (!hasMoved) {
        finish();
      }
    }, 160);

    const check = (now) => {
      if (resolved) return;

      const currX = scrollContainer ? scrollContainer.scrollLeft : 0;
      const currY = window.pageYOffset;

      const diffX = Math.abs(currX - lastX);
      const diffY = Math.abs(currY - lastY);

      if (needsScrollX && diffX > 0.5) {
        hasMoved = true;
      }
      if (needsScrollY && diffY > 0.5) {
        hasMoved = true;
      }

      if (hasMoved) {
        const isIdleX = doneX || diffX <= 0.5;
        const isIdleY = doneY || diffY <= 0.5;

        if (isIdleX && isIdleY) {
          if (idleStartTime === null) {
            idleStartTime = now;
          }
          const reachedTargetX =
            !needsScrollX ||
            (typeof targetScrollLeft === "number" &&
              Math.abs(currX - targetScrollLeft) <= 1);
          const requiredIdleMs = reachedTargetX && !needsScrollY ? 50 : 110;
          if (now - idleStartTime >= requiredIdleMs) {
            finish();
            return;
          }
        } else {
          idleStartTime = null;
        }
      }

      lastX = currX;
      lastY = currY;

      rafId = requestAnimationFrame(check);
    };

    if (scrollContainer && needsScrollX) {
      scrollContainer.addEventListener("scrollend", onContainerScrollEnd, {
        once: true,
        passive: true,
      });
    }
    if (needsScrollY) {
      window.addEventListener("scrollend", onWindowScrollEnd, {
        once: true,
        passive: true,
      });
    }

    rafId = requestAnimationFrame(check);
  });
};

const prepareGalleryItemOpenPromise = (target) => {
  if (!target) {
    return null;
  }

  const isBlocked = isImageBlockedByFixedHeader(target);
  const inGrid = isElementInImageGridItem(target);

  // Neither blocked by fixed nav-header nor inside an image-grid; open lightbox immediately
  if (!isBlocked && !inGrid) {
    return null;
  }

  // Hide nav-header early on click only when the item is blocked by it
  const headerDidStartHiding = isBlocked
    ? hideFixedHeaderOnGalleryClick(target)
    : false;

  let deltaX = 0;
  let deltaY = 0;
  let targetScrollLeft = null;
  let scrollContainer = null;

  if (inGrid) {
    const scrollInfo = getScrollDelta(target);
    deltaX = scrollInfo.deltaX;
    deltaY = scrollInfo.deltaY;
    targetScrollLeft = scrollInfo.targetScrollLeft;
    scrollContainer = scrollInfo.scrollContainer;
  } else if (isBlocked) {
    // Non-grid image blocked by header: skip vertical scroll when only partially outside viewport
    const scrollTarget = getScrollTarget(target) || target;
    const rect = scrollTarget.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;
    if (rect.bottom <= 0 || rect.top >= windowHeight) {
      deltaY = rect.top - 16;
    }
  }

  const needsScrollX = Boolean(scrollContainer && Math.abs(deltaX) > 6);
  const needsScrollY = Math.abs(deltaY) > 6;
  const needsScroll = needsScrollX || needsScrollY;

  if (!needsScroll) {
    if (headerDidStartHiding) {
      return new Promise((resolve) => {
        setTimeout(resolve, 180);
      });
    }
    return null;
  }

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior = prefersReducedMotion ? "instant" : "smooth";
  let restoreScrollSnap = null;

  if (
    needsScrollX &&
    scrollContainer &&
    typeof targetScrollLeft === "number"
  ) {
    restoreScrollSnap = suspendScrollSnap(scrollContainer);
    if (typeof scrollContainer.scrollTo === "function") {
      scrollContainer.scrollTo({ left: targetScrollLeft, behavior });
    } else {
      scrollContainer.scrollLeft = targetScrollLeft;
    }
  }

  if (needsScrollY) {
    if (typeof window.scrollBy === "function") {
      window.scrollBy({ top: deltaY, behavior });
    } else {
      window.scroll(0, window.pageYOffset + deltaY);
    }
  }

  if (behavior === "instant") {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        if (restoreScrollSnap) {
          restoreScrollSnap(targetScrollLeft);
        }
        window.requestAnimationFrame(resolve);
      });
    });
  }

  return waitForScrollEnd(
    scrollContainer,
    needsScrollX,
    needsScrollY,
    targetScrollLeft,
  ).then(() => {
    if (restoreScrollSnap) {
      restoreScrollSnap(targetScrollLeft);
    }
  });
};

lightbox.addFilter("clickedIndex", (index, event) => {
  if (index >= 0) {
    const clickedEl =
      event &&
      event.target &&
      (event.target.closest ? event.target : event.target.parentElement);
    const target =
      clickedEl &&
      clickedEl.closest &&
      (clickedEl.closest("a.gallery-item") ||
        clickedEl.closest(".gallery-item"));
    pendingOpenPromise = prepareGalleryItemOpenPromise(target);
  }
  return index;
});

lightbox.addFilter("itemData", (itemData) => {
  const livePhotoSrc =
    itemData &&
    itemData.element &&
    itemData.element.dataset &&
    itemData.element.dataset.livePhotoSrc;
  if (!livePhotoSrc) {
    return itemData;
  }

  const iframeSrc = decodeURIComponent(livePhotoSrc);
  return {
    ...itemData,
    msrc:
      (itemData.element.dataset && itemData.element.dataset.livePhotoPicUrl) ||
      itemData.msrc ||
      itemData.src,
    thumbCropped: true,
    src: undefined,
    type: "html",
    html: getLivePhotoHtml(iframeSrc),
  };
});

lightbox.addFilter("thumbEl", (thumbEl, itemData) => {
  return getLivePhotoThumbElement(itemData) || thumbEl;
});

lightbox.addFilter("useContentPlaceholder", (usePlaceholder, content) => {
  const itemData = content && content.data;
  return getLivePhotoThumbElement(itemData) ? true : usePlaceholder;
});

const extractCssUrl = (bgImage) => {
  if (!bgImage || bgImage === "none") return "";
  const match = String(bgImage).match(/^url\(\s*(['"]?)(.*?)\1\s*\)$/i);
  const url = match && match[2] ? match[2].trim() : "";
  return /^(?:data:image\/|https?:\/\/|\/)/i.test(url) ? url : "";
};

const getBlurHashDataUrl = (lazyloadWrap, itemData) => {
  if (!lazyloadWrap || !lazyloadWrap.dataset) return "";
  if (lazyloadWrap.dataset.blurhashDataUrl) {
    return lazyloadWrap.dataset.blurhashDataUrl;
  }
  const existingCanvas = lazyloadWrap.querySelector(".placeholder canvas");
  if (existingCanvas) {
    try {
      const dataUrl = existingCanvas.toDataURL();
      lazyloadWrap.dataset.blurhashDataUrl = dataUrl;
      return dataUrl;
    } catch (e) {}
  }
  const rawHash = lazyloadWrap.dataset.blurhash;
  if (
    !rawHash ||
    !window.blurhash ||
    typeof window.blurhash.decodeBlurHash !== "function"
  ) {
    return "";
  }
  try {
    const w = 32;
    const ratio =
      itemData && itemData.width && itemData.height
        ? itemData.height / itemData.width
        : 1;
    const h = Math.max(1, Math.min(64, Math.round(w * ratio)));
    const pixels = window.blurhash.decodeBlurHash(
      rawHash.replace(/^blurhash:/, ""),
      w,
      h,
    );
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const imageData = ctx.createImageData(w, h);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL();
    lazyloadWrap.dataset.blurhashDataUrl = dataUrl;
    return dataUrl;
  } catch (e) {
    return "";
  }
};

const getGalleryPlaceholderSrc = (galleryElement, content) => {
  if (!galleryElement) return "";
  if (
    galleryElement.classList &&
    galleryElement.classList.contains("live-photo-gallery-item")
  ) {
    return (
      (galleryElement.dataset && galleryElement.dataset.livePhotoPicUrl) || ""
    );
  }
  const loadedImg = galleryElement.querySelector("img");
  if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
    const loadedSrc = loadedImg.currentSrc || loadedImg.src || "";
    if (loadedSrc) return loadedSrc;
  }
  const placeholderEl = galleryElement.querySelector(".placeholder");
  if (placeholderEl) {
    const bgUrl = extractCssUrl(
      placeholderEl.style && placeholderEl.style.backgroundImage,
    );
    if (bgUrl) return bgUrl;
  }
  const lazyloadWrap = galleryElement.querySelector(".lazyload-wrap");
  if (lazyloadWrap) {
    const blurhashUrl = getBlurHashDataUrl(
      lazyloadWrap,
      content && content.data,
    );
    if (blurhashUrl) return blurhashUrl;
  }
  return "";
};

lightbox.addFilter("placeholderSrc", (placeholderSrc, content) => {
  const galleryElement = content && content.data && content.data.element;
  const resolvedPlaceholder = getGalleryPlaceholderSrc(galleryElement, content);
  if (resolvedPlaceholder) {
    return resolvedPlaceholder;
  }
  if (useMsrcPlaceholder) {
    const thumbnail =
      (content &&
        content.slide &&
        content.slide.data &&
        content.slide.data.msrc) ||
      "";
    if (thumbnail) {
      return thumbnail;
    }
  }
  return placeholderSrc;
});

lightbox.on("contentResize", ({ content, width, height }) => {
  const placeholderEl =
    content && content.placeholder && content.placeholder.element;
  if (
    placeholderEl &&
    placeholderEl.tagName === "IMG" &&
    width > 0 &&
    height > 0
  ) {
    placeholderEl.style.height = `${(height / width) * 250}px`;
  }
});

lightbox.on("uiRegister", function () {
  lightbox.pswp.ui.registerElement({
    name: "custom-caption",
    order: 9,
    isButton: false,
    appendTo: "root",
    html: "",
    onInit: (el) => {
      lightbox.pswp.on("change", () => {
        const currSlideElement = lightbox.pswp.currSlide.data.element;
        let captionHTML = "";
        if (currSlideElement) {
          const slideData = lightbox.pswp.currSlide.data || {};
          const aspectRatio = slideData.width
            ? slideData.height / slideData.width
            : 0;
          const gap =
            (window.innerHeight - aspectRatio * window.innerWidth) / 2;
          captionHTML = getExif(slideData.element) || "";
          if (window.innerWidth <= 600) {
            el.classList.add("mobile");
            if (gap < 110) {
              el.classList.add("is-overlaid");
              el.style.top = "58px";
            } else {
              el.classList.remove("is-overlaid");
              el.style.top = `${gap}px`;
            }
          } else {
            el.style.top = "unset";
            el.classList.remove("mobile", "is-overlaid");
          }
        }
        el.classList.toggle("is-empty", !captionHTML);
        el.innerHTML = captionHTML || "";
      });
    },
  });
});

lightbox.on("beforeOpen", () => {
  isPswpOpening = true;
});

lightbox.on("openingAnimationEnd", () => {
  revealOpeningLivePhotoTrigger();
});

lightbox.on("closingAnimationStart", () => {
  prepareCurrentLivePhotoClose();
});

lightbox.on("closingAnimationEnd", () => {
  setPswpLivePhotoClosing(false);
  window.requestAnimationFrame(restorePageLivePhotoTriggers);
  if (headerWasHiddenByLightbox) {
    const header = document.querySelector(".nav-header");
    if (header) {
      header.classList.remove("hide");
    }
    headerWasHiddenByLightbox = false;
  }
});

lightbox.on("destroy", () => {
  if (headerWasHiddenByLightbox) {
    const header = document.querySelector(".nav-header");
    if (header) {
      header.classList.remove("hide");
    }
    headerWasHiddenByLightbox = false;
  }
});

lightbox.on("change", () => {
  pauseLivePhotos();
  const currentElement = getCurrentGalleryElement();
  syncSwitcherWithGalleryElement(currentElement);
  if (isPswpOpening) {
    setPswpLivePhotoOpening(isLivePhotoGalleryElement(currentElement));
    isPswpOpening = false;
    return;
  }
  setPswpLivePhotoOpening(false);
  const currentImage = getScrollTarget(currentElement);
  if (currentImage && currentImage.scrollIntoView) {
    currentImage.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "instant",
    });
  }
});

lightbox.on("close", () => {
  prepareCurrentLivePhotoClose();
  pauseLivePhotos();
});

lightbox.init();

document.addEventListener("pointerdown", (event) => {
  if (
    event.target &&
    typeof event.target.closest === "function" &&
    event.target.closest(".pswp-live-photo-trigger")
  ) {
    event.stopPropagation();
  }
});

document.addEventListener("click", async (event) => {
  const trigger =
    event.target && typeof event.target.closest === "function"
      ? event.target.closest(".pswp-live-photo-trigger")
      : null;
  if (!trigger) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const livePhoto = trigger.closest(".pswp-live-photo-wrap");
  const video =
    livePhoto &&
    livePhoto.querySelector &&
    livePhoto.querySelector(".pswp-live-photo-video");
  if (!video) {
    return;
  }

  if (video.paused) {
    const rawVolAttr = livePhoto.dataset.volume;
    const parsedVol =
      rawVolAttr === undefined || rawVolAttr === "" ? 100 : Number(rawVolAttr);
    const safeVol = Number.isFinite(parsedVol)
      ? Math.min(Math.max(parsedVol, 0), 100) / 100
      : 1;
    video.volume = safeVol;
    try {
      await video.play();
      livePhoto.classList.add("is-playing");
    } catch (error) {
      livePhoto.classList.remove("is-playing");
    }
  } else {
    video.pause();
    livePhoto.classList.remove("is-playing");
  }
});

document.addEventListener(
  "pause",
  (event) => {
    if (
      event.target &&
      typeof event.target.matches === "function" &&
      event.target.matches(".pswp-live-photo-video")
    ) {
      const livePhotoWrap = event.target.closest(".pswp-live-photo-wrap");
      if (livePhotoWrap) {
        livePhotoWrap.classList.remove("is-playing");
      }
    }
  },
  true,
);

window.addEventListener("message", (event) => {
  if (event.origin !== location.origin) {
    return;
  }

  if (lightbox.pswp) {
    return;
  }

  const messageUrl =
    typeof event.data === "string"
      ? event.data
      : event.data && event.data.picUrl;
  if (!messageUrl) {
    return;
  }

  const targetUrl = normalizeUrl(messageUrl);
  const target = Array.from(
    document.querySelectorAll("#post a.gallery-item"),
  ).find((element) => {
    const livePhotoPicUrl = element.dataset.livePhotoPicUrl;
    return normalizeUrl(livePhotoPicUrl || element.href) === targetUrl;
  });

  if (target) {
    target.click();
  }
});
