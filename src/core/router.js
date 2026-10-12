/**
 * 支援動態參數的 Hash Router。
 * routes: { "/trips": renderFn, "/trips/:id": renderFn, ... }
 * renderFn(container, params) 負責把畫面畫進 container，params 是路由參數物件。
 */
function compileRoute(pattern) {
  const paramNames = [];
  const regexStr = pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

export function createRouter(routes, { container, defaultPath, onNavigate }) {
  const compiled = Object.entries(routes).map(([pattern, render]) => ({
    pattern,
    render,
    ...compileRoute(pattern),
  }));

  function matchPath(path) {
    for (const route of compiled) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
        return { route, params };
      }
    }
    return null;
  }

  function render() {
    const hash = window.location.hash.replace(/^#/, "") || defaultPath;
    const matched = matchPath(hash) || matchPath(defaultPath);
    container.innerHTML = "";
    matched.route.render(container, matched.params);
    if (onNavigate) onNavigate(matched.route.pattern, matched.params, hash);
  }

  window.addEventListener("hashchange", render);

  return {
    start() {
      if (!window.location.hash) {
        window.location.hash = defaultPath;
      } else {
        render();
      }
    },
    navigate(path) {
      window.location.hash = path;
    },
  };
}
