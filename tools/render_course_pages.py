#!/usr/bin/env python3
"""
把 docs/ 下的课程 PDF 渲染为 assets/course-pages/<code>/page-NNN.jpg 页图，
并更新 data/course-documents/images.json。

用法:
    python render_course_pages.py CS5187 CS5222 ...   # 渲染指定课程
    python render_course_pages.py --all                # 渲染 docs/ 下所有 PDF
    python render_course_pages.py --list               # 只列出 docs 下缺失页图的课程
    python render_course_pages.py --text CODE          # 输出指定课程的 PDF 文本（供翻译用）

依赖: pymupdf (fitz)
"""

import sys
import os
import json
import glob
import hashlib

import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
OUT_ROOT = os.path.join(ROOT, "assets", "course-pages")
IMAGES_JSON = os.path.join(ROOT, "data", "course-documents", "images.json")

TARGET_DPI = 150
JPG_QUALITY = 88


def pdf_sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def list_pdf_codes():
    return sorted(
        os.path.splitext(os.path.basename(p))[0]
        for p in glob.glob(os.path.join(DOCS, "*.pdf"))
    )


def render_course(code):
    pdf_path = os.path.join(DOCS, f"{code}.pdf")
    if not os.path.exists(pdf_path):
        print(f"[跳过] {code}: 找不到 {pdf_path}", file=sys.stderr)
        return None
    out_dir = os.path.join(OUT_ROOT, code)
    os.makedirs(out_dir, exist_ok=True)

    zoom = TARGET_DPI / 72.0
    mat = fitz.Matrix(zoom, zoom)
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        out = os.path.join(out_dir, f"page-{i + 1:03d}.jpg")
        pix.save(out, jpg_quality=JPG_QUALITY)
        pages.append(f"assets/course-pages/{code}/page-{i + 1:03d}.jpg")
    doc.close()
    return {
        "page_count": len(pages),
        "source_pdf": f"docs/{code}.pdf",
        "source_sha256": pdf_sha256(pdf_path),
        "pages": pages,
    }


def dump_text(code):
    pdf_path = os.path.join(DOCS, f"{code}.pdf")
    if not os.path.exists(pdf_path):
        print(f"[跳过] {code}: 找不到 {pdf_path}", file=sys.stderr)
        return
    doc = fitz.open(pdf_path)
    for i, page in enumerate(doc):
        print(f"\n===== PAGE {i + 1} / {doc.page_count} =====")
        print(page.get_text())
    doc.close()


def load_images():
    if os.path.exists(IMAGES_JSON):
        with open(IMAGES_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "schema_version": 1,
        "generated_from": "tools/render_course_pages.py",
        "course_count": 0,
        "page_count": 0,
        "courses": {},
    }


def main():
    args = sys.argv[1:]

    if args and args[0] == "--text":
        if len(args) < 2:
            print("用法: python render_course_pages.py --text CODE", file=sys.stderr)
            sys.exit(1)
        dump_text(args[1])
        return

    data = load_images()

    if args and args[0] == "--list":
        existing = set(data["courses"].keys())
        for code in list_pdf_codes():
            mark = "" if code in existing else "  <-- 缺页图"
            print(f"{code}{mark}")
        return

    codes = [a for a in args if not a.startswith("--")]
    if not codes or "--all" in args:
        codes = list_pdf_codes()

    for code in codes:
        info = render_course(code)
        if info:
            data["courses"][code] = info
            print(f"[OK] {code}: {info['page_count']} 页")

    data["course_count"] = len(data["courses"])
    data["page_count"] = sum(c["page_count"] for c in data["courses"].values())
    with open(IMAGES_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"已更新 images.json：{data['course_count']} 门课程，{data['page_count']} 页。")


if __name__ == "__main__":
    main()
