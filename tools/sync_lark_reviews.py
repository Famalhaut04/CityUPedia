#!/usr/bin/env python3
"""
Sync approved course reviews from Lark Base to static JSON.

Reads records where 审核状态 = "通过" from the Lark Bitable,
transforms them to the site's review format, and writes to
data/lark-reviews.json.

Environment variables:
  LARK_APP_ID       - Lark app ID (cli_xxx)
  LARK_APP_SECRET   - Lark app secret
  LARK_BASE_TOKEN   - Bitable app token
  LARK_TABLE_ID     - Bitable table ID (tbl_xxx)
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

LARK_HOST = "https://open.larksuite.com"
REVIEW_STATUS_FIELD = "审核状态"
APPROVED_VALUE = "通过"


def api_request(method, path, token=None, body=None):
    url = f"{LARK_HOST}{path}"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"API error {e.code} on {method} {path}: {err_body}", file=sys.stderr)
        raise
    except urllib.error.URLError as e:
        print(f"Network error on {method} {path}: {e}", file=sys.stderr)
        raise


def get_tenant_access_token(app_id, app_secret):
    body = {"app_id": app_id, "app_secret": app_secret}
    result = api_request("POST", "/open-apis/auth/v3/tenant_access_token/internal", body=body)
    token = result.get("tenant_access_token")
    if not token:
        raise RuntimeError(f"Failed to get tenant_access_token: {result}")
    return token


def fetch_approved_reviews(token, base_token, table_id):
    all_records = []
    page_token = None
    while True:
        path = f"/open-apis/bitable/v1/apps/{base_token}/tables/{table_id}/records/search"
        body = {
            "filter": {
                "conjunction": "and",
                "conditions": [
                    {"field_name": REVIEW_STATUS_FIELD, "operator": "is", "value": [APPROVED_VALUE]}
                ],
            },
        }
        if page_token:
            body["page_token"] = page_token
        result = api_request("POST", path, token=token, body=body)
        data = result.get("data", {})
        items = data.get("items", [])
        all_records.extend(items)
        if not data.get("has_more"):
            break
        page_token = data.get("page_token")
        if not page_token:
            break
    return all_records


def extract_text(field_value):
    if field_value is None:
        return ""
    if isinstance(field_value, str):
        return field_value
    if isinstance(field_value, list):
        texts = []
        for item in field_value:
            if isinstance(item, dict):
                texts.append(item.get("text", ""))
            elif isinstance(item, str):
                texts.append(item)
        return "".join(texts)
    if isinstance(field_value, dict):
        return field_value.get("text", "") or field_value.get("name", "")
    return str(field_value)


def extract_number(field_value):
    if field_value is None:
        return 0
    if isinstance(field_value, (int, float)):
        return field_value
    if isinstance(field_value, str):
        try:
            return float(field_value)
        except ValueError:
            return 0
    return 0


def extract_datetime(field_value):
    if field_value is None:
        return None
    if isinstance(field_value, (int, float)):
        import datetime
        return datetime.datetime.fromtimestamp(field_value / 1000, tz=datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(field_value, str):
        return field_value
    return None


def transform_record(record):
    fields = record.get("fields", {})
    return {
        "id": record.get("record_id", ""),
        "course_code": extract_text(fields.get("课程代码")),
        "nickname": extract_text(fields.get("昵称")) or "城大同学",
        "course_professor": extract_text(fields.get("课程/教授")),
        "comment": extract_text(fields.get("评价内容")),
        "rating": int(extract_number(fields.get("评分"))),
        "created_at": extract_datetime(fields.get("提交时间")),
    }


def main():
    app_id = os.environ.get("LARK_APP_ID", "cli_aa0f06a2f5789e15")
    app_secret = os.environ.get("LARK_APP_SECRET")
    base_token = os.environ.get("LARK_BASE_TOKEN", "Jed0b6XV3aZPXwsjsD6jlf1apwd")
    table_id = os.environ.get("LARK_TABLE_ID", "tblru0J5s8x7j5Fd")

    if not app_secret:
        print("Error: LARK_APP_SECRET must be set", file=sys.stderr)
        sys.exit(1)

    print("Fetching tenant_access_token...")
    token = get_tenant_access_token(app_id, app_secret)
    print("Token acquired. Fetching approved reviews...")

    raw_records = fetch_approved_reviews(token, base_token, table_id)
    print(f"Retrieved {len(raw_records)} approved records.")

    reviews = [transform_record(r) for r in raw_records]
    reviews = [r for r in reviews if r["course_code"]]
    # 按提交时间倒序（新评价在前），无时间戳的排在最后
    reviews.sort(key=lambda r: r.get("created_at") or "", reverse=True)

    output_path = Path(__file__).parent.parent / "data" / "lark-reviews.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(reviews, f, ensure_ascii=False, indent=2)

    print(f"Written {len(reviews)} reviews to {output_path}")


if __name__ == "__main__":
    main()
