function replaceEmojis() {
  if (!document.body) return;
  const replacements = [{ emoji: "✅", className: "custom-checked-checkbox" }];

  replacements.forEach(({ emoji, className }) => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.includes(emoji)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (
            node.parentElement &&
            node.parentElement.closest("pre, code, textarea, script, style")
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    const nodesToReplace = [];

    while (walker.nextNode()) {
      nodesToReplace.push(walker.currentNode);
    }

    nodesToReplace.forEach((textNode) => {
      const parts = textNode.nodeValue.split(emoji);
      const parent = textNode.parentNode;

      parts.forEach((part, index) => {
        if (index > 0) {
          const customElement = document.createElement("i");
          customElement.className = className;
          parent.insertBefore(customElement, textNode);
        }
        if (part) {
          parent.insertBefore(document.createTextNode(part), textNode);
        }
      });

      parent.removeChild(textNode);
    });
  });
}

replaceEmojis();
