"use strict";

const fs = require("fs");
const path = require("path");

const EMOJI_DIR = path.join(__dirname, "../source/linen-theme/img/emoji");

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

// Match full emoji sequences (including modifiers & ZWJ sequences) so compound
// emojis are never partially replaced.
const EMOJI_REGEX =
  /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*/gu;

const HTML_TOKEN_REGEX = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g;

function loadAvailableEmojis() {
  try {
    const files = fs.readdirSync(EMOJI_DIR);
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

function replaceEmojisInHtml(html, availableEmojis, emojiBaseUrl) {
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
      return `<img class="linen-emoji" src="${emojiBaseUrl}${cp}.svg" alt="${match}" draggable="false" loading="lazy" decoding="async" />`;
    });
  });

  return headPart + processedBody;
}

function registerEmojiFilter(hexoInstance) {
  const availableEmojis = loadAvailableEmojis();
  if (!availableEmojis.size) return;

  hexoInstance.extend.filter.register("after_render:html", function (str) {
    if (
      hexoInstance.theme?.config?.emoji?.enable === false ||
      hexoInstance.config?.theme_config?.emoji?.enable === false
    ) {
      return str;
    }
    const root = String(hexoInstance.config?.root || "/").replace(/\/+$/, "");
    const emojiBaseUrl = `${root}/linen-theme/img/emoji/`;
    return replaceEmojisInHtml(str, availableEmojis, emojiBaseUrl);
  });
}

if (typeof hexo !== "undefined") {
  registerEmojiFilter(hexo);
}

module.exports = registerEmojiFilter;
