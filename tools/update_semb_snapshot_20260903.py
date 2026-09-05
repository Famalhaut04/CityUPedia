# 更新 8 门 SemB 课程的 AIMS 班次快照（数据来源：AIMS 2026-09-03 00:12-00:14 截图）
# 用法：python tools/update_semb_snapshot_20260903.py
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATE = "11/01/2027 - 17/04/2027"

CS3_LINE = "only for Programme: CS3/C, CS3/M, CS3/P, MSCS2, MSCS3, MSCYBE, MSEC4"
CS3_MSAI_LINE = "only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3, MSCYBE, MSEC4"


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
    # CS5293 Topics in Information Security and Privacy（AIMS 00:12）
    "CS5293": {
        "prerequisites": "CS5285 Introduction to Cybersecurity",
        "sections": [
            sec("12768", "C61", 3, "Y", "218", "218", "W", "19:00 - 20:50", "YEUNG", "LT-2", "ZHAO Qingchuan, WU Chenyuan", [CS3_LINE]),
            sec("12769", "T61", 0, "Y", "114", "114", "W", "21:00 - 21:50", "YEUNG", "B7701", "ZHAO Qingchuan", [CS3_LINE]),
            sec("15296", "T62", 0, "Y", "104", "104", "W", "21:00 - 21:50", "YEUNG", "G7510", "WU Chenyuan", [CS3_LINE]),
        ],
    },
    # CS5182 Computer Graphics（AIMS 00:13）
    "CS5182": {
        "sections": [
            sec("10539", "C61", 3, "Y", "295", "295", "F", "19:00 - 20:50", "BOC", "R4057", "HOU Junhui", ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3"]),
            sec("13999", "CP1", 3, "N", "5", "5", "F", "19:00 - 20:50", "BOC", "R4057", "HOU Junhui", ["only for Programme: MFACM"]),
            sec("10567", "T61", 0, "Y", "295", "295", "F", "21:00 - 21:50", "BOC", "R4057", "HOU Junhui", ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3"]),
            sec("14000", "TP1", 0, "N", "5", "5", "F", "21:00 - 21:50", "BOC", "R4057", "HOU Junhui", ["only for Programme: MFACM"]),
        ],
    },
    # CS5281 Internet Application Development（AIMS 00:13）
    "CS5281": {
        "sections": [
            sec("10001", "C61", 3, "Y", "240", "240", "F", "18:00 - 22:50", "YEUNG", "LT-2", "LEE Ka Chun K.", ["only for Programme: CS3/C, CS3/M, CS3/P, MSEC4"]),
        ],
    },
    # CS5288 Cryptography: Theory and Practice（AIMS 00:13；C01/T01 每周两个时段）
    "CS5288": {
        "sections": [
            sec("15294", "C01", 3, "Y", "280", "280", "W", "11:00 - 12:50", "LI", "3505", "LU Zhenliang", [CS3_LINE]),
            sec("15294", "C01", 3, "Y", "280", "280", "F", "12:00 - 13:50", "LI", "3505", "LU Zhenliang", [CS3_LINE]),
            sec("15295", "T01", 0, "Y", "280", "280", "W", "13:00 - 13:50", "LI", "3505", "LU Zhenliang", [CS3_LINE]),
            sec("15295", "T01", 0, "Y", "280", "280", "F", "14:00 - 14:50", "LI", "3505", "LU Zhenliang", [CS3_LINE]),
        ],
    },
    # CS5296 Cloud Computing: Theory and Practice（AIMS 00:13）
    "CS5296": {
        "sections": [
            sec("12003", "C01", 3, "Y", "228", "228", "T", "15:00 - 16:50", "YEUNG", "LT-2", "LIANG Weifa, FANG Yuguang", [CS3_LINE]),
            sec("12004", "T01", 0, "Y", "114", "114", "T", "17:00 - 17:50", "YEUNG", "B7701", "LIANG Weifa", [CS3_LINE]),
            sec("15297", "T02", 0, "Y", "114", "114", "T", "18:00 - 18:50", "YEUNG", "B7701", "LIANG Weifa", [CS3_LINE]),
        ],
    },
    # CS5483 Data Warehousing and Data Mining（AIMS 00:13；C01 每周三个时段）
    "CS5483": {
        "sections": [
            sec("11660", "C01", 3, "Y", "300", "300", "M", "12:00 - 14:50", "LI", "3505", "CHAN Chung", [CS3_MSAI_LINE]),
            sec("11660", "C01", 3, "Y", "300", "300", "T", "15:00 - 17:50", "LI", "3505", "CHAN Chung", [CS3_MSAI_LINE]),
            sec("11660", "C01", 3, "Y", "300", "300", "R", "19:00 - 21:50", "BOC", "R4057", "CHAN Chung", [CS3_MSAI_LINE]),
        ],
    },
    # CS5487 Machine Learning: Principles and Practice（AIMS 00:14；班次不变，仅补充 restrict notes）
    "CS5487": {
        "sections": [
            sec("13998", "C01", 3, "Y", "170", "170", "R", "15:00 - 17:50", "LI", "6606", "CHAN Antoni Bert",
                ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCIE, MSCIEBM, MSCS2, MSCS3, MSDS1, MSEC4, MSMIT1, MSMITBM2"]),
            sec("14003", "C61", 3, "Y", "170", "170", "R", "19:00 - 21:50", "YEUNG", "LT-6", "CHAN Antoni Bert",
                ["only for Programme: MSAI, MSCIE, MSCIEBM, MSCS2, MSCS3, MSDS1, MSEC4, MSMIT1, MSMITBM2"]),
        ],
    },
    # CS5491 Artificial Intelligence（AIMS 00:14）
    "CS5491": {
        "sections": [
            sec("14143", "C01", 3, "Y", "200", "200", "T", "12:00 - 13:50", "LI", "2505", "LU Zhichao, GUO Jianyuan", ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3, MSEC4"]),
            sec("12881", "C61", 3, "Y", "300", "300", "T", "19:00 - 20:50", "BOC", "R4057", "LU Zhichao, GUO Jianyuan", ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3, MSEC4"]),
            sec("14144", "T01", 0, "Y", "200", "200", "T", "14:00 - 14:50", "LI", "2505", "LU Zhichao, GUO Jianyuan", ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3, MSEC4"]),
            sec("12941", "T61", 0, "Y", "300", "300", "T", "21:00 - 21:50", "BOC", "R4057", "LU Zhichao, GUO Jianyuan", ["only for Programme: CS3/C, CS3/M, CS3/P, MSAI, MSCS2, MSCS3, MSEC4"]),
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
        if "prerequisites" in update:
            course["prerequisites"] = update["prerequisites"]

        unique_crns = [f"{s['section']}({s['crn']})" for s in unique.values()]
        print(f"{code}: {len(sections)} 条班次记录 / {len(unique)} 个唯一班次 {', '.join(unique_crns)}"
              f" -> summary {course['summary']['available']}/{course['summary']['capacity']}")

    note = ("Semester B 2026/27 快照更新：CS5293、CS5182、CS5281、CS5288、CS5296、CS5483、CS5487、CS5491 "
            "八门课的班次时间已对照 AIMS 更新至 2026-09-03 00:14（Asia/Beijing）；其余课程班次仍为 2026-08-05/06 快照。")
    if note not in index["notes"]:
        index["notes"].append(note)

    with open(index_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("index.json 已更新")


if __name__ == "__main__":
    main()
