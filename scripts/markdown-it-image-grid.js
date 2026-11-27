hexo.extend.filter.register(
  "before_post_render",
  function (data) {
    try {
      const escapeAttribute = (value = "") =>
        String(value)
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const getImageAlt = (renderedLine) => {
        const altMatch = renderedLine.match(/<img[\s\S]*?\salt=["']([^"']*)["']/i);
        return altMatch?.[1]?.trim() || "";
      };

      const getFallbackLabel = (renderedLine, index) => {
        return getImageAlt(renderedLine) || `${index + 1}`;
      };

      const renderMarkdownLine = (line) =>
        hexo.render
          .renderSync({
            text: line,
            engine: "markdown"
          })
          .replace(/<p>/g, "")
          .replace(/<\/p>/g, "")
          .replace(/<br\s*\/?>/gi, "");

      const splitSwitcherLine = (line) => {
        const contentStart = line.search(/!\[|<img\b|<iframe\b/i);
        const delimiterIndex = line.indexOf("|");
        const hasLabel =
          delimiterIndex > -1 &&
          (contentStart === -1 || delimiterIndex < contentStart);
        return {
          label: hasLabel ? line.slice(0, delimiterIndex).trim() : "",
          imageMarkdown: hasLabel ? line.slice(delimiterIndex + 1).trim() : line,
        };
      };

      const transformOutsideCodeFences = (source, transformer) => {
        const lines = String(source || "").split("\n");
        const out = [];
        let buffer = [];
        let inFence = false;
        let fenceChar = "";
        let fenceLen = 0;

        const flushBuffer = () => {
          if (!buffer.length) return;
          out.push(transformer(buffer.join("\n")));
          buffer = [];
        };

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const cleanLine = line.replace(/\r$/, "");
          if (!inFence) {
            const openMatch = cleanLine.match(/^(?:[ \t]*>[ \t]?)*[ \t]*(`{3,}|~{3,})(.*)$/);
            if (openMatch && !(openMatch[1][0] === "`" && openMatch[2].includes("`"))) {
              flushBuffer();
              inFence = true;
              fenceChar = openMatch[1][0];
              fenceLen = openMatch[1].length;
              out.push(line);
              continue;
            }
            buffer.push(line);
          } else {
            out.push(line);
            const closeRe = new RegExp(`^(?:[ \\t]*>[ \\t]?)*[ \\t]*\\${fenceChar}{${fenceLen},}[ \\t]*$`);
            if (closeRe.test(cleanLine)) {
              inFence = false;
              fenceChar = "";
              fenceLen = 0;
            }
          }
        }
        flushBuffer();
        return out.join("\n");
      };

      const formatedContent = transformOutsideCodeFences(data.content, (chunk) =>
        chunk.replace(
          /:::image-grid(?:\s+([\w-]+))?([\s\S]*?):::/g,
          (match, grid, content) => {
            const gridClass = grid ? ` ${grid}` : "";
            const lines = content
              .split("\n")
              .filter((v) => v)
              .map((line) => line.trim());

            if (grid === "switcher") {
              const items = lines
                .map((line, index) => {
                  const { label, imageMarkdown } = splitSwitcherLine(line);
                  const renderedLine = renderMarkdownLine(imageMarkdown);
                  const alt = getImageAlt(renderedLine);

                  return /<img|<iframe/.test(renderedLine)
                    ? {
                        label: label || alt || getFallbackLabel(renderedLine, index),
                        content: renderedLine
                      }
                    : null;
                })
                .filter(Boolean);

              if (!items.length) return match;

              return `<span class="image-grid switcher">${items
                .map(
                  (item, index) =>
                    `<span class="grid-item${index === 0 ? " active" : ""}" data-switch-label="${escapeAttribute(
                      item.label
                    )}" role="tabpanel" aria-hidden="${index === 0 ? "false" : "true"}">${item.content}</span>`
                )
                .join(
                  ""
                )}<span class="image-grid-switcher-controls is-ready" role="tablist" style="--switcher-item-count: ${
                items.length
              }; --switcher-active-index: 0;">${items
                .map(
                  (item, index) =>
                    `<button class="image-grid-switcher-button${index === 0 ? " active" : ""}" type="button" role="tab" aria-selected="${
                      index === 0 ? "true" : "false"
                    }">${escapeAttribute(item.label)}</button>`
                )
                .join("")}</span></span>`;
            }

            return `<span class="image-grid${gridClass}">${lines
              .map((line) => {
                const renderedLine = renderMarkdownLine(line);
                return /<img|<iframe/.test(renderedLine)
                  ? `<span class="grid-item">${renderedLine}</span>`
                  : renderedLine;
              })
              .join("")}</span>`;
          }
        )
      );
      data.content = formatedContent;
    } catch (error) {
      console.log(error);
    }
  },
  1
);
