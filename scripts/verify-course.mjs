import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const productionDist = path.resolve("dist");
const verificationDist = path.resolve(".verification-dist");
const astroCli = path.resolve("node_modules", "astro", "bin", "astro.mjs");
const routes = ["/", ...Array.from({ length: 6 }, (_, index) => `/lesson-${index + 1}/`)];
const titles = ["Welcome to ON: Match the Move", "Decode the Shoe: ON and Running Fundamentals", "Everyday Running: Comfort, Support or Energy", "Performance Running: Train Fast, Race Ready", "Outdoor: Choose the Terrain", "Training and Lifestyle: Match the Movement", "Become an ON Footwear Specialist"];
const firstSectionSelectors = [".l0-customers", ".l1-profiles", ".l2-sipho", ".l3-anele", ".l4-lerato", ".l5-thabo", ".run-framework"];
const viewports = [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
const storageKey = "astro-course-progress:on-match-the-move:v3";
const lessonRequirementCounts = [7, 11, 7, 7, 7, 7, 5];
const errors = [];
const fail = (condition, message) => { if (condition) errors.push(message); };
const exists = async (filename) => { try { await access(filename); return true; } catch { return false; } };
const monitor = (page, label, origin) => {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${label}: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${label}: HTTP ${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    if (failure === "net::ERR_ABORTED") return;
    errors.push(`${label}: request failed ${request.url()} (${failure || "unknown error"})`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== origin) errors.push(`${label}: external request ${url}`);
  });
};

