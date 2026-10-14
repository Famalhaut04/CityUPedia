// 数据一致性校验：node tools/validate_data.mjs
// 检查课程索引、班次、评价、来源与课程文件之间的引用关系和字段格式。
// 「错误」会让网站显示异常（课程缺班次文件、星期/时间格式无法解析、引用不存在的项目或来源等），退出码为 1；
// 「警告」不影响页面（孤立文件、已下线课程的残留文档等），仅提示。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const error = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const exists = (relative) => existsSync(path.join(root, relative));
function readJson(relative) {
  try {
    return JSON.parse(readFileSync(path.join(root, relative), "utf8"));
  } catch (cause) {
    error(`${relative}：JSON 读取失败（${cause.message}）`);
    return undefined;
  }
}

const WEEK_DAYS = "MTWRFSU";
const TERMS = new Set(["SemA", "SemB", "Summer"]);
const LEVELS = new Set(["strong", "recommended", "good", "research", "neutral", "caution", "unknown"]);
const TIME_PATTERN = /^(\d{2}):(\d{2}) - (\d{2}):(\d{2})$/;

const index = readJson("data/courses/index.json");
const sources = readJson("data/sources.json") || {};
if (!index || !Array.isArray(index.courses) || !Array.isArray(index.programmes)) {
  error("data/courses/index.json 缺少 courses / programmes 数组");
  report();
}

const programmes = new Map(index.programmes.map((programme) => [programme.code, programme]));
const courseCodes = new Set();

for (const course of index.courses) {
  const { code } = course;
  if (!code) {
    error("课程缺少 code 字段");
    continue;
  }
  if (courseCodes.has(code)) error(`${code}：课程代码重复`);
  courseCodes.add(code);

  for (const programmeCode of course.programmes || []) {
    if (!programmes.has(programmeCode)) error(`${code}：引用了不存在的项目 ${programmeCode}`);
  }
  for (const [programmeCode, groupKey] of Object.entries(course.programme_elective_groups || {})) {
    const groups = programmes.get(programmeCode)?.requirement_credit_units?.elective_groups || [];
    if (!groups.some((group) => group.key === groupKey)) {
      error(`${code}：项目 ${programmeCode} 未定义选修分组 ${groupKey}`);
    }
  }
  for (const term of String(course.semester_tag || "").split("+").filter(Boolean)) {
    if (!TERMS.has(term)) error(`${code}：无法识别的学期标签 ${course.semester_tag}`);
  }

  const sectionsPath = `data/sections/${code}.json`;
  if (!exists(sectionsPath)) {
    error(`${code}：缺少班次文件 ${sectionsPath}`);
  } else {
    const sections = readJson(sectionsPath);
    if (sections !== undefined && !Array.isArray(sections)) error(`${sectionsPath}：应为数组`);
    for (const section of Array.isArray(sections) ? sections : []) {
      const label = `${code} ${section.section || "?"}`;
      const day = String(section.day || "");
      // 多日班次（如 "MF"）由前端拆分，逐字检查即可
      if (day && ![...day].every((ch) => WEEK_DAYS.includes(ch))) error(`${label}：无法识别的星期 "${day}"`);
      if (section.time) {
        const match = TIME_PATTERN.exec(section.time);
        if (!match) {
          error(`${label}：时间格式应为 "HH:MM - HH:MM"，实际为 "${section.time}"`);
        } else {
          const start = Number(match[1]) * 60 + Number(match[2]);
          const end = Number(match[3]) * 60 + Number(match[4]);
          if (end <= start) error(`${label}：结束时间不晚于开始时间（${section.time}）`);
        }
      } else if (day) {
        warn(`${label}：有星期但没有上课时间，不会排入课表`);
      }
      if (Number.isNaN(Number(section.credits))) error(`${label}：credits 不是数字`);
    }
  }

  const reviewPath = `data/reviews/${code}.json`;
  if (!exists(reviewPath)) {
    error(`${code}：缺少评价文件 ${reviewPath}`);
  } else {
    const review = readJson(reviewPath);
    if (review && typeof review === "object") {
      if (!LEVELS.has(review.level)) error(`${reviewPath}：无法识别的评价等级 "${review.level}"`);
      if (!Array.isArray(review.tags)) error(`${reviewPath}：tags 应为数组`);
      for (const sourceId of review.source_ids || review.sourceIds || []) {
        if (!sources[sourceId]) error(`${reviewPath}：引用了 sources.json 中不存在的来源 ${sourceId}`);
      }
    }
  }
}

for (const programme of index.programmes) {
  if (!index.courses.some((course) => (course.programmes || []).includes(programme.code))) {
    warn(`项目 ${programme.code} 没有任何课程`);
  }
}

for (const directory of ["sections", "reviews"]) {
  for (const file of readdirSync(path.join(root, "data", directory))) {
    if (file.endsWith(".json") && !courseCodes.has(file.slice(0, -5))) warn(`data/${directory}/${file}：课程索引中没有对应课程`);
  }
}

for (const [sourceId, source] of Object.entries(sources)) {
  if (!source?.url) warn(`来源 ${sourceId} 缺少原文链接 url`);
  const reviewPath = `data/source-reviews/${sourceId}.json`;
  if (!exists(reviewPath)) {
    warn(`来源 ${sourceId} 缺少摘录文件 ${reviewPath}`);
    continue;
  }
  for (const code of Object.keys(readJson(reviewPath)?.course_reviews || {})) {
    if (!courseCodes.has(code)) warn(`${reviewPath}：摘录了课程索引中没有的课程 ${code}`);
  }
}

const documents = readJson("data/course-documents/index.json") || {};
const images = readJson("data/course-documents/images.json") || {};
for (const [code, document] of Object.entries(documents)) {
  if (!courseCodes.has(code)) {
    warn(`课程文件 ${code}：课程索引中没有对应课程`);
    continue;
  }
  if (document.pdf && !exists(decodeURI(document.pdf))) error(`课程文件 ${code}：PDF 不存在 ${document.pdf}`);
  if (!document.translation) continue;
  if (!exists(document.translation)) {
    error(`课程文件 ${code}：翻译文件不存在 ${document.translation}`);
    continue;
  }
  const pages = images.courses?.[code]?.pages;
  if (!Array.isArray(pages)) {
    error(`课程文件 ${code}：有翻译但 images.json 中没有页图`);
    continue;
  }
  const translation = readJson(document.translation);
  if (translation && (translation.pages || []).length !== pages.length) {
    error(`课程文件 ${code}：页图 ${pages.length} 页，翻译 ${(translation.pages || []).length} 页`);
  }
  for (const page of pages) if (!exists(page)) error(`课程文件 ${code}：页图不存在 ${page}`);
}

report();

function report() {
  console.log(`课程 ${index?.courses?.length ?? 0} 门 · 项目 ${index?.programmes?.length ?? 0} 个 · 来源 ${Object.keys(sources).length} 个`);
  if (warnings.length) {
    console.log(`\n警告 ${warnings.length} 条：`);
    warnings.forEach((message) => console.log(`  - ${message}`));
  }
  if (errors.length) {
    console.log(`\n错误 ${errors.length} 条：`);
    errors.forEach((message) => console.log(`  - ${message}`));
    process.exit(1);
  }
  console.log("\n数据校验通过");
  process.exit(0);
}
