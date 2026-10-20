import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const productionDist = path.resolve("dist");
const verificationDist = path.resolve(".verification-dist");
const astroCli = path.resolve("node_modules", "astro", "bin", "astro.mjs");
const errors = [];

const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const componentViewports = [
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

const labelFor = ({ width, height }) => `${width}x${height}`;
const fail = (condition, message) => { if (condition) errors.push(message); };

const fileExists = async (filename) => {
  try { await access(filename); return true; } catch { return false; }
};

const parseHex = (value) => {
  const rgbMatch = value.trim().match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/i);
  if (rgbMatch) return rgbMatch.slice(1).map(Number);
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const expanded = match[1].length === 3 ? [...match[1]].map((character) => character.repeat(2)).join("") : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16));
};

const luminance = (rgb) => {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (first, second) => {
  const firstRgb = parseHex(first);
  const secondRgb = parseHex(second);
  if (!firstRgb || !secondRgb) return 0;
  const firstLuminance = luminance(firstRgb);
  const secondLuminance = luminance(secondRgb);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
};

const monitor = (page, label, allowedOrigin) => {
  page.on("pageerror", (error) => errors.push(`${label} page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console error: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
  page.on("requestfailed", (request) => errors.push(`${label} request failed: ${request.url()}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== allowedOrigin) {
      errors.push(`${label} made an external runtime request: ${request.url()}`);
    }
  });
};

const checkFocus = async (page, selector, label) => {
  const control = page.locator(selector).first();
  await control.focus();
  const focus = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: Number.parseFloat(style.outlineWidth), color: style.outlineColor };
  });
  fail(!Number.isFinite(focus.width) || focus.width < 2, `${label} has no substantial focus outline`);
  fail(focus.color === "transparent" || focus.color === "rgba(0, 0, 0, 0)", `${label} has a transparent focus outline`);
};

await rm(verificationDist, { recursive: true, force: true });

