"use strict";

hexo.extend.filter.register("before_post_render", function (data) {
  let lines = data.content.split("\n");

  const footnotes = {};
  const refRegex = /\[\^(.+?)\]/g;
  const defStartRegex = /^\[\^(.+?)\]:\s*(.*)$/;

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const defMatch = line.match(defStartRegex);

    if (defMatch) {
      const id = defMatch[1];
      const firstLine = defMatch[2] || "";
      let blocks = [];

      if (firstLine.trim()) {
        blocks.push(firstLine);
      }

      i++;

      while (i < lines.length) {
        const next = lines[i];

        if (defStartRegex.test(next)) break;

        if (/^\s{4,}|\t/.test(next)) {
          blocks.push(next.replace(/^\s{4}/, ""));
          i++;
          continue;
        }

        if (next.trim() === "") {
          blocks.push("");
          i++;
          continue;
        }

        break;
      }

      footnotes[id] = blocks.join("\n");
      continue;
    }

    i++;
  }

  data.content = data.content.replace(
    /^\[\^(.+?)\]:[\s\S]+?(?=\n\[|\n*$)/gm,
    "",
  );

  const refCount = {};

  data.content = data.content.replace(refRegex, (m, id) => {
    if (!footnotes[id]) return m;

    refCount[id] = (refCount[id] || 0) + 1;
    const n = refCount[id];

    return `<sup class="footnote-anchor-wrap" id="fnref-${id}-${n}"><a class="footnote-href" href="#fn-${id}">${id}</a></sup>`;
  });

  const keys = Object.keys(footnotes);
  if (keys.length > 0) {
    const list = keys
      .map((id) => {
        const html = footnotes[id]
          .split("\n")
          .map((p) => (p.trim() ? p : ""))
          .join("\n");

        const backrefs = Array.from({ length: refCount[id] || 0 }, (_, i) => {
          const n = i + 1;
          return `<a href="#fnref-${id}-${n}" class="footnote-backref" aria-label="返回脚注引用" title="返回脚注引用"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 6v5a3 3 0 0 1-3 3H4m0 0 4-4m-4 4 4 4" /></svg></a>`;
        }).join(" ");

        return `<li id="fn-${id}">${html}${backrefs}</li>`;
      })
      .join("\n");

    data.content += `
<hr class="footnotes-sep">
<section class="footnotes">
  <ol>
    ${list}
  </ol>
</section>
`;
  }

  return data;
});
