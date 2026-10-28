import { createServer } from "node:http";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { extractZip } from "./scorm-zip.mjs";

const zip = path.resolve("scorm-output", "Content-SCORM-1.2.zip");
const extracted = path.resolve(".verification-scorm", "course");
const root = path.dirname(extracted);
await rm(root, { recursive: true, force: true });
try {
  const entries = await extractZip(zip, extracted);
  for (const required of ["index.html", "imsmanifest.xml"]) if (!entries.includes(required)) throw new Error(`${required} is missing at ZIP root`);
  if (entries.some((name) => name.startsWith("__verify-"))) throw new Error("Verification fixture leaked into ZIP");
  const manifest = await readFile(path.join(extracted, "imsmanifest.xml"), "utf8");
  const html = await readFile(path.join(extracted, "index.html"), "utf8");
  const embeddedConfig = html.match(/<script type="application\/json" data-course-progress-config>(.*?)<\/script>/s);
  if (!embeddedConfig) throw new Error("Packaged milestone configuration is missing");
  const packageConfig = JSON.parse(embeddedConfig[1]);
  const requiredIds = packageConfig.milestones.filter((milestone) => milestone.required).map((milestone) => milestone.id);
  if (!manifest.includes("<schemaversion>1.2</schemaversion>") || !manifest.includes('adlcp:scormtype="sco" href="index.html"') || !manifest.includes("<title>Content</title>")) throw new Error("SCORM 1.2 manifest metadata is incorrect");
  if (/<title>\s*Content\s*<\/title>/.test(html) === false) throw new Error("Browser title is not Content");
  if (entries.some((name) => !manifest.includes(`<file href="${name}"/>`) && name !== "imsmanifest.xml")) throw new Error("Manifest does not list every course file");
  for (const name of entries.filter((name) => /\.(?:html|css|js)$/.test(name))) {
    const content = await readFile(path.join(extracted, ...name.split("/")), "utf8");
    if (content.includes("Reset Progress")) throw new Error(`Reset Progress remains in ${name}`);
    if (name.endsWith(".html") && /(?:src|href)="\/(?:assets|_astro)\//.test(content)) throw new Error(`Root-relative asset in ${name}`);
    if (name.endsWith(".css") && /url\(["']?\/assets\//.test(content)) throw new Error(`Root-relative CSS asset in ${name}`);
  }

  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const target = path.resolve(root, `.${pathname}`);
      if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid path");
      const info = await stat(target);
      if (!info.isFile()) throw new Error("Not a file");
      response.writeHead(200, { "Content-Type": mime[path.extname(target)] || "application/octet-stream" });
      response.end(await readFile(target));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/course/index.html`;
  const browser = await chromium.launch({ headless: true });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const networkErrors = [];
  const installMock = async (context, initial = {}) => {
    await context.addInitScript((seed) => {
      const key = "__lms_mock";
      const load = () => JSON.parse(localStorage.getItem(key) || "null") || { values: { "cmi.core.lesson_status": seed.status || "not attempted", "cmi.suspend_data": seed.suspendData || "" }, calls: [], error: "0", failSet: seed.failSet || "", failInitialize: seed.failInitialize || false };
      const save = (state) => localStorage.setItem(key, JSON.stringify(state));
      const call = (name, element, value) => { const state = load(); state.calls.push({ name, element, value }); save(state); return state; };
      window.API = {
        LMSInitialize: () => { const state = call("LMSInitialize"); if (state.failInitialize) { state.error = "101"; save(state); return "false"; } return "true"; },
        LMSFinish: () => { call("LMSFinish"); return "true"; },
        LMSGetValue: (element) => { const state = call("LMSGetValue", element); state.error = "0"; save(state); return state.values[element] || ""; },
        LMSSetValue: (element, value) => { const state = call("LMSSetValue", element, value); if (state.failSet === element) { state.error = "405"; save(state); return "false"; } state.error = "0"; state.values[element] = value; save(state); return "true"; },
        LMSCommit: () => { call("LMSCommit"); return "true"; },
        LMSGetLastError: () => load().error,
        LMSGetErrorString: (code) => code === "405" ? "Write failure" : code === "101" ? "Initialization failure" : "No error",
        LMSGetDiagnostic: (code) => `Mock diagnostic ${code}`,
      };
    }, initial);
  };
  const lmsState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("__lms_mock")));
  const open = async (context) => {
    const page = await context.newPage();
    page.on("response", (response) => { if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`); });
    page.on("requestfailed", (request) => networkErrors.push(`Request failed: ${request.url()}`));
    const response = await page.goto(url, { waitUntil: "networkidle" });
    assert(response?.ok(), "Extracted package did not launch");
    return page;
  };
  try {
    const context = await browser.newContext();
    await installMock(context);
    await context.addInitScript(({ ids, storageKey }) => localStorage.setItem(storageKey, JSON.stringify({ completed: ids, watchRanges: {}, explored: {} })), { ids: requiredIds, storageKey: packageConfig.storageKey });
    let page = await open(context);
    assert((await page.title()) === "Content", "Extracted browser title changed");
    assert(await page.locator("[data-progress-reset]").count() === 0, "Learner-facing reset control remains");
    assert((await lmsState(page)).values["cmi.core.lesson_status"] === "incomplete", "Fresh LMS attempt was completed on launch or loaded stale browser progress");
    assert((await page.locator("[data-progress-percent]").textContent()) !== "100%", "Stale browser storage completed a fresh LMS attempt");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      delete document.visibilityState;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert((await lmsState(page)).calls.every((call) => call.name !== "LMSFinish"), "Tab visibility finished the LMS session");
    await page.locator("#lesson-2").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(1000);
    const partial = await lmsState(page);
    assert(partial.values["cmi.core.lesson_status"] === "incomplete" && partial.values["cmi.suspend_data"].includes("nike-winflo-12:v3"), "Partial progress was not saved as incomplete");
    await page.evaluate(() => { window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pagehide")); });
    assert((await lmsState(page)).calls.filter((call) => call.name === "LMSFinish").length === 1, "LMSFinish was not guarded on exit");
    await page.close();
    page = await open(context);
    assert((await page.locator('[data-progress-completed] [data-progress-target="lesson-2"]').count()) === 1 || (await page.locator("[data-progress-percent]").textContent()) !== "0%", "Partial LMS progress did not resume");
    const config = await page.locator("[data-course-progress-config]").textContent();
    const required = JSON.parse(config).milestones.filter((milestone) => milestone.required);
    assert(required.length > 0 && required.every((milestone) => milestone.targetId && milestone.id), "Required milestones are missing");
    const registration = await page.evaluate((milestones) => milestones.map((milestone) => {
      const target = document.getElementById(milestone.targetId);
      let childrenValid = true;
      if (milestone.type === "explore") {
        const childIds = JSON.parse(target?.dataset.requiredItems || "[]");
        childrenValid = childIds.length > 0 && childIds.every((id) => target?.querySelector(`[data-item-id="${id}"], [data-explore-item="${id}"]`));
      }
      return Boolean(target && target.dataset.completionId === milestone.id && childrenValid && (milestone.type !== "watch" || target instanceof HTMLVideoElement));
    }), required);
    assert(registration.every(Boolean), "A required milestone lacks a valid target or exploration child");
    assert((await page.locator("#recap h2").textContent()) === "Course Recap: Ready to Recommend", "Course recap heading is missing");
    for (const milestone of required.filter((item) => item.type === "view" && item.id !== "recap")) {
      await page.locator(`#${milestone.targetId}`).evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(960);
    }
    for (const milestone of required.filter((item) => item.type === "explore")) {
      const carousel = page.locator(`#${milestone.targetId}`);
      const total = await carousel.locator("[data-item-id]").count();
      for (let index = 1; index < total; index += 1) await carousel.locator("[data-carousel-next]").click();
    }
    await page.locator('#needs-match [data-match-id="soft"] select').selectOption("heel");
    await page.locator("#needs-match [data-match-submit]").click();
    for (let index = 1; index <= 2; index += 1) {
      if (index > 1) await page.locator("[data-practice-next]").click();
      await page.locator(`#practice-${index} input[type="radio"]`).first().check();
      await page.locator(`#practice-${index} [type="submit"]`).click();
    }
    assert((await lmsState(page)).values["cmi.core.lesson_status"] === "incomplete", "LMS completed before the final required milestone");
    await page.locator("[data-practice-next]").click();
    await page.locator('#practice-3 input[type="radio"]').first().check();
    await page.locator('#practice-3 [type="submit"]').click();
    assert((await lmsState(page)).values["cmi.core.lesson_status"] === "incomplete", "LMS completed before the recap was viewed");
    await page.locator("#recap").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(1000);
    const finished = await lmsState(page);
    assert(finished.values["cmi.core.lesson_status"] === "completed", "All required milestones did not set completed");
    const completionCall = finished.calls.findIndex((call) => call.name === "LMSSetValue" && call.element === "cmi.core.lesson_status" && call.value === "completed");
    assert(completionCall >= 0 && finished.calls.slice(completionCall + 1).some((call) => call.name === "LMSCommit"), "Completed status was not committed immediately");
    assert(finished.calls.every((call) => !/cmi\.core\.score|passed|failed/.test(`${call.element || ""}:${call.value || ""}`)), "Score or pass/fail was invented");
    await page.close();
    page = await open(context);
    assert((await lmsState(page)).values["cmi.core.lesson_status"] === "completed" && (await page.locator("[data-progress-percent]").textContent()) === "100%", "Completed attempt did not reopen intact");
    await context.close();

    const passedContext = await browser.newContext();
    await installMock(passedContext, { status: "passed" });
    const passedPage = await open(passedContext);
    assert((await lmsState(passedPage)).values["cmi.core.lesson_status"] === "passed", "Existing passed status was downgraded");
    await passedContext.close();

    const failureContext = await browser.newContext();
    await installMock(failureContext, { failSet: "cmi.suspend_data" });
    const failures = [];
    const failurePage = await failureContext.newPage();
    failurePage.on("console", (message) => { if (message.type() === "error") failures.push(message.text()); });
    await failurePage.goto(url, { waitUntil: "networkidle" });
    await failurePage.locator("#lesson-2").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await failurePage.waitForTimeout(1000);
    assert(failures.some((message) => message.includes("LMSSetValue") && message.includes("cmi.suspend_data") && message.includes("405")), "API write failure lacked useful diagnostics");
    await failureContext.close();

    const initializationFailure = await browser.newContext();
    await installMock(initializationFailure, { failInitialize: true });
    const initializationErrors = [];
    const initializationPage = await initializationFailure.newPage();
    initializationPage.on("console", (message) => { if (message.type() === "error") initializationErrors.push(message.text()); });
    await initializationPage.goto(url, { waitUntil: "networkidle" });
    assert(initializationErrors.some((message) => message.includes("LMSInitialize") && message.includes("101")), "Initialization failure lacked useful diagnostics");
    assert((await initializationPage.locator("[data-progress-percent]").textContent()) !== "100%", "Initialization failure completed the course");
    await initializationFailure.close();

    const standalone = await browser.newContext();
    const standalonePage = await open(standalone);
    await standalonePage.locator("#lesson-2").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await standalonePage.waitForTimeout(1000);
    await standalonePage.reload({ waitUntil: "networkidle" });
    assert((await standalonePage.locator('[data-progress-completed] [data-progress-target="lesson-2"]').count()) === 1, "Standalone browser storage did not restore progress");
    await standalone.close();
    assert(networkErrors.length === 0, `Extracted course had failed resources: ${networkErrors.join(", ")}`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
  console.log(`Extracted SCORM ZIP verified: ${zip}; fresh, partial, resume, completion, completed/passed reopen, stale storage, API failure, standalone, package roots and relative assets.`);
} finally { await rm(root, { recursive: true, force: true }); }
