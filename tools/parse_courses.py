#!/usr/bin/env python3
"""
解析课程列表数据（Tab 分隔的表格文本）为 JSON。

用法:
    python parse_courses.py input.txt output.json
    或
    python parse_courses.py < input.txt > output.json   （从标准输入读取，输出到标准输出）

输入格式说明:
    数据每行以 Tab（制表符）分隔，字段顺序为：
    Academic Unit, Subject, Course, Title, Credit, WEB, Level,
    Avail, Cap, Waitlist Avail, Medium of Instruction

    文件中夹杂的分类标题行（如 "Accountancy"）、"Offering" 行、
    以及表头行（"Academic Unit ... Medium of Instruction"）会被自动跳过。
"""

import sys
import json
import re

FIELDS = [
    "academic_unit",
    "subject",
    "course",
    "title",
    "credit",
    "web",
    "level",
    "avail",
    "cap",
    "waitlist_avail",
    "medium_of_instruction",
]

NUMERIC_FIELDS = {"credit", "avail", "cap"}
BOOL_FIELDS = {"web", "waitlist_avail"}


def to_number(value):
    """尝试把字符串转成 int 或 float，失败则原样返回字符串。"""
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value


def to_bool(value):
    v = value.strip().upper()
    if v == "Y":
        return True
    if v == "N":
        return False
    return value


def parse(text):
    records = []
    for raw_line in text.splitlines():
        line = raw_line.rstrip("\n")
        if not line.strip():
            continue

        # 按 Tab 分割；如果没有 Tab（比如粘贴时被转换成多空格），
        # 退而用连续 2 个以上空格分割
        if "\t" in line:
            parts = line.split("\t")
        else:
            parts = re.split(r"\s{2,}", line.strip())

        parts = [p.strip() for p in parts]

        # 跳过分类标题行（如 "Accountancy"）、"Offering" 行
        if len(parts) < len(FIELDS):
            continue

        # 跳过表头行
        if parts[0] == "Academic Unit":
            continue

        if len(parts) != len(FIELDS):
            # 字段数不匹配，跳过（可能是格式异常行），也可以选择打印警告
            print(f"警告：跳过无法解析的行（字段数 {len(parts)}）：{line}",
                  file=sys.stderr)
            continue

        record = dict(zip(FIELDS, parts))

        for key in NUMERIC_FIELDS:
            record[key] = to_number(record[key])
        for key in BOOL_FIELDS:
            record[key] = to_bool(record[key])

        records.append(record)

    return records


def main():
    if len(sys.argv) >= 2:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()

    records = parse(text)
    output = json.dumps(records, ensure_ascii=False, indent=2)

    if len(sys.argv) >= 3:
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(output)
        print(f"已写入 {len(records)} 条记录到 {sys.argv[2]}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()