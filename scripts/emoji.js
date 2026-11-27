"use strict";

const fs = require("fs");
const path = require("path");
const { getSiteData } = require("./lib/site-data");

const EMOJI_DIR = path.join(__dirname, "../assets/emoji");
const OUTPUT_PREFIX = "linen-theme/img/emoji/";

const SKIP_TAGS = new Set([
  "script",
  "style",
  "pre",
  "code",
  "textarea",
  "svg",
  "noscript",
  "title",
]);

// Match full emoji sequences (including keycaps, modifiers & ZWJ sequences) so
// compound emojis are never partially replaced.
const EMOJI_REGEX =
  /[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*/gu;

const HTML_TOKEN_REGEX =
  /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<textarea\b[^>]*>[\s\S]*?<\/textarea>|<title\b[^>]*>[\s\S]*?<\/title>|<noscript\b[^>]*>[\s\S]*?<\/noscript>|<\/?[a-zA-Z][^>]*>|[^<]+/gi;

function loadAvailableEmojis(emojiDir = EMOJI_DIR) {
  try {
    const files = fs.readdirSync(emojiDir);
    return new Set(
      files
        .filter((file) => file.endsWith(".svg"))
        .map((file) => file.slice(0, -4).toLowerCase()),
    );
  } catch (error) {
    return new Set();
  }
}

function toCodepoint(emoji) {
  return [...emoji]
    .map((ch) => ch.codePointAt(0).toString(16))
    .filter((cp) => cp !== "fe0f")
    .join("-");
}

function collectEmojisFromText(text, availableEmojis, usedSet) {
  if (!text || typeof text !== "string" || !availableEmojis.size) {
    return;
  }
  EMOJI_REGEX.lastIndex = 0;
  let match;
  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    const token = match[0];
    if (token.includes("\uFE0E")) continue;
    const cp = toCodepoint(token);
    if (availableEmojis.has(cp)) {
      usedSet.add(cp);
    }
  }
}

function collectUsedEmojisFromValue(value, availableEmojis, usedSet, seen) {
  if (!value) return;
  if (typeof value === "string") {
    collectEmojisFromText(value, availableEmojis, usedSet);
    return;
  }
  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      collectUsedEmojisFromValue(item, availableEmojis, usedSet, seen);
    }
    return;
  }
  for (const key of Object.keys(value)) {
    collectUsedEmojisFromValue(value[key], availableEmojis, usedSet, seen);
  }
}

function replaceEmojisInHtml(
  html,
  availableEmojis,
  emojiBaseUrl,
  onReplaceCodepoint,
) {
  if (!html || typeof html !== "string" || !availableEmojis.size) {
    return html;
  }

  const bodyStart = html.search(/<body\b/i);
  // Only process full HTML documents (skip RSS markdown fragments & partials)
  if (bodyStart === -1) {
    return html;
  }
  const headPart = html.slice(0, bodyStart);
  const bodyPart = html.slice(bodyStart);

  let skipDepth = 0;

  const processedBody = bodyPart.replace(HTML_TOKEN_REGEX, (token) => {
    if (token.startsWith("<!--")) {
      return token;
    }

    if (token.startsWith("<")) {
      if (/^<(?:script|style|textarea|title|noscript)\b/i.test(token) && /<\/(?:script|style|textarea|title|noscript)>$/i.test(token)) {
        return token;
      }
      const tagMatch = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(token);
      if (tagMatch) {
        const isClosing = tagMatch[1] === "/";
        const tagName = tagMatch[2].toLowerCase();
        const isSelfClosing = /\/>$/.test(token);
        if (SKIP_TAGS.has(tagName) && !isSelfClosing) {
          if (isClosing) {
            skipDepth = Math.max(0, skipDepth - 1);
          } else {
            skipDepth += 1;
          }
        }
      }
      return token;
    }

    if (skipDepth > 0) {
      return token;
    }

    return token.replace(EMOJI_REGEX, (match) => {
      // Respect explicit text-presentation selector
      if (match.includes("\uFE0E")) {
        return match;
      }
      const cp = toCodepoint(match);
      if (!availableEmojis.has(cp)) {
        return match;
      }
      if (typeof onReplaceCodepoint === "function") {
        onReplaceCodepoint(cp);
      }
      return `<img class="linen-emoji" src="${emojiBaseUrl}${cp}.svg" alt="${match}" draggable="false" loading="lazy" decoding="async" />`;
    });
  });

  return headPart + processedBody;
}

