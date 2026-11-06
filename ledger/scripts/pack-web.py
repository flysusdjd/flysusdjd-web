"""把记账本前端打成一个可以直接拖到 Netlify 的 zip。

为什么要放 Netlify：*.workers.dev 在国内被墙（TLS 直接被干扰），
所以静态文件放 Netlify（国内能开），API 仍跑在 Cloudflare Worker 上，
由 web/_redirects 把 /api/* 转发过去。
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
OUT = os.path.join(ROOT, "..", "ledger-deploy.zip")

SKIP_DIRS = {"__pycache__", ".DS_Store"}

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
    for base, dirs, files in os.walk(WEB):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if name in SKIP_DIRS:
                continue
            path = os.path.join(base, name)
            rel = os.path.relpath(path, WEB).replace("\\", "/")
            zf.write(path, rel)
            print(f"  + {rel}")

print(f"saved {OUT} ({os.path.getsize(OUT)} bytes)")
