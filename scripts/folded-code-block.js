// scripts/add-folded-to-code.js
"use strict";

hexo.extend.filter.register("after_post_render", function (data) {
  if (!data || !data.content) return data;

  let content = data.content;

  content = content.replace(
    /<figure([^>]*\bclass="[^"]*\bhighlight\b[^"]*"[^>]*)>([\s\S]*?)<\/figure>/gi,
    (match, attrs, inner) => {
      let newAttrs = attrs;
      let newInner = inner;

      if (/<figcaption[^>]*>/.test(inner)) {
        newInner = newInner.replace(
          /<figcaption([^>]*)>([\s\S]*?)<\/figcaption>/i,
          (m, capAttrs, capText) => {
            let captionText = capText;

            const hasFolded = /\bfolded\b/i.test(captionText);

            captionText = captionText.replace(/\bfolded\b/gi, "").trim();

            if (!captionText) return "";

            if (!/^<span[\s\S]*<\/span>$/.test(captionText)) {
              captionText = `<span>${captionText}</span>`;
            }

            if (hasFolded) {
              if (/class\s*=\s*"/i.test(newAttrs)) {
                newAttrs = newAttrs.replace(/class\s*=\s*"(.*?)"/i, (m, g1) => {
                  return `class="${g1} folded"`;
                });
              } else {
                newAttrs += ' class="folded"';
              }
            }

            return `<figcaption${capAttrs}>${captionText}</figcaption>`;
          },
        );
      }

      if (/class="[^"]*folded/.test(newAttrs)) {
        return `<figure${newAttrs}>${newInner}<button type="button" class="fold-toggle" aria-label="Toggle code block"></button></figure>`;
      } else {
        return `<figure${newAttrs}>${newInner}</figure>`;
      }
    },
  );

  data.content = content;
  return data;
});
