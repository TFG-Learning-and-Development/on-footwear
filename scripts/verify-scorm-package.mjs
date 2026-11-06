import { createServer } from "node:http";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { extractZip } from "./scorm-zip.mjs";

const zip = path.resolve("scorm-output", "ON-Match-the-Move-SCORM-1.2.zip");
const root = path.resolve(".verification-scorm");
const extracted = path.join(root, "course");
const courseBase = "/oracle/learning/player/launch/content/package-4827/";
const routes = ["/", ...Array.from({ length: 6 }, (_, index) => `/lesson-${index + 1}/`)];
const expectedCounts = [7, 11, 7, 7, 7, 7, 5];
const failures = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const monitor = (page, label, origin) => {
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`${label}: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) failures.push(`${label}: HTTP ${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") failures.push(`${label}: ${request.failure()?.errorText} ${request.url()}`); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== origin) failures.push(`${label}: external request ${url}`);
  });
};
const installMock = async (context, seed) => context.addInitScript((initial) => {
  const key = "__package_lms_mock";
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ values: initial, calls: [] }));
  const load = () => JSON.parse(localStorage.getItem(key));
  const record = (name, element, value) => {
    const state = load();
    state.calls.push([name, element, value]);
    localStorage.setItem(key, JSON.stringify(state));
    return state;
  };
  window.API = {
    LMSInitialize: () => { record("LMSInitialize"); return "true"; },
    LMSFinish: () => { record("LMSFinish"); return "true"; },
    LMSGetValue: (element) => record("LMSGetValue", element).values[element] || "",
    LMSSetValue: (element, value) => {
      const state = record("LMSSetValue", element, value);
      state.values[element] = value;
      localStorage.setItem(key, JSON.stringify(state));
      return "true";
    },
    LMSCommit: () => { record("LMSCommit"); return "true"; },
    LMSGetLastError: () => "0", LMSGetErrorString: () => "No error", LMSGetDiagnostic: () => "",
  };
}, seed);
const mockState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("__package_lms_mock")));

