# AIMS Semester A 2026/27 全校课表快照

来源：CityU AIMS "Courses Offered in Semester A 2026/27" 页面（全校范围，覆盖 35 个学术单位、621 门课程），采集时间 2026-08-07 11:24 AM。

## 文件说明

- `input.txt`：从 AIMS 页面复制的原始文本（Tab 分隔表格），包含所有学术单位的分类标题、表头和课程行。
- `output.json`：用 `tools/parse_courses.py` 解析 `input.txt` 后生成的结构化数据，共 621 条课程记录。
- 重新生成：`python3 tools/parse_courses.py data/reference/aims-sema-2026-27-full/input.txt data/reference/aims-sema-2026-27-full/output.json`

## 字段说明（output.json 每条记录）

| 字段 | 说明 |
|---|---|
| `academic_unit` | 开课学术单位 |
| `subject` | 学科代码（如 CS、DSC） |
| `course` | 课程编号 |
| `title` | 课程名称 |
| `credit` | 学分（数字） |
| `web` | 是否可网页注册，**布尔值** `true`/`false`（由原始 Y/N 转换而来） |
| `level` | 课程程度代码（如 P、P R、B P D R） |
| `avail` | 剩余名额（数字，个别为 "FULL" 时保留字符串） |
| `cap` | 总名额（数字） |
| `waitlist_avail` | 是否有等候名单，**布尔值** |
| `medium_of_instruction` | 授课语言 |

## 与站点选课数据的差异（重要）

这份数据是**原始参考快照**，不是站点选课工具（`data/courses/index.json` + `data/sections/*.json`）直接使用的数据源，两者字段格式不同，合并前需注意：

- `web`/`waitlist_avail` 这里是布尔值，站点选课数据里对应字段是字符串 `"Y"`/`"N"`（如 `assets/course.js` 里 `section.web === "Y"` 这类判断），不能直接互换。
- 这里没有 CRN、班次（Section）、上课时间/地点/教师等排课细节，只是课程级别的开课概况，不能替代 `data/sections/*.json`。
- 名额（avail/cap）是采集时间点的快照，会随时间变化，仅供参考。

## 用途

作为核对/扩充站点课程数据（如 [../../courses/index.json](../../courses/index.json)）时的原始依据，尤其是确认某门课本学期是否真的开课、学分是否正确等。
