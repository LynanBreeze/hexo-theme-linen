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
          .replace(/<br\s?\>/g, "");

      const formatedContent = data.content.replace(
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
                const delimiterIndex = line.indexOf("|");
                const hasLabel = delimiterIndex > -1;
                const label = hasLabel ? line.slice(0, delimiterIndex).trim() : "";
                const imageMarkdown = hasLabel ? line.slice(delimiterIndex + 1).trim() : line;
                const renderedLine = renderMarkdownLine(imageMarkdown);
                const alt = getImageAlt(renderedLine);

                return /<img|<iframe/.test(renderedLine)
                  ? {
                      label: alt || label || getFallbackLabel(renderedLine, index),
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
      );
      data.content = formatedContent;
    } catch (error) {
      console.log(error);
    }
  },
  1
);