await rm(root, { recursive: true, force: true });
try {
  const entries = await extractZip(zip, extracted);
  const members = new Set(entries);
  assert(members.size === entries.length, "ZIP contains duplicate entries");
  for (const name of ["imsmanifest.xml", "index.html", ...routes.slice(1).map((route) => `${route.slice(1)}index.html`)]) assert(members.has(name), `Package is missing ${name}`);
  assert(!entries.some((name) => name.startsWith("__verify-")), "Verification fixture entered the ZIP");
  const manifest = await readFile(path.join(extracted, "imsmanifest.xml"), "utf8");
  assert(/<schemaversion>1\.2<\/schemaversion>/.test(manifest) && /adlcp:scormtype="sco"/.test(manifest), "Manifest is not SCORM 1.2 SCO metadata");
  assert(!/SCORM\s*2004|imsss:|adlcp:scormType=/.test(manifest), "SCORM 2004 declaration entered the manifest");
  assert(manifest.includes("<title>Content</title>"), "Manifest title changed");
  const launch = manifest.match(/<resource\b[^>]*\bhref="([^"]+)"/);
  assert(launch && members.has(launch[1]), "Manifest launch resource is missing from ZIP");
  for (const name of entries.filter((name) => name !== "imsmanifest.xml")) {
    const escaped = name.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
    assert(manifest.includes(`<file href="${escaped}"/>`), `Manifest does not list ${name}`);
  }
  for (const name of entries.filter((name) => /\.(?:html|css|js)$/.test(name))) {
    const content = await readFile(path.join(extracted, ...name.split("/")), "utf8");
    assert(!content.includes("Reset Progress"), `Reset Progress entered ${name}`);
    assert(!/localhost|127\.0\.0\.1/.test(content), `Development host URL entered ${name}`);
    if (name.endsWith(".html")) {
      assert(!/\b(?:src|href|data-image-src)="\/(?!\/)/.test(content), `Root-relative HTML URL remains in ${name}`);
      assert(content.includes('data-scorm-package="true"'), `Package routing marker is missing in ${name}`);
      assert(/<title>Content<\/title>/.test(content), `Browser title changed in ${name}`);
      assert(content.includes("Return to People Connect to continue"), `Footer text changed in ${name}`);
      for (const [, reference] of content.matchAll(/\b(?:src|data-image-src)="([^"#?]+)"/g)) {
        if (/^(?:https?:|data:)/.test(reference)) continue;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), decodeURIComponent(reference)));
        assert(members.has(target), `Broken asset reference ${reference} in ${name}`);
      }
    }
    if (name.endsWith(".css")) assert(!/url\(["']?\/assets\//.test(content), `Root-relative CSS asset remains in ${name}`);
  }
  const html = await readFile(path.join(extracted, "index.html"), "utf8");
  const embedded = html.match(/<script type="application\/json" data-course-progress-config>(.*?)<\/script>/s);
  assert(embedded, "Packaged completion configuration is missing");
  const config = JSON.parse(embedded[1]);
  const milestones = config.milestones.filter((item) => item.required);
  assert(config.storageKey === "astro-course-progress:on-match-the-move:v3" && config.completionEnabled === true, "Completion configuration changed");
  assert(milestones.length === 51 && new Set(milestones.map((item) => item.id)).size === 51, "Package does not contain 51 unique required milestones");
  routes.forEach((route, index) => assert(milestones.filter((item) => item.path === route).length === expectedCounts[index], `Lesson ${index} requirement count changed`));
  assert(!milestones.some((item) => /people.connect|final.quiz/i.test(item.id)), "People Connect assessment entered completion requirements");

  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
      if (!pathname.startsWith(courseBase)) throw new Error("Outside package URL");
      const relative = pathname.slice(courseBase.length);
      if (!relative || relative.endsWith("/")) throw new Error("Directory URLs are not served by this LMS simulation");
      const target = path.resolve(extracted, relative);
      if (!target.startsWith(`${extracted}${path.sep}`) || !(await stat(target)).isFile()) throw new Error("Missing package file");
      response.writeHead(200, { "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream" });
      response.end(await readFile(target));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const packageUrl = (file) => `${origin}${courseBase}${file}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const seed = (indexes, status = "incomplete", location = "/") => ({
      "cmi.core.lesson_status": status,
      "cmi.core.lesson_location": location,
      "cmi.core.student_id": "package-learner-A",
      "cmi.suspend_data": JSON.stringify({
        v: config.storageKey, c: indexes, w: {},
        e: Object.fromEntries(indexes.filter((index) => milestones[index].type === "explore").map((index) => [index, milestones[index].requiredItems])),
        u: {},
      }),
    });
    const freshContext = await browser.newContext();
    await installMock(freshContext, { "cmi.core.lesson_status": "not attempted", "cmi.core.lesson_location": "/", "cmi.core.student_id": "package-learner-A", "cmi.suspend_data": "" });
    const freshPage = await freshContext.newPage();
    monitor(freshPage, "fresh packaged launch", origin);
    await freshPage.goto(packageUrl(launch[1]), { waitUntil: "networkidle" });
    assert((await freshPage.locator("[data-progress-percent]").textContent()) === "0%", "Fresh learner did not start at 0%");
    for (let index = 1; index <= 6; index += 1) assert((await freshPage.locator(`[data-progress-lesson="lesson-${index}"]`).getAttribute("data-lesson-state")) === "locked", `Lesson ${index} was not initially locked`);
    assert(!(await mockState(freshPage)).calls.some((call) => call[0] === "LMSSetValue" && call[1] === "cmi.core.lesson_status" && call[2] === "completed"), "Course completed on launch");
    await freshPage.goto(packageUrl("lesson-1/index.html"), { waitUntil: "networkidle" });
    await freshPage.waitForURL(packageUrl("index.html"));
    await freshPage.locator("#lesson-0-response").fill("Packaged learner reflection");
    await freshPage.locator("[data-reflection-continue]").click();
    const partial = await mockState(freshPage);
    assert(partial.values["cmi.core.lesson_status"] === "incomplete", "Reflection completed the LMS early");
    assert(!partial.values["cmi.suspend_data"].includes("Packaged learner reflection"), "Reflection prose was sent to the LMS");
    assert(partial.values["cmi.suspend_data"].length <= 4096, "Packaged suspend_data exceeds 4,096 characters");
    assert(JSON.parse(partial.values["cmi.suspend_data"]).c.includes(milestones.findIndex((item) => item.id === "lesson-0-reflection")), "Reflection milestone did not save to LMS");
    await freshPage.reload({ waitUntil: "networkidle" });
    assert((await freshPage.locator("#lesson-0-response").inputValue()) === "Packaged learner reflection", "Same-browser LMS reflection did not restore");
    await freshPage.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    const savedClose = await mockState(freshPage);
    assert(savedClose.calls.some((call) => call[0] === "LMSFinish"), "Packaged Save and Close did not finish the LMS session");
    assert(savedClose.values["cmi.core.lesson_status"] === "incomplete", "Save and Close completed a partial attempt");
    await freshContext.close();

    const resumeContext = await browser.newContext();
    await installMock(resumeContext, savedClose.values);
    const resumePage = await resumeContext.newPage();
    monitor(resumePage, "packaged partial resume", origin);
    await resumePage.goto(packageUrl(launch[1]), { waitUntil: "networkidle" });
    assert((await resumePage.locator("#lesson-0-response").inputValue()) === "", "Different-browser LMS resume invented written reflection text");
    assert((await resumePage.locator('[data-checklist-activity="lesson-0-reflection"]').getAttribute("data-checklist-state")) === "completed", "Different-browser LMS resume lost reflection milestone");
    await resumeContext.close();

    for (let lesson = 0; lesson < 6; lesson += 1) {
      const count = expectedCounts.slice(0, lesson + 1).reduce((total, item) => total + item, 0);
      const context = await browser.newContext();
      await installMock(context, seed(Array.from({ length: count }, (_, index) => index)));
      const page = await context.newPage();
      monitor(page, `packaged lesson ${lesson + 1} unlock`, origin);
      await page.goto(packageUrl(`lesson-${lesson + 1}/index.html`), { waitUntil: "networkidle" });
      assert(page.url() === packageUrl(`lesson-${lesson + 1}/index.html`), `Lesson ${lesson + 1} did not unlock after Lesson ${lesson} reached 100%`);
      assert((await page.locator(`[data-progress-lesson="lesson-${lesson}"] .course-progress__lesson-head strong`).textContent()) === "100%", `Lesson ${lesson} percent did not restore`);
      if (lesson < 5) {
        await page.goto(packageUrl(`lesson-${lesson + 2}/index.html`), { waitUntil: "networkidle" });
        await page.waitForURL(packageUrl(`lesson-${lesson + 1}/index.html`));
      }
      if (lesson >= 1 && lesson <= 4) {
        const alternate = page.locator('[data-image-src]').nth(1);
        if (await alternate.count()) {
          await alternate.click();
          await page.waitForFunction(() => [...document.querySelectorAll('[data-product-image]')].some((image) => image.complete && image.naturalWidth > 0));
        }
      }
      await context.close();
    }

    const sequenceContext = await browser.newContext();
    await installMock(sequenceContext, seed(Array.from({ length: 51 }, (_, index) => index), "completed"));
    const sequencePage = await sequenceContext.newPage();
    monitor(sequencePage, "packaged seven-lesson navigation", origin);
    await sequencePage.goto(packageUrl("index.html"), { waitUntil: "networkidle" });
    for (let lesson = 0; lesson <= 6; lesson += 1) {
      const file = lesson === 0 ? "index.html" : `lesson-${lesson}/index.html`;
      assert(sequencePage.url() === packageUrl(file), `Lesson ${lesson} opened a directory or wrong file`);
      assert((await sequencePage.locator("[data-course-path]").getAttribute("data-course-path")) === routes[lesson], `Lesson ${lesson} content did not render`);
      assert(await sequencePage.locator("main h1").isVisible(), `Lesson ${lesson} heading is missing or hidden`);
      assert(await sequencePage.evaluate(() => document.styleSheets.length > 0), `Lesson ${lesson} CSS did not load`);
      await sequencePage.evaluate(() => document.querySelectorAll("img[loading='lazy']").forEach((image) => { image.loading = "eager"; }));
      await sequencePage.waitForFunction(() => [...document.images].every((image) => image.complete), null, { timeout: 12000 });
      const brokenImages = await sequencePage.evaluate(() => [...document.images].filter((image) => image.naturalWidth === 0).map((image) => image.src));
      assert(brokenImages.length === 0, `Lesson ${lesson} has broken images: ${brokenImages.join(", ")}`);
      if (lesson === 1) {
        const before = await sequencePage.locator('[data-profile-id="profile-1"]').getAttribute("aria-expanded");
        await sequencePage.locator('[data-profile-id="profile-1"]').click();
        assert((await sequencePage.locator('[data-profile-id="profile-1"]').getAttribute("aria-expanded")) !== before, "Packaged Lesson 1 profile interaction failed");
      }
      if (lesson >= 2 && lesson <= 5) {
        const alternate = sequencePage.locator('[data-image-src]:visible').nth(1);
        await alternate.click();
        const selected = await alternate.getAttribute("data-image-src");
        assert(selected && !selected.startsWith("/assets/") && (await sequencePage.locator('[data-product-image]:visible').first().getAttribute("src")) === selected, `Packaged Lesson ${lesson} gallery path failed`);
      }
      if (lesson === 6) {
        await sequencePage.locator('#run-tab-1').click();
        assert((await sequencePage.locator('#run-tab-1').getAttribute("aria-selected")) === "true", "Packaged RUN framework interaction failed");
      }
      if (lesson === 6) break;
      const nextFile = `lesson-${lesson + 1}/index.html`;
      const next = sequencePage.locator('.lesson-navigation__link--next');
      assert((await next.getAttribute("href")) === `${courseBase}${nextFile}`, `Lesson ${lesson} Next path is not an explicit packaged file`);
      await next.click();
      await sequencePage.waitForURL(packageUrl(nextFile));
      const previous = sequencePage.locator('.lesson-navigation__link--previous');
      assert(new URL(await previous.getAttribute("href"), sequencePage.url()).href === packageUrl(file), `Lesson ${lesson + 1} Previous path is not an explicit packaged file`);
      await previous.click();
      await sequencePage.waitForURL(packageUrl(file));
      await sequencePage.locator('.lesson-navigation__link--next').click();
      await sequencePage.waitForURL(packageUrl(nextFile));
    }
    await sequencePage.locator('[data-progress-trigger]').click();
    await sequencePage.locator('[data-progress-lesson="lesson-2"] a').click();
    await sequencePage.waitForURL(packageUrl("lesson-2/index.html"));
    await sequencePage.locator('.lessons-toggle').click();
    await sequencePage.locator('[data-lesson-path="/lesson-4/"]').click();
    await sequencePage.waitForURL(packageUrl("lesson-4/index.html"));
    assert((await sequencePage.locator('[data-progress-percent]').textContent()) === "100%", "Progress was lost during packaged navigation");
    await sequenceContext.close();

    const activityContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    await installMock(activityContext, { "cmi.core.lesson_status": "not attempted", "cmi.core.lesson_location": "/", "cmi.core.student_id": "package-activity-learner", "cmi.suspend_data": "" });
    const activityPage = await activityContext.newPage();
    monitor(activityPage, "packaged 51 learner triggers", origin);
    await activityPage.goto(packageUrl("index.html"), { waitUntil: "networkidle" });
    const completedIndexes = async () => JSON.parse((await mockState(activityPage)).values["cmi.suspend_data"] || '{"c":[]}').c;
    const viewRequirement = async (milestone) => {
      await activityPage.locator(`#${milestone.targetId}`).evaluate((element) => element.scrollIntoView({ block: "center" }));
      const index = milestones.findIndex((item) => item.id === milestone.id);
      await activityPage.waitForFunction((target) => JSON.parse(JSON.parse(localStorage.getItem("__package_lms_mock")).values["cmi.suspend_data"] || '{"c":[]}').c.includes(target), index, { timeout: 6000 });
    };
    let cumulative = 0;
    for (let lesson = 0; lesson <= 6; lesson += 1) {
      const requirements = milestones.filter((item) => item.path === routes[lesson]);
      for (const milestone of requirements.filter((item) => item.type === "view")) await viewRequirement(milestone);
      if (lesson === 0) {
        await activityPage.locator('input[name="scenario-answer"][value="0"]').check();
        await activityPage.locator('[data-assessment-next]').click();
        await activityPage.locator('input[name="knowledge-answer"][value="0"]').check();
        await activityPage.locator('#lesson-0-response').fill('Ask about intended use.');
        await activityPage.locator('[data-reflection-continue]').click();
      } else if (lesson === 1) {
        for (const button of await activityPage.locator('[data-profile-id]').all()) await button.click();
        for (const button of await activityPage.locator('[data-technology-id]').all()) await button.click();
        for (const button of await activityPage.locator('[data-hotspot-id]').all()) await button.click();
        await activityPage.locator('#lesson-1-check-clue input[value="0"]').check();
        await activityPage.locator('#lesson-1-challenge input[value="0"]').check();
        for (const select of await activityPage.locator('[data-match-form] select').all()) await select.selectOption({ index: 1 });
        await activityPage.locator('[data-match-form] button[type="submit"]').click();
        await activityPage.locator('#l1-reflection-input').fill('Ask about distance.');
        await activityPage.locator('[data-l1-reflection] button[type="submit"]').click();
      } else if (lesson <= 5) {
        await activityPage.locator(`#lesson-${lesson}-${lesson === 2 ? 'sipho' : lesson === 3 ? 'anele' : lesson === 4 ? 'lerato' : 'thabo'}-check input[value="0"]`).check();
        await activityPage.locator(`#lesson-${lesson}-knowledge input[value="0"]`).check();
        const productGroup = `lesson-${lesson}-products`;
        const productMilestone = requirements.find((item) => item.id === productGroup);
        for (const productId of productMilestone.requiredItems) {
          const article = activityPage.locator(`#${productGroup}-product-${productId}`);
          const category = await article.evaluate((element) => element.closest('[data-category-panel]').dataset.categoryPanel);
          await activityPage.locator(`#${productGroup}-tab-${category}`).click();
          await activityPage.locator(`#${productGroup}-panel-${category} [data-product-choice="${productId}"]`).click();
          await article.locator('h3').evaluate((element) => element.scrollIntoView({ block: "center" }));
          const index = milestones.findIndex((item) => item.id === productGroup);
          await activityPage.waitForFunction(({ index, productId }) => JSON.parse(JSON.parse(localStorage.getItem("__package_lms_mock")).values["cmi.suspend_data"]).e[index]?.includes(productId), { index, productId }, { timeout: 6000 });
        }
        for (const button of await activityPage.locator(`#lesson-${lesson}-feature-cards [data-flip-id]`).all()) await button.click();
        for (const select of await activityPage.locator(`#lesson-${lesson}-matching select`).all()) await select.selectOption({ index: 1 });
        await activityPage.locator(`#lesson-${lesson}-matching button[type="submit"]`).click();
      } else {
        for (const button of await activityPage.locator('[data-run-tab]').all()) await button.click();
      }
      const done = await completedIndexes();
      for (const milestone of requirements) assert(done.includes(milestones.findIndex((item) => item.id === milestone.id)), `Packaged learner trigger failed: ${milestone.id}`);
      cumulative += requirements.length;
      assert((await activityPage.locator('[data-progress-percent]').textContent()) === `${Math.round(cumulative / 51 * 100)}%`, `Packaged overall progress is wrong after Lesson ${lesson}`);
      assert((await activityPage.locator(`[data-progress-lesson="lesson-${lesson}"] .course-progress__lesson-head strong`).textContent()) === "100%", `Packaged Lesson ${lesson} did not reach 100%`);
      if (lesson < 6) {
        const nextFile = `lesson-${lesson + 1}/index.html`;
        await activityPage.locator('.lesson-navigation__link--next').click();
        await activityPage.waitForURL(packageUrl(nextFile));
        assert((await activityPage.locator('[data-progress-percent]').textContent()) === `${Math.round(cumulative / 51 * 100)}%`, `Progress was lost entering packaged Lesson ${lesson + 1}`);
      }
    }
    const activityState = await mockState(activityPage);
    assert(activityState.values["cmi.core.lesson_status"] === "completed", "The 51st packaged trigger did not complete the LMS");
    assert(!activityState.values["cmi.suspend_data"].includes('Ask about intended use.') && !activityState.values["cmi.suspend_data"].includes('Ask about distance.'), "Packaged reflection prose entered LMS suspend_data");
    assert(activityState.values["cmi.suspend_data"].length <= 4096, "Full packaged progress exceeds SCORM 1.2 suspend_data limit");
    await activityContext.close();

    const completionContext = await browser.newContext();
    await installMock(completionContext, seed(Array.from({ length: 50 }, (_, index) => index), "incomplete", "/lesson-6/"));
    const completionPage = await completionContext.newPage();
    monitor(completionPage, "packaged final completion", origin);
    await completionPage.goto(packageUrl("lesson-6/index.html"), { waitUntil: "networkidle" });
    assert((await mockState(completionPage)).values["cmi.core.lesson_status"] === "incomplete", "Package completed before final requirement");
    await completionPage.locator("#lesson-6-challenge").evaluate((element) => element.scrollIntoView({ block: "center" }));
    await completionPage.waitForFunction(() => JSON.parse(localStorage.getItem("__package_lms_mock")).values["cmi.core.lesson_status"] === "completed", null, { timeout: 8000 });
    const completed = await mockState(completionPage);
    assert(JSON.parse(completed.values["cmi.suspend_data"]).c.length === 51, "Final completion did not save all 51 milestones");
    assert(completed.values["cmi.suspend_data"].length <= 4096, "Final suspend_data exceeds 4,096 characters");
    await completionContext.close();

    for (const status of ["completed", "passed"]) {
      const context = await browser.newContext();
      await installMock(context, { ...completed.values, "cmi.core.lesson_status": status });
      const page = await context.newPage();
      monitor(page, `${status} packaged reopen`, origin);
      await page.goto(packageUrl(launch[1]), { waitUntil: "networkidle" });
      await page.waitForURL(packageUrl("lesson-6/index.html"));
      assert((await page.locator("[data-progress-percent]").textContent()) === "100%", `${status} attempt did not resume at 100%`);
      const restored = await mockState(page);
      assert(restored.values["cmi.core.lesson_status"] === status, `${status} attempt was downgraded`);
      assert(!restored.calls.some((call) => call[0] === "LMSSetValue" && call[1] === "cmi.core.lesson_status"), `${status} attempt status was rewritten`);
      await context.close();
    }
    assert(failures.length === 0, `Packaged browser errors: ${failures.join("; ")}`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
  console.log(`Extracted SCORM 1.2 ZIP verified under strict nested file hosting: ${zip}; ${entries.length} files, seven rendered routes, all 51 learner triggers, Next/Previous navigation, sequential unlocking, reflection isolation, partial resume and completed-attempt reopen.`);
} finally { await rm(root, { recursive: true, force: true }); }
