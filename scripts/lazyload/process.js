"use strict";

const fs = require("fs");
const path = require("path");
const { defaultConfig } = require("./config");
function getElemAttributes(elemText) {
  // Regex to pick out start tag from start of element's HTML.
  var re_start_tag = /^<\w+\b(?:\s+[\w\-.:]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[\w\-.:]+))?)*\s*\/?>/;
  var start_tag = elemText.match(re_start_tag);
  start_tag = start_tag ? start_tag[0] : "";
  // Regex to pick out attribute name and (optional) value from start tag.
  var re_attribs = /\s+([\w\-.:]+)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([\w\-.:]+)))?/g;
  var attribs = {}; // Store attribute name=value pairs in object.
  var match = re_attribs.exec(start_tag);
  while (match != null) {
    var attrib = match[1]; // Attribute name in $1.
    var value = match[1]; // Assume no value specified.
    if (match[2]) {
      // If match[2] is set, then attribute has a value.
      value = match[3]
        ? match[3] // Attribute value is in $3, $4 or $5.
        : match[4]
          ? match[4]
          : match[5];
    }
    attribs[attrib] = value;
    match = re_attribs.exec(start_tag);
  }
  return attribs;
}

function readAllImgs(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    let merged = [];

    for (const file of jsonFiles) {
      const fullPath = path.join(dirPath, file);
      const content = fs.readFileSync(fullPath, "utf-8");

      try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          merged = merged.concat(data); // 合并数组
        } else {
          console.warn(`⚠️ ${file} 不是数组，跳过`);
        }
      } catch (err) {
        console.error(`❌ JSON parse error in ${file}:`, err);
      }
    }

    return merged;
  } catch (error) {
    return [];
  }
}

function getInlineWidthStyle(style) {
  const filtered = style
    .split(";")
    .map((s) => s.trim())
    .filter((s) => /^(max-)?width\s*:/.test(s))
    .join(";");

  return filtered ? `style="${filtered};"` : "";
}

