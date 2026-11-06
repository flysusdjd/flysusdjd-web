"""把个人主页打成一个可以直接拖到 Netlify 的 zip（只含 index.html 和 assets/）。"""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "deploy.zip")

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
    zf.write(os.path.join(ROOT, "index.html"), "index.html")
    for base, _dirs, files in os.walk(os.path.join(ROOT, "assets")):
        for name in files:
            path = os.path.join(base, name)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            zf.write(path, rel)
            print("  +", rel)

print(f"saved {OUT} ({os.path.getsize(OUT)} bytes)")
