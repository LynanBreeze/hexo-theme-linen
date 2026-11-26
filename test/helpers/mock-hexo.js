"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "../..");

function createMockHexo(overrides = {}) {
  const filters = {};
  const helpers = {};
  const generators = {};
  const routes = new Map();

  const mockHexo = {
    base_dir: overrides.base_dir || ROOT_DIR,
    theme_dir: overrides.theme_dir || ROOT_DIR,
    config: {
      title: "Linen Test",
      description: "Test site",
      url: "https://example.com",
      root: "/",
      language: "zh-CN",
      theme_config: {},
      ...(overrides.config || {}),
    },
    theme: {
      config: {
        version: "1.0.59",
        ...(overrides.themeConfig || {}),
      },
    },
    locals: {
      get: (key) => (overrides.locals ? overrides.locals[key] : undefined),
    },
    render: {
      renderSync: ({ text }) => `<p>${String(text || "").trim()}</p>`,
      ...(overrides.render || {}),
    },
    route: {
      set: (routePath, data) => routes.set(routePath, data),
      get: (routePath) => routes.get(routePath),
      list: () => Array.from(routes.keys()),
    },
    extend: {
      filter: {
        register(name, fn) {
          (filters[name] ||= []).push(fn);
        },
      },
      helper: {
        register(name, fn) {
          helpers[name] = fn;
        },
        get(name) {
          return helpers[name];
        },
      },
      generator: {
        register(name, fn) {
          generators[name] = fn;
        },
      },
    },
    _filters: filters,
    _helpers: helpers,
    _generators: generators,
    _routes: routes,
  };

  return mockHexo;
}

function loadHexoScript(relPath, mockHexo) {
  const fullPath = path.resolve(ROOT_DIR, relPath);
  const code = fs.readFileSync(fullPath, "utf8");
  const mod = { exports: {} };
  const wrapper = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname, hexo) {\n${code}\n})`,
    { filename: fullPath },
  );
  const localRequire = (id) =>
    require(id.startsWith(".") ? path.resolve(path.dirname(fullPath), id) : id);
  wrapper(
    mod.exports,
    localRequire,
    mod,
    fullPath,
    path.dirname(fullPath),
    mockHexo,
  );
  return mod.exports;
}

module.exports = {
  ROOT_DIR,
  createMockHexo,
  loadHexoScript,
};