await rm(verificationDist, { recursive: true, force: true });
try {
  for (const route of routes) {
    const output = path.join(productionDist, route === "/" ? "index.html" : `${route.slice(1)}index.html`);
    fail(!(await exists(output)), `Production route missing: ${route}`);
  }
  await execFileAsync(process.execPath, [astroCli, "build", "--outDir", verificationDist], {
    cwd: process.cwd(), env: { ...process.env, COURSE_VERIFY_COMPONENTS: "1", PUBLIC_COURSE_VERIFY: "1" },
  });
  fail(!(await exists(path.join(verificationDist, "__verify-components", "index.html"))), "Component fixture missing");
  fail(!(await exists(path.join(verificationDist, "__verify-completion", "index.html"))), "Completion fixture missing");
  fail(await exists(path.join(productionDist, "__verify-completion", "index.html")), "Verification fixture leaked into production");

  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
      let target = path.resolve(verificationDist, `.${pathname}`);
      if (!target.startsWith(`${verificationDist}${path.sep}`) && target !== verificationDist) throw new Error("Invalid path");
      if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
      response.writeHead(200, { "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream" });
      response.end(await readFile(target));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const setupPage = await browser.newPage();
    await setupPage.goto(origin, { waitUntil: "networkidle" });
    const allMilestones = JSON.parse(await setupPage.locator("[data-course-progress-config]").textContent()).milestones;
    await setupPage.close();
    const completedThrough = (lessonIndex) => {
      const requirements = allMilestones.filter((milestone) => routes.indexOf(milestone.path) <= lessonIndex);
      return {
        completed: requirements.map((milestone) => milestone.id),
        watchRanges: {},
        explored: Object.fromEntries(requirements.filter((milestone) => milestone.type === "explore").map((milestone) => [milestone.id, milestone.requiredItems])),
        ui: {},
      };
    };
    const seedProgress = async (context, throughLesson) => context.addInitScript(({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    }, { key: storageKey, state: completedThrough(throughLesson) });
    for (let lessonIndex = 0; lessonIndex < routes.length; lessonIndex += 1) {
      const checklistContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      if (lessonIndex > 0) await seedProgress(checklistContext, lessonIndex - 1);
      const checklistPage = await checklistContext.newPage();
      monitor(checklistPage, `Lesson ${lessonIndex} activity checklist`, origin);
      await checklistPage.goto(`${origin}${routes[lessonIndex]}`, { waitUntil: 'networkidle' });
      await checklistPage.locator('[data-progress-trigger]').click();
      await checklistPage.locator('[data-activity-checklist] summary').click();
      const audit = await checklistPage.evaluate((key) => {
        const config = JSON.parse(document.querySelector('[data-course-progress-config]').textContent);
        const path = document.querySelector('[data-course-path]').dataset.coursePath;
        const expected = config.milestones.filter((milestone) => milestone.required && milestone.path === path);
        const completed = new Set(JSON.parse(localStorage.getItem(key) || '{"completed":[]}').completed);
        const items = [...document.querySelectorAll('[data-checklist-activity]')].map((item) => ({ id: item.dataset.checklistActivity, label: item.querySelector('a, span')?.textContent, state: item.dataset.checklistState, href: item.querySelector('a')?.getAttribute('href') || null }));
        return { expected, completed: [...completed], items, count: document.querySelector('[data-checklist-count]').textContent, guidance: document.querySelector('[data-checklist-guidance]').textContent };
      }, storageKey);
      fail(audit.items.length !== lessonRequirementCounts[lessonIndex], `Lesson ${lessonIndex} checklist does not contain every required activity`);
      fail(audit.count !== `${audit.expected.filter((milestone) => audit.completed.includes(milestone.id)).length} of ${audit.expected.length} completed`, `Lesson ${lessonIndex} checklist count is incorrect`);
      fail(!audit.guidance.includes('left to') && audit.expected.some((milestone) => !audit.completed.includes(milestone.id)), `Lesson ${lessonIndex} checklist lacks unlock guidance`);
      audit.expected.forEach((milestone, index) => {
        const item = audit.items[index];
        fail(item?.id !== milestone.id || item?.label !== milestone.label, `Lesson ${lessonIndex} checklist label or order differs from the central registry for ${milestone.id}`);
        fail(item?.state !== (audit.completed.includes(milestone.id) ? 'completed' : 'outstanding'), `Lesson ${lessonIndex} checklist status differs from saved progress for ${milestone.id}`);
        fail(!audit.completed.includes(milestone.id) && item?.href !== `${routes[lessonIndex]}#${milestone.targetId}`, `Lesson ${lessonIndex} outstanding activity ${milestone.id} has no working anchor`);
      });
      if (lessonIndex === 0) {
        await checklistPage.locator('[data-checklist-activity="lesson-0-check"] a').click();
        fail(!(await checklistPage.locator('[data-assessment-slide="1"]').isVisible()), 'Checklist did not reveal the hidden knowledge-check question');
        await checklistPage.waitForFunction(() => document.activeElement?.id === 'lesson-0-check-heading');
      }
      await checklistContext.close();
    }
    for (const width of [320, 375, 768, 1280]) {
      const jumpContext = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
      await seedProgress(jumpContext, 0);
      const jumpPage = await jumpContext.newPage();
      monitor(jumpPage, `${width}px activity navigation`, origin);
      await jumpPage.goto(`${origin}/lesson-1/`, { waitUntil: 'networkidle' });
      await jumpPage.locator('[data-progress-trigger]').click();
      await jumpPage.locator('[data-activity-checklist] summary').click();
      fail(await jumpPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${width}px expanded checklist caused horizontal overflow`);
      await jumpPage.locator('[data-checklist-activity="lesson-1-measure"] a').click();
      await jumpPage.waitForFunction(() => document.activeElement?.closest('#lesson-1-measure'));
      fail(await jumpPage.locator('[data-progress-panel]').isVisible(), `${width}px checklist did not close after navigating to an activity`);
      fail((await jumpPage.locator('#lesson-1-measure').getAttribute('data-checklist-highlight')) !== 'true', `${width}px checklist jump did not highlight the activity`);
      fail(await jumpPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${width}px checklist navigation caused horizontal overflow`);
      await jumpContext.close();
    }
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    monitor(freshPage, "fresh sequential access", origin);
    await freshPage.goto(`${origin}/lesson-6/`, { waitUntil: "networkidle" });
    await freshPage.waitForURL(origin + "/");
    fail(new URL(freshPage.url()).pathname !== "/", "Fresh learner bypassed locks through a direct Lesson 6 URL");
    fail(!(await freshPage.locator('[data-access-notice]').isVisible()), "Direct URL redirect did not explain the lock");
    fail((await freshPage.locator('[data-progress-lesson][data-lesson-state="locked"]').count()) !== 6, "Lessons 1–6 did not start locked");
    fail((await freshPage.locator('[data-progress-lesson="lesson-1"] a').count()) !== 0, "Locked lesson remained clickable in Progress");
    await freshPage.locator('[data-progress-trigger]').click();
    fail(!(await freshPage.locator('[data-progress-lesson="lesson-1"] .course-progress__lock svg').isVisible()), "Locked Progress row lacks a lock icon");
    fail((await freshPage.locator('[data-progress-lesson="lesson-1"] .course-progress__lesson-bar').evaluate((element) => getComputedStyle(element).height)) !== '7px', "Lesson progress bar lost its shared styling");
    await freshPage.locator('[data-progress-close]').click();
    fail((await freshPage.locator('.lesson-navigation__link--next').getAttribute('href')) !== null, "Fresh learner could use the next-lesson card");
    fail((await freshPage.locator('[data-next-reason]').textContent()).trim() !== 'Complete Lesson 0 to 100% before continuing.', "Locked next-lesson card lacks a clear requirement");
    await freshPage.locator('.lessons-toggle').click();
    fail((await freshPage.locator('.course-links a[data-lesson-path="/lesson-1/"]').getAttribute('href')) !== null, "Fresh learner could use a locked top-navigation link");
    fail(!(await freshPage.locator('.course-links a[data-lesson-path="/lesson-1/"] [data-lock-reason]').isVisible()), "Locked top-navigation link lacks a reason");
    await freshPage.locator('.lessons-toggle').click();
    await freshPage.locator('#lesson-0-why').evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await freshPage.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || '{"completed":[]}').completed.includes('lesson-0-why'), storageKey);
    fail((await freshPage.locator('[data-checklist-activity="lesson-0-why"]').getAttribute('data-checklist-state')) !== 'completed', 'Checklist did not update immediately after a VIEW milestone');
    fail((await freshPage.locator('[data-progress-lesson="lesson-0"]').getAttribute('data-lesson-state')) !== 'in-progress', "Partial Lesson 0 progress was not shown");
    fail((await freshPage.locator('.lesson-navigation__link--next').getAttribute('href')) !== null, "Partial Lesson 0 completion unlocked Lesson 1");
    await freshPage.goto(`${origin}/lesson-1/`, { waitUntil: 'networkidle' });
    await freshPage.waitForURL(origin + '/');
    fail(new URL(freshPage.url()).pathname !== '/', "Partial Lesson 0 progress bypassed the Lesson 1 route guard");
    await freshContext.close();
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      await seedProgress(context, 5);
      await context.addInitScript(() => localStorage.setItem("astro-course-progress:previous-course:v3", JSON.stringify({ completed: ["lesson-1"] })));
      const page = await context.newPage();
      monitor(page, `${viewport.width}px course`, origin);
      for (let index = 0; index < routes.length; index += 1) {
        if (index === 0) {
          const response = await page.goto(`${origin}${routes[index]}`, { waitUntil: "networkidle" });
          fail(!response?.ok(), `${viewport.width}px ${routes[index]} did not load`);
        } else await page.waitForLoadState("networkidle");
        fail(new URL(page.url()).pathname !== routes[index], `${viewport.width}px ${routes[index]} did not load`);
        fail((await page.title()) !== "Content", `${routes[index]} browser title changed`);
        fail((await page.locator("main h1").textContent()) !== titles[index], `${routes[index]} heading changed`);
        const adjacentHeadingGaps = await page.locator("main h1 + h2").evaluateAll((headings) => headings.map((heading) => ({
          gap: heading.getBoundingClientRect().top - heading.previousElementSibling.getBoundingClientRect().bottom,
          first: heading.previousElementSibling.textContent?.trim(),
          second: heading.textContent?.trim(),
        })));
        for (const headings of adjacentHeadingGaps) fail(headings.gap < 31.5, `${viewport.width}px ${routes[index]} adjacent headings are crowded: ${JSON.stringify(headings)}`);
        const headingCopyGaps = await page.locator("main h2 + p").evaluateAll((paragraphs) => paragraphs.map((paragraph) => ({
          gap: paragraph.getBoundingClientRect().top - paragraph.previousElementSibling.getBoundingClientRect().bottom,
          heading: paragraph.previousElementSibling.textContent?.trim(),
        })));
        for (const item of headingCopyGaps) fail(item.gap < 7.5, `${viewport.width}px ${routes[index]} heading and copy are crowded: ${JSON.stringify(item)}`);
        const layoutSpacing = await page.evaluate((selector) => {
          const section = document.querySelector(selector);
          const hero = document.querySelector(".l0-hero, .l1-hero, .l2-hero, .l3-hero, .l4-hero, .l5-hero, .l6-hero");
          const overlap = document.querySelector(".l0-why, .l1-purpose, .l2-purpose, .l3-purpose, .l4-purpose, .l5-purpose, .l6-purpose");
          return {
            sectionTop: Number.parseFloat(getComputedStyle(section).paddingTop),
            sectionBottom: Number.parseFloat(getComputedStyle(section).paddingBottom),
            overlap: hero.getBoundingClientRect().bottom - overlap.getBoundingClientRect().top,
          };
        }, firstSectionSelectors[index]);
        fail(layoutSpacing.sectionTop < 47.5 || layoutSpacing.sectionTop > 96.5 || layoutSpacing.sectionBottom < 47.5 || layoutSpacing.sectionBottom > 96.5, `${viewport.width}px ${routes[index]} section spacing changed: ${JSON.stringify(layoutSpacing)}`);
        fail(layoutSpacing.overlap < 80 || layoutSpacing.overlap > 200, `${viewport.width}px ${routes[index]} approved hero overlap changed: ${JSON.stringify(layoutSpacing)}`);
        fail((await page.locator(".course-links a").count()) !== 7, `${routes[index]} lesson navigation incomplete`);
        fail(await page.locator(".course-links").isVisible(), `${routes[index]} lesson links are visible outside the dropdown`);
        fail(!(await page.locator(".lessons-toggle").isVisible()), `${routes[index]} Lessons control is hidden`);
        for (const selector of [".lessons-toggle", ".course-progress__trigger"]) {
          const colours = await page.locator(selector).evaluate((element) => ({ text: getComputedStyle(element).color, border: getComputedStyle(element).borderTopColor }));
          fail(colours.text !== "rgb(255, 255, 255)" || colours.border !== "rgb(255, 255, 255)", `${routes[index]} ${selector} is not white`);
        }
        fail((await page.locator('.course-links a[aria-current="page"]').getAttribute("href")) !== routes[index], `${routes[index]} active link incorrect`);
        const config = JSON.parse(await page.locator("[data-course-progress-config]").textContent());
        fail(config.storageKey !== storageKey || config.milestones.length !== 51 || config.completionEnabled !== true, `${routes[index]} course requirement configuration is incorrect`);
        fail(new Set(config.milestones.map((milestone) => milestone.id)).size !== 51 || new Set(config.milestones.map((milestone) => milestone.targetId)).size !== 51, `${routes[index]} milestone IDs are not unique`);
        fail(config.milestones.filter((milestone) => milestone.path === routes[index]).length !== lessonRequirementCounts[index], `${routes[index]} lesson milestone count is incorrect`);
        fail((await page.locator('[data-progress-lesson]').count()) !== 7, `${routes[index]} progress dropdown must contain all seven lessons`);
        fail((await page.locator(".footer-inner > p").textContent()) !== "Return to People Connect to continue", `${routes[index]} footer text changed`);
        fail((await page.locator(".footer-inner > p a, .footer-inner > p button").count()) !== 0, `${routes[index]} footer message is interactive`);
        const footerColours = await page.locator(".course-footer").evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, text: getComputedStyle(element.querySelector("p")).color }));
        fail(footerColours.background !== "rgb(0, 0, 0)" || footerColours.text !== "rgb(255, 255, 255)", `${routes[index]} footer contrast changed`);
        fail((await page.locator(".skip-link").count()) !== 1, `${routes[index]} skip link missing`);
        fail((await page.locator(".footer-inner > a").textContent()) !== "Back to top↑", `${routes[index]} Back to top changed`);
        fail((await page.locator(".eyebrow, .section-eyebrow, .qc-type--eyebrow").count()) !== 0, `${routes[index]} includes an eyebrow`);
        fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${viewport.width}px ${routes[index]} horizontal overflow`);
        fail(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior !== "auto"), `${routes[index]} reduced-motion setting missing`);
        const type = await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily);
        fail(!/Arial Nova|Arial/.test(type), `${routes[index]} lost shared typography`);
        if (index === 0) {
          const motifAcrossBoundary = await page.evaluate(() => {
            const logo = document.querySelector('.l0-transition__motif img')?.getBoundingClientRect();
            const boundary = document.querySelector('.l0-assessment')?.getBoundingClientRect().top;
            return { crosses: logo && boundary !== undefined && logo.top < boundary && logo.bottom > boundary, top: logo?.top, bottom: logo?.bottom, boundary };
          });
          fail(!motifAcrossBoundary.crosses, `${viewport.width}px ON logo misses the section transition (${JSON.stringify(motifAcrossBoundary)})`);
          await page.locator("[data-progress-trigger]").click();
          fail(!(await page.locator("[data-progress-panel]").isVisible()), "Progress dropdown did not open");
          await page.locator("[data-progress-close]").click();
          fail(await page.locator("[data-progress-panel]").isVisible(), "Progress dropdown did not close");
          await page.locator(".lessons-toggle").click();
          fail(!(await page.locator(".course-links").isVisible()), "Lesson disclosure did not open");
          await page.keyboard.press("Escape");
          fail(await page.locator(".course-links").isVisible(), "Escape did not close lesson disclosure");
        }
        if (index < 6) {
          await page.locator('.lesson-navigation__link--next').click();
          fail(new URL(page.url()).pathname !== routes[index + 1], `${routes[index]} next lesson link failed`);
          fail((await page.locator('.lesson-navigation__link--previous').getAttribute('href')) !== routes[index], `${routes[index + 1]} previous lesson link failed`);
        }
      }
      await page.locator(".lessons-toggle").click();
      await page.locator('.course-links a[href="/"]').click();
      fail(new URL(page.url()).pathname !== "/", `${viewport.width}px lesson dropdown link failed`);
      fail(await page.locator(".course-links").isVisible(), "Lesson dropdown stayed open after navigation");
      await page.locator(".footer-inner > a").click();
      fail(new URL(page.url()).hash !== "#top", "Back to top anchor failed");
      fail((await page.locator("[data-progress-percent]").textContent()) === "100%", "Incidental page navigation completed all Lesson 0 requirements");
      await context.close();
    }

    await mkdir(path.resolve("tmp", "screenshots"), { recursive: true });
    for (const viewport of [{ width: 375, height: 667 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedProgress(context, 0);
      monitor(page, `${viewport.width}px Lesson 1`, origin);
      await page.goto(`${origin}/lesson-1/`, { waitUntil: "networkidle" });
      fail((await page.locator("[data-profile-id]").count()) !== 8, "Lesson 1 needs eight Customer profiles");
      fail((await page.locator('[role="tab"]').count()) !== 7, "Lesson 1 needs seven technology tabs");
      fail((await page.locator("[data-hotspot-id]").count()) !== 4, "Lesson 1 needs four Cloudflow hotspots");
      fail((await page.locator(".l1-discovery__steps li").count()) !== 5, "Lesson 1 needs five discovery areas");
      fail((await page.locator("[data-single-assessment]").count()) !== 2, "Lesson 1 needs two storyboard-positioned assessments");
      fail((await page.locator('[data-single-assessment] button[type="submit"]').count()) !== 0, "Lesson 1 knowledge checks gained a submit button");
      fail((await page.locator(".lesson-navigation__title").textContent()) !== "Everyday Running: Comfort, Support or Energy", "Lesson 1 next lesson title is incomplete");
      fail(!(await page.locator(".lesson-navigation__link--previous").textContent()).includes("Welcome to ON: Match the Move"), "Lesson 1 previous lesson title is missing");
      await page.locator(".l1-shoe").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector(".l1-shoe img")?.naturalWidth === 1600);
      await page.evaluate(() => window.scrollTo(0, 0));
      fail((await page.locator(".l1-shoe img").evaluate((image) => image.naturalWidth)) !== 1600, "Cloudflow 5 side image did not decode");
      await page.screenshot({ path: path.resolve("tmp", "screenshots", `lesson-1-${viewport.width}.png`), fullPage: true });
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${viewport.width}px Lesson 1 horizontal overflow`);
      await page.locator('[data-profile-id="profile-1"]').click();
      fail((await page.locator('[data-profile-id="profile-1"]').getAttribute("aria-expanded")) !== "true", "Customer profile did not flip");
      await page.locator('[data-profile-id="profile-1"]').click();
      fail((await page.locator('[data-profile-id="profile-1"]').getAttribute("aria-expanded")) !== "false", "Customer profile did not flip back");
      for (let index = 1; index <= 8; index++) await page.locator('[data-profile-id="profile-' + index + '"]').click();
      await page.locator("#l1-tab-0").click();
      await page.locator("#l1-tab-0").focus();
      await page.keyboard.press("ArrowRight");
      fail((await page.locator("#l1-tab-1").getAttribute("aria-selected")) !== "true" || !(await page.locator("#l1-panel-1").isVisible()), "Technology tab keyboard navigation failed");
      for (let index = 2; index < 7; index++) await page.locator("#l1-tab-" + index).click();
      for (let index = 1; index <= 3; index++) await page.locator('[data-hotspot-id="hotspot-' + index + '"]').click();
      fail((await page.locator('#l1-weight-cue').textContent()).includes('Select Weight to reveal') === false, 'Weight hotspot has no clear reveal instruction');
      fail((await page.locator('[data-measure-completion]').isVisible()), 'Measurements showed Completed before Weight was selected');
      await page.locator('[data-hotspot-id="hotspot-4"]').click();
      fail(!(await page.locator("[data-hotspot-detail]").textContent()).includes("Weight:"), "Weight hotspot did not reveal its explanation");
      fail((await page.locator('[data-hotspot-id="hotspot-4"]').getAttribute('data-reviewed')) !== 'true', 'Weight hotspot did not show a reviewed state');
      fail(!(await page.locator('[data-measure-completion]').isVisible()), 'Measurements did not show Completed after all four hotspots');
      await page.locator('#lesson-1-check-clue input[value="1"]').check();
      fail(!(await page.locator("#lesson-1-check-clue [data-question-feedback]").textContent()).startsWith("Correct."), "Check the clue lacked immediate feedback");
      await page.locator('#lesson-1-challenge input[value="0"]').check();
      fail(!(await page.locator("#lesson-1-challenge [data-question-feedback]").textContent()).startsWith("Not quite."), "Quick Customer Challenge lacked immediate feedback");
      for (let index = 0; index < 4; index++) await page.locator("#l1-match-" + index).selectOption(String(index));
      await page.locator('[data-match-form] button[type="submit"]').click();
      fail((await page.locator("[data-match-summary]").textContent()) !== "4 of 4 matched correctly.", "Customer clue matching failed");
      await page.locator("#l1-reflection-input").fill("   ");
      await page.locator('[data-l1-reflection] button[type="submit"]').click();
      fail((await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').completed || [], storageKey)).includes('lesson-1-reflection'), 'Whitespace-only Lesson 1 response completed its milestone');
      await page.locator("#l1-reflection-input").fill("Ask how often they run.");
      await page.locator('[data-l1-reflection] button[type="submit"]').click();
      const progress = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), storageKey);
      for (const id of ["lesson-1-profiles", "lesson-1-technology", "lesson-1-measure", "lesson-1-check-clue", "lesson-1-challenge", "lesson-1-matching", "lesson-1-reflection"]) fail(!progress.completed?.includes(id), `Lesson 1 milestone ${id} did not complete`);
      fail(JSON.stringify(progress).includes("Ask how often they run"), "Reflection text leaked into progress storage");
      await page.reload({ waitUntil: "networkidle" });
      fail((await page.locator("#l1-reflection-input").inputValue()) !== "Ask how often they run.", "Lesson 1 reflection did not persist");
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.goto(`${origin}/lesson-1/`, { waitUntil: 'networkidle' });
      fail((await page.locator("#l1-reflection-input").inputValue()) !== "Ask how often they run.", "Lesson 1 reflection did not restore after lesson navigation");
      fail((await page.locator("#l1-tab-6").getAttribute("aria-selected")) !== "true", "Technology selection did not persist");
      fail(!(await page.locator('[data-measure-completion]').isVisible()), 'Weight activity completion indicator did not restore');
      await context.close();
    }
    for (const viewport of [{ width: 375, height: 667 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedProgress(context, 1);
      monitor(page, `${viewport.width}px Lesson 2`, origin);
      await page.goto(`${origin}/lesson-2/`, { waitUntil: "networkidle" });
      fail((await page.locator(".product-explorer__product").count()) !== 5, "Lesson 2 needs five complete products");
      fail((await page.locator(".feature-flip").count()) !== 5, "Lesson 2 needs five feature-to-benefit cards");
      fail((await page.locator(".product-match__needs li").count()) !== 5, "Lesson 2 needs five recommendation matches");
      fail((await page.locator("[data-single-assessment]").count()) !== 2, "Lesson 2 needs two immediate-feedback questions");
      fail((await page.locator(".lesson-navigation__title").textContent()) !== "Performance Running: Train Fast, Race Ready", "Lesson 2 next lesson title is incomplete");
      const fields = ["Who it is for", "What it does / best for", "Why it works", "How to explain it", "Technical information", "Recommendation cue"];
      for (const product of await page.locator(".product-explorer__product").all()) {
        const text = await product.textContent();
        for (const field of fields) fail(!text.includes(field), `Lesson 2 product is missing ${field}`);
      }
      await page.locator('#lesson-2-sipho-check input[value="0"]').check();
      fail(!(await page.locator("#lesson-2-sipho-check [data-question-feedback]").textContent()).startsWith("Not quite."), "Sipho scenario lacked incorrect feedback");
      await page.locator('#lesson-2-sipho-check input[value="2"]').check();
      fail(!(await page.locator("#lesson-2-sipho-check [data-question-feedback]").textContent()).startsWith("Correct."), "Sipho scenario lacked correct feedback");
      await page.locator('[data-category-id="support"]').click();
      await page.locator('[data-product-choice="cloudrunner-3-max"]').click();
      fail(!(await page.locator('#lesson-2-products-product-cloudrunner-3-max').isVisible()), "Lesson 2 product switching failed");
      await page.locator('.feature-flip').first().click();
      fail((await page.locator('.feature-flip').first().getAttribute('aria-expanded')) !== 'true', "Lesson 2 flip card did not reveal");
      const answerIds = ["cloudsurfer-2", "cloudsurfer-max", "cloudrunner-3", "cloudrunner-3-max", "cloudmonster-3"];
      for (const [index, answer] of answerIds.entries()) await page.locator('.product-match__needs select').nth(index).selectOption(answer);
      await page.locator('.product-match__actions button').click();
      fail(!(await page.locator('[data-match-summary]').textContent()).startsWith('5 of 5'), "Lesson 2 matching failed");
      await page.locator('#lesson-2-knowledge input[value="2"]').check();
      fail(!(await page.locator("#lesson-2-knowledge [data-question-feedback]").textContent()).startsWith("Correct."), "Lesson 2 knowledge check lacked immediate feedback");
      await page.reload({ waitUntil: "networkidle" });
      fail(!(await page.locator('#lesson-2-products-product-cloudrunner-3-max').isVisible()), "Lesson 2 product selection did not persist");
      fail((await page.locator('.product-match__needs select').nth(4).inputValue()) !== 'cloudmonster-3', "Lesson 2 matching selections did not persist");
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${viewport.width}px Lesson 2 horizontal overflow`);
      await context.close();
    }
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedProgress(context, 2);
      monitor(page, `${viewport.width}px Lesson 3`, origin);
      await page.goto(`${origin}/lesson-3/`, { waitUntil: "networkidle" });
      fail((await page.locator(".product-explorer__product").count()) !== 6, "Lesson 3 needs six complete products");
      fail((await page.locator(".feature-flip").count()) !== 6, "Lesson 3 needs six feature cards");
      fail((await page.locator(".product-match__needs li").count()) !== 6, "Lesson 3 needs six recommendation matches");
      fail((await page.locator("[data-single-assessment]").count()) !== 2, "Lesson 3 needs two immediate-feedback questions");
      fail((await page.locator(".product-explorer__tabs button").allTextContents()).join("|") !== "FAST TRAINING|LONG / TEMPO PERFORMANCE|RACE DAY", "Lesson 3 product categories changed");
      fail((await page.locator("#lesson-3-collection-heading").textContent()) !== "Meet the collection" || (await page.locator("#lesson-3-products-heading").textContent()) !== "Meet the shoes", "Lesson 3 collection headings missing");
      fail(!(await page.locator(".lesson-navigation__link--previous").textContent()).includes("Everyday Running: Comfort, Support or Energy"), "Lesson 3 previous lesson title missing");
      fail((await page.locator(".lesson-navigation__title").textContent()) !== "Outdoor: Choose the Terrain", "Lesson 3 next lesson title changed");
      for (const product of await page.locator(".product-explorer__product").all()) {
        const copy = await product.textContent();
        for (const field of ["Who it is for", "What it does / best for", "Why it works", "How to explain it", "Technical information", "Recommendation cue"]) fail(!copy.includes(field), `Lesson 3 product missing ${field}`);
        fail((await product.locator("[data-image-src]").count()) !== 3, "Lesson 3 product is missing an approved angle");
      }
      await page.locator('#lesson-3-anele-check input[value="0"]').check();
      fail((await page.locator("#lesson-3-anele-check [data-question-feedback]").textContent()) !== "Not quite. Try again.", "Anele scenario retry feedback changed");
      await page.locator('#lesson-3-anele-check input[value="1"]').check();
      fail(!(await page.locator("#lesson-3-anele-check [data-question-feedback]").textContent()).startsWith("The Customer has already clarified"), "Anele scenario correct feedback missing");
      for (const [category, ids] of [["fast-training", ["cloudflow-5"]], ["long-tempo", ["cloudmonster-3-hyper", "lightspray-cloudmonster-3-hyper"]], ["race-day", ["cloudboom-volt", "cloudboom-max", "cloudboom-strike-2"]]]) {
        await page.locator(`[data-category-id="${category}"]`).click();
        for (const id of ids) {
          await page.locator(`[data-category-panel="${category}"] [data-product-choice="${id}"]`).click();
          const product = page.locator(`#lesson-3-products-product-${id}`);
          fail(!(await product.isVisible()), `Lesson 3 ${id} did not open`);
          for (const angle of await product.locator("[data-image-src]").all()) {
            await angle.click();
            await product.locator("[data-product-image]").evaluate((image) => image.decode());
            fail((await product.locator("[data-product-image]").evaluate((image) => image.naturalWidth)) !== 1600, `Lesson 3 ${id} image did not decode`);
          }
        }
      }
      for (const card of await page.locator(".feature-flip").all()) {
        await card.click();
        fail((await card.getAttribute("aria-expanded")) !== "true", "Lesson 3 feature card did not reveal");
        await card.click();
        fail((await card.getAttribute("aria-expanded")) !== "false", "Lesson 3 feature card did not turn back");
      }
      const answerIds = ["cloudflow-5", "cloudmonster-3-hyper", "lightspray-cloudmonster-3-hyper", "cloudboom-max", "cloudboom-volt", "cloudboom-strike-2"];
      for (const [index, answer] of answerIds.entries()) await page.locator(".product-match__needs select").nth(index).selectOption(answer);
      await page.locator(".product-match__actions button").click();
      fail(!(await page.locator("[data-match-summary]").textContent()).startsWith("6 of 6"), "Lesson 3 matching failed");
      await page.locator('#lesson-3-knowledge input[value="1"]').check();
      fail(!(await page.locator("#lesson-3-knowledge [data-question-feedback]").textContent()).startsWith("Not quite."), "Lesson 3 knowledge incorrect feedback missing");
      await page.locator('#lesson-3-knowledge input[value="0"]').check();
      fail(!(await page.locator("#lesson-3-knowledge [data-question-feedback]").textContent()).startsWith("Correct."), "Lesson 3 knowledge correct feedback missing");
      await page.reload({ waitUntil: "networkidle" });
      fail(!(await page.locator("#lesson-3-products-product-cloudboom-strike-2").isVisible()), "Lesson 3 product selection did not persist");
      fail((await page.locator(".product-match__needs select").nth(5).inputValue()) !== "cloudboom-strike-2", "Lesson 3 matching did not persist");
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${viewport.width}px Lesson 3 horizontal overflow`);
      await page.screenshot({ path: path.resolve("tmp", "screenshots", `lesson-3-${viewport.width}.png`), fullPage: true });
      await context.close();
    }
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedProgress(context, 3);
      monitor(page, `${viewport.width}px Lesson 4`, origin);
      await page.goto(`${origin}/lesson-4/`, { waitUntil: "networkidle" });
      fail((await page.locator(".product-explorer__product").count()) !== 3, "Lesson 4 needs three complete products");
      fail((await page.locator(".feature-flip").count()) !== 3, "Lesson 4 needs three feature cards");
      fail((await page.locator(".product-match__needs li").count()) !== 3, "Lesson 4 needs three recommendation matches");
      fail((await page.locator("[data-single-assessment]").count()) !== 2, "Lesson 4 needs two immediate-feedback questions");
      fail((await page.locator(".product-explorer__tabs button").allTextContents()).join("|") !== "HIKING|VERSATILE TRAIL|TECHNICAL ULTRA", "Lesson 4 product categories changed");
      fail((await page.locator("#lesson-4-collection-heading").textContent()) !== "Meet the collection" || (await page.locator("#lesson-4-products-heading").textContent()) !== "Meet the shoes", "Lesson 4 collection headings missing");
      fail(!(await page.locator(".lesson-navigation__link--previous").textContent()).includes("Performance Running: Train Fast, Race Ready"), "Lesson 4 previous lesson title missing");
      fail((await page.locator(".lesson-navigation__title").textContent()) !== "Training and Lifestyle: Match the Movement", "Lesson 4 next lesson title incomplete");
      for (const product of await page.locator(".product-explorer__product").all()) {
        const copy = await product.textContent();
        for (const field of ["Who it is for", "What it does / best for", "Why it works", "How to explain it", "Technical information", "Recommendation cue"]) fail(!copy.includes(field), `Lesson 4 product missing ${field}`);
        fail((await product.locator("[data-image-src]").count()) !== 3, "Lesson 4 product is missing an approved angle");
      }
      await page.locator('#lesson-4-lerato-check input[value="1"]').check();
      fail((await page.locator("#lesson-4-lerato-check [data-question-feedback]").textContent()) !== "Not quite. Try again.", "Lerato scenario retry feedback changed");
      await page.locator('#lesson-4-lerato-check input[value="0"]').check();
      fail((await page.locator("#lesson-4-lerato-check [data-question-feedback]").textContent()) !== "The Customer is hiking for one day and wants comfort and trail traction.", "Lerato scenario correct feedback missing");
      await page.locator(".l4-lerato__image").scrollIntoViewIfNeeded();
      await page.locator(".l4-lerato__image").evaluate((image) => image.decode());
      fail((await page.locator(".l4-lerato__image").evaluate((image) => image.naturalWidth)) !== 2880, "Lesson 4 scenario image did not decode");
      for (const [category, id] of [["hiking", "cloudhorizon-2"], ["versatile-trail", "cloudvista-3"], ["technical-ultra", "cloudultra-3"]]) {
        await page.locator(`[data-category-id="${category}"]`).click();
        const product = page.locator(`#lesson-4-products-product-${id}`);
        fail(!(await product.isVisible()), `Lesson 4 ${id} did not open`);
        for (const angle of await product.locator("[data-image-src]").all()) {
          await angle.click();
          await product.locator("[data-product-image]").evaluate((image) => image.decode());
          fail((await product.locator("[data-product-image]").evaluate((image) => image.naturalWidth)) < 1600, `Lesson 4 ${id} image did not decode`);
        }
      }
      for (const card of await page.locator(".feature-flip").all()) {
        await card.click();
        fail((await card.getAttribute("aria-expanded")) !== "true", "Lesson 4 feature card did not reveal");
        await card.click();
        fail((await card.getAttribute("aria-expanded")) !== "false", "Lesson 4 feature card did not turn back");
      }
      const answerIds = ["cloudhorizon-2", "cloudvista-3", "cloudultra-3"];
      for (const [index, answer] of answerIds.entries()) await page.locator(".product-match__needs select").nth(index).selectOption(answer);
      await page.locator(".product-match__actions button").click();
      fail(!(await page.locator("[data-match-summary]").textContent()).startsWith("3 of 3"), "Lesson 4 matching failed");
      await page.locator('#lesson-4-knowledge input[value="0"]').check();
      fail((await page.locator("#lesson-4-knowledge [data-question-feedback]").textContent()) !== "Not quite. Use the ultra-distance and technical-terrain clues.", "Lesson 4 knowledge incorrect feedback missing");
      await page.locator('#lesson-4-knowledge input[value="2"]').check();
      fail((await page.locator("#lesson-4-knowledge [data-question-feedback]").textContent()) !== "Correct. Cloudultra 3 is positioned for ultra-distance and technical terrain.", "Lesson 4 knowledge correct feedback missing");
      await page.reload({ waitUntil: "networkidle" });
      fail(!(await page.locator("#lesson-4-products-product-cloudultra-3").isVisible()), "Lesson 4 product selection did not persist");
      fail((await page.locator(".product-match__needs select").nth(2).inputValue()) !== "cloudultra-3", "Lesson 4 matching did not persist");
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${viewport.width}px Lesson 4 horizontal overflow`);
      await page.locator(".l4-lerato__image").scrollIntoViewIfNeeded();
      await page.locator(".l4-lerato__image").evaluate((image) => image.decode());
      await page.screenshot({ path: path.resolve("tmp", "screenshots", `lesson-4-${viewport.width}.png`), fullPage: true });
      await context.close();
    }
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedProgress(context, 4);
      monitor(page, `${viewport.width}px Lesson 5`, origin);
      await page.goto(`${origin}/lesson-5/`, { waitUntil: "networkidle" });
      fail((await page.locator(".product-explorer__product").count()) !== 5, "Lesson 5 needs five complete products");
      fail((await page.locator(".feature-flip").count()) !== 5, "Lesson 5 needs five feature cards");
      fail((await page.locator(".product-match__needs li").count()) !== 5, "Lesson 5 needs five recommendation matches");
      fail((await page.locator("[data-single-assessment]").count()) !== 2, "Lesson 5 needs two immediate-feedback questions");
      fail((await page.locator(".product-explorer__tabs button").allTextContents()).join("|") !== "BODYWEIGHT / STUDIO|HYBRID|HIIT / CIRCUITS|VERSATILE WORKOUTS|LIFESTYLE", "Lesson 5 product categories changed");
      const crowdedTabs = await page.locator(".product-explorer__tabs button").evaluateAll((buttons) => buttons.filter((button) => button.scrollWidth > button.clientWidth + 1).map((button) => button.textContent?.trim()));
      fail(crowdedTabs.length > 0, `${viewport.width}px Lesson 5 category labels overflow: ${crowdedTabs.join(", ")}`);
      const tabColumns = await page.locator(".product-explorer__tabs").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(/\s+/).length);
      fail(viewport.width < 512 ? tabColumns !== 2 : viewport.width >= 1024 ? tabColumns !== 5 : false, `${viewport.width}px Lesson 5 category grid is crowded`);
      fail((await page.locator("#lesson-5-collection-heading").textContent()) !== "Meet the collection" || (await page.locator("#lesson-5-products-heading").textContent()) !== "Meet the shoes", "Lesson 5 collection headings missing");
      fail((await page.locator(".lesson-navigation__link--previous").getAttribute("href")) !== "/lesson-4/", "Lesson 5 previous route changed");
      fail((await page.locator(".lesson-navigation__title").textContent()) !== "Become an ON Footwear Specialist", "Lesson 5 next lesson title changed");
      fail(!(await page.locator("#lesson-5-transition").textContent()).startsWith("You have now explored the complete ON footwear range."), "Lesson 5 final transition missing");
      for (const product of await page.locator(".product-explorer__product").all()) {
        const copy = await product.textContent();
        for (const field of ["Who it is for", "What it does / best for", "Why it works", "How to explain it", "Technical information", "Recommendation cue"]) fail(!copy.includes(field), `Lesson 5 product missing ${field}`);
        fail((await product.locator("[data-image-src]").count()) !== 3, "Lesson 5 product is missing an approved angle");
      }
      fail((await page.locator("#lesson-5-products-product-cloud-6 .product-explorer__proof").textContent()).includes("1 mm"), "Unverified Cloud 6 heel stack was published");
      await page.locator('#lesson-5-thabo-check input[value="0"]').check();
      fail((await page.locator("#lesson-5-thabo-check [data-question-feedback]").textContent()) !== "Not quite. Try again.", "Thabo scenario retry feedback changed");
      await page.locator('#lesson-5-thabo-check input[value="1"]').check();
      fail((await page.locator("#lesson-5-thabo-check [data-question-feedback]").textContent()) !== "The workout combines cardio and strength, so hybrid use is the strongest clue.", "Thabo scenario correct feedback missing");
      await page.locator(".l5-thabo__image").scrollIntoViewIfNeeded();
      await page.locator(".l5-thabo__image").evaluate((image) => image.decode());
      fail((await page.locator(".l5-thabo__image").evaluate((image) => image.naturalWidth)) !== 1440, "Lesson 5 scenario image did not decode");
      for (const [category, id] of [["bodyweight-studio", "cloud-x-5"], ["hybrid", "cloud-x-tempo"], ["hiit-circuits", "cloudpulse-2"], ["versatile-workouts", "cloudpulse-next"], ["lifestyle", "cloud-6"]]) {
        await page.locator(`[data-category-id="${category}"]`).click();
        const product = page.locator(`#lesson-5-products-product-${id}`);
        fail(!(await product.isVisible()), `Lesson 5 ${id} did not open`);
        for (const angle of await product.locator("[data-image-src]").all()) {
          await angle.click();
          await product.locator("[data-product-image]").evaluate((image) => image.decode());
          fail((await product.locator("[data-product-image]").evaluate((image) => image.naturalWidth)) !== 1600, `Lesson 5 ${id} image did not decode`);
        }
      }
      for (const card of await page.locator(".feature-flip").all()) {
        await card.click();
        fail((await card.getAttribute("aria-expanded")) !== "true", "Lesson 5 feature card did not reveal");
        await card.click();
        fail((await card.getAttribute("aria-expanded")) !== "false", "Lesson 5 feature card did not turn back");
      }
      const answers = ["cloud-x-5", "cloud-x-tempo", "cloudpulse-2", "cloudpulse-next", "cloud-6"];
      for (const [index, answer] of answers.entries()) await page.locator(".product-match__needs select").nth(index).selectOption(answer);
      await page.locator(".product-match__actions button").click();
      fail(!(await page.locator("[data-match-summary]").textContent()).startsWith("5 of 5"), "Lesson 5 matching failed");
      await page.locator('#lesson-5-knowledge input[value="0"]').check();
      fail(!(await page.locator("#lesson-5-knowledge [data-question-feedback]").textContent()).startsWith("Not quite."), "Lesson 5 knowledge incorrect feedback missing");
      await page.locator('#lesson-5-knowledge input[value="1"]').check();
      fail(!(await page.locator("#lesson-5-knowledge [data-question-feedback]").textContent()).startsWith("Correct."), "Lesson 5 knowledge correct feedback missing");
      await page.reload({ waitUntil: "networkidle" });
      fail(!(await page.locator("#lesson-5-products-product-cloud-6").isVisible()), "Lesson 5 product selection did not persist");
      fail((await page.locator(".product-match__needs select").nth(4).inputValue()) !== "cloud-6", "Lesson 5 matching did not persist");
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${viewport.width}px Lesson 5 horizontal overflow`);
      await context.close();
    }
    for (const viewport of [{ width: 375, height: 667 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      await seedProgress(context, 5);
      monitor(page, `${viewport.width}px Lesson 6`, origin);
      await page.goto(`${origin}/lesson-6/`, { waitUntil: "networkidle" });
      for (const heading of ["It all comes together here", "RUN the recommendation", "Watch RUN in action", "Every move has a match", "Ready for the challenge?"]) {
        fail(!(await page.locator("main h2").allTextContents()).includes(heading), `Lesson 6 is missing ${heading}`);
      }
      fail((await page.locator("[data-run-tab]").count()) !== 3, "Lesson 6 RUN needs three steps");
      const clippedRunTabs = await page.locator("[data-run-tab]").evaluateAll((tabs) => tabs.filter((tab) => tab.scrollWidth > tab.clientWidth + 1 || tab.scrollHeight > tab.clientHeight + 1).map((tab) => tab.textContent?.trim()));
      fail(clippedRunTabs.length > 0, `${viewport.width}px Lesson 6 RUN tabs clip text: ${clippedRunTabs.join(", ")}`);
      fail((await page.locator("[data-run-panel]:visible").count()) !== 1, "Lesson 6 RUN must reveal one step at a time");
      fail((await page.locator("#run-panel-0 p").textContent()) !== "Ask about the Customer’s activity, surface, distance, preferred feel and goal.", "Lesson 6 R copy changed");
      await page.locator("[data-run-next]").click();
      fail((await page.locator("[data-run-panel]:visible").count()) !== 1 || !(await page.locator("#run-panel-1").isVisible()), "Lesson 6 RUN forward control failed");
      fail((await page.locator("#run-panel-1 p").textContent()) !== "Choose one or two approved product facts that support the recommendation. Do not overwhelm the Customer with specifications.", "Lesson 6 U copy changed");
      await page.locator("[data-run-next]").click();
      fail((await page.locator("#run-panel-2 p").textContent()) !== "Explain why the product proof matters to this Customer, then confirm the fit, comfort and overall experience.", "Lesson 6 N copy changed");
      fail(!(await page.locator("[data-run-next]").isDisabled()), "Lesson 6 RUN Next should stop at N");
      await page.locator("[data-run-previous]").click();
      fail(!(await page.locator("#run-panel-1").isVisible()), "Lesson 6 RUN back control failed");
      await page.locator("#run-tab-1").focus();
      await page.keyboard.press("End");
      fail(!(await page.locator("#run-panel-2").isVisible()) || !(await page.locator("#run-tab-2").evaluate((tab) => tab === document.activeElement)), "Lesson 6 RUN keyboard navigation failed");
      await page.reload({ waitUntil: "networkidle" });
      fail(!(await page.locator("#run-panel-2").isVisible()), "Lesson 6 RUN step did not persist");
      fail((await page.locator(".run-dialogue__turn--customer blockquote").textContent()) !== "“I run most days and I’m starting to increase my distance. I want something comfortable, but I still like to feel stable and supported.”", "Lesson 6 Customer dialogue changed");
      fail((await page.locator(".run-dialogue__turn--athlete blockquote").textContent()) !== "“It sounds like you need more cushioning as your distance increases, without losing that stable feel. I’d start with the Cloudrunner 3 Max. Its wide base, higher sidewalls and dual-foam midsole are designed to support stable, cushioned strides as your mileage grows. Let’s try it on and see how it feels.”", "Lesson 6 Athlete dialogue changed");
      fail(!(await page.locator("#lesson-6-conclusion").textContent()).includes("Then confirm the fit and help the Customer choose with confidence."), "Lesson 6 conclusion incomplete");
      fail(!(await page.locator("#lesson-6-challenge").textContent()).includes("Complete the final quiz in People Connect."), "Lesson 6 People Connect transition missing");
      fail((await page.locator("main").textContent()).includes("Which response gives you the broadest starting point"), "People Connect quiz question leaked into Lesson 6");
      fail((await page.locator("#lesson-6-challenge button, #lesson-6-challenge a").count()) !== 0, "Lesson 6 challenge includes an unapproved action");
      fail((await page.locator(".lesson-navigation__link--previous").getAttribute("href")) !== "/lesson-5/", "Lesson 6 previous route changed");
      fail(!(await page.locator(".lesson-navigation__link--previous").textContent()).includes("Training and Lifestyle: Match the Movement"), "Lesson 6 previous title incomplete");
      fail((await page.locator(".lesson-navigation__link--next").count()) !== 0, "Lesson 6 should not link to a next lesson");
      fail(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${viewport.width}px Lesson 6 horizontal overflow`);
      await context.close();
    }
    for (const viewport of [{ width: 375, height: 667 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      monitor(page, `${viewport.width}px Lesson 0`, origin);
      await page.goto(origin, { waitUntil: "networkidle" });
      await page.screenshot({ path: path.resolve("tmp", "screenshots", `lesson-0-${viewport.width}.png`), fullPage: true });
      const headings = await page.locator("main h2").allTextContents();
      for (const heading of ["Your learning, your pace", "Why ON?", "Every Customer moves differently", "You are on the footwear floor", "Check your understanding", "Your learning run", "Your starting point", "Key takeaway"]) {
        fail(!headings.includes(heading), `${viewport.width}px Lesson 0 is missing ${heading}`);
      }
      fail((await page.locator(".l0-collections img").count()) !== 4, "Four collection images are missing");
      const whySurface = await page.locator(".l0-why").evaluate((element) => ({
        colour: getComputedStyle(element).backgroundColor,
        tint: getComputedStyle(element).backgroundImage,
        text: getComputedStyle(element.querySelector(":scope > p")).color,
        inset: getComputedStyle(element.querySelector(".l0-why__inset")).backgroundColor,
      }));
      fail(whySurface.colour !== "rgb(41, 149, 204)" || whySurface.tint !== "none" || whySurface.text !== "rgb(255, 255, 255)" || whySurface.inset !== "rgb(0, 0, 0)", `Why ON solid Totalsports blue panel changed at ${viewport.width}px: ${JSON.stringify(whySurface)}`);
      fail((await page.locator(".l0-why__shoe").count()) !== 0, "Why ON footwear overlay remains");
      const motif = await page.evaluate(() => {
        const graphic = document.querySelector('.l0-transition__motif');
        const image = graphic?.querySelector('img');
        const logo = image?.getBoundingClientRect();
        const boundary = document.querySelector('.l0-assessment')?.getBoundingClientRect().top;
        return { decorative: graphic?.getAttribute('aria-hidden') === 'true' && getComputedStyle(graphic).pointerEvents === 'none' && image?.getAttribute('alt') === '', source: image?.getAttribute('src'), cropped: logo && logo.left < 0 && logo.right > 0, smaller: logo && logo.width <= 304, crosses: logo && boundary !== undefined && logo.top < boundary && logo.bottom > boundary, top: logo?.top, bottom: logo?.bottom, boundary };
      });
      fail(!motif.decorative || motif.source !== '/assets/logos/ON Logo Black.png' || !motif.cropped || !motif.smaller || !motif.crosses, `${viewport.width}px decorative ON logo does not match the section transition (${JSON.stringify(motif)})`);
      for (const item of await page.locator(".l0-collections img").all()) await item.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll(".l0-collections img, .l0-hero__image, .l0-why__symbol img")].every((image) => image.complete && image.naturalWidth > 0));
      fail(await page.locator(".l0-collections img, .l0-hero__image, .l0-why__symbol img").evaluateAll((images) => images.some((image) => !image.complete || image.naturalWidth === 0)), "Approved Lesson 0 imagery did not load");
      fail((await page.locator("[data-assessment-panel]").count()) !== 1, "Lesson 0 assessment is not one component");
      fail((await page.locator("[data-assessment-panel] details, [data-assessment-panel] button[type='submit']").count()) !== 0, "Old collapsible or Submit Answer controls remain");
      const assessmentBackground = await page.locator("[data-assessment-panel]").evaluate((element) => getComputedStyle(element).backgroundImage);
      fail(!assessmentBackground.includes("linear-gradient") || !assessmentBackground.includes("49, 60, 68"), "Assessment lost the layered charcoal gradient");
      fail((await page.locator('[data-assessment-slide="0"]').evaluate((element) => element.firstElementChild?.tagName)) !== 'H2', "Scenario has content above its activity heading");
      fail((await page.locator('[data-assessment-slide="1"]').evaluate((element) => element.firstElementChild?.tagName)) !== 'H2', "Knowledge check has content above its activity heading");
      const transitionBackground = await page.locator(".l0-transition").evaluate((element) => getComputedStyle(element).backgroundImage);
      fail(!transitionBackground.includes("linear-gradient") || !transitionBackground.includes("rgb(255, 255, 255)") || !transitionBackground.includes("rgb(0, 0, 0)"), "Customer and assessment sections lost the smooth white-to-black gradient");
      fail(!(await page.locator('[data-assessment-slide="0"]').isVisible()) || await page.locator('[data-assessment-slide="1"]').isVisible(), "Assessment must show only Question 1 initially");
      fail((await page.locator('[data-assessment-counter]').textContent()) !== 'Question 1 of 2', "Assessment counter starts incorrectly");
      fail(!(await page.locator('[data-assessment-previous]').isDisabled()), "Previous should be disabled on Question 1");
      fail((await page.locator('[data-scenario-feedback]').textContent()) !== '', "Scenario feedback revealed before an answer");
      fail((await page.locator('.assessment-panel__option span').first().textContent()).trim().startsWith('A.'), "Answer letters remain");
      fail((await page.locator("[data-journey-item]").count()) !== 7, "Learning journey does not list seven lessons");
      fail((await page.locator("[data-learning-journey] a").count()) !== 0, "Learning journey cards still link to lessons");
      const journeyCard = page.locator('[data-journey-item][data-path="/"] .learning-journey__card');
      await journeyCard.hover();
      fail((await journeyCard.evaluate((element) => getComputedStyle(element).backgroundColor)) !== 'rgb(41, 149, 204)', "Learning journey hover does not use Totalsports blue");
      fail((await page.locator('[data-journey-item][data-path="/"]').getAttribute('data-state')) !== 'current', "Lesson 0 should be the current journey node");
      fail((await page.locator('[data-journey-item][data-path="/lesson-1/"]').getAttribute('data-state')) !== 'locked', "Lesson 1 journey node was not locked");
      fail((await page.locator('.lesson-navigation__link--next').getAttribute('href')) !== null, "Locked next lesson destination remained active");
      fail((await page.locator('.lesson-navigation__title').textContent()) !== 'Decode the Shoe', "Next lesson title is missing");
      fail((await page.locator('.lesson-navigation__subtitle').textContent()) !== 'ON and Running Fundamentals', "Next lesson supporting text is missing");
      fail((await page.locator('.lesson-navigation__eyebrow').textContent()).replace(/\s+/g, ' ').trim() !== 'Up next · Lesson 1', "Next lesson eyebrow is incorrect");
      fail((await page.locator('.lesson-navigation__link--next').textContent()).trim() !== 'Locked', "Locked next lesson button label is incorrect");
      const lessonNavigationStyles = await page.locator('.lesson-navigation').evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, cardBackground: getComputedStyle(element.querySelector('.lesson-navigation__card')).backgroundImage }));
      fail(lessonNavigationStyles.background !== 'rgb(0, 0, 0)' || !lessonNavigationStyles.cardBackground.includes('linear-gradient'), "Next lesson navigation lost its dark card or seamless black background");
      const state = async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"completed":[]}'), storageKey);
      const assessmentConfig = JSON.parse(await page.locator('[data-assessment-config]').textContent());
      fail((await state()).completed.includes("lesson-0-scenario") || (await state()).completed.includes("lesson-0-check"), "Unanswered assessment completed a milestone");
      fail((await page.locator('[data-assessment-clear]').count()) !== 0, "Question 1 still has a retry control");
      await page.locator('input[name="scenario-answer"][value="0"]').focus();
      const focusOutline = await page.locator('.assessment-panel__option:has(input[name="scenario-answer"][value="0"])').evaluate((element) => getComputedStyle(element).outlineWidth);
      fail(focusOutline === '0px', "Scenario answer lacks a visible focus state");
      await page.locator('.assessment-panel__option:has(input[name="scenario-answer"][value="0"])').click();
      fail(!(await page.locator('input[name="scenario-answer"][value="0"]').isChecked()), "Scenario answer card is not clickable");
      fail((await page.locator('[data-scenario-feedback]').textContent()) !== assessmentConfig.scenarioFeedback.incorrect, "Scenario feedback was not immediate or changed");
      const incorrectFeedback = await page.locator('[data-scenario-feedback]').evaluate((element) => ({ result: element.parentElement.dataset.result, gradient: getComputedStyle(element.parentElement).backgroundImage }));
      fail(incorrectFeedback.result !== 'incorrect' || !incorrectFeedback.gradient.includes('166, 56, 56'), "Incorrect scenario feedback lacks its distinct gradient");
      const incorrectOptionColour = await page.locator('.assessment-panel__option:has(input[name="scenario-answer"][value="0"])').evaluate((element) => getComputedStyle(element).borderTopColor);
      fail(incorrectOptionColour !== 'rgb(166, 56, 56)', "Incorrect scenario answer does not match its feedback state");
      fail(!(await state()).completed.includes("lesson-0-scenario"), "Scenario attempt did not complete its milestone");
      fail(await page.locator('input[name="scenario-answer"][value="1"]').isDisabled(), "Scenario answer was locked after a selection");
      await page.locator('[data-assessment-next]').focus();
      await page.keyboard.press('Enter');
      fail(!(await page.locator('[data-assessment-slide="1"]').isVisible()) || await page.locator('[data-assessment-slide="0"]').isVisible(), "Next did not show only Question 2");
      fail((await page.locator('[data-assessment-counter]').textContent()) !== 'Question 2 of 2', "Assessment counter did not advance");
      fail((await page.locator('[data-knowledge-feedback]').textContent()) !== '', "Knowledge feedback revealed before an answer");
      fail((await state()).completed.includes("lesson-0-check"), "Unanswered knowledge check completed a milestone");
      await page.locator('input[name="knowledge-answer"][value="0"]').check();
      fail((await page.locator('[data-knowledge-feedback]').textContent()) !== assessmentConfig.knowledgeFeedback.incorrect, "Knowledge feedback was not immediate or changed");
      fail(!(await state()).completed.includes("lesson-0-check"), "Knowledge selection did not complete its submit milestone");
      await page.reload({ waitUntil: "networkidle" });
      fail((await page.locator('[data-assessment-counter]').textContent()) !== 'Question 2 of 2', "Assessment position did not restore");
      fail(!(await page.locator('input[name="knowledge-answer"][value="0"]').isChecked()), "Knowledge answer did not restore");
      fail((await page.locator('[data-knowledge-feedback]').textContent()) !== assessmentConfig.knowledgeFeedback.incorrect, "Knowledge feedback did not restore");
      await page.locator('[data-assessment-previous]').click();
      fail(!(await page.locator('input[name="scenario-answer"][value="0"]').isChecked()), "Scenario answer did not restore");
      fail((await page.locator('[data-scenario-feedback]').textContent()) !== assessmentConfig.scenarioFeedback.incorrect, "Scenario feedback did not restore");
      await page.locator('.assessment-panel__option:has(input[name="scenario-answer"][value="1"])').click();
      fail((await page.locator('[data-scenario-feedback]').textContent()) !== assessmentConfig.scenarioFeedback.correct, "Scenario correct feedback changed");
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-scenario-feedback]').parentElement).borderTopColor === 'rgb(41, 149, 204)');
      const correctFeedback = await page.locator('[data-scenario-feedback]').evaluate((element) => ({ result: element.parentElement.dataset.result, gradient: getComputedStyle(element.parentElement).backgroundImage, border: getComputedStyle(element.parentElement).borderTopColor }));
      fail(correctFeedback.result !== 'correct' || !correctFeedback.gradient.includes('8, 124, 172') || correctFeedback.border !== 'rgb(41, 149, 204)', `Correct scenario feedback lost the Totalsports blue gradient: ${JSON.stringify(correctFeedback)}`);
      fail(await page.locator('input[name="scenario-answer"][value="0"]').isDisabled(), "Scenario answer was locked after correct feedback");
      await page.locator('input[name="scenario-answer"][value="2"]').check();
      fail((await page.locator('[data-scenario-feedback]').textContent()) !== assessmentConfig.scenarioFeedback.incorrect, "Scenario did not update feedback on a third selection");
      await page.locator('input[name="scenario-answer"][value="1"]').check();
      fail((await page.locator('[data-scenario-feedback]').textContent()) !== assessmentConfig.scenarioFeedback.correct, "Scenario did not update feedback on a fourth selection");
      await page.locator('[data-assessment-next]').click();
      await page.locator('input[name="knowledge-answer"][value="1"]').check();
      fail((await page.locator('[data-knowledge-feedback]').textContent()) !== assessmentConfig.knowledgeFeedback.correct, "Knowledge correct feedback changed");
      fail(!(await state()).completed.includes("lesson-0-check"), "Knowledge milestone was lost");
      await page.evaluate((key) => {
        const saved = JSON.parse(localStorage.getItem(key));
        saved.ui["lesson-0-scenario"].scenario.attempts = 2;
        localStorage.setItem(key, JSON.stringify(saved));
      }, storageKey);
      await page.reload({ waitUntil: "networkidle" });
      await page.locator('[data-assessment-previous]').click();
      fail(!(await page.locator('input[name="scenario-answer"][value="1"]').isChecked()), "Scenario answer did not restore after refresh");
      fail(await page.locator('input[name="scenario-answer"][value="3"]').isDisabled(), "Restored scenario answer remained locked");
      await page.locator('input[name="scenario-answer"][value="3"]').check();
      fail((await page.locator('[data-scenario-feedback]').textContent()) !== assessmentConfig.scenarioFeedback.incorrect, "Restored scenario did not accept another answer");
      await page.reload({ waitUntil: "networkidle" });
      fail(!(await page.locator('input[name="scenario-answer"][value="3"]').isChecked()), "Changed scenario answer did not persist");
      await page.locator('input[name="scenario-answer"][value="1"]').check();
      fail((await page.locator('[data-scenario-feedback]').textContent()) !== assessmentConfig.scenarioFeedback.correct, "Scenario did not remain selectable after refresh");
      fail(!(await state()).completed.includes("lesson-0-scenario") || !(await state()).completed.includes("lesson-0-check"), "Changing answers erased completed milestones");
      await page.locator('[data-assessment-next]').click();
      fail(!(await page.locator('input[name="knowledge-answer"][value="1"]').isChecked()), "Changing Question 1 erased Question 2's answer");
      fail(!(await page.locator("[data-reflection-continue]").isDisabled()), "Empty reflection allowed Continue");
      await page.locator("#lesson-0-response").fill("Ask about intended use and preferred feel.");
      await page.locator("[data-reflection-continue]").click();
      fail(!(await state()).completed.includes("lesson-0-reflection"), "Reflection Continue did not complete its milestone");
      fail(await page.evaluate((key) => localStorage.getItem(key + ":lesson-0-reflection-text") !== "Ask about intended use and preferred feel.", storageKey), "Reflection was not saved locally");
      fail(await page.evaluate((key) => JSON.stringify(JSON.parse(localStorage.getItem(key) || "{}" )).includes("Ask about intended use"), storageKey), "Reflection free text leaked into progress storage");
      await page.reload({ waitUntil: "networkidle" });
      fail((await page.locator("#lesson-0-response").inputValue()) !== "Ask about intended use and preferred feel.", "Reflection did not restore after reload");
      fail(!(await state()).completed.includes("lesson-0-reflection"), "Lesson 0 progress did not restore after reload");
      for (const id of ['lesson-0-guidance', 'lesson-0-why', 'lesson-0-customers', 'lesson-0-takeaway']) {
        await page.locator(`#${id}`).evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key) || '{"completed":[]}').completed.includes(id), { key: storageKey, id }, { timeout: 5000 });
      }
      fail((await page.locator('.lesson-navigation__link--next').getAttribute('href')) !== '/lesson-1/', "Completing Lesson 0 did not unlock its next card immediately");
      await page.locator('.lesson-navigation__link--next').click();
      fail(new URL(page.url()).pathname !== '/lesson-1/', "Next lesson route failed");
      await page.locator('.lesson-navigation__link--previous').click();
      await page.waitForLoadState("networkidle");
      fail(new URL(page.url()).pathname !== '/', "Previous lesson navigation failed");
      const overflow = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollX: window.scrollX,
        offenders: [...document.querySelectorAll('body *')].map((element) => ({ selector: `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.trim().replaceAll(' ', '.')}` : ''}`, left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })).filter((item) => item.right > document.documentElement.clientWidth + 1).slice(0, 8),
      }));
      fail(overflow.width > 1, `${viewport.width}px Lesson 0 overflows after interaction (${JSON.stringify(overflow)})`);
      await page.close();
      const reopenedReflection = await context.newPage();
      monitor(reopenedReflection, `${viewport.width}px Lesson 0 browser reopen`, origin);
      await reopenedReflection.goto(origin, { waitUntil: 'networkidle' });
      fail((await reopenedReflection.locator('#lesson-0-response').inputValue()) !== 'Ask about intended use and preferred feel.', 'Lesson 0 response did not restore after browser page reopened');
      fail(!(await reopenedReflection.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"completed":[]}').completed.includes('lesson-0-reflection'), storageKey)), 'Lesson 0 completion was lost on browser page reopen');
      await context.close();
    }

    const lmsContext = await browser.newContext();
    await lmsContext.addInitScript((key) => {
      const values = {
        "cmi.core.lesson_status": "not attempted",
        "cmi.suspend_data": JSON.stringify({ v: key, c: [0, 1, 2, 3, 4, 5, 6], w: {}, e: {}, u: {} }),
      };
      const calls = [];
      window.__lmsState = { values, calls };
      window.API = {
        LMSInitialize: () => "true",
        LMSFinish: () => { calls.push(["LMSFinish"]); return "true"; },
        LMSGetValue: (element) => values[element] || "",
        LMSSetValue: (element, value) => { calls.push(["LMSSetValue", element, value]); values[element] = value; return "true"; },
        LMSCommit: () => { calls.push(["LMSCommit"]); return "true"; },
        LMSGetLastError: () => "0",
        LMSGetErrorString: () => "No error",
        LMSGetDiagnostic: () => "",
      };
    }, storageKey);
    const lmsPage = await lmsContext.newPage();
    monitor(lmsPage, "Lesson 0 LMS gate", origin);
    await lmsPage.goto(origin, { waitUntil: "networkidle" });
    fail((await lmsPage.locator("[data-progress-percent]").textContent()) !== "14%", "LMS resume did not restore Lesson 0 milestones");
    fail((await lmsPage.locator('[data-journey-item][data-path="/"]').getAttribute('data-state')) !== 'completed', "Learning journey did not restore completed Lesson 0 state");
    fail((await lmsPage.locator('[data-journey-item][data-path="/lesson-1/"]').getAttribute('data-state')) !== 'available', "Lesson 1 was treated as complete without its requirements");
    await lmsPage.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    const lms = await lmsPage.evaluate(() => window.__lmsState);
    fail(lms.values["cmi.core.lesson_status"] !== "incomplete" || lms.calls.some((call) => call[1] === "cmi.core.lesson_status" && call[2] === "completed"), "Lesson 0 completed the LMS before course requirements are defined");
    fail(lms.values["cmi.suspend_data"].includes("Ask about intended use"), "Reflection text was sent to LMS suspend data");
    await lmsContext.close();

    const lesson1LmsContext = await browser.newContext();
    await lesson1LmsContext.addInitScript((key) => {
      const values = {
        "cmi.core.lesson_status": "not attempted",
        "cmi.suspend_data": JSON.stringify({
          v: key,
          c: Array.from({ length: 18 }, (_, index) => index),
          w: {},
          e: {
            8: Array.from({ length: 8 }, (_, index) => "profile-" + (index + 1)),
            10: Array.from({ length: 7 }, (_, index) => "technology-" + (index + 1)),
            13: Array.from({ length: 4 }, (_, index) => "hotspot-" + (index + 1)),
          },
          u: {},
        }),
      };
      const calls = [];
      window.__lmsState = { values, calls };
      window.API = {
        LMSInitialize: () => "true",
        LMSFinish: () => { calls.push(["LMSFinish"]); return "true"; },
        LMSGetValue: (element) => values[element] || "",
        LMSSetValue: (element, value) => { calls.push(["LMSSetValue", element, value]); values[element] = value; return "true"; },
        LMSCommit: () => { calls.push(["LMSCommit"]); return "true"; },
        LMSGetLastError: () => "0",
        LMSGetErrorString: () => "No error",
        LMSGetDiagnostic: () => "",
      };
    }, storageKey);
    const lesson1LmsPage = await lesson1LmsContext.newPage();
    monitor(lesson1LmsPage, "Lesson 1 LMS resume", origin);
    await lesson1LmsPage.goto(`${origin}/lesson-1/`, { waitUntil: "networkidle" });
    fail((await lesson1LmsPage.locator("[data-progress-percent]").textContent()) !== "35%", "LMS resume did not restore Lesson 1 milestones");
    const lesson1Restored = await lesson1LmsPage.evaluate(() => {
      const restored = {};
      for (const activityId of ["lesson-1-profiles", "lesson-1-technology", "lesson-1-measure"]) {
        window.dispatchEvent(new CustomEvent("course-progress:request-restore", { detail: { activityId, apply: (itemIds) => { restored[activityId] = itemIds; } } }));
      }
      return restored;
    });
    fail(lesson1Restored["lesson-1-profiles"]?.length !== 8 || lesson1Restored["lesson-1-technology"]?.length !== 7 || lesson1Restored["lesson-1-measure"]?.length !== 4, "Lesson 1 LMS exploration state did not restore");
    await lesson1LmsPage.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    const lesson1Lms = await lesson1LmsPage.evaluate(() => window.__lmsState);
    fail(lesson1Lms.values["cmi.core.lesson_status"] !== "incomplete" || lesson1Lms.calls.some((call) => call[1] === "cmi.core.lesson_status" && call[2] === "completed"), "Lesson 1 completed the LMS before the full course is built");
    await lesson1LmsContext.close();

    const reflectionLmsContext = await browser.newContext();
    await reflectionLmsContext.addInitScript((key) => {
      const learner = sessionStorage.getItem('__reflection_learner') || 'learner-A';
      const saved = sessionStorage.getItem('__reflection_lms_state');
      const values = saved ? JSON.parse(saved) : {
        'cmi.core.lesson_status': 'incomplete',
        'cmi.core.lesson_location': '/',
        'cmi.suspend_data': JSON.stringify({ v: key, c: Array.from({ length: 7 }, (_, index) => index), w: {}, e: {}, u: {} }),
      };
      values['cmi.core.student_id'] = learner;
      window.__lmsState = { values };
      window.API = {
        LMSInitialize: () => 'true', LMSFinish: () => 'true',
        LMSGetValue: (element) => values[element] || '',
        LMSSetValue: (element, value) => { values[element] = value; sessionStorage.setItem('__reflection_lms_state', JSON.stringify(values)); return 'true'; },
        LMSCommit: () => { sessionStorage.setItem('__reflection_lms_state', JSON.stringify(values)); return 'true'; },
        LMSGetLastError: () => '0', LMSGetErrorString: () => 'No error', LMSGetDiagnostic: () => '',
      };
    }, storageKey);
    const reflectionLmsPage = await reflectionLmsContext.newPage();
    monitor(reflectionLmsPage, 'learner-scoped LMS reflections', origin);
    await reflectionLmsPage.goto(origin, { waitUntil: 'networkidle' });
    await reflectionLmsPage.locator('#lesson-0-response').fill('Learner A starting point');
    await reflectionLmsPage.locator('[data-reflection-continue]').click();
    fail(await reflectionLmsPage.evaluate((key) => localStorage.getItem(`${key}:learner:learner-A:lesson-0-reflection-text`) !== 'Learner A starting point', storageKey), 'Lesson 0 LMS response was not saved under the learner ID on Continue');
    await reflectionLmsPage.reload({ waitUntil: 'networkidle' });
    fail((await reflectionLmsPage.locator('#lesson-0-response').inputValue()) !== 'Learner A starting point', 'Lesson 0 LMS response did not restore on refresh');
    await reflectionLmsPage.goto(`${origin}/lesson-1/`, { waitUntil: 'networkidle' });
    await reflectionLmsPage.locator('#l1-reflection-input').fill('Learner A discovery question');
    await reflectionLmsPage.locator('[data-l1-reflection] button[type="submit"]').click();
    fail(await reflectionLmsPage.evaluate((key) => localStorage.getItem(`${key}:learner:learner-A:lesson-1-reflection-text`) !== 'Learner A discovery question', storageKey), 'Lesson 1 LMS response was not saved under the learner ID on Save response');
    await reflectionLmsPage.reload({ waitUntil: 'networkidle' });
    fail((await reflectionLmsPage.locator('#l1-reflection-input').inputValue()) !== 'Learner A discovery question', 'Lesson 1 LMS response did not restore on refresh');
    fail(!(await reflectionLmsPage.evaluate((index) => JSON.parse(window.__lmsState.values['cmi.suspend_data']).c.includes(index), allMilestones.findIndex((milestone) => milestone.id === 'lesson-1-reflection'))), 'Lesson 1 reflection milestone was not committed to the LMS');
    await reflectionLmsPage.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const savedReflectionLms = await reflectionLmsPage.evaluate(() => ({ ...window.__lmsState.values }));
    fail(savedReflectionLms['cmi.suspend_data'].includes('Learner A'), 'Reflection prose leaked into LMS suspend_data');
    await reflectionLmsPage.close();
    const reopenedLmsPage = await reflectionLmsContext.newPage();
    monitor(reopenedLmsPage, 'same-browser LMS reflection reopen', origin);
    await reopenedLmsPage.goto(`${origin}/lesson-1/`, { waitUntil: 'networkidle' });
    fail((await reopenedLmsPage.locator('#l1-reflection-input').inputValue()) !== 'Learner A discovery question', 'Lesson 1 LMS response did not restore after browser page reopened');
    await reopenedLmsPage.locator('.lesson-navigation__link--previous').click();
    await reopenedLmsPage.waitForLoadState('networkidle');
    fail((await reopenedLmsPage.locator('#lesson-0-response').inputValue()) !== 'Learner A starting point', 'Lesson 0 LMS response did not restore after lesson navigation');
    await reopenedLmsPage.evaluate(() => sessionStorage.setItem('__reflection_learner', 'learner-B'));
    await reopenedLmsPage.reload({ waitUntil: 'networkidle' });
    fail((await reopenedLmsPage.locator('#lesson-0-response').inputValue()) !== '', 'Another LMS learner saw the prior learner’s Lesson 0 response');
    await reopenedLmsPage.goto(`${origin}/lesson-1/`, { waitUntil: 'networkidle' });
    fail((await reopenedLmsPage.locator('#l1-reflection-input').inputValue()) !== '', 'Another LMS learner saw the prior learner’s Lesson 1 response');
    await reopenedLmsPage.evaluate(() => sessionStorage.setItem('__reflection_learner', 'learner-A'));
    await reopenedLmsPage.reload({ waitUntil: 'networkidle' });
    fail((await reopenedLmsPage.locator('#l1-reflection-input').inputValue()) !== 'Learner A discovery question', 'Returning LMS learner did not regain their local response');
    await reflectionLmsContext.close();

    const differentDeviceContext = await browser.newContext();
    await differentDeviceContext.addInitScript((values) => {
      const saved = { ...values };
      window.API = {
        LMSInitialize: () => 'true', LMSFinish: () => 'true',
        LMSGetValue: (element) => saved[element] || '',
        LMSSetValue: (element, value) => { saved[element] = value; return 'true'; },
        LMSCommit: () => 'true', LMSGetLastError: () => '0', LMSGetErrorString: () => 'No error', LMSGetDiagnostic: () => '',
      };
    }, savedReflectionLms);
    const differentDevicePage = await differentDeviceContext.newPage();
    monitor(differentDevicePage, 'different-device LMS reflection resume', origin);
    await differentDevicePage.goto(`${origin}/lesson-1/`, { waitUntil: 'networkidle' });
    fail((await differentDevicePage.locator('#l1-reflection-input').inputValue()) !== '', 'LMS falsely restored written text on a different browser');
    fail((await differentDevicePage.locator('[data-checklist-activity="lesson-1-reflection"]').getAttribute('data-checklist-state')) !== 'completed', 'LMS reflection completion milestone did not resume on a different browser');
    await differentDeviceContext.close();

    const unidentifiedContext = await browser.newContext();
    await unidentifiedContext.addInitScript(({ key, values }) => {
      localStorage.setItem(`${key}:lesson-0-reflection-text`, 'Unrelated standalone response');
      const saved = { ...values, 'cmi.core.student_id': '' };
      window.API = {
        LMSInitialize: () => 'true', LMSFinish: () => 'true',
        LMSGetValue: (element) => saved[element] || '',
        LMSSetValue: (element, value) => { saved[element] = value; return 'true'; },
        LMSCommit: () => 'true', LMSGetLastError: () => '0', LMSGetErrorString: () => 'No error', LMSGetDiagnostic: () => '',
      };
    }, { key: storageKey, values: savedReflectionLms });
    const unidentifiedPage = await unidentifiedContext.newPage();
    monitor(unidentifiedPage, 'LMS reflection without learner ID', origin);
    await unidentifiedPage.goto(`${origin}/lesson-1/`, { waitUntil: 'networkidle' });
    fail((await unidentifiedPage.locator('#l1-reflection-input').inputValue()) !== '', 'LMS without a learner ID showed a shared response');
    await unidentifiedPage.locator('#l1-reflection-input').fill('Unidentified response');
    await unidentifiedPage.locator('[data-l1-reflection] button[type="submit"]').click();
    await unidentifiedPage.reload({ waitUntil: 'networkidle' });
    fail((await unidentifiedPage.locator('#l1-reflection-input').inputValue()) !== '', 'LMS without a learner ID saved text into shared browser storage');
    await unidentifiedContext.close();

    const fullContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    const fullPage = await fullContext.newPage();
    monitor(fullPage, "full seven-lesson completion", origin);
    let fullConfig;
    let cumulative = 0;
    const fullState = async () => fullPage.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"completed":[],"explored":{},"ui":{}}'), storageKey);
    const viewRequirement = async (id) => {
      await fullPage.locator(`#${id}`).evaluate((element) => element.scrollIntoView({ block: "center" }));
      await fullPage.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key) || '{"completed":[]}').completed.includes(id), { key: storageKey, id }, { timeout: 5000 });
    };
    for (let lessonIndex = 0; lessonIndex < routes.length; lessonIndex += 1) {
      await fullPage.goto(`${origin}${routes[lessonIndex]}`, { waitUntil: "networkidle" });
      const config = JSON.parse(await fullPage.locator("[data-course-progress-config]").textContent());
      fullConfig = config;
      const requirements = config.milestones.filter((milestone) => milestone.path === routes[lessonIndex]);
      if (lessonIndex < 6) {
        fail((await fullPage.locator('.lesson-navigation__link--next').getAttribute('href')) !== null, `Lesson ${lessonIndex + 1} unlocked before Lesson ${lessonIndex} reached 100%`);
        fail((await fullPage.locator(`[data-progress-lesson="lesson-${lessonIndex + 1}"]`).getAttribute('data-lesson-state')) !== 'locked', `Lesson ${lessonIndex + 1} progress did not show Locked`);
      }
      for (const milestone of requirements.filter((item) => item.type === "view")) await viewRequirement(milestone.id);
      if (lessonIndex === 0) {
        await fullPage.locator('input[name="scenario-answer"][value="0"]').check();
        await fullPage.locator('[data-assessment-next]').click();
        await fullPage.locator('input[name="knowledge-answer"][value="0"]').check();
        await fullPage.locator('#lesson-0-response').fill('Ask about intended use.');
        await fullPage.locator('[data-reflection-continue]').click();
      } else if (lessonIndex === 1) {
        for (const button of await fullPage.locator('[data-profile-id]').all()) await button.click();
        for (const button of await fullPage.locator('[data-technology-id]').all()) await button.click();
        for (const button of await fullPage.locator('[data-hotspot-id]').all()) await button.click();
        await fullPage.locator('#lesson-1-check-clue input[value="0"]').check();
        await fullPage.locator('#lesson-1-challenge input[value="0"]').check();
        for (const select of await fullPage.locator('[data-match-form] select').all()) await select.selectOption({ index: 1 });
        await fullPage.locator('[data-match-form] button[type="submit"]').click();
        await fullPage.locator('#l1-reflection-input').fill('Ask about distance.');
        await fullPage.locator('[data-l1-reflection] button[type="submit"]').click();
      } else if (lessonIndex <= 5) {
        const scenario = requirements.find((item) => item.id.endsWith('-check') && item.id !== `lesson-${lessonIndex}-knowledge`);
        await fullPage.locator(`#${scenario.id} input[value="0"]`).check();
        await fullPage.locator(`#lesson-${lessonIndex}-knowledge input[value="0"]`).check();
        const productGroup = `lesson-${lessonIndex}-products`;
        const productMilestone = requirements.find((item) => item.id === productGroup);
        for (const productId of productMilestone.requiredItems) {
          const article = fullPage.locator(`#${productGroup}-product-${productId}`);
          const category = await article.evaluate((element) => element.closest('[data-category-panel]').dataset.categoryPanel);
          await fullPage.locator(`#${productGroup}-tab-${category}`).click();
          await fullPage.locator(`#${productGroup}-panel-${category} [data-product-choice="${productId}"]`).click();
          await article.locator('h3').evaluate((element) => element.scrollIntoView({ block: "center" }));
          await fullPage.waitForFunction(({ key, group, productId }) => JSON.parse(localStorage.getItem(key) || '{"explored":{}}').explored[group]?.includes(productId), { key: storageKey, group: productGroup, productId }, { timeout: 5000 });
        }
        fail(!(await fullPage.locator('[data-product-explore-count]').textContent()).includes(`${productMilestone.requiredItems.length} of ${productMilestone.requiredItems.length} shoes explored`), `Lesson ${lessonIndex} product explorer did not show progress`);
        for (const button of await fullPage.locator(`#lesson-${lessonIndex}-feature-cards [data-flip-id]`).all()) await button.click();
        fail(!(await fullPage.locator(`#lesson-${lessonIndex}-feature-cards [data-flip-progress]`).textContent()).includes(`${productMilestone.requiredItems.length} of ${productMilestone.requiredItems.length} cards revealed`), `Lesson ${lessonIndex} flip cards did not show progress`);
        for (const select of await fullPage.locator(`#lesson-${lessonIndex}-matching select`).all()) await select.selectOption({ index: 1 });
        await fullPage.locator(`#lesson-${lessonIndex}-matching button[type="submit"]`).click();
      } else {
        for (const button of await fullPage.locator('[data-run-tab]').all()) await button.click();
        fail(!(await fullPage.locator('[data-run-explore-count]').textContent()).includes('3 of 3 steps explored'), 'RUN exploration count did not update');
      }
      const currentState = await fullState();
      for (const milestone of requirements) fail(!currentState.completed.includes(milestone.id), `Full-course ${milestone.id} did not complete through its learner trigger`);
      cumulative += requirements.length;
      fail((await fullPage.locator('[data-progress-percent]').textContent()) !== `${Math.round(cumulative / config.milestones.length * 100)}%`, `Overall progress is incorrect after Lesson ${lessonIndex}`);
      fail((await fullPage.locator(`[data-progress-lesson="lesson-${lessonIndex}"] .course-progress__lesson-head strong`).textContent()) !== '100%', `Lesson ${lessonIndex} progress is not 100%`);
      fail((await fullPage.locator(`[data-progress-lesson="lesson-${lessonIndex}"]`).getAttribute('data-lesson-state')) !== 'completed', `Lesson ${lessonIndex} status is not Completed`);
      if (lessonIndex < 6) {
        fail((await fullPage.locator(`[data-progress-lesson="lesson-${lessonIndex + 1}"]`).getAttribute('data-lesson-state')) !== 'not-started', `Lesson ${lessonIndex + 1} was completed by another lesson`);
        fail((await fullPage.locator('.lesson-navigation__link--next').getAttribute('href')) !== routes[lessonIndex + 1], `Lesson ${lessonIndex + 1} did not unlock immediately`);
        fail((await fullPage.locator(`.course-links a[data-lesson-path="${routes[lessonIndex + 1]}"]`).getAttribute('href')) !== routes[lessonIndex + 1], `Lesson ${lessonIndex + 1} top navigation did not unlock`);
        fail((await fullPage.locator(`[data-progress-lesson="lesson-${lessonIndex + 1}"] a`).getAttribute('href')) !== routes[lessonIndex + 1], `Lesson ${lessonIndex + 1} progress link did not unlock`);
      }
      await fullPage.reload({ waitUntil: "networkidle" });
      fail((await fullPage.locator(`[data-progress-lesson="lesson-${lessonIndex}"] .course-progress__lesson-head strong`).textContent()) !== '100%', `Lesson ${lessonIndex} progress did not restore on refresh`);
      if (lessonIndex > 0) fail((await fullPage.locator(`.course-links a[data-lesson-path="${routes[lessonIndex - 1]}"]`).getAttribute('href')) !== routes[lessonIndex - 1], `Previously unlocked Lesson ${lessonIndex - 1} became inaccessible`);
    }
    fail((await fullPage.locator('[data-progress-percent]').textContent()) !== '100%', 'Full course did not reach 100% after all 51 requirements');
    const finalState = await fullState();
    fail(finalState.completed.length !== 51, `Full course stored ${finalState.completed.length} completed milestones rather than 51`);
    fail(JSON.stringify(finalState).includes('Ask about intended use.') || JSON.stringify(finalState).includes('Ask about distance.'), 'Reflection free text entered course progress state');
    await fullContext.close();

    const almostComplete = {
      v: storageKey,
      c: fullConfig.milestones.slice(0, -1).map((_, index) => index),
      w: {},
      e: Object.fromEntries(fullConfig.milestones.slice(0, -1).flatMap((milestone, index) => milestone.type === 'explore' ? [[index, milestone.requiredItems]] : [])),
      u: { 'lesson-6-run-active': 2 },
    };
    fail(JSON.stringify(almostComplete).length > 3000, 'Full explored LMS state exceeds the planned 3,000-character headroom');
    const completionLmsContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await completionLmsContext.addInitScript(({ payload }) => {
      const values = { 'cmi.core.lesson_status': 'incomplete', 'cmi.core.lesson_location': '/lesson-6/', 'cmi.suspend_data': payload };
      const calls = [];
      window.__lmsState = { values, calls };
      window.API = {
        LMSInitialize: () => 'true', LMSFinish: () => { calls.push(['LMSFinish']); return 'true'; },
        LMSGetValue: (element) => values[element] || '',
        LMSSetValue: (element, value) => { calls.push(['LMSSetValue', element, value]); values[element] = value; return 'true'; },
        LMSCommit: () => { calls.push(['LMSCommit']); return 'true'; },
        LMSGetLastError: () => '0', LMSGetErrorString: () => 'No error', LMSGetDiagnostic: () => '',
      };
    }, { payload: JSON.stringify(almostComplete) });
    const completionLmsPage = await completionLmsContext.newPage();
    monitor(completionLmsPage, 'final LMS completion', origin);
    await completionLmsPage.goto(`${origin}/lesson-6/`, { waitUntil: 'networkidle' });
    fail((await completionLmsPage.locator('[data-progress-percent]').textContent()) !== '98%', 'Near-complete LMS attempt did not restore 50 of 51 milestones');
    fail((await completionLmsPage.evaluate(() => window.__lmsState)).calls.some((call) => call[1] === 'cmi.core.lesson_status' && call[2] === 'completed'), 'LMS completed on launch');
    await completionLmsPage.locator('#lesson-6-challenge').evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await completionLmsPage.waitForFunction(() => window.__lmsState.values['cmi.core.lesson_status'] === 'completed', null, { timeout: 5000 });
    const completedLms = await completionLmsPage.evaluate(() => window.__lmsState);
    fail(completedLms.values['cmi.suspend_data'].length > 4096, 'Completed LMS suspend_data exceeded 4,096 characters');
    fail(completedLms.values['cmi.core.lesson_location'] !== '/lesson-6/', 'LMS lesson location was not saved');
    fail((await completionLmsPage.locator('[data-progress-percent]').textContent()) !== '100%', 'LMS progress did not reach 100% on final milestone');
    await completionLmsPage.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    fail((await completionLmsPage.evaluate(() => window.__lmsState.values['cmi.core.lesson_status'])) !== 'completed', 'Page exit downgraded completed status');
    await completionLmsContext.close();

    const failedSaveContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await failedSaveContext.addInitScript(({ payload }) => {
      const values = { 'cmi.core.lesson_status': 'incomplete', 'cmi.core.lesson_location': '/lesson-6/', 'cmi.suspend_data': payload };
      const calls = [];
      window.__lmsState = { values, calls };
      window.API = {
        LMSInitialize: () => 'true', LMSFinish: () => 'true',
        LMSGetValue: (element) => values[element] || '',
        LMSSetValue: (element, value) => { calls.push(['LMSSetValue', element, value]); if (element === 'cmi.suspend_data') return 'false'; values[element] = value; return 'true'; },
        LMSCommit: () => { calls.push(['LMSCommit']); return 'true'; },
        LMSGetLastError: () => '0', LMSGetErrorString: () => 'Save rejected', LMSGetDiagnostic: () => '',
      };
    }, { payload: JSON.stringify(almostComplete) });
    const failedSavePage = await failedSaveContext.newPage();
    await failedSavePage.goto(`${origin}/lesson-6/`, { waitUntil: 'networkidle' });
    await failedSavePage.locator('#lesson-6-challenge').evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await failedSavePage.waitForFunction(() => window.__lmsState.calls.some((call) => call[1] === 'cmi.suspend_data'), null, { timeout: 5000 });
    fail((await failedSavePage.locator('[data-progress-percent]').textContent()) !== '98%', 'Rejected LMS save falsely raised course progress to 100%');
    fail((await failedSavePage.evaluate(() => window.__lmsState.values['cmi.core.lesson_status'])) !== 'incomplete', 'Rejected LMS save falsely completed the course');
    await failedSavePage.locator('[data-progress-trigger]').click();
    fail(!(await failedSavePage.locator('[data-progress-save-error]').isVisible()), 'Rejected LMS save did not display a recovery message');
    await failedSaveContext.close();

    for (const finalStatus of ['completed', 'passed']) {
      const reopenContext = await browser.newContext();
      await reopenContext.addInitScript(({ values }) => {
        const saved = { ...values };
        const calls = [];
        window.__lmsState = { values: saved, calls };
        window.API = {
          LMSInitialize: () => { calls.push(['LMSInitialize']); return 'true'; },
          LMSFinish: () => { calls.push(['LMSFinish']); return 'true'; },
          LMSGetValue: (element) => saved[element] || '',
          LMSSetValue: (element, value) => { calls.push(['LMSSetValue', element, value]); saved[element] = value; return 'true'; },
          LMSCommit: () => { calls.push(['LMSCommit']); return 'true'; },
          LMSGetLastError: () => '0', LMSGetErrorString: () => 'No error', LMSGetDiagnostic: () => '',
        };
      }, { values: { ...completedLms.values, 'cmi.core.lesson_status': finalStatus } });
      const reopenPage = await reopenContext.newPage();
      monitor(reopenPage, `${finalStatus} LMS reopen`, origin);
      await reopenPage.goto(`${origin}/lesson-4/`, { waitUntil: 'networkidle' });
      fail((await reopenPage.locator('[data-progress-percent]').textContent()) !== '100%', `${finalStatus} LMS progress did not restore across lessons`);
      await reopenPage.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      const reopen = await reopenPage.evaluate(() => window.__lmsState);
      fail(reopen.values['cmi.core.lesson_status'] !== finalStatus, `${finalStatus} LMS status was overwritten`);
      fail(reopen.calls.some((call) => call[1] === 'cmi.core.lesson_status'), `${finalStatus} LMS status was rewritten on reopen`);
      fail(reopen.calls.filter((call) => call[0] === 'LMSFinish').length !== 1, `${finalStatus} LMS session was not finished once`);
      await reopenContext.close();
    }

    const partialContext = await browser.newContext();
    await partialContext.addInitScript((key) => {
      const values = { 'cmi.core.lesson_status': 'incomplete', 'cmi.core.lesson_location': '/lesson-2/', 'cmi.suspend_data': JSON.stringify({ v: key, c: Array.from({ length: 18 }, (_, index) => index), w: {}, e: { 8: Array.from({ length: 8 }, (_, index) => `profile-${index + 1}`), 10: Array.from({ length: 7 }, (_, index) => `technology-${index + 1}`), 13: Array.from({ length: 4 }, (_, index) => `hotspot-${index + 1}`) }, u: {} }) };
      const calls = [];
      window.__lmsState = { values, calls };
      window.API = {
        LMSInitialize: () => 'true', LMSFinish: () => { calls.push(['LMSFinish']); return 'true'; },
        LMSGetValue: (element) => values[element] || '',
        LMSSetValue: (element, value) => { calls.push(['LMSSetValue', element, value]); values[element] = value; return 'true'; },
        LMSCommit: () => { calls.push(['LMSCommit']); return 'true'; },
        LMSGetLastError: () => '0', LMSGetErrorString: () => 'No error', LMSGetDiagnostic: () => '',
      };
    }, storageKey);
    const partialPage = await partialContext.newPage();
    monitor(partialPage, 'partial LMS save and close', origin);
    await partialPage.goto(`${origin}/lesson-2/`, { waitUntil: 'networkidle' });
    await partialPage.locator('#lesson-2-sipho-check input[value="0"]').check();
    await partialPage.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const partial = await partialPage.evaluate(() => window.__lmsState);
    fail(partial.values['cmi.core.lesson_status'] !== 'incomplete', 'Partial Save and Close completed the LMS');
    fail(partial.values['cmi.core.lesson_location'] !== '/lesson-2/', 'Partial LMS lesson location was not saved');
    fail(partial.values['cmi.suspend_data'].length > 4096, 'Partial LMS suspend_data exceeded 4,096 characters');
    fail(JSON.parse(partial.values['cmi.suspend_data']).u['lesson-2-sipho-check'] !== 0, 'Partial LMS assessment selection was not saved');
    await partialContext.close();

    const partialResumeContext = await browser.newContext();
    await partialResumeContext.addInitScript(({ key, values }) => {
      localStorage.setItem(key, JSON.stringify({ completed: Array.from({ length: 51 }, (_, index) => `stale-${index}`), explored: {}, watchRanges: {}, ui: {} }));
      const saved = { ...values };
      const calls = [];
      window.__lmsState = { values: saved, calls };
      window.API = {
        LMSInitialize: () => 'true', LMSFinish: () => { calls.push(['LMSFinish']); return 'true'; },
        LMSGetValue: (element) => saved[element] || '',
        LMSSetValue: (element, value) => { calls.push(['LMSSetValue', element, value]); saved[element] = value; return 'true'; },
        LMSCommit: () => { calls.push(['LMSCommit']); return 'true'; },
        LMSGetLastError: () => '0', LMSGetErrorString: () => 'No error', LMSGetDiagnostic: () => '',
      };
    }, { key: storageKey, values: partial.values });
    const partialResumePage = await partialResumeContext.newPage();
    monitor(partialResumePage, 'partial LMS resume', origin);
    await partialResumePage.goto(origin, { waitUntil: 'networkidle' });
    await partialResumePage.waitForURL(`${origin}/lesson-2/`);
    fail(new URL(partialResumePage.url()).pathname !== '/lesson-2/', 'People Connect relaunch did not resume at the saved unlocked lesson');
    fail(!(await partialResumePage.locator('#lesson-2-sipho-check input[value="0"]').isChecked()), 'Partial LMS answer did not restore on another browser');
    fail((await partialResumePage.locator('[data-checklist-activity="lesson-2-sipho-check"]').getAttribute('data-checklist-state')) !== 'completed', 'LMS resume did not restore the activity checklist status');
    fail((await partialResumePage.locator('[data-progress-percent]').textContent()) === '100%', 'Stale browser progress overrode partial LMS progress');
    await partialResumePage.goto(`${origin}/lesson-5/`, { waitUntil: 'networkidle' });
    await partialResumePage.waitForURL(`${origin}/lesson-2/`);
    fail(new URL(partialResumePage.url()).pathname !== '/lesson-2/', 'Locked direct URL bypassed Lesson 2 on LMS resume');
    fail((await partialResumePage.locator('[data-progress-lesson="lesson-2"] .course-progress__lesson-head strong').textContent()) === '0%', 'Lesson 2 progress was lost on cross-page LMS resume');
    await partialResumePage.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await partialResumeContext.close();

    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    monitor(page, "tracking fixture", origin);
    await page.goto(`${origin}/__verify-completion/`, { waitUntil: "networkidle" });
    const state = async () => page.evaluate(() => JSON.parse(localStorage.getItem("astro-course-progress:verification-fixture:v1") || '{"completed":[],"watchRanges":{},"explored":{}}'));
    await page.locator("#fixture-view").evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    await page.locator("#fixture-complete").evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(700);
    fail((await state()).completed.includes("fixture-view"), "VIEW completed before 900ms dwell");
    await page.locator("#fixture-view").evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(1000);
    fail(!(await state()).completed.includes("fixture-view"), "VIEW did not complete after 900ms dwell");
    await page.evaluate(() => {
      const video = document.querySelector("#fixture-watch");
      Object.defineProperty(video, "duration", { configurable: true, value: 100 });
      let ranges = [[0, 30], [70, 100]];
      Object.defineProperty(video, "played", { configurable: true, get: () => ({ length: ranges.length, start: (i) => ranges[i][0], end: (i) => ranges[i][1] }) });
      video.dispatchEvent(new Event("timeupdate"));
      window.__setFixtureRanges = (next) => { ranges = next; video.dispatchEvent(new Event("timeupdate")); };
    });
    fail((await state()).completed.includes("fixture-watch"), "WATCH counted seek gaps");
    await page.evaluate(() => window.__setFixtureRanges([[0, 30], [0, 30], [70, 100]]));
    fail((await state()).completed.includes("fixture-watch"), "WATCH counted replayed ranges");
    await page.evaluate(() => window.__setFixtureRanges([[20, 90]]));
    fail(!(await state()).completed.includes("fixture-watch"), "WATCH did not complete at 80% unique ranges");
    await page.locator("#fixture-question button[type='submit']").click();
    fail((await state()).completed.includes("fixture-question"), "Empty submission completed knowledge check");
    await page.locator("#fixture-question [data-completion-option]").check();
    await page.locator("#fixture-question button[type='submit']").click();
    fail(!(await state()).completed.includes("fixture-question"), "Valid submission did not complete knowledge check");
    await page.locator("[data-match-submit]").click();
    fail((await state()).completed.includes("fixture-match"), "Empty matching attempt completed");
    await page.locator("[data-match-choice]").click();
    await page.locator("[data-match-submit]").click();
    fail(!(await state()).completed.includes("fixture-match"), "Matching attempt did not complete");
    await page.locator("#fixture-explore [data-explore-trigger]").nth(0).click();
    await page.locator("#fixture-explore [data-explore-trigger]").nth(1).click();
    fail(!(await state()).completed.includes("fixture-explore"), "EXPLORE did not complete");
    await page.reload({ waitUntil: "networkidle" });
    fail(!(await state()).completed.includes("fixture-watch"), "Browser progress did not restore");
    await context.close();

    for (const viewport of viewports) {
      const fixture = await browser.newPage({ viewport, reducedMotion: "reduce" });
      monitor(fixture, `${viewport.width}px component fixture`, origin);
      await fixture.goto(`${origin}/__verify-components/`, { waitUntil: "networkidle" });
      fail((await fixture.locator(".section-heading").count()) !== 2, "Reusable heading fixture missing");
      fail(await fixture.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${viewport.width}px reusable components overflow`);
      await fixture.close();
    }
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
} catch (error) { errors.push(`Verification setup failed: ${error instanceof Error ? error.message : String(error)}`); }
finally { await rm(verificationDist, { recursive: true, force: true }); }

if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log("Course verification passed: seven routes, 51 learner-triggered milestones, seven lesson progress displays, responsive interactions, browser persistence, simulated LMS save/resume/completion, and reusable component fixtures.");
