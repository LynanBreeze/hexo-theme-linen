// scripts/append-raw-markdown.js
const { highlight } = require('hexo-util');

hexo.extend.filter.register('after_render:html', function (html, data) {
  const page = data?.page;
  if (!page || !page.appendRawMarkdown) return html;

  const raw = page.raw || '';

  const codeHtml = highlight(raw, {
    lang: 'markdown', 
    autoDetect: false, 
    line_number: false,
  }).replace(/<\/figure>/g, '<div class="copy-btn"></div></figure>');

  const block = `<div id="raw-markdown-block">\n${codeHtml}\n</div>`;

  return html.replace('<div id="page-content-end"></div>', () => block)
}, 10);