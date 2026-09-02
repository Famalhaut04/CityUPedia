# 更新 7 门 SemB 课程的 AIMS 班次快照 第二批（数据来源：AIMS 2026-09-03 00:14-00:15 截图）
# CS5491 与第一批重复，不在本批。用法：python tools/update_semb_snapshot_20260903_batch2.py
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATE = "11/01/2027 - 17/04/2027"

CS3_MSAI_LINE = "only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3, MSEC4"


def sec(crn, section, credits, web, avail, cap, day, time, building, room, instructor, notes):
    return {
        "crn": crn,
        "section": section,
        "credits": credits,
        "web": web,
        "available": avail,
        "capacity": cap,
        "date": DATE,
        "day": day,
        "time": time,
        "building": building,
        "room": room,
        "instructor": instructor,
        "medium": "English",
        "notes": notes,
    }


UPDATES = {
    # CS6493 Natural Language Processing（AIMS 00:15；补全至 12 个班次，此前仅 MSDS 的 CA1/CP1）
    "CS6493": {
        "sections": [
            sec("15350", "C01", 3, "Y", "208", "208", "W", "11:00 - 12:50", "YEUNG", "LT-2", "SONG Linqi, MA Chen", [CS3_MSAI_LINE]),
            sec("12005", "C61", 3, "Y", "182", "182", "W", "19:00 - 20:50", "LI", "3505", "SONG Linqi, MA Chen", [CS3_MSAI_LINE]),
            sec("15357", "CA1", 3, "Y", "20", "20", "W", "11:00 - 12:50", "YEUNG", "LT-2", "SONG Linqi, MA Chen", ["only for Programme: MSDS1"]),
            sec("12006", "CP1", 3, "Y", "20", "20", "W", "19:00 - 20:50", "LI", "3505", "SONG Linqi, MA Chen", ["only for Programme: MSDS1"]),
            sec("14004", "T01", 0, "Y", "104", "104", "W", "13:00 - 13:50", "YEUNG", "B7701", "SONG Linqi, MA Chen", [CS3_MSAI_LINE]),
            sec("15355", "T02", 0, "Y", "104", "104", "W", "17:00 - 17:50", "YEUNG", "B7701", "SONG Linqi, MA Chen", [CS3_MSAI_LINE]),
            sec("12050", "T61", 0, "Y", "102", "102", "W", "21:00 - 21:50", "LI", "G600", "SONG Linqi", [CS3_MSAI_LINE]),
            sec("12942", "T62", 0, "Y", "80", "80", "W", "21:00 - 21:50", "LI", "4412", "MA Chen", [CS3_MSAI_LINE]),
            sec("14005", "TA1", 0, "Y", "10", "10", "W", "13:00 - 13:50", "YEUNG", "B7701", "SONG Linqi, MA Chen", ["only for Programme: MSDS1"]),
            sec("15360", "TA2", 0, "Y", "10", "10", "W", "17:00 - 17:50", "YEUNG", "B7701", "SONG Linqi, MA Chen", ["only for Programme: MSDS1"]),
            sec("12052", "TP1", 0, "Y", "10", "10", "W", "21:00 - 21:50", "LI", "G600", "SONG Linqi", ["only for Programme: MSDS1"]),
            sec("12943", "TP2", 0, "Y", "10", "10", "W", "21:00 - 21:50", "LI", "4412", "MA Chen", ["only for Programme: MSDS1"]),
        ],
    },
    # CS6491 Topics in Optimization（AIMS 00:15；C01/T01 仅 CS3 研究型，CA1/TA1 面向授课式硕士）
    "CS6491": {
        "sections": [
            sec("12772", "C01", 3, "Y", "90", "90", "F", "12:00 - 13:50", "LI", "3614", "ZHANG Qingfu", ["only for Programme: CS3/C, CS3/M, CS3/P"]),
            sec("14385", "CA1", 3, "Y", "100", "100", "R", "12:00 - 13:50", "LI", "3614", "ZHANG Qingfu", ["only for Programme: MSAI, MSCS2, MSCS3, MSEC4"]),
            sec("12773", "T01", 0, "Y", "90", "90", "F", "14:00 - 14:50", "LI", "3614", "ZHANG Qingfu", ["only for Programme: CS3/C, CS3/M, CS3/P"]),
            sec("14386", "TA1", 0, "Y", "100", "100", "R", "14:00 - 14:50", "LI", "3614", "ZHANG Qingfu", ["only for Programme: MSAI, MSCS2, MSCS3, MSEC4"]),
        ],
    },
    # CS6487 Topics in Machine Learning（AIMS 00:15）
    "CS6487": {
        "sections": [
            sec("14494", "C01", 3, "Y", "135", "135", "M", "15:00 - 16:50", "LI", "1503", "MA Ziye, GUO Jianyuan", ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3"]),
            sec("14495", "T01", 0, "Y", "135", "135", "M", "17:00 - 17:50", "LI", "1503", "MA Ziye, GUO Jianyuan", ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3"]),
        ],
    },
    # CS6290 Privacy-enhancing Technologies（AIMS 00:15；各班次同时段双教室 CMC M3017 + YEUNG LT-8，按同 CRN 两条记录存储）
    "CS6290": {
        "sections": [
            sec("12356", "C61", 3, "Y", "215", "215", "R", "19:00 - 20:50", "CMC", "M3017", "CHEN Yufei", ["only for Programme: CS3/C, CS3/M, CS3/P, MSCS2, MSCS3, MSCYBE, MSEC4"]),
            sec("12356", "C61", 3, "Y", "215", "215", "R", "19:00 - 20:50", "YEUNG", "LT-8", "CHEN Yufei", ["only for Programme: CS3/C, CS3/M, CS3/P, MSCS2, MSCS3, MSCYBE, MSEC4"]),
            sec("12937", "CP1", 3, "Y", "40", "40", "R", "19:00 - 20:50", "CMC", "M3017", "CHEN Yufei", ["only for Programme: MSDS1"]),
            sec("12937", "CP1", 3, "Y", "40", "40", "R", "19:00 - 20:50", "YEUNG", "LT-8", "CHEN Yufei", ["only for Programme: MSDS1"]),
            sec("12939", "CQ1", 3, "Y", "25", "25", "R", "19:00 - 20:50", "CMC", "M3017", "CHEN Yufei", ["only for Programme: MSCIE, MSCIEBM, MSMIT1, MSMITBM2"]),
            sec("12939", "CQ1", 3, "Y", "25", "25", "R", "19:00 - 20:50", "YEUNG", "LT-8", "CHEN Yufei", ["only for Programme: MSCIE, MSCIEBM, MSMIT1, MSMITBM2"]),
            sec("12771", "T61", 0, "Y", "215", "215", "R", "21:00 - 21:50", "CMC", "M3017", "CHEN Yufei", ["only for Programme: CS3/C, CS3/M, CS3/P, MSCS2, MSCS3, MSCYBE, MSEC4"]),
            sec("12771", "T61", 0, "Y", "215", "215", "R", "21:00 - 21:50", "YEUNG", "LT-8", "CHEN Yufei", ["only for Programme: CS3/C, CS3/M, CS3/P, MSCS2, MSCS3, MSCYBE, MSEC4"]),
            sec("12938", "TP1", 0, "Y", "40", "40", "R", "21:00 - 21:50", "CMC", "M3017", "CHEN Yufei", ["only for Programme: MSDS1"]),
            sec("12938", "TP1", 0, "Y", "40", "40", "R", "21:00 - 21:50", "YEUNG", "LT-8", "CHEN Yufei", ["only for Programme: MSDS1"]),
            sec("12940", "TQ1", 0, "Y", "25", "25", "R", "21:00 - 21:50", "CMC", "M3017", "CHEN Yufei", ["only for Programme: MSCIE, MSCIEBM, MSMIT1, MSMITBM2"]),
            sec("12940", "TQ1", 0, "Y", "25", "25", "R", "21:00 - 21:50", "YEUNG", "LT-8", "CHEN Yufei", ["only for Programme: MSCIE, MSCIEBM, MSMIT1, MSMITBM2"]),
        ],
    },
    # CS6284 Advanced Topics in Software Security（AIMS 00:14）
    "CS6284": {
        "sections": [
            sec("15301", "C61", 3, "Y", "69", "69", "T", "19:00 - 20:50", "LI", "4109", "HUANG Heqing", ["only for Programme: MSCYBE"]),
            sec("15302", "T61", 0, "Y", "69", "69", "T", "21:00 - 21:50", "LI", "4109", "HUANG Heqing", ["only for Programme: MSCYBE"]),
        ],
    },
    # CS5493 Topics in Autonomous Driving（AIMS 00:14）
    "CS5493": {
        "sections": [
            sec("14152", "C61", 3, "Y", "156", "156", "M", "20:00 - 21:50", "YEUNG", "LT-17", "GUAN Nan", ["only for Programme: MSAI"]),
            sec("14153", "T61", 0, "Y", "78", "78", "M", "18:00 - 18:50", "YEUNG", "B7520", "GUAN Nan", ["only for Programme: MSAI"]),
            sec("14154", "T62", 0, "Y", "78", "78", "M", "19:00 - 19:50", "YEUNG", "B7520", "GUAN Nan", ["only for Programme: MSAI"]),
        ],
    },
    # CS6283 Advanced Topics in Mobile and IoT Security（AIMS 00:14）
    "CS6283": {
        "sections": [
            sec("15299", "C01", 3, "Y", "110", "110", "R", "12:00 - 13:50", "LI", "1610", "XU Weitao", ["only for Programme: MSCYBE"]),
            sec("15300", "T01", 0, "Y", "110", "110", "R", "14:00 - 14:50", "LI", "G600", "XU Weitao", ["only for Programme: MSCYBE"]),
        ],
    },
}


def write_json(path, obj):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    index_path = os.path.join(ROOT, "data", "courses", "index.json")
    with open(index_path, encoding="utf-8") as f:
        index = json.load(f)

    for code, update in UPDATES.items():
        sections = update["sections"]
        write_json(os.path.join(ROOT, "data", "sections", f"{code}.json"), sections)

        course = next((c for c in index["courses"] if c["code"] == code), None)
        assert course is not None, f"{code} 不在课程索引中"

        # course 级统计：section_count 按唯一 CRN，summary 按有学分的唯一班次合计
        unique = {}
        for s in sections:
            unique.setdefault(s["crn"], s)
        primaries = [s for s in unique.values() if s["credits"] > 0]
        course["section_count"] = len(unique)
        course["summary"] = {
            "web": "Y" if any(s["web"] == "Y" for s in unique.values()) else "N",
            "available": str(sum(int(s["available"]) for s in primaries)),
            "capacity": str(sum(int(s["capacity"]) for s in primaries)),
            "medium": "English",
        }

        unique_crns = [f"{s['section']}({s['crn']})" for s in unique.values()]
        print(f"{code}: {len(sections)} 条记录 / {len(unique)} 个唯一班次 {', '.join(unique_crns)}"
              f" -> summary {course['summary']['available']}/{course['summary']['capacity']}")

    # 陈旧评价占位清理
    for code in ["CS6283", "CS6284"]:
        p = os.path.join(ROOT, "data", "reviews", f"{code}.json")
        d = json.load(open(p, encoding="utf-8"))
        if "未开设或暂未采集" in (d.get("summary") or ""):
            d["summary"] = ""
            d["last_updated"] = "2026-09-03"
            with open(p, "w", encoding="utf-8", newline="") as f:
                json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
                f.write("\n")
            print(code, "review 占位已清空")

    note = ("Semester B 2026/27 快照更新（第二批）：CS6493、CS6491、CS6487、CS6290、CS6284、CS5493、CS6283 "
            "七门课的班次时间已对照 AIMS 更新至 2026-09-03 00:15（Asia/Beijing）。")
    if note not in index["notes"]:
        index["notes"].append(note)

    with open(index_path, "w", encoding="utf-8", newline="\r\n") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("index.json 已更新")


if __name__ == "__main__":
    main()
