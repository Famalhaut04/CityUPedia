# -*- coding: utf-8 -*-
"""Cross-repo content sync via GitHub Git Data API (union, direction-aware brand transform).

Usage:
  python cross_repo_sync.py --src <repo> --src-ref <ref> --dst <repo> --dst-ref <ref> \
      --direction prod_to_test|test_to_prod [--dry-run]

- union: adds/updates files from src into dst; never deletes dst-only files.
- Excludes: .github/workflows/**, data/lark-reviews.json
- Brand transform applied to UTF-8 text files only (PDFs/other binary left untouched).
- Auth via SYNC_TOKEN env (fallback GITHUB_TOKEN).
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error

API = "https://api.github.com"
OWNER = "Famalhaut04"
TOKEN = os.environ.get("SYNC_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""

EXCLUDE_PREFIXES = (".github/workflows/",)
EXCLUDE_EXACT = ("data/lark-reviews.json",)

# Brand token maps. Order matters: longer / more specific first.
PROD_TO_TEST = [
    ("CityU Pedia", "CityUpedia测试版"),
    ("CityUPedia", "CityUPediaTest"),
]
TEST_TO_PROD = [
    ("CityUpedia测试版", "CityU Pedia"),
    ("CityUPediaTest", "CityUPedia"),
]


def api(method, path, body=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8", "replace"))


def tree_of(repo, ref):
    s, br = api("GET", f"/repos/{OWNER}/{repo}/branches/{ref}")
    if s != 200:
        print(f"branch error {repo}@{ref}: {s} {br}", file=sys.stderr)
        sys.exit(1)
    commit_sha = br["commit"]["sha"]
    s, c = api("GET", f"/repos/{OWNER}/{repo}/git/commits/{commit_sha}")
    ts = c["tree"]["sha"]
    s, t = api("GET", f"/repos/{OWNER}/{repo}/git/trees/{ts}?recursive=1")
    tree = {x["path"]: x["sha"] for x in t["tree"] if x["type"] == "blob"}
    return tree, ts, commit_sha


def fetch_blob(repo, sha):
    s, b = api("GET", f"/repos/{OWNER}/{repo}/git/blobs/{sha}")
    if s != 200:
        print(f"blob fetch error {repo} {sha}: {s} {b}", file=sys.stderr)
        sys.exit(1)
    return base64.b64decode(b["content"])


TRANSFORM_EXTS = (".html", ".js", ".css", ".md")


def apply_transform(raw, direction, path=""):
    if not path.lower().endswith(TRANSFORM_EXTS):
        return raw  # only brand-bearing code/docs files; leave data/binary untouched
    pairs = PROD_TO_TEST if direction == "prod_to_test" else TEST_TO_PROD
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw  # binary, leave untouched
    for a, b in pairs:
        text = text.replace(a, b)
    return text.encode("utf-8")


def excluded(path):
    return path in EXCLUDE_EXACT or path.startswith(EXCLUDE_PREFIXES)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--src-ref", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--dst-ref", required=True)
    ap.add_argument("--direction", required=True, choices=["prod_to_test", "test_to_prod"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    src_tree, _, _ = tree_of(args.src, args.src_ref)
    dst_tree, dst_tree_sha, dst_commit_sha = tree_of(args.dst, args.dst_ref)
    print(f"src {args.src}@{args.src_ref}: {len(src_tree)} files")
    print(f"dst {args.dst}@{args.dst_ref}: {len(dst_tree)} files")
    print(f"direction: {args.direction}")

    entries = []
    to_sync = []
    for path in sorted(src_tree):
        if excluded(path):
            continue
        src_sha = src_tree[path]
        if path in dst_tree and dst_tree[path] == src_sha:
            continue  # identical
        to_sync.append(path)

    print(f"\nfiles to sync (add/update): {len(to_sync)}")
    for p in to_sync:
        print("  ", p)

    if args.dry_run:
        print("\n[dry-run] no changes applied")
        return

    for path in to_sync:
        raw = fetch_blob(args.src, src_tree[path])
        new_raw = apply_transform(raw, args.direction, path)
        s, blob = api("POST", f"/repos/{OWNER}/{args.dst}/git/blobs", {
            "content": base64.b64encode(new_raw).decode("ascii"), "encoding": "base64",
        })
        if s != 201:
            print("blob create error", path, s, blob, file=sys.stderr)
            sys.exit(1)
        # skip no-op (transform produced identical bytes to existing dst)
        if path in dst_tree and dst_tree[path] == blob["sha"]:
            continue
        entries.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        time.sleep(0.05)

    if not entries:
        print("\nNo changes to commit.")
        return

    s, tree = api("POST", f"/repos/{OWNER}/{args.dst}/git/trees", {
        "base_tree": dst_tree_sha, "tree": entries,
    })
    if s != 201:
        print("tree error", s, tree, file=sys.stderr)
        sys.exit(1)

    msg = f"chore: sync from {args.src}@{args.src_ref} ({args.direction})"
    s, nc = api("POST", f"/repos/{OWNER}/{args.dst}/git/commits", {
        "message": msg, "tree": tree["sha"], "parents": [dst_commit_sha],
    })
    if s != 201:
        print("commit error", s, nc, file=sys.stderr)
        sys.exit(1)

    s, res = api("PATCH", f"/repos/{OWNER}/{args.dst}/git/refs/heads/{args.dst_ref}", {
        "sha": nc["sha"], "force": False,
    })
    if s != 200:
        print("ref update error", s, res, file=sys.stderr)
        sys.exit(1)

    print(f"\nCommitted {len(entries)} files -> {args.dst}@{args.dst_ref}: {nc['sha']}")


if __name__ == "__main__":
    main()
