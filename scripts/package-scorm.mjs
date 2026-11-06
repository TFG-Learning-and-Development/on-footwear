import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { writeZip } from "./scorm-zip.mjs";

const dist = path.resolve("dist");
const output = path.resolve("scorm-output", "ON-Match-the-Move-SCORM-1.2.zip");
const files = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else if (entry.isFile()) files.push(path.relative(dist, absolute).replaceAll(path.sep, "/"));
  }
}
await collect(dist);
if (!files.includes("index.html")) throw new Error("Build the course before packaging: dist/index.html is missing.");
if (files.some((name) => name.startsWith("__verify-"))) throw new Error("Verification fixtures must not be packaged.");
files.sort();
const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="on-match-the-move-scorm-12" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="course-organization"><organization identifier="course-organization"><title>Content</title><item identifier="course-item" identifierref="course-resource"><title>Content</title></item></organization></organizations>
  <resources><resource identifier="course-resource" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files.map((name) => `    <file href="${escapeXml(name)}"/>`).join("\n")}
  </resource></resources>
</manifest>
`;
const entries = [["imsmanifest.xml", Buffer.from(manifest)]];
for (const name of files) {
  let content = await readFile(path.join(dist, ...name.split("/")));
  if (name.endsWith(".html")) {
    const depth = name.split("/").length - 1;
    const prefix = depth ? "../".repeat(depth) : "./";
    const text = content.toString("utf8")
      .replace(/<html\b/i, '<html data-scorm-package="true"')
      .replace(/\b(href|src|data-image-src)="\/(?!\/)([^"]*)"/g, (_match, attribute, target) => {
        const lessonRoute = attribute === "href" && /^(?:lesson-[1-6]\/)?$/.test(target);
        return `${attribute}="${prefix}${lessonRoute ? `${target}index.html` : target}"`;
      });
    content = Buffer.from(text);
  } else if (name.endsWith(".css")) {
    content = Buffer.from(content.toString("utf8").replaceAll('url(/assets/', 'url(../assets/').replaceAll('url("/assets/', 'url("../assets/').replaceAll("url('/assets/", "url('../assets/"));
  }
  entries.push([name, content]);
}
await writeZip(output, entries);
console.log(`SCORM 1.2 package: ${output}`);
