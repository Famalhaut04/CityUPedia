import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "..");
const manifestPath = path.join(repositoryRoot, "wechat", "generated", "pdf-pages-manifest.json");
const documentIndexPath = path.join(repositoryRoot, "data", "course-documents", "index.json");
const outputRoot = path.join(repositoryRoot, "assets", "course-pages");
const indexPath = path.join(repositoryRoot, "data", "course-documents", "images.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const documentIndex = JSON.parse(await readFile(documentIndexPath, "utf8"));
const courses = {};

const manifestCodes = manifest.courses.map((course) => course.course_code).sort();
const documentCodes = Object.keys(documentIndex).sort();
if (JSON.stringify(manifestCodes) !== JSON.stringify(documentCodes)) {
  throw new Error("课程文档索引与小程序页图清单不一致");
}

for (const course of manifest.courses) {
  const courseCode = course.course_code;
  const translation = JSON.parse(
    await readFile(path.join(repositoryRoot, documentIndex[courseCode].translation), "utf8")
  );
  if (translation.pages.length !== course.pages.length) {
    throw new Error(`${courseCode} 的英文页图与中文翻译页数不一致`);
  }
  const courseDirectory = path.join(outputRoot, courseCode);
  await mkdir(courseDirectory, { recursive: true });

  for (const fileName of await readdir(courseDirectory)) {
    if (/^page-\d+\.jpg$/i.test(fileName)) {
      await unlink(path.join(courseDirectory, fileName));
    }
  }

  const pages = [];
  for (const page of course.pages) {
    const fileName = path.posix.basename(page.path);
    const sourcePath = path.join(repositoryRoot, "wechat", "miniprogram", page.path);
    const outputPath = path.join(courseDirectory, fileName);
    await copyFile(sourcePath, outputPath);
    pages.push(`assets/course-pages/${courseCode}/${fileName}`);
  }

  courses[courseCode] = {
    page_count: course.page_count,
    source_pdf: course.source_pdf,
    source_sha256: course.source_sha256,
    pages
  };
}

await mkdir(path.dirname(indexPath), { recursive: true });
await writeFile(
  indexPath,
  `${JSON.stringify(
    {
      schema_version: 1,
      generated_from: "wechat/generated/pdf-pages-manifest.json",
      course_count: manifest.course_count,
      page_count: manifest.page_count,
      courses
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`已生成网页版课程页图：${manifest.course_count} 门课程，${manifest.page_count} 页。`);
