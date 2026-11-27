"use strict";

(() => {
  const mapEl = document.getElementById("travel-map");
  if (!mapEl) return;

  const mapLanguage = mapEl.dataset.mapLang || "en";
  const errorText =
    mapEl.dataset.errorText ||
    (mapLanguage === "zh" ? "地图加载失败。" : "Map failed to load.");
  const leafletCssUrl =
    mapEl.dataset.leafletCss || "/linen-theme/css/leaflet.css";
  const leafletJsUrl =
    mapEl.dataset.leafletJs || "/linen-theme/js/leaflet.js";
  const lightMapStyle =
    mapEl.dataset.mapStyleLight || "https://tiles.openfreemap.org/styles/liberty";
  const darkMapStyle =
    mapEl.dataset.mapStyleDark || "https://tiles.openfreemap.org/styles/dark";

  const isDarkTheme = () => {
    const explicit = document.documentElement.getAttribute("data-theme");
    if (explicit === "dark") return true;
    if (explicit === "light") return false;
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  };

  const getMapStyleUrl = () => (isDarkTheme() ? darkMapStyle : lightMapStyle);

  const initMapData = () => {
    const places = JSON.parse(
      decodeURIComponent(mapEl.dataset.places || "%5B%5D"),
    );
    const items = document.querySelectorAll("[data-travel-place]");
    const setActive = (id, active) => {
      items.forEach((item) => {
        if (item.dataset.travelPlace === id)
          item.classList.toggle("active", active);
      });
    };

    const placeGroups = places.reduce((groups, place) => {
      const key = `${place.lat.toFixed(3)},${place.lng.toFixed(3)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          lat: place.lat,
          lng: place.lng,
          places: [],
        });
      }
      groups.get(key).places.push(place);
      return groups;
    }, new Map());

    const escapeHtml = (value = "") =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const getPopupHtml = (group) => {
      const listItems = group.places
        .map((place) => {
          const subTitle = place.subTitle
            ? `<small class="travel-map-popup-subtitle">${escapeHtml(place.subTitle)}</small>`
            : "";
          const coverImg = place.cover
            ? `<img class="travel-map-popup-cover" src="${escapeHtml(place.cover)}" alt="" />`
            : "";
          return `<a class="travel-map-popup-record" href="${escapeHtml(place.path)}">${coverImg}<div class="travel-map-popup-content"><span>${escapeHtml(place.title)}${subTitle}</span><small>${escapeHtml(place.date || place.location)}</small></div></a>`;
        })
        .join("");
      return `<div class="travel-map-popup-list">${listItems}</div>`;
    };

    const bindCardEvents = (markers) => {
      if (typeof unbindCardEvents === "function") {
        unbindCardEvents();
        unbindCardEvents = null;
      }
      const cleanups = [];
      items.forEach((item) => {
        const id = item.dataset.travelPlace;
        const getEl = markers.get(id);
        const toggle = (active) => {
          setActive(id, active);
          const el = getEl ? getEl() : null;
          if (el) el.classList.toggle("active", active);
        };
        const onEnter = () => toggle(true);
        const onLeave = () => toggle(false);
        item.addEventListener("mouseenter", onEnter);
        item.addEventListener("mouseleave", onLeave);
        item.addEventListener("focusin", onEnter);
        item.addEventListener("focusout", onLeave);
        cleanups.push(() => {
          item.removeEventListener("mouseenter", onEnter);
          item.removeEventListener("mouseleave", onLeave);
          item.removeEventListener("focusin", onEnter);
          item.removeEventListener("focusout", onLeave);
        });
      });
      unbindCardEvents = () => {
        cleanups.forEach((fn) => fn());
      };
    };

    return { placeGroups, setActive, getPopupHtml, bindCardEvents };
  };

  let fallbackTriggered = false;
  let unbindCardEvents = null;

  const showError = () => {
    mapEl.innerHTML = "";
    const msg = document.createElement("div");
    msg.className = "travel-map-loading";
    msg.textContent = errorText;
    mapEl.appendChild(msg);
  };

  const initLeafletMap = () => {
    if (!window.L) {
      showError();
      return;
    }

    const { placeGroups, setActive, getPopupHtml, bindCardEvents } =
      initMapData();
    const markers = new Map();
    mapEl.innerHTML = "";

    const tileConfig =
      mapLanguage === "zh"
        ? {
            url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
            options: {
              maxZoom: 18,
              subdomains: ["1", "2", "3", "4"],
              attribution: "&copy; 高德地图",
            },
          }
        : {
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            options: {
              maxZoom: 18,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
          };

    const map = window.L.map(mapEl, {
      scrollWheelZoom: false,
      attributionControl: true,
      tap: false,
    });
    window.L.tileLayer(tileConfig.url, tileConfig.options).addTo(map);

    const createMarkerIcon = (count = 1) =>
      window.L.divIcon({
        className: "travel-leaflet-marker",
        html: `<span data-place-count="${count}">${count > 1 ? `<strong>${count}</strong>` : ""}</span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
      });
    const bounds = [];

    placeGroups.forEach((group) => {
      const placeCount = group.places.length;
      const marker = window.L.marker([group.lat, group.lng], {
        icon: createMarkerIcon(placeCount),
      })
        .addTo(map)
        .bindPopup(getPopupHtml(group));
      group.places.forEach((place) =>
        markers.set(place.id, () => marker.getElement()),
      );
      bounds.push([group.lat, group.lng]);

      marker.on("mouseover", () => {
        const el = marker.getElement();
        if (el) el.classList.add("active");
        group.places.forEach((place) => setActive(place.id, true));
      });
      marker.on("mouseout", () => {
        const el = marker.getElement();
        if (el) el.classList.remove("active");
        group.places.forEach((place) => setActive(place.id, false));
      });
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
      map.setMinZoom(map.getZoom());
    }

    bindCardEvents(markers);
  };

  const loadLeafletFallback = () => {
    if (fallbackTriggered) return;
    fallbackTriggered = true;

    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = leafletCssUrl;
      document.head.appendChild(link);
    }

    if (window.L) {
      initLeafletMap();
    } else {
      const script = document.createElement("script");
      script.src = leafletJsUrl;
      script.async = true;
      script.onload = initLeafletMap;
      script.onerror = showError;
      document.body.appendChild(script);
    }
  };

  const initMapLibreMap = () => {
    if (!window.maplibregl) {
      loadLeafletFallback();
      return;
    }

    const { placeGroups, setActive, getPopupHtml, bindCardEvents } =
      initMapData();
    const markers = new Map();
    mapEl.innerHTML = "";

    let styleLoaded = false;
    let currentStyleUrl = getMapStyleUrl();
    let map;
    try {
      map = new window.maplibregl.Map({
        container: mapEl,
        style: currentStyleUrl,
        center: [108, 34],
        zoom: 3.2,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
      });
    } catch (error) {
      loadLeafletFallback();
      return;
    }

    let mapDestroyed = false;
    const syncMapTheme = () => {
      if (mapDestroyed) return;
      const nextStyleUrl = getMapStyleUrl();
      if (nextStyleUrl !== currentStyleUrl) {
        currentStyleUrl = nextStyleUrl;
        try {
          map.setStyle(nextStyleUrl);
        } catch (e) {}
      }
    };

    const darkMedia =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const cleanupMapLibre = () => {
      if (mapDestroyed) return;
      mapDestroyed = true;
      if (typeof unbindCardEvents === "function") {
        unbindCardEvents();
        unbindCardEvents = null;
      }
      window.removeEventListener("linen:themechange", syncMapTheme);
      if (darkMedia) {
        if (typeof darkMedia.removeEventListener === "function") {
          darkMedia.removeEventListener("change", syncMapTheme);
        } else if (typeof darkMedia.removeListener === "function") {
          darkMedia.removeListener(syncMapTheme);
        }
      }
      try {
        map.remove();
      } catch (e) {}
    };

    window.addEventListener("linen:themechange", syncMapTheme);
    if (darkMedia) {
      if (typeof darkMedia.addEventListener === "function") {
        darkMedia.addEventListener("change", syncMapTheme);
      } else if (typeof darkMedia.addListener === "function") {
        darkMedia.addListener(syncMapTheme);
      }
    }

    map.addControl(
      new window.maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new window.maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    const fallbackTimer = setTimeout(() => {
      if (!styleLoaded) {
        cleanupMapLibre();
        loadLeafletFallback();
      }
    }, 8000);

    map.on("error", () => {
      if (!styleLoaded) {
        clearTimeout(fallbackTimer);
        cleanupMapLibre();
        loadLeafletFallback();
      }
    });

    map.on("style.load", () => {
      styleLoaded = true;
      clearTimeout(fallbackTimer);

      const labelExpr =
        mapLanguage === "zh"
          ? [
              "coalesce",
              ["get", "name:zh"],
              ["get", "name:zh-Hans"],
              ["get", "name"],
            ]
          : [
              "coalesce",
              ["get", "name:en"],
              ["get", "name:latin"],
              ["get", "name"],
            ];

      const layers = map.getStyle().layers || [];
      layers.forEach((layer) => {
        if (
          layer.type !== "symbol" ||
          !layer.layout ||
          !layer.layout["text-field"]
        ) {
          return;
        }
        const fieldStr = JSON.stringify(layer.layout["text-field"]);
        if (fieldStr.includes("name")) {
          try {
            map.setLayoutProperty(layer.id, "text-field", labelExpr);
          } catch (e) {}
        }
      });
    });

    const bounds = new window.maplibregl.LngLatBounds();

    placeGroups.forEach((group) => {
      const placeCount = group.places.length;
      const markerEl = document.createElement("div");
      markerEl.className = "travel-leaflet-marker";
      markerEl.innerHTML = `<span data-place-count="${placeCount}">${placeCount > 1 ? `<strong>${placeCount}</strong>` : ""}</span>`;

      const popup = new window.maplibregl.Popup({
        offset: 14,
        closeButton: true,
        maxWidth: "260px",
      }).setHTML(getPopupHtml(group));

      new window.maplibregl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([group.lng, group.lat])
        .setPopup(popup)
        .addTo(map);

      group.places.forEach((place) => markers.set(place.id, () => markerEl));
      bounds.extend([group.lng, group.lat]);

      markerEl.addEventListener("mouseenter", () => {
        markerEl.classList.add("active");
        group.places.forEach((place) => setActive(place.id, true));
      });
      markerEl.addEventListener("mouseleave", () => {
        markerEl.classList.remove("active");
        group.places.forEach((place) => setActive(place.id, false));
      });
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 40,
        maxZoom: 11,
        duration: 0,
      });
      map.setMinZoom(Math.max(1, map.getZoom() - 0.5));
    }

    bindCardEvents(markers);
  };

  const hasWebGL = (() => {
    try {
      const canvas = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl"))
      );
    } catch (e) {
      return false;
    }
  })();

  const loadResources = () => {
    if (!hasWebGL) {
      loadLeafletFallback();
      return;
    }

    const mapLibreCss =
      "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css";
    const mapLibreJs =
      "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js";

    if (!document.querySelector('link[href*="maplibre-gl.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = mapLibreCss;
      document.head.appendChild(link);
    }

    if (window.maplibregl) {
      initMapLibreMap();
    } else {
      const script = document.createElement("script");
      script.src = mapLibreJs;
      script.async = true;
      script.onload = initMapLibreMap;
      script.onerror = loadLeafletFallback;
      document.body.appendChild(script);
    }
  };

  // Yield main thread to avoid blocking initial paint/layout of the place list
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => loadResources());
  } else {
    setTimeout(loadResources, 100);
  }
})();
