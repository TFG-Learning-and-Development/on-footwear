// Course data uses logical routes such as /lesson-2/. The package writes an
// explicit marker so LMS navigation can target the actual lesson HTML files.
export function courseUrl(path: string): string {
  const current = document.querySelector<HTMLElement>("[data-course-path]")?.dataset.coursePath || "/";
  const root = new URL(current === "/" ? "./" : "../", window.location.href);
  const relative = path.replace(/^\/+/, "");
  const packaged = document.documentElement.dataset.scormPackage === "true";
  const target = new URL(packaged ? `${relative}index.html` : relative, root);
  return `${target.pathname}${target.search}${target.hash}`;
}