function escapeAttribute(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getLivePhotoInfo(src = "", style = "") {
  src = decodeHexEntity(src).replace(/&amp;/g, "&");

  if (!/\/static\/live-photo\//.test(src)) {
    return null;
  }

  try {
    const livePhotoUrl = new URL(src, "https://lynan.cn");
    const picUrl = livePhotoUrl.searchParams.get("picUrl") || livePhotoUrl.searchParams.get("photoSrc");
    const aspectRatio = /aspect-ratio\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim() || "";
    const [width, height] = aspectRatio.includes("/")
      ? aspectRatio.split("/").map((value) => Number(value.trim()))
      : [Number(aspectRatio) || 16, 1];

    if (!picUrl || !width || !height) {
      return null;
    }

    return {
      picUrl,
      width,
      height
    };
  } catch (error) {
    return null;
  }
}

function decodeHexEntity(str) {
  return str
    ? str.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    : "";
}

function isUrlEqual(src1 = "", src2 = "") {
  try {
    const u1 = new URL(src1);
    const u2 = new URL(src2);

    return u1.pathname === u2.pathname && u1.search === u2.search && u1.hash === u2.hash;
  } catch (e) {
    return false;
  }
}

function appendAttributeToTag(tag, attrName, attrValue) {
  if (!attrValue || new RegExp(`\\s${attrName}=`).test(tag)) {
    return tag;
  }
  return tag.replace(/\s*\/?>$/, (end) => ` ${attrName}="${attrValue}"${end}`);
}

function getPlaceholderStyle(placeholder = "") {
  if (!placeholder || placeholder.startsWith("blurhash:")) {
    return "";
  }
  return /http|data:image/.test(placeholder) ? `background-image: url(${placeholder})` : placeholder;
}

function formatAttributes(str, src, imgs = [], language) {
  let res = {};
  const imgItem = imgs.find((item) => isUrlEqual(item.url, src || ""));
  let attributesObj = getElemAttributes(str);
  const originalItem = imgs.find((item) => item.url === imgItem?.originalUrl);
  const styleAttr = attributesObj.style || "";

  const styleStringToObject = (input) => {
    var result = {},
      attributes = input.split(";");
    for (var i = 0; i < attributes.length; i++) {
      var entry = attributes[i].split(":");
      result[entry.splice(0, 1)[0].trim()] = entry.join(":").trim();
    }
    return result;
  };

  const getAspectRatio = (returnStr) => {
    let aspectRatio = "";
    let percentage = "";
    if (imgItem) {
      aspectRatio = `${imgItem.width}/${imgItem.height}`;
    }
    if (styleAttr) {
      const styleObj = styleStringToObject(styleAttr.replace(/style="(.*?)"/gi, "$1"));
      if (styleObj["aspect-ratio"]) {
        aspectRatio = styleObj["aspect-ratio"];
      }
    }
    const aspectRatioRes = /aspect-ratio=(\S+)=aspect-ratio/gi.exec(
      decodeHexEntity(attributesObj.alt)
    );
    if (aspectRatioRes && aspectRatioRes[1]) {
      aspectRatio = aspectRatioRes[1];
    }
    if (returnStr) {
      return aspectRatio;
    }
    if (aspectRatio) {
      if (/\//.test(aspectRatio)) {
        percentage =
          ((Number(aspectRatio.split("/")[1]) / Number(aspectRatio.split("/")[0])) * 100).toFixed(
            5
          ) + "%";
      } else {
        percentage = 100 / Number(aspectRatio) + "%";
      }
    }
    return percentage;
  };

  const getPlaceholderImage = (returnStr) => {
    let placeholderImage = attributesObj["data-placeholderimg"] || "";
    var placeholderImageRes = /placeholder=(\S+)=placeholder/gi.exec(attributesObj.alt);
    if (placeholderImageRes && placeholderImageRes[1]) {
      placeholderImage = placeholderImageRes[1];
    }

    if (imgItem?.placeholder) {
      placeholderImage = imgItem.placeholder;
    }

    const isBlurHash = placeholderImage.startsWith("blurhash:");

    if (returnStr) {
      return isBlurHash ? "" : placeholderImage;
    }

    return isBlurHash
      ? ""
      : /http|data:image/.test(placeholderImage)
        ? `url(${placeholderImage})`
        : placeholderImage;
  };

  const getAltText = () => {
    if (imgItem?.[`alt${language}`] || imgItem?.alt) {
      return imgItem?.[`alt${language}`] || imgItem?.alt;
    }
    let alt = (attributesObj.alt || "").trim().replace(/^alt$/, "");
    if (alt) {
      alt = decodeHexEntity(alt)
        .replace(/\$placeholder=(\S+)=placeholder/gi, "")
        .replace(/\$aspect-ratio=(\S+)=aspect-ratio/gi, "")
        .replace(/(\$)?no-lazy/, "")
        .replace(/(\$)?no-link/, "");
    }
    return alt.trim();
  };

  const getIsLink = () => {
    let isLink = true;
    if (/(\$)?no-link/.test(str) || imgItem?.noLink) {
      isLink = false;
    }
    return isLink;
  };

  res["pswp-src"] = imgItem?.originalUrl || attributesObj["pswp-src"] || "";
  res.alt = getAltText();
  res.paddingBottom = getAspectRatio();
  res.aspectRatioStr = getAspectRatio(true);
  res.placeholderImage = getPlaceholderImage();
  res.placeholderImageStr = getPlaceholderImage(true);
  res.isLink = getIsLink();
  res.style = styleAttr;
  res.caption = imgItem?.[`caption_${language}`] || imgItem?.caption || "";
  res.exif = imgItem?.exif || "";
  res.originalWidth = originalItem?.width;
  res.originalHeight = originalItem?.height;
  res.location = imgItem?.location
    ? `{${imgItem.location}}{${
        imgItem?.[`locationText_${language}`] || imgItem?.locationText || ""
      }}`
    : "";
  return res;
}

const getformatedStr = (str, attrs, placeholerStyle = "") => {
  let formatedStr = decodeHexEntity(str);
  let noScriptElementStr = decodeHexEntity(str)
    .replace(/\$placeholder=(\S+)=placeholder/gi, "")
    .replace(/\$aspect-ratio=(\S+)=aspect-ratio/gi, "")
    .replace(/(\$)?no-lazy/, "")
    .replace(/(\$)?no-link/, "");

  const { placeholderImageStr, aspectRatioStr, style } = attrs;
  formatedStr = formatedStr.replace(/(\$)?no-link/, "");

  if (placeholderImageStr) {
    if (/data-placeholderimg/.test(formatedStr)) {
      formatedStr = formatedStr.replace(`data-placeholderimg="${placeholderImageStr}"`, "");
      noScriptElementStr = noScriptElementStr.replace(
        `data-placeholderimg="${placeholderImageStr}"`,
        ""
      );
    }
    if (/\$placeholder=/.test(formatedStr)) {
      formatedStr = formatedStr.replace(`$placeholder=${placeholderImageStr}=placeholder`, "");
      noScriptElementStr = noScriptElementStr.replace(
        `$placeholder=${placeholderImageStr}=placeholder`,
        ""
      );
    }
  }
  if (aspectRatioStr) {
    if (/\$aspect-ratio=/.test(formatedStr)) {
      formatedStr = formatedStr.replace(`$aspect-ratio=${aspectRatioStr}=aspect-ratio`, "");
    }
  }
  if (style) {
    formatedStr = formatedStr.replace(
      `style="${style}"`,
      /<video|<iframe/.test(str) ? placeholerStyle : ""
    );
  }
  return { formatedStr, noScriptElementStr };
};

function lazyProcess(htmlContent) {
  const theme = this.config.theme;
  const themeConfig = this.config.theme_config;
  const language = this.config.language;
  const { showAltText, placeholderRatio } = {
    ...defaultConfig,
    ...(themeConfig?.lazyload || {})
  };

  const enableGallery = themeConfig?.photoswipe === true;
  const imgs = readAllImgs(path.join(this.base_dir, "assets-db/imgs"));
  let livePhotoThumbIndex = 0;

  return htmlContent
    .replace(/<img([\s\S]*?)src="(.*?)"([\s\S]*?)(>|<\/img>)/gi, function (str, p1, src, attrStr) {
      if (/no-lazy/gi.test(str)) {
        return str.replace(/\$?no-lazy/, "");
      }

      const formatedAttributes = formatAttributes(str, src, imgs, language);
      const wrapStyle = formatedAttributes.style;

      let placeholerStyle = "";
      if (formatedAttributes.paddingBottom || formatedAttributes.placeholderImage) {
        placeholerStyle = `style="${
          formatedAttributes.paddingBottom
            ? `padding-bottom: ${formatedAttributes.paddingBottom};`
            : ""
        }${
          formatedAttributes.placeholderImage
            ? `background-image: ${formatedAttributes.placeholderImage}`
            : ""
        }"`;
      }

      const { formatedStr, noScriptElementStr } = getformatedStr(str, formatedAttributes);

      const defaultpswpConfig = {
        width: 1920,
        height: 1920 / placeholderRatio
      };
      const hasSizeConfig =
        formatedAttributes?.originalWidth || formatedAttributes.aspectRatioStr?.split("/")?.[0];
      const pswpWidth =
        formatedAttributes?.originalWidth ??
        (/\//.test(formatedAttributes.aspectRatioStr)
          ? formatedAttributes.aspectRatioStr?.split("/")?.[0]
          : defaultpswpConfig.width);
      const pswpHeight =
        formatedAttributes?.originalHeight ??
        (/\//.test(formatedAttributes.aspectRatioStr)
          ? formatedAttributes.aspectRatioStr?.split("/")?.[1]
          : defaultpswpConfig.height);
      const pswpConfig = enableGallery
        ? `data-pswp-hassize="${(!!hasSizeConfig).toString()}" data-pswp-width="${pswpWidth}" data-pswp-height="${pswpHeight}" ${
            formatedAttributes["pswp-src"]
              ? `data-pswp-src="${formatedAttributes["pswp-src"]}"`
              : ""
          } data-cropped="true"${
            formatedAttributes.exif ? ` data-pspw-exif="${formatedAttributes.exif}"` : ""
          }${
            formatedAttributes.location
              ? ` data-pspw-location="${formatedAttributes.location}"`
              : ""
          }`
        : "";

      const itemTag = formatedAttributes.isLink ? "a" : "span";
      const widthStyle = getInlineWidthStyle(wrapStyle || "");

      return `<span class="lazyload-outer-wrap" style="width: 100%;"><${itemTag} class="gallery-item" href="${src}" ${pswpConfig} target="_blank" rel="noopener" ${
        theme === "landscape" ? 'data-fancybox="gallery"' : ""
      } ${widthStyle}><noscript>${noScriptElementStr}</noscript><span class="lazyload-wrap" data-content="${encodeURIComponent(
        formatedStr
      )}" ${
        wrapStyle ? `style="${wrapStyle}"` : ""
      }><span class="placeholder" ${placeholerStyle}></span></span>${
        formatedAttributes.caption
          ? `<span class="pswp-caption-content">${formatedAttributes.caption}</span>`
          : ""
      }</${itemTag}>${
        showAltText && formatedAttributes.alt
          ? `<span class="caption" ${widthStyle}>${formatedAttributes.alt}</span>`
          : ``
      }</span>`;
    })
    .replace(/<iframe(.*?)src="(.*?)"(.*?)<\/iframe>/gi, function (str, p1, src) {
      if (/no-lazy/gi.test(str)) {
        return str;
      }
      const formatedAttributes = formatAttributes(str);
      const wrapStyle = formatedAttributes.style;
      let placeholerStyle = "";
      if (formatedAttributes.paddingBottom || formatedAttributes.placeholderImage) {
        placeholerStyle = `style="${
          formatedAttributes.paddingBottom
            ? `padding-bottom: ${formatedAttributes.paddingBottom};`
            : ""
        }${
          formatedAttributes.placeholderImage
            ? `background-image: ${formatedAttributes.placeholderImage}`
            : ""
        }"`;
      }
      const { formatedStr } = getformatedStr(
        str,
        formatedAttributes,
        formatedAttributes.placeholderImage
          ? `style="background-image: ${formatedAttributes.placeholderImage}; background-size: 100% 100%;"`
          : ""
      );

      const livePhotoInfo = enableGallery ? getLivePhotoInfo(src, wrapStyle || "") : null;
      const livePhotoThumbId = livePhotoInfo ? `live-photo-thumb-${livePhotoThumbIndex++}` : "";
      const livePhotoGalleryItem = livePhotoInfo
        ? `<a class="gallery-item live-photo-gallery-item" href="${escapeAttribute(
            livePhotoInfo.picUrl
          )}" data-pswp-width="${livePhotoInfo.width}" data-pswp-height="${
            livePhotoInfo.height
          }" data-cropped="true" data-pswp-thumb-id="${livePhotoThumbId}" data-live-photo-src="${encodeURIComponent(src)}" data-live-photo-pic-url="${escapeAttribute(
            livePhotoInfo.picUrl
          )}" target="_blank" rel="noopener" style="display: none;" aria-hidden="true"></a>`
        : "";

      return `<span class="lazyload-outer-wrap" style="width: 100%;">${livePhotoGalleryItem}<span class="lazyload-wrap" data-content="${encodeURIComponent(
        formatedStr
      )}" ${livePhotoThumbId ? `id="${livePhotoThumbId}"` : ""} ${
        wrapStyle ? `style="${wrapStyle}"` : ""
      }><span class="placeholder" ${placeholerStyle}></span></span><noscript>[This iframe content needs to be loaded by JavaScript.]</noscript></span>`;
    })
    .replace(/<video([\s\S]*?)src="(.*?)"([\s\S]*?)(>|<\/video>)/gi, function (str) {
      if (/no-lazy/gi.test(str)) {
        return str;
      }
      const formatedAttributes = formatAttributes(str);
      const wrapStyle = formatedAttributes.style;
      let placeholerStyle = "";
      if (formatedAttributes.paddingBottom || formatedAttributes.placeholderImage) {
        placeholerStyle = `style="${
          formatedAttributes.paddingBottom
            ? `padding-bottom: ${formatedAttributes.paddingBottom};`
            : ""
        }${
          formatedAttributes.placeholderImage
            ? `background-image: ${formatedAttributes.placeholderImage}`
            : ""
        }"`;
      }
      const { formatedStr, noScriptElementStr } = getformatedStr(
        str,
        formatedAttributes,
        formatedAttributes.placeholderImage
          ? `style="background-image: ${formatedAttributes.placeholderImage}; background-size: 100% 100%;"`
          : ""
      );

      return `<span class="lazyload-outer-wrap" style="width: 100%;"><span class="lazyload-wrap" data-content="${encodeURIComponent(
        formatedStr
      )}" ${
        wrapStyle ? `style="${wrapStyle}"` : ""
      }><span class="placeholder" ${placeholerStyle}></span></span><noscript>${noScriptElementStr}</noscript></span>`;
    });
}

module.exports.processPost = function (data) {
  data.content = lazyProcess.call(this, data.content);
  return data;
};

module.exports.processCovers = function (str, data) {
  try {
    const imgs = readAllImgs(path.join(this.base_dir, "assets-db/imgs"));
    const imgData = imgs.find((item) => isUrlEqual(item.url, data.page.cover || "" || ""));
    if (data?.page?.coverPlaceholder || imgData?.placeholder) {
      str = str.replace(
        '<div class="post-cover-img-wrap">',
        `<div class="post-cover-img-wrap" style="background-image: url(${
          data?.page?.coverPlaceholder || imgData?.placeholder
        })">`
      );
    }
    str = str.replace(
      /<div class="cover-img">\s*(<img\b[^>]*\bsrc="([^"]+)"[^>]*>)\s*<\/div>/gi,
      (coverStr, imgStr, src) => {
        if (/no-lazy/gi.test(imgStr)) {
          return coverStr.replace(/\s+\$?no-lazy\b/i, "");
        }

        const imgData = imgs.find((item) => isUrlEqual(item.url, src || ""));
        const placeholder = imgData?.placeholder || "";
        const contentImgStr = appendAttributeToTag(imgStr, "data-placeholderimg", placeholder);
        const placeholderStyle = getPlaceholderStyle(placeholder);

        return `<div class="cover-img"><noscript>${imgStr}</noscript><span class="lazyload-wrap post-list-cover-lazy" data-content="${encodeURIComponent(
          contentImgStr
        )}"><span class="placeholder"${
          placeholderStyle ? ` style="${placeholderStyle}"` : ""
        }></span></span></div>`;
      }
    );
  } catch (error) {
    console.log(error);
    return str;
  }
  return str;
};