function isEmojiEnabled(hexoInstance) {
  const explicit =
    hexoInstance?.theme?.config?.emoji?.enable ??
    hexoInstance?.config?.theme_config?.emoji?.enable;
  return explicit !== false;
}

function registerEmojiFilter(hexoInstance) {
  const availableEmojis = loadAvailableEmojis();
  if (!availableEmojis.size) return;

  const emittedEmojis = new Set();

  hexoInstance.extend.filter.register("before_generate", function () {
    emittedEmojis.clear();
  });

  hexoInstance.extend.generator.register(
    "linen-emoji-assets",
    function (locals) {
      if (!isEmojiEnabled(hexoInstance)) {
        return [];
      }

      const used = new Set();
      const seen = new WeakSet();
      const posts = locals?.posts ? locals.posts.toArray() : [];
      const pages = locals?.pages ? locals.pages.toArray() : [];

      for (const item of [...posts, ...pages]) {
        collectEmojisFromText(item.title, availableEmojis, used);
        collectEmojisFromText(item.subTitle, availableEmojis, used);
        collectEmojisFromText(item.excerpt, availableEmojis, used);
        collectEmojisFromText(item.content, availableEmojis, used);
        collectEmojisFromText(item._content, availableEmojis, used);
        if (item.sponsors) {
          collectUsedEmojisFromValue(item.sponsors, availableEmojis, used, seen);
        }
        if (item.coverInfo) {
          collectUsedEmojisFromValue(
            item.coverInfo,
            availableEmojis,
            used,
            seen,
          );
        }
      }

      collectEmojisFromText(hexoInstance.config?.title, availableEmojis, used);
      collectEmojisFromText(
        hexoInstance.config?.description,
        availableEmojis,
        used,
      );
      collectUsedEmojisFromValue(
        hexoInstance.theme?.config?.info,
        availableEmojis,
        used,
        seen,
      );
      collectUsedEmojisFromValue(
        hexoInstance.theme?.config?.navItems,
        availableEmojis,
        used,
        seen,
      );

      for (const dataKey of ["series", "categories", "tags"]) {
        collectUsedEmojisFromValue(
          getSiteData(hexoInstance, dataKey, hexoInstance),
          availableEmojis,
          used,
          seen,
        );
      }

      const assets = [];
      for (const cp of used) {
        const filePath = path.join(EMOJI_DIR, `${cp}.svg`);
        if (fs.existsSync(filePath)) {
          emittedEmojis.add(cp);
          assets.push({
            path: `${OUTPUT_PREFIX}${cp}.svg`,
            data: () => fs.createReadStream(filePath),
          });
        }
      }

      return assets;
    },
  );

  hexoInstance.extend.filter.register("after_render:html", function (str) {
    if (!isEmojiEnabled(hexoInstance)) {
      return str;
    }
    const root = String(hexoInstance.config?.root || "/").replace(/\/+$/, "");
    const emojiBaseUrl = `${root}/${OUTPUT_PREFIX}`;
    return replaceEmojisInHtml(str, availableEmojis, emojiBaseUrl, (cp) => {
      if (!emittedEmojis.has(cp) && hexoInstance.route?.set) {
        const filePath = path.join(EMOJI_DIR, `${cp}.svg`);
        if (fs.existsSync(filePath)) {
          emittedEmojis.add(cp);
          hexoInstance.route.set(`${OUTPUT_PREFIX}${cp}.svg`, () =>
            fs.createReadStream(filePath),
          );
        }
      }
    });
  });
}

if (typeof hexo !== "undefined") {
  registerEmojiFilter(hexo);
}

module.exports = registerEmojiFilter;
module.exports.loadAvailableEmojis = loadAvailableEmojis;
module.exports.toCodepoint = toCodepoint;
module.exports.collectEmojisFromText = collectEmojisFromText;
module.exports.replaceEmojisInHtml = replaceEmojisInHtml;
