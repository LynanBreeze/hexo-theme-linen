const { resolvePostLayoutStyle } = require("./lib/site-data");

const TRAVEL_ROUTE_HEADING_REGEX = /^(?:路线|路线规划|Route|Route Planning)$/i;
const TRAVEL_ROUTE_PALETTE = [
  "#c97a63",
  "#a8452e",
  "#8a9a86",
  "#c4b7a6",
  "#b87d56",
  "#6d8b74",
  "#d49a79",
  "#9c8f84",
];

function stripHtmlTags(str) {
  return String(str || "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function stripHeadingText(str) {
  return stripHtmlTags(
    String(str || "").replace(
      /<a[^>]*class="[^"]*(?:headerlink|header-anchor)[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
      "",
    ),
  )
    .replace(/^[#¶\s]+|[#¶\s]+$/g, "")
    .trim();
}

function escapeAttr(str) {
  return String(str || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

function parseChineseNumeral(str) {
  const map = {
    半: 0.5,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  if (str in map) return map[str];
  if (/^十[一二三四五六七八九]$/.test(str)) {
    return 10 + map[str[1]];
  }
  return null;
}

function parseDurationFragment(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  // Compound: e.g. "2天1晚", "3 日 2 晚"
  const compoundMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(日|天)\s*\d+(?:\.\d+)?\s*(?:晚|夜)$/,
  );
  if (compoundMatch) {
    const value = Number(compoundMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return {
        label: trimmed,
        weight: value,
        unitKind: "day",
        unitText: compoundMatch[2],
      };
    }
  }

  // Half-day forms: "半日", "半天", "half day"
  if (/^(半日|半天|half\s+day)$/i.test(trimmed)) {
    const isEn = /day/i.test(trimmed);
    return {
      label: trimmed,
      weight: 0.5,
      unitKind: "day",
      unitText: isEn ? "days" : trimmed.endsWith("日") ? "日" : "天",
    };
  }

  // Chinese numeral forms: "一日", "两天", "一天半", "三日半"
  const zhNumMatch = trimmed.match(
    /^(十?[一二两三四五六七八九]|十)\s*(日|天|晚|夜)(半)?$/,
  );
  if (zhNumMatch) {
    const base = parseChineseNumeral(zhNumMatch[1]);
    if (base) {
      const value = base + (zhNumMatch[3] ? 0.5 : 0);
      const unitChar = zhNumMatch[2];
      return {
        label: trimmed,
        weight: value,
        unitKind: unitChar === "晚" || unitChar === "夜" ? "night" : "day",
        unitText: unitChar,
      };
    }
  }

  // Numeric forms: "2 日", "0.5 天", "5 days", "2d", "3 nights", "4 小时", "3h"
  const numMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(日|天|晚|夜|小时|days?|nights?|hours?|hrs?|d|h)$/i,
  );
  if (numMatch) {
    const value = Number(numMatch[1]);
    const unitRaw = numMatch[2];
    if (Number.isFinite(value) && value > 0) {
      const lower = unitRaw.toLowerCase();
      let unitKind = "day";
      let unitText = unitRaw;
      if (lower === "晚" || lower === "夜" || lower.startsWith("night")) {
        unitKind = "night";
        unitText = lower.startsWith("night") ? "nights" : unitRaw;
      } else if (
        lower === "小时" ||
        lower.startsWith("hour") ||
        lower.startsWith("hr") ||
        lower === "h"
      ) {
        unitKind = "hour";
        unitText = lower === "小时" ? "小时" : "hours";
      } else if (lower.startsWith("day") || lower === "d") {
        unitKind = "day";
        unitText = "days";
      }
      return {
        label: trimmed,
        weight: value,
        unitKind,
        unitText,
      };
    }
  }

  return null;
}

function parseTravelRouteItem(rawHtml) {
  let content = String(rawHtml || "").trim();
  if (/^<p>[\s\S]*<\/p>$/i.test(content) && !/<\/p>\s*<p>/i.test(content)) {
    content = content.replace(/^<p>|<\/p>$/gi, "").trim();
  }

  let note = "";
  let duration = null;

  // Check for trailing parenthetical: either a pure duration like "大阪（2日）" or a note like "大阪 2 日（心斋桥）"
  const trailingParenMatch = content.match(
    /^(.*?)[\s]*(?:（([^（）]+)）|\(([^()]+)\))\s*$/,
  );
  if (trailingParenMatch && trailingParenMatch[1].trim()) {
    const parenInner = (
      trailingParenMatch[2] ||
      trailingParenMatch[3] ||
      ""
    ).trim();
    const parenDuration = parseDurationFragment(parenInner);
    if (parenDuration) {
      duration = parenDuration;
      content = trailingParenMatch[1].trim();
    } else {
      note = parenInner;
      content = trailingParenMatch[1].trim();
    }
  }

  // Extract trailing duration from the remaining content if not yet parsed
  if (!duration) {
    const tailMatch = content.match(
      /^(.*?)(?:[\s·•\-—:：,，/]+)(\d+(?:\.\d+)?\s*(?:日|天)\s*\d+(?:\.\d+)?\s*(?:晚|夜)|\d+(?:\.\d+)?\s*(?:日|天|晚|夜|小时|days?|nights?|hours?|hrs?|d|h)|(?:半日|半天|half\s+day)|(?:十?[一二两三四五六七八九]|十)\s*(?:日|天|晚|夜)(?:半)?)\s*$/i,
    );
    if (tailMatch && tailMatch[1].trim()) {
      const parsed = parseDurationFragment(tailMatch[2]);
      if (parsed) {
        duration = parsed;
        content = tailMatch[1].trim();
      }
    }
  }

  // Fallback for no-space CJK place + duration, e.g. "大阪2日", "京都5天", "宇治半日"
  if (!duration) {
    const compactMatch = content.match(
      /^(.*?)(\d+(?:\.\d+)?\s*(?:日|天)\s*\d+(?:\.\d+)?\s*(?:晚|夜)|\d+(?:\.\d+)?\s*(?:日|天|晚|夜|小时)|半日|半天)$/,
    );
    if (compactMatch && compactMatch[1].trim()) {
      const parsed = parseDurationFragment(compactMatch[2]);
      if (parsed) {
        duration = parsed;
        content = compactMatch[1].trim();
      }
    }
  }

  const place = content.replace(/[\s·•\-—:：,，/]+$/, "").trim();
  if (!place) {
    return {
      place: rawHtml.trim(),
      duration: null,
      note: "",
    };
  }

  return { place, duration, note };
}

function getRouteGridCols(count) {
  if (count <= 2) return 2;
  if (count === 3 || count === 5 || count === 6 || count === 9) return 3;
  return 4;
}

function buildTravelRouteBlock(listHtml, isEnglishPost) {
  const innerListHtml = listHtml
    .replace(/^<(?:ul|ol)[^>]*>/i, "")
    .replace(/<\/(?:ul|ol)>\s*$/i, "");

  // Skip lists containing nested lists or block-level media/containers
  if (
    /<(?:ul|ol|img|iframe|table|pre|blockquote|figure)\b/i.test(innerListHtml)
  ) {
    return null;
  }

  const liMatches = [...innerListHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  if (liMatches.length < 2) {
    return null;
  }

  const stops = liMatches.map((m) => parseTravelRouteItem(m[1]));
  const stopsWithDuration = stops.filter((s) => s.duration);
  const showBar = stopsWithDuration.length >= 2;
  const cols = getRouteGridCols(stops.length);

  // Build proportion bar (only segments with parsed durations)
  let barHtml = "";
  let summaryHtml = "";

  if (showBar) {
    const unitKinds = new Set(stopsWithDuration.map((s) => s.duration.unitKind));
    const segmentsHtml = stops
      .map((stop, idx) => {
        if (!stop.duration) return "";
        const color = TRAVEL_ROUTE_PALETTE[idx % TRAVEL_ROUTE_PALETTE.length];
        let flexWeight = stop.duration.weight;
        if (unitKinds.size > 1 && stop.duration.unitKind === "hour") {
          flexWeight = Math.max(stop.duration.weight / 24, 0.25);
        }
        const tip = escapeAttr(
          `${stripHtmlTags(stop.place)} · ${stop.duration.label}`,
        );
        return `<span class="travel-route-seg" style="flex:${flexWeight};--stop-color:${color};" title="${tip}"></span>`;
      })
      .join("");

    barHtml = `<div class="travel-route-bar" aria-hidden="true">${segmentsHtml}</div>`;

    // Build subtle summary when all durations share the same unit kind (day or night)
    if (
      stopsWithDuration.length === stops.length &&
      unitKinds.size === 1 &&
      (unitKinds.has("day") || unitKinds.has("night"))
    ) {
      const total = Number(
        stopsWithDuration
          .reduce((sum, s) => sum + s.duration.weight, 0)
          .toFixed(2),
      );
      const firstUnit = stopsWithDuration[0].duration.unitText;
      const useEnglish = isEnglishPost || /^[a-z]+$/i.test(firstUnit);
      const summaryText = useEnglish
        ? `${stops.length} STOPS · ${total} ${firstUnit.toUpperCase()}`
        : `${stops.length} 站 · 共 ${total} ${firstUnit}`;
      summaryHtml = `<div class="travel-route-summary">${summaryText}</div>`;
    }
  }

  const itemsHtml = stops
    .map((stop, idx) => {
      const color = TRAVEL_ROUTE_PALETTE[idx % TRAVEL_ROUTE_PALETTE.length];
      const num = String(idx + 1).padStart(2, "0");
      const durationHtml = stop.duration
        ? `<span class="travel-route-days">${stop.duration.label}</span>`
        : "";
      const noteHtml = stop.note
        ? `<span class="travel-route-note">${stop.note}</span>`
        : "";

      return `<li class="travel-route-item" style="--stop-color:${color};"><div class="travel-route-item-top"><span class="travel-route-index">${num}</span><span class="travel-route-dot" aria-hidden="true"></span></div><div class="travel-route-place">${stop.place}</div>${durationHtml}${noteHtml}</li>`;
    })
    .join("");

  return `<div class="travel-route-block${showBar ? " has-bar" : ""}" style="--route-cols:${cols};">${summaryHtml}${barHtml}<ul class="travel-route-grid">${itemsHtml}</ul></div>`;
}

function extractBalancedListHtml(str) {
  const openMatch = /^<(ul|ol)\b[^>]*>/i.exec(str);
  if (!openMatch) return null;
  const tagName = openMatch[1].toLowerCase();
  const tokenRe = new RegExp(`<(\\/)?${tagName}\\b[^>]*>`, "gi");
  let depth = 0;
  let match;
  while ((match = tokenRe.exec(str)) !== null) {
    if (match[1]) {
      depth -= 1;
      if (depth === 0) {
        return str.slice(0, match.index + match[0].length);
      }
    } else {
      depth += 1;
    }
  }
  return null;
}

function processTravelRoute(content, data, ctx, hexoInstance) {
  if (
    !content ||
    resolvePostLayoutStyle(data, ctx, undefined, hexoInstance || hexo) !==
      "journal"
  ) {
    return content;
  }

  const explicitLang = String(
    data?.language ||
      data?.lang ||
      ctx?.config?.language ||
      hexoInstance?.config?.language ||
      "",
  ).trim();
  const isEnglishPost = explicitLang
    ? /^en\b/i.test(explicitLang)
    : data?.series === "Travel";

  const headingRe = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const betweenRe =
    /^(?:\s|<!--[\s\S]*?-->|<div\s+id=["']gitalk-initiator["'][^>]*><\/div>|<span\s+id=["']more["'][^>]*><\/span>|<a\s+id=["']more["'][^>]*><\/a>)*/i;

  let result = "";
  let cursor = 0;
  let match;

  while ((match = headingRe.exec(content)) !== null) {
    const headingEnd = match.index + match[0].length;
    const headingText = stripHeadingText(match[2]);
    if (!TRAVEL_ROUTE_HEADING_REGEX.test(headingText)) {
      continue;
    }

    const tail = content.slice(headingEnd);
    const betweenMatch = betweenRe.exec(tail);
    const betweenLen = betweenMatch ? betweenMatch[0].length : 0;
    const listStartInTail = betweenLen;
    const listHtml = extractBalancedListHtml(tail.slice(listStartInTail));
    if (!listHtml) {
      continue;
    }
    if (/^<(?:ul|ol)\b[^>]*\bclass=["'][^"']*\btravel-route-grid\b/i.test(listHtml)) {
      continue;
    }

    const routeBlock = buildTravelRouteBlock(listHtml, isEnglishPost);
    if (!routeBlock) {
      continue;
    }

    const listAbsStart = headingEnd + listStartInTail;
    const listAbsEnd = listAbsStart + listHtml.length;

    result += content.slice(cursor, listAbsStart) + routeBlock;
    cursor = listAbsEnd;
    headingRe.lastIndex = listAbsEnd;
  }

  if (cursor === 0) {
    return content;
  }

  return result + content.slice(cursor);
}

function processCodeBlock(content) {
  if (!content) return content;
  return content.replace(
    /<figure\b([^>]*\bclass="[^"]*\bhighlight\b[^"]*"[^>]*)>([\s\S]*?)<\/figure>/gi,
    (match, attrs, inner) => {
      if (inner.includes('class="copy-btn"')) {
        return match;
      }
      return `<figure${attrs}>${inner}<button type="button" class="copy-btn" aria-label="Copy code" title="Copy code"></button></figure>`;
    },
  );
}

function processTables(content) {
  if (!content) return content;
  return content.replace(
    /(<figure\b[^>]*class="[^"]*\bhighlight\b[^"]*"[^>]*>[\s\S]*?<\/figure>)|(<div\b[^>]*class="[^"]*\btable-wrap\b[^"]*"[^>]*>[\s\S]*?<\/div>)|(<table\b[^>]*>[\s\S]*?<\/table>)/gi,
    (match, highlightBlock, wrappedTable, tableHtml) => {
      if (highlightBlock || wrappedTable) {
        return match;
      }
      return `<div class="table-wrap">${tableHtml}</div>`;
    },
  );
}

function process(content) {
  if (!content) return "";
  const h2Regex = /(<h2[^>]*>.*?<\/h2>)/g;
  let match,
    count = 0,
    lastIndex = 0;
  let updatedContent = content;

  while ((match = h2Regex.exec(content)) !== null) {
    count++;
    if (count === 3) {
      lastIndex = match.index + match[0].length;
      updatedContent =
        content.slice(0, lastIndex) +
        '<div id="gitalk-initiator"></div>' +
        content.slice(lastIndex);
      return updatedContent;
    }
  }

  return updatedContent + '<div id="gitalk-initiator"></div>';
}

hexo.extend.helper.register("renderTravelRoutes", function (content, post) {
  return processTravelRoute(content, post || this.page, this, hexo);
});

function isCommentsEnabled(data, hexoInstance) {
  if (data?.comment === false) return false;
  const commentConfig =
    hexoInstance?.theme?.config?.comment ??
    hexoInstance?.config?.theme_config?.comment;
  if (!commentConfig) return false;
  if (data?.comment === true) return true;
  return commentConfig.enable !== false;
}

hexo.extend.filter.register(
  "after_post_render",
  function (data) {
    data.content = processCodeBlock(data.content);
    data.content = processTables(data.content);
    data.content = processTravelRoute(data.content, data, this, hexo);
    if (isCommentsEnabled(data, hexo)) {
      data.content = process.call(this, data.content);
    }
    return data;
  },
  2,
);