try {
  fail(!(await fileExists(path.join(productionDist, "index.html"))), "production output is missing; run npm run build before npm run verify");
  fail(await fileExists(path.join(productionDist, "assets", "README.md")), "author asset guidance is present in production output");
  fail(await fileExists(path.join(productionDist, "__verify-components", "index.html")), "verification fixture leaked into production output");
  fail(await fileExists(path.join(productionDist, "__verify-completion", "index.html")), "completion verification fixture leaked into production output");

  await execFileAsync(process.execPath, [astroCli, "build", "--outDir", verificationDist], {
    cwd: process.cwd(),
    env: { ...process.env, COURSE_VERIFY_COMPONENTS: "1", PUBLIC_COURSE_VERIFY: "1" },
  });

  fail(!(await fileExists(path.join(verificationDist, "__verify-components", "index.html"))), "component verification route was not generated");
  fail(!(await fileExists(path.join(verificationDist, "__verify-completion", "index.html"))), "completion verification route was not generated");
  fail(await fileExists(path.join(verificationDist, "assets", "README.md")), "author asset guidance leaked into the verification build");

  const mimeTypes = {
    ".css": "text/css",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      let target = path.resolve(verificationDist, `.${pathname}`);
      if (!target.startsWith(`${verificationDist}${path.sep}`) && target !== verificationDist) throw new Error("Invalid path");
      if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
      response.writeHead(200, { "Content-Type": mimeTypes[path.extname(target)] ?? "application/octet-stream" });
      response.end(await readFile(target));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of viewports) {
      const label = labelFor(viewport);
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      monitor(page, label, baseUrl);
      const response = await page.goto(baseUrl, { waitUntil: "networkidle" });

      fail(!response?.ok(), `${label} returned HTTP ${response?.status() ?? "unknown"}`);
      fail((await page.title()) !== "Content", `${label} metadata title is incorrect`);
      fail((await page.locator("[data-nav-section]").count()) !== 8, `${label} section navigation is incomplete`);
      fail((await page.locator('.eyebrow, .section-eyebrow, .qc-type--eyebrow').count()) !== 0, `${label} renders a learner-facing eyebrow label`);
      fail((await page.locator(".skip-link").count()) !== 1, `${label} skip link is missing`);
      fail((await page.locator(".footer-inner > p").textContent()) !== "Return to People Connect to continue", `${label} footer guidance text is incorrect`);
      fail((await page.locator(".footer-inner > p a, .footer-inner > p button").count()) !== 0, `${label} footer guidance text is interactive`);
      fail((await page.locator(".footer-inner > p").evaluate((element) => getComputedStyle(element).color)) !== "rgb(255, 255, 255)", `${label} footer guidance text is not white`);
      fail((await page.locator(".current-lesson, [data-current-lesson], [data-current-lesson-count]").count()) !== 0, `${label} current lesson strip remains in the header`);
      fail((await page.locator(".footer-inner > a").count()) !== 1 || !(await page.locator(".footer-inner > a").evaluate((element) => element.textContent?.includes("Back to top") && element.querySelector('[aria-hidden="true"]')?.textContent === "↑")), `${label} Back to top control or arrow changed`);
      fail(!(await page.locator(".course-footer").evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--course-accent)";
        document.body.append(probe);
        const matches = getComputedStyle(element).backgroundColor === getComputedStyle(probe).color;
        probe.remove();
        return matches;
      })), `${label} footer does not use the configurable course accent`);
      fail(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior !== "auto"), `${label} reduced-motion styles are not active`);
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${label} has horizontal overflow`);
      fail(await page.evaluate(() => Object.keys(localStorage).some((key) => key !== "astro-course-progress:nike-winflo-12:v1") || Object.keys(sessionStorage).length > 0), `${label} writes unexpected browser storage`);

      const courseTypography = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const heroHeading = getComputedStyle(document.querySelector(".hero h1"));
        const sectionHeading = getComputedStyle(document.querySelector(".section-heading h2"));
        return {
          bodySize: Number.parseFloat(body.fontSize),
          bodyLineHeight: Number.parseFloat(body.lineHeight),
          family: body.fontFamily,
          heroSize: Number.parseFloat(heroHeading.fontSize),
          sectionSize: Number.parseFloat(sectionHeading.fontSize),
        };
      });
      fail(Math.abs(courseTypography.bodySize - 18) > 0.1, `${label} does not use the 1.125rem course body size`);
      fail(courseTypography.bodyLineHeight < courseTypography.bodySize * 1.5, `${label} course body line height is too tight`);
      fail(!courseTypography.family.includes("Arial Nova"), `${label} does not expose the local Arial Nova fallback stack`);
      fail(courseTypography.heroSize < 30 || courseTypography.heroSize > 55, `${label} hero heading falls outside the visual-board scale`);

      const geometry = await page.evaluate(() => {
        const bounds = (selector) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect && { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        const selectors = [".site-header", ".course-nav", ".hero", ".hero-grid", ".winflo-carousel", ".winflo-practice", ".course-footer", ".footer-inner"];
        return {
          items: selectors.map((selector) => ({ selector, ...bounds(selector) })),
          header: bounds(".site-header"),
          hero: bounds(".hero"),
          nav: bounds(".course-nav"),
          heroContainer: bounds(".hero .container"),
          footerContainer: bounds(".footer-inner"),
        };
      });
      for (const item of geometry.items) {
        fail(item.left < -1 || item.right > viewport.width + 1, `${label} ${item.selector} is clipped or outside the viewport`);
      }
      fail(Math.abs(geometry.header.bottom - geometry.hero.top) > 1, `${label} has a gap or overlap below the sticky header`);
      fail(geometry.heroContainer.left < 15 || geometry.heroContainer.right > viewport.width - 15, `${label} hero panel lacks visible outer margins`);
      const headerPattern = await page.evaluate(() => {
        const nav = document.querySelector(".course-nav");
        const logo = document.querySelector(".brand-link");
        const lessons = document.querySelector(".lessons-toggle");
        const progress = document.querySelector("[data-progress-trigger]");
        const rect = (element) => {
          const bounds = element?.getBoundingClientRect();
          return bounds && { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
        };
        return {
          logoChildren: logo?.children.length,
          logoName: logo?.getAttribute("aria-label"),
          nav: rect(nav), logo: rect(logo), lessons: rect(lessons), progress: rect(progress),
          lessonsColor: getComputedStyle(lessons).color,
          chevronColor: getComputedStyle(lessons.querySelector("svg")).stroke,
          progressColor: getComputedStyle(progress).color,
          lessonsFontSize: getComputedStyle(lessons).fontSize,
          progressLabelFontSize: getComputedStyle(progress.querySelector("span")).fontSize,
          progressPercentFontSize: getComputedStyle(progress.querySelector("strong")).fontSize,
        };
      });
      fail(headerPattern.logoChildren !== 1 || !headerPattern.logoName, `${label} header brand is not logo-only with an accessible name`);
      fail(headerPattern.logo.right > headerPattern.lessons.left + 1 || headerPattern.lessons.right > headerPattern.progress.left + 1, `${label} logo, Lessons and Progress overlap`);
      fail(Math.abs(headerPattern.nav.right - headerPattern.progress.right) > 1, `${label} Progress is not aligned to the header's padded right edge`);
      fail([headerPattern.lessonsColor, headerPattern.chevronColor, headerPattern.progressColor].some((color) => color !== "rgb(255, 255, 255)"), `${label} navbar control text or chevron is not white`);
      fail(headerPattern.progressLabelFontSize !== headerPattern.lessonsFontSize || headerPattern.progressPercentFontSize !== headerPattern.lessonsFontSize, `${label} Progress label and percentage do not match the Lessons font size`);

      const progressTrigger = page.locator("[data-progress-trigger]");
      await checkFocus(page, "[data-progress-trigger]", `${label} progress trigger`);
      const pageWidthBeforeProgress = await page.locator(".course-page").evaluate((element) => element.getBoundingClientRect().width);
      await progressTrigger.press("Enter");
      const progressPanel = page.locator("[data-progress-panel]");
      fail((await progressTrigger.getAttribute("aria-expanded")) !== "true" || !(await progressPanel.isVisible()), `${label} progress dropdown did not open from the keyboard`);
      const progressTheme = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.backgroundColor = "var(--course-accent)";
        document.body.append(probe);
        const accent = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          accent,
          fill: getComputedStyle(document.querySelector("[data-progress-bar-fill]")).backgroundColor,
          track: getComputedStyle(document.querySelector("[data-progress-bar]")).backgroundColor,
        };
      });
      fail(progressTheme.fill !== progressTheme.accent, `${label} progress fill does not inherit the course accent token`);
      fail(progressTheme.track === progressTheme.accent, `${label} unfilled progress track is not neutral`);
      await page.locator("[data-progress-close]").hover();
      fail((await page.locator("[data-progress-close]").evaluate((element) => getComputedStyle(element).backgroundColor)) !== progressTheme.accent, `${label} progress close hover does not inherit the course accent token`);
      const panelGeometry = await progressPanel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, scrollable: element.scrollHeight > element.clientHeight };
      });
      fail(panelGeometry.left < -1 || panelGeometry.right > viewport.width + 1 || panelGeometry.top < -1 || panelGeometry.bottom > viewport.height + 1, `${label} progress dropdown escapes the viewport (${JSON.stringify(panelGeometry)})`);
      fail(Math.abs((await page.locator(".course-page").evaluate((element) => element.getBoundingClientRect().width)) - pageWidthBeforeProgress) > 1, `${label} progress dropdown shifts the page`);
      await page.keyboard.press("Escape");
      fail((await progressTrigger.getAttribute("aria-expanded")) !== "false" || await progressPanel.isVisible(), `${label} progress dropdown did not close with Escape`);
      fail(!(await progressTrigger.evaluate((element) => element === document.activeElement)), `${label} progress dropdown did not restore trigger focus`);
      await progressTrigger.click();
      await page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
      fail((await progressTrigger.getAttribute("aria-expanded")) !== "false", `${label} progress dropdown did not dismiss on outside click`);
      await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));

      const skipLink = page.locator(".skip-link");
      await skipLink.focus();
      fail(!(await skipLink.evaluate((element) => element === document.activeElement)) || !(await skipLink.isVisible()), `${label} skip link is not keyboard-visible`);
      await checkFocus(page, ".skip-link", `${label} skip link`);
      await skipLink.press("Enter");
      fail((await page.evaluate(() => location.hash)) !== "#main-content", `${label} skip link did not target main content`);

      const toggle = page.locator(".lessons-toggle");
      const lessonsPanel = page.locator(".course-links");
      fail(await lessonsPanel.isVisible() || (await toggle.getAttribute("aria-expanded")) !== "false", `${label} Lessons is not initially closed`);
      fail((await page.locator(".course-links a").count()) !== 8 || (await page.locator(".lessons-toggle").count()) !== 1, `${label} does not have exactly one eight-lesson menu`);
      await checkFocus(page, ".lessons-toggle", `${label} Lessons control`);
      await toggle.press("Enter");
      fail((await toggle.getAttribute("aria-expanded")) !== "true" || !(await lessonsPanel.isVisible()), `${label} Lessons did not open from the keyboard`);
      fail((await lessonsPanel.locator(".course-links__heading").textContent()) !== "Course lessons", `${label} Lessons panel heading is missing`);
      const lessonPanelGeometry = await lessonsPanel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      fail(lessonPanelGeometry.left < -1 || lessonPanelGeometry.right > viewport.width + 1 || lessonPanelGeometry.bottom > viewport.height + 1, `${label} Lessons panel escapes the viewport`);
      await progressTrigger.click();
      fail((await toggle.getAttribute("aria-expanded")) !== "false" || await lessonsPanel.isVisible(), `${label} Progress did not close Lessons`);
      await page.keyboard.press("Escape");
      await toggle.click();
      await toggle.press("Escape");
      fail((await toggle.getAttribute("aria-expanded")) !== "false" || await lessonsPanel.isVisible(), `${label} Lessons did not close with Escape`);
      fail(!(await toggle.evaluate((element) => element === document.activeElement)), `${label} Lessons did not restore focus after Escape`);
      await toggle.click();
      await page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
      fail((await toggle.getAttribute("aria-expanded")) !== "false", `${label} Lessons did not dismiss on outside click`);

      const expectedLessons = ["Welcome", "Product basics", "Shoe technology", "Customer fit", "What’s new", "Key selling message", "Customer scenario", "Practice knowledge check"];
      const lessonNumbers = viewport.width === 1366 ? [1, 2, 3, 4, 5, 6, 7, 8] : [2];
      for (const number of lessonNumbers) {
        await toggle.click();
        const lessonLink = lessonsPanel.locator(`a[href="#lesson-${number}"]`);
        fail((await lessonLink.locator("span").allTextContents()).join(" ") !== `${String(number).padStart(2, "0")} ${expectedLessons[number - 1]}`, `${label} lesson ${number} label or target is incorrect`);
        await checkFocus(page, `.course-links a[href="#lesson-${number}"]`, `${label} lesson ${number} link`);
        await lessonLink.press("Enter");
        fail((await toggle.getAttribute("aria-expanded")) !== "false" || await lessonsPanel.isVisible(), `${label} Lessons did not close after selection`);
        fail((await page.evaluate(() => location.hash)) !== `#lesson-${number}`, `${label} lesson ${number} link did not update the URL`);
        await page.waitForFunction((index) => document.querySelector(".course-links a[aria-current='location']")?.getAttribute("href") === `#lesson-${index}`, number);
        const anchorOffset = await page.evaluate((index) => ({
          headerBottom: document.querySelector(".site-header").getBoundingClientRect().bottom,
          targetTop: document.querySelector(`#lesson-${index}`).getBoundingClientRect().top,
        }), number);
        fail(anchorOffset.targetTop < anchorOffset.headerBottom - 1 || anchorOffset.targetTop > anchorOffset.headerBottom + 24, `${label} lesson ${number} anchor has incorrect header spacing`);
      }
      if (viewport.width === 320) {
        await page.setViewportSize({ width: 320, height: 360 });
        await toggle.click();
        const shortPanel = await lessonsPanel.evaluate((element) => ({ scrollable: element.scrollHeight > element.clientHeight, bottom: element.getBoundingClientRect().bottom }));
        fail(!shortPanel.scrollable || shortPanel.bottom > 361, "Lessons panel is not contained and scrollable on a short screen");
        await toggle.press("Escape");
        await page.setViewportSize(viewport);
      }

      const carouselNext = page.locator("#technology-carousel [data-carousel-next]");
      await checkFocus(page, "#technology-carousel [data-carousel-next]", `${label} carousel next control`);
      await carouselNext.press("Enter");
      fail((await page.locator("#technology-carousel [data-carousel-count]").textContent()) !== "2 of 6", `${label} technology carousel did not advance from the keyboard`);
      await page.locator("#technology-carousel [data-carousel-prev]").click();
      fail((await page.locator("#technology-carousel [data-carousel-count]").textContent()) !== "1 of 6", `${label} technology carousel did not move backward`);
      const firstOption = page.locator("#practice-1 input[value='1']");
      await firstOption.check();
      await page.locator("#practice-1 [type='submit']").click();
      fail(!(await page.locator("#practice-1 [data-practice-feedback]").textContent()).includes("Correct."), `${label} practice answer feedback is missing`);
      fail(!(await page.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:nike-winflo-12:v1") || "{}").completed?.includes("practice-1"))), `${label} practice attempt did not emit completion`);
      await page.locator("[data-practice-next]").click();
      fail((await page.locator("[data-practice-count]").textContent()) !== "Question 2 of 3", `${label} practice did not advance`);
      await page.locator("[data-practice-prev]").click();
      fail(!(await firstOption.isChecked()) || !(await page.locator("#practice-1 [data-practice-feedback]").isVisible()), `${label} practice response was not retained`);

      const matching = page.locator("#needs-match");
      fail((await matching.locator("[data-match-id]").count()) !== 6 || (await page.locator("#needs-carousel").count()) !== 0, `${label} Customer needs were not replaced with six matching prompts`);
      await checkFocus(page, "#needs-match select", `${label} matching response selector`);
      await matching.locator("[data-match-submit]").press("Enter");
      fail(!(await matching.locator("[data-match-feedback]").textContent()).includes("Choose at least one"), `${label} blank matching feedback is missing`);
      fail((await page.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:nike-winflo-12:v1") || "{}").completed?.includes("needs-match"))), `${label} blank matching submission counted as an attempt`);
      await matching.locator('[data-match-id="soft"] select').selectOption("heel");
      await matching.locator("[data-match-submit]").click();
      fail((await matching.locator('[data-match-id="soft"]').getAttribute("data-result")) !== "incorrect", `${label} incorrect matching feedback is missing`);
      fail(!(await page.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:nike-winflo-12:v1") || "{}").completed?.includes("needs-match"))), `${label} genuine matching attempt did not complete the milestone`);

      if (viewport.width === 1440) {
        for (const [carouselId, total] of [["technology-carousel", 6], ["fit-carousel", 5]]) {
          const carousel = page.locator(`#${carouselId}`);
          for (let item = 2; item <= total; item += 1) {
            await carousel.locator("[data-carousel-next]").click();
            fail((await carousel.locator("[data-carousel-count]").textContent()) !== `${item} of ${total}`, `${carouselId} count is incorrect at item ${item}`);
            fail((await carousel.locator(".winflo-carousel__slide:visible").count()) !== 1, `${carouselId} shows multiple items`);
          }
          fail(!(await carousel.locator("[data-carousel-next]").isDisabled()), `${carouselId} next control did not stop at the last item`);
          await carousel.locator("[data-carousel-prev]").click();
          fail((await carousel.locator("[data-carousel-count]").textContent()) !== `${total - 1} of ${total}`, `${carouselId} previous control did not work`);
        }
        for (const id of ["soft", "heel", "fit", "stable", "warm", "racing"]) await matching.locator(`[data-match-id="${id}"] select`).selectOption(id);
        await matching.locator("[data-match-submit]").click();
        fail((await matching.locator('[data-match-feedback]').textContent()) !== "All 6 matches are correct.", "correct matching feedback is missing");
        fail((await matching.locator('[data-match-id][data-result="correct"]').count()) !== 6, "not all six matching rows were marked correct");
        await matching.locator('[type="reset"]').click();
        fail((await matching.locator('select').evaluateAll((elements) => elements.some((element) => element.value !== ""))) || await matching.locator('[data-match-feedback]').isVisible(), "matching clear action did not reset selections and feedback");
        await page.locator("[data-practice-next]").click();
        await page.locator("#practice-2 input[value='0']").check();
        await page.locator("#practice-2 [type='submit']").click();
        fail((await page.locator("#practice-2 [data-practice-feedback]").getAttribute("data-result")) !== "incorrect", "question 2 incorrect feedback is missing");
        await page.locator("#practice-2 input[value='1']").check();
        await page.locator("#practice-2 [type='submit']").click();
        fail(!(await page.locator("#practice-2 [data-practice-feedback]").textContent()).includes("Correct."), "question 2 retry feedback is missing");
        await page.locator("[data-practice-next]").click();
        await page.locator("#practice-3 input[value='2']").check();
        await page.locator("#practice-3 [type='submit']").click();
        fail(!(await page.locator("#practice-3 [data-practice-feedback]").textContent()).includes("Correct."), "question 3 correct feedback is missing");
        const courseState = await page.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:nike-winflo-12:v1") || "{}"));
        for (const activityId of ["technology-carousel", "fit-carousel", "needs-match", "practice-1", "practice-2", "practice-3"]) {
          fail(!courseState.completed?.includes(activityId), `${activityId} did not complete in course-specific storage`);
        }
        const restoredPage = await context.newPage();
        await restoredPage.goto(baseUrl, { waitUntil: "networkidle" });
        fail((await restoredPage.locator('[data-progress-completed] [data-progress-target="needs-match"]').count()) !== 1, "Customer needs matching completion was not restored after reopening the course");
        await restoredPage.close();
      }

      await page.locator("#lesson-8").evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(100);
      fail((await page.locator('.course-links a[aria-current="location"]').getAttribute("href")) !== "#lesson-8", `${label} final section did not become the active navigation item`);

      const footerLink = page.locator(".footer-inner a");
      await checkFocus(page, ".footer-inner a", `${label} footer link`);
      const footerControl = await footerLink.evaluate((element) => {
        const style = getComputedStyle(element);
        const copyStyle = getComputedStyle(document.querySelector(".footer-inner p"));
        return {
          display: style.display,
          borderWidth: Number.parseFloat(style.borderWidth),
          radius: Number.parseFloat(style.borderRadius),
          shadow: style.boxShadow,
          fontSize: Number.parseFloat(style.fontSize),
          copySize: Number.parseFloat(copyStyle.fontSize),
          fontWeight: Number.parseInt(style.fontWeight, 10),
        };
      });
      fail(!["flex", "inline-flex"].includes(footerControl.display) || footerControl.borderWidth < 1 || footerControl.radius < 16 || footerControl.shadow === "none", `${label} Back to top capsule styling is incomplete`);
      fail(Math.abs(footerControl.fontSize - footerControl.copySize) > 0.1 || footerControl.fontWeight < 500 || footerControl.fontWeight > 600, `${label} Back to top typography does not match the footer copy at medium weight`);
      const footerLayout = await page.evaluate(() => {
        const footer = document.querySelector(".course-footer");
        const inner = document.querySelector(".footer-inner");
        const message = inner.querySelector("p");
        const control = inner.querySelector("a");
        const footerStyle = getComputedStyle(footer);
        const innerStyle = getComputedStyle(inner);
        const messageStyle = getComputedStyle(message);
        const innerRect = inner.getBoundingClientRect();
        const controlRect = control.getBoundingClientRect();
        return {
          footerPosition: footerStyle.position,
          direction: innerStyle.flexDirection,
          align: innerStyle.alignItems,
          justify: innerStyle.justifyContent,
          gap: Number.parseFloat(innerStyle.rowGap),
          paddingTop: Number.parseFloat(innerStyle.paddingTop),
          paddingRight: Number.parseFloat(innerStyle.paddingRight),
          paddingBottom: Number.parseFloat(innerStyle.paddingBottom),
          paddingLeft: Number.parseFloat(innerStyle.paddingLeft),
          minHeight: Number.parseFloat(innerStyle.minHeight),
          height: innerRect.height,
          textAlign: messageStyle.textAlign,
          controlHeight: controlRect.height,
          controlWidth: controlRect.width,
          innerWidth: innerRect.width,
        };
      });
      fail(footerLayout.footerPosition !== "static", `${label} footer is not in normal page flow`);
      if (viewport.width <= 430) {
        fail(footerLayout.direction !== "column" || footerLayout.align !== "center" || footerLayout.justify !== "center", `${label} mobile footer is not a centred vertical column`);
        fail(Math.abs(footerLayout.gap - 16) > 0.1, `${label} mobile footer gap is not 16px`);
        fail([footerLayout.paddingTop, footerLayout.paddingBottom].some((value) => Math.abs(value - 24) > 0.1) || [footerLayout.paddingLeft, footerLayout.paddingRight].some((value) => Math.abs(value - 20) > 0.1), `${label} mobile footer padding is incorrect`);
        fail(Math.abs(footerLayout.minHeight - 144) > 0.1 || footerLayout.height < 144, `${label} mobile footer does not maintain its 144px minimum height`);
        fail(footerLayout.textAlign !== "center", `${label} mobile footer message is not centred`);
        fail(footerLayout.controlHeight < 44 || footerLayout.controlWidth >= footerLayout.innerWidth - 40, `${label} mobile Back to top capsule does not retain its natural width and 44px touch height`);
      } else if (viewport.width > 1024) {
        fail(footerLayout.direction !== "row" || footerLayout.justify !== "space-between", `${label} desktop footer row changed`);
      }
      await footerLink.press("Enter");
      await page.waitForFunction(() => window.scrollY <= 1);
      fail((await page.evaluate(() => window.scrollY)) > 1, `${label} back-to-top control did not return to the document top`);

      if (viewport.width === 1024) {
        const tokens = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          return Object.fromEntries(["--surface", "--ink", "--course-accent", "--course-accent-strong", "--focus-on-light", "--focus-on-dark"].map((name) => [name, style.getPropertyValue(name).trim()]));
        });
        const heroTheme = await page.evaluate(() => {
          const root = document.documentElement;
          const hero = document.querySelector(".hero");
          const initial = getComputedStyle(hero).backgroundImage;
          root.style.setProperty("--course-accent", "#010203");
          const accentChanged = getComputedStyle(hero).backgroundImage !== initial;
          root.style.removeProperty("--course-accent");
          root.style.setProperty("--course-accent-strong", "#040506");
          const accentStrongChanged = getComputedStyle(hero).backgroundImage !== initial;
          root.style.removeProperty("--course-accent-strong");
          return { accentChanged, accentStrongChanged };
        });
        fail(!heroTheme.accentChanged || !heroTheme.accentStrongChanged, "Overview hero does not respond to both shared course accent tokens");
        fail(tokens["--course-accent"].toLowerCase() !== "#00a9e0", "course accent is not the Totalsports brand blue");
        fail(tokens["--focus-on-light"] !== tokens["--course-accent"], "light-surface focus ring does not inherit the Totalsports brand blue");
        fail(contrast(tokens["--focus-on-dark"], tokens["--ink"]) < 3, "dark-surface focus token has less than 3:1 contrast against the navigation/footer surface");
        fail(contrast(tokens["--focus-on-dark"], tokens["--course-accent-strong"]) < 3, "dark-surface focus token has less than 3:1 contrast against the course accent surface");

        if (!(await page.locator(".course-links").isVisible())) await page.locator(".lessons-toggle").click();

        await page.locator('.course-links a[href="#lesson-1"]').evaluate((element) => element.setAttribute("aria-current", "location"));
        const activeStyle = await page.locator('.course-links a[href="#lesson-1"]').evaluate((element) => {
          const style = getComputedStyle(element); return `${style.backgroundColor}|${style.borderLeftColor}`;
        });
        await page.locator('.course-links a[href="#lesson-2"]').hover();
        const hoverStyle = await page.locator('.course-links a[href="#lesson-2"]').evaluate((element) => {
          const style = getComputedStyle(element); return `${style.backgroundColor}|${style.borderLeftColor}`;
        });
        fail(activeStyle === hoverStyle, "navigation hover and active-section styles are not distinguishable");
      }

      await context.close();
    }

    {
      const label = "completion tracking fixture";
      const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      monitor(page, label, baseUrl);
      await page.addInitScript(() => localStorage.setItem("astro-course-progress:other-course:v1", JSON.stringify({ completed: ["keep-me"] })));
      const response = await page.goto(`${baseUrl}/__verify-completion/`, { waitUntil: "networkidle" });
      fail(!response?.ok(), `${label} returned HTTP ${response?.status() ?? "unknown"}`);

      const state = async () => page.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:verification-fixture:v1") || '{"completed":[],"watchRanges":{},"explored":{}}'));
      await page.locator("#fixture-view").evaluate((element) => element.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(300);
      await page.locator("#fixture-complete").evaluate((element) => element.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(700);
      fail((await state()).completed.includes("fixture-view"), `${label} completed VIEW without 900 ms continuous qualification`);
      await page.locator("#fixture-view").evaluate((element) => element.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(950);
      fail(!(await state()).completed.includes("fixture-view"), `${label} did not complete VIEW after 900 ms in the central zone`);

      await page.evaluate(() => {
        const video = document.querySelector("#fixture-watch");
        Object.defineProperty(video, "duration", { configurable: true, value: 100 });
        let ranges = [[0, 30], [70, 100]];
        Object.defineProperty(video, "played", { configurable: true, get: () => ({ length: ranges.length, start: (index) => ranges[index][0], end: (index) => ranges[index][1] }) });
        video.dispatchEvent(new Event("timeupdate"));
        window.__setFixtureRanges = (next) => { ranges = next; video.dispatchEvent(new Event("timeupdate")); };
      });
      fail((await state()).completed.includes("fixture-watch"), `${label} counted video seek gaps toward WATCH completion`);
      await page.evaluate(() => window.__setFixtureRanges([[0, 30], [0, 30], [70, 100]]));
      fail((await state()).completed.includes("fixture-watch"), `${label} counted replayed video ranges twice`);
      await page.evaluate(() => window.__setFixtureRanges([[20, 90]]));
      fail(!(await state()).completed.includes("fixture-watch"), `${label} did not merge unique video ranges to the 80% WATCH threshold`);

      await page.locator("#fixture-question button[type='submit']").click();
      fail((await state()).completed.includes("fixture-question"), `${label} completed a knowledge check on empty submission`);
      await page.locator("#fixture-question [data-completion-option]").check();
      fail((await state()).completed.includes("fixture-question"), `${label} completed a knowledge check on selection without submission`);
      await page.locator("#fixture-question button[type='submit']").click();
      fail(!(await state()).completed.includes("fixture-question"), `${label} did not complete a knowledge check on valid submission`);
      await page.locator("[data-match-submit]").click();
      fail((await state()).completed.includes("fixture-match"), `${label} completed matching without a selection`);
      await page.locator("[data-match-choice]").click();
      await page.locator("[data-match-submit]").click();
      fail(!(await state()).completed.includes("fixture-match"), `${label} did not complete matching after a genuine submitted attempt`);

      const firstTabState = await state();
      fail(!firstTabState.explored["fixture-tabs"]?.includes("first") || firstTabState.completed.includes("fixture-tabs"), `${label} did not preserve initial-tab partial recording`);
      await page.locator("#fixture-explore [data-explore-trigger]").nth(0).click();
      fail((await state()).completed.includes("fixture-explore"), `${label} completed EXPLORE before all child items`);
      await page.reload({ waitUntil: "networkidle" });
      fail((await page.locator('#fixture-explore [data-explore-item="one"]').getAttribute("data-explored")) !== "true", `${label} did not restore partial EXPLORE state`);
      await page.locator("#fixture-explore [data-explore-trigger]").nth(1).click();
      fail(!(await state()).completed.includes("fixture-explore"), `${label} did not complete EXPLORE after all child items`);
      await page.locator('#fixture-tabs [role="tab"]').nth(1).click();
      fail(!(await state()).completed.includes("fixture-tabs"), `${label} did not complete tab EXPLORE after the remaining tab`);
      await page.locator("#fixture-complete").click();
      await page.locator("#fixture-optional").click();
      const optionalPercent = await page.locator("[data-progress-percent]").textContent();
      fail(optionalPercent !== "100%", `${label} required flags did not produce equal-weight 100% completion`);

      const restoredBeforeReload = await state();
      await page.reload({ waitUntil: "networkidle" });
      const restoredAfterReload = await state();
      fail(JSON.stringify(restoredAfterReload.watchRanges["fixture-watch"]) !== JSON.stringify(restoredBeforeReload.watchRanges["fixture-watch"]), `${label} did not restore saved WATCH ranges`);
      fail((await page.locator("[data-progress-percent]").textContent()) !== "100%", `${label} did not restore completed progress`);

      await page.locator("[data-progress-trigger]").click();
      const panel = page.locator("[data-progress-panel]");
      fail(!(await panel.isVisible()) || (await panel.getAttribute("inert")) !== null, `${label} dropdown did not expose interactive content when open`);
      const firstLink = panel.locator("a[data-progress-target]").first();
      await firstLink.click();
      fail(await panel.isVisible(), `${label} activity navigation did not close the dropdown`);
      fail(!(await page.evaluate(() => location.hash.startsWith("#fixture-"))), `${label} activity navigation did not update the destination`);
      await page.locator("[data-progress-trigger]").click();
      await page.evaluate(() => window.dispatchEvent(new Event("course-progress:test-reset")));
      fail(await page.evaluate(() => localStorage.getItem("astro-course-progress:verification-fixture:v1") !== null), `${label} reset did not clear its course storage`);
      fail(!(await page.evaluate(() => localStorage.getItem("astro-course-progress:other-course:v1") !== null)), `${label} reset cleared another course's storage`);
      fail((await page.locator("[data-progress-percent]").textContent()) !== "0%", `${label} reset did not clear required completion`);
      fail((await panel.getAttribute("inert")) !== null, `${label} open dropdown unexpectedly became inert after reset`);
      await page.locator("[data-progress-close]").click();
      fail((await panel.getAttribute("inert")) === null || await panel.isVisible(), `${label} hidden dropdown remained keyboard-accessible`);
      await context.close();
    }

    for (const viewport of componentViewports) {
      const label = `components ${labelFor(viewport)}`;
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      monitor(page, label, baseUrl);
      const response = await page.goto(`${baseUrl}/__verify-components/`, { waitUntil: "networkidle" });

      fail(!response?.ok(), `${label} returned HTTP ${response?.status() ?? "unknown"}`);
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${label} has horizontal page overflow`);
      fail((await page.locator(".section-heading").count()) !== 2, `${label} did not render SectionHeading variants`);
      fail((await page.locator('.eyebrow, .section-eyebrow, .qc-type--eyebrow').count()) !== 0, `${label} component fixture renders an eyebrow label`);
      fail((await page.locator(".info-callout").count()) !== 3, `${label} did not render InfoCallout variants`);
      fail((await page.locator(".responsive-table").count()) !== 2, `${label} did not render ResponsiveTable variants`);
      fail((await page.locator('.dialogue[role="group"]').count()) !== 1, `${label} did not render the labelled DialogueBlock`);
      fail((await page.locator(".verification-typography .qc-type").count()) < 8, `${label} did not render TypeText role specimens`);
      fail((await page.locator(".verification-typography .qc-text-layout").count()) !== 4, `${label} did not render TextLayout specimens`);
      fail((await page.locator(".verification-typography .qc-quote").count()) !== 2, `${label} did not render QuoteBlock variants`);
      fail((await page.locator(".verification-typography .qc-statistic").count()) !== 1, `${label} did not render StatisticBlock`);
      fail((await page.locator(".verification-typography .qc-definition-list").count()) !== 1, `${label} did not render DefinitionList`);

      const typeRules = await page.evaluate(() => {
        const read = (selector) => getComputedStyle(document.querySelector(selector));
        const body = read("body");
        const roleDefault = read(".verification-role-default");
        const headingMedium = read(".verification-role-heading-md");
        const explicitWeight = read(".verification-role-explicit-weight");
        const localOverride = read(".verification-role-local-override");
        const compactRole = read(".qc-type--body-compact");
        const list = read(".verification-list");
        const defaultQuote = read(".qc-quote--family-sans");
        const serifQuote = read(".qc-quote--family-serif");
        const nativeSizes = [...document.querySelectorAll(".verification-native-headings > *")].map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        const columns = (selector) => getComputedStyle(document.querySelector(selector)).gridTemplateColumns.split(" ").filter(Boolean).length;
        return {
          bodySize: Number.parseFloat(body.fontSize),
          bodyLineHeight: Number.parseFloat(body.lineHeight),
          bodyFamily: body.fontFamily,
          roleDefaultWeight: roleDefault.fontWeight,
          headingMediumSize: Number.parseFloat(headingMedium.fontSize),
          headingMediumWeight: headingMedium.fontWeight,
          explicitWeight: explicitWeight.fontWeight,
          localOverrideSize: Number.parseFloat(localOverride.fontSize),
          compactSize: Number.parseFloat(compactRole.fontSize),
          listStyle: list.listStyleType,
          defaultQuoteFamily: defaultQuote.fontFamily,
          serifQuoteFamily: serifQuote.fontFamily,
          nativeSizes,
          twoColumns: columns(".qc-text-layout--two-equal"),
          pullQuoteColumns: columns(".qc-text-layout--pull-quote"),
          threeColumns: columns(".qc-text-layout--three"),
        };
      });
      fail(Math.abs(typeRules.bodySize - 18) > 0.1, `${label} body role is not 1.125rem`);
      fail(typeRules.bodyLineHeight < typeRules.bodySize * 1.5, `${label} body role line height is below 1.5`);
      fail(!typeRules.bodyFamily.includes("Arial Nova"), `${label} sans stack does not start with the local Arial Nova option`);
      fail(typeRules.roleDefaultWeight !== "700", `${label} TypeText default weight overrides the heading-large role weight`);
      fail(typeRules.headingMediumWeight !== "650", `${label} heading-medium role weight is incorrect`);
      fail(typeRules.explicitWeight !== "500", `${label} explicit TypeText weight did not override the role weight`);
      fail(Math.abs(typeRules.localOverrideSize - 32) > 0.1 || Math.abs(typeRules.localOverrideSize - typeRules.headingMediumSize) < 1, `${label} scoped size override is missing or leaked`);
      fail(typeRules.listStyle === "none", `${label} native list markers were not restored after the CSS reset`);
      fail(!typeRules.defaultQuoteFamily.includes("Arial Nova"), `${label} QuoteBlock does not default to sans`);
      fail(!typeRules.serifQuoteFamily.includes("Georgia"), `${label} QuoteBlock serif option is unavailable`);
      fail(typeRules.nativeSizes.length !== 6 || typeRules.nativeSizes.some((size, index) => index > 0 && size > typeRules.nativeSizes[index - 1] + 0.1), `${label} native h1-h6 defaults do not form a complete hierarchy`);
      const expectedColumns = viewport.width < 640 ? 1 : 2;
      fail(typeRules.twoColumns !== expectedColumns || typeRules.pullQuoteColumns !== expectedColumns, `${label} two-column typography layouts do not stack responsively`);
      fail(typeRules.threeColumns !== (viewport.width < 960 ? 1 : 3), `${label} three-column typography layout uses the wrong responsive column count`);

      await page.evaluate(() => document.body.classList.add("verification-course-override"));
      await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.body).fontSize) === 20);
      const courseOverride = await page.evaluate(() => {
        const bodySize = Number.parseFloat(getComputedStyle(document.body).fontSize);
        const headingSize = Number.parseFloat(getComputedStyle(document.querySelector(".verification-role-default")).fontSize);
        const compactSize = Number.parseFloat(getComputedStyle(document.querySelector(".qc-type--body-compact")).fontSize);
        return { bodySize, headingSize, compactSize };
      });
      await page.evaluate(() => document.body.classList.remove("verification-course-override"));
      await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.body).fontSize) === 18);
      const restoredBodySize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).fontSize));
      fail(Math.abs(courseOverride.bodySize - 20) > 0.1, `${label} course-wide body-size override produced ${courseOverride.bodySize}px instead of 20px`);
      fail(courseOverride.headingSize <= typeRules.headingMediumSize, `${label} responsive course-wide heading override did not affect its intended role`);
      fail(Math.abs(courseOverride.compactSize - typeRules.compactSize) > 0.1, `${label} course-wide role override changed unrelated compact text`);
      fail(Math.abs(restoredBodySize - 18) > 0.1, `${label} course-wide override did not restore cleanly`);

      const alignments = await page.locator(".section-heading").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).textAlign));
      fail(alignments[0] !== "center" || alignments[1] !== "left", `${label} SectionHeading alignment variants are incorrect`);

      const calloutBackgrounds = await page.locator(".info-callout").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor));
      fail(new Set(calloutBackgrounds).size !== 3, `${label} InfoCallout tone variants are not distinct`);

      for (const table of ["#fixture-table-light", "#fixture-table-dark"]) {
        const region = page.locator(table);
        const containment = await region.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
          hint: element.getAttribute("aria-describedby"),
        }));
        fail(containment.left < -1 || containment.right > viewport.width + 1, `${label} ${table} escapes its container`);
        fail(!containment.hint || (await page.locator(`#${containment.hint}`).count()) !== 1, `${label} ${table} is not associated with its scroll hint`);
        if (viewport.width === 320) fail(containment.scrollWidth <= containment.clientWidth, `${label} ${table} did not exercise contained horizontal scrolling`);
        await checkFocus(page, table, `${label} ${table}`);
      }

      await checkFocus(page, ".info-callout--navy a", `${label} dark callout link`);

      const dialogue = await page.locator(".dialogue").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const blocks = [...element.children].map((child) => child.getBoundingClientRect());
        const paragraph = element.querySelector("p");
        const style = getComputedStyle(paragraph);
        return {
          left: rect.left,
          right: rect.right,
          overlaps: blocks.some((block, index) => index > 0 && block.top < blocks[index - 1].bottom - 1),
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize),
        };
      });
      fail(dialogue.left < -1 || dialogue.right > viewport.width + 1 || dialogue.overlaps, `${label} dialogue is clipped or overlapping`);
      fail(dialogue.lineHeight < dialogue.fontSize * 1.4, `${label} dialogue line spacing is too tight`);

      await context.close();
    }

    const resizeContext = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const resizePage = await resizeContext.newPage();
    monitor(resizePage, "components 200% browser-zoom equivalent", baseUrl);
    const resizeResponse = await resizePage.goto(`${baseUrl}/__verify-components/`, { waitUntil: "networkidle" });
    fail(!resizeResponse?.ok(), `components 200% browser-zoom equivalent returned HTTP ${resizeResponse?.status() ?? "unknown"}`);
    const resized = await resizePage.evaluate(() => ({
      cssWidth: window.innerWidth,
      deviceScaleFactor: window.devicePixelRatio,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      clippedText: [...document.querySelectorAll(".qc-type")].some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
      }),
    }));
    fail(resized.cssWidth !== 640 || resized.deviceScaleFactor !== 2, "200% browser-zoom equivalent did not use the expected 640 CSS-pixel viewport at 2x scale");
    fail(resized.overflow || resized.clippedText, "typography fixture overflows or clips at the 200% browser-zoom equivalent");
    await resizeContext.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
} catch (error) {
  errors.push(`verification setup failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await rm(verificationDist, { recursive: true, force: true });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Course verification passed: ${viewports.map(labelFor).join(", ")}; responsive navigation, progress dropdown, anchors, active-section and back-to-top capsule behaviour; carousel and practice interactions; keyboard and reduced-motion support; completion types, persistence, internal test reset and storage isolation; shared-token hero, progress and focus theming; typography roles and overrides; a 200% browser-zoom equivalent; and reusable component fixtures at ${componentViewports.map(labelFor).join(", ")}.`);
}
