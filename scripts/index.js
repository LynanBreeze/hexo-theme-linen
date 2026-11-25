"use strict";

module.exports = hexo => {
require("./custom")(hexo);
require("./hoverTexts")(hexo);
require("./helpers/tools")(hexo);
require("./font-version")(hexo);
require("./footnote")(hexo);
require("./appendRawMarkdownContent")(hexo); 
require("./addCopyButtonToCodeBlocks")(hexo);
require('./folded-code-block')(hexo);
require('./series-generator')(hexo);
require("./lazyload/index")(hexo);
require("./emoji")(hexo);
require("./rss")(hexo);
}
