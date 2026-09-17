# -*- coding: utf-8 -*-
"""
从各卷 evidence/_index/method_dedup_index_*.md 抽取「跨篇去重后的方法」，
输出 mao-site/data/methods.js —— 五卷方法图谱的数据源。
结构：{ 卷号: [ { t:方法名, d:说明, sub:[ {t:具体做法, d:说明, p:[篇名] } ] } ] }
"""
import os, re, io, json, glob

ROOT = r"C:\Users\Iovoeyl\Desktop\work"
OUT = os.path.join(ROOT, "mao-site", "data")
VOLS = [(1, "01、第一卷evidence"), (2, "02、第二卷evidence"), (3, "03、第三卷evidence"),
        (4, "04、第四卷evidence"), (5, "05、第五卷evidence")]

WIKI = re.compile(r"\[\[[^\]]*\|([^\]]+)\]\]")
WIKI2 = re.compile(r"\[\[([^\]|]+)\]\]")
QUOTE_T = re.compile(r"《([^》]+)》")


def clean(s, limit=0):
    """去 wikilink、去引用标记、压空白；可选截断"""
    s = WIKI.sub(r"\1", s)
    s = WIKI2.sub(r"\1", s)
    s = re.sub(r"\*\*出处：\*\*[\s\S]*?(?=\n\n|\n###|\Z)", "", s)
    s = re.sub(r"\*\*相关思想：\*\*[\s\S]*?(?=\n\n|\n###|\Z)", "", s)
    s = re.sub(r"\*\*主要依据：\*\*[\s\S]*?(?=\n\n|\n###|\Z)", "", s)
    s = re.sub(r"\[P\d{3}[–\-—]?P?\d*\]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("证据", "")
    if limit and len(s) > limit:
        s = s[:limit].rstrip("，,。、；; ") + "…"
    return s


def extract_srcs(block):
    """从'**出处：**'行里提取篇名"""
    m = re.search(r"\*\*出处：\*\*([\s\S]*?)(?=\n\n|\n###|\Z)", block)
    if not m:
        return []
    names = []
    for t in QUOTE_T.findall(m.group(1)):
        t = t.strip()
        if t and t not in names:
            names.append(t)
    return names[:6]


data = {}

for vno, vdir in VOLS:
    files = sorted(glob.glob(os.path.join(ROOT, vdir, "_index", "method_dedup_index_*.md")))
    if not files:
        print(f"卷{vno}: 无方法索引")
        continue
    text = "\n".join(io.open(f, encoding="utf-8").read().replace("\r\n", "\n") for f in files)
    # 去掉文件头的说明块
    text = re.sub(r"^# Method Dedup Index[\s\S]*?(?=\n## )", "", text)

    items = []
    for blk in re.split(r"\n## ", text):
        if not blk.strip():
            continue
        lines = blk.split("\n")
        l2_title = lines[0].strip().lstrip("#").strip()
        if not l2_title or l2_title.startswith("#"):
            continue
        rest = "\n".join(lines[1:])

        # L2 说明：到第一个 ### 为止
        first_sub = rest.find("\n### ")
        l2_desc = clean(rest[:first_sub] if first_sub >= 0 else rest, 320)

        subs = []
        if first_sub >= 0:
            for sblk in re.split(r"\n### ", rest[first_sub:]):
                if not sblk.strip():
                    continue
                slines = sblk.split("\n")
                st = slines[0].strip().lstrip("#").strip()
                sbody = "\n".join(slines[1:])
                if not st:
                    continue
                subs.append({
                    "t": st,
                    "d": clean(sbody, 240),
                    "p": extract_srcs(sblk),
                })
        items.append({"t": l2_title, "d": l2_desc, "sub": subs})

    data[str(vno)] = items
    nsub = sum(len(i["sub"]) for i in items)
    print(f"卷{vno}: L2 {len(items)} 个 / L1 {nsub} 条")

js = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
with io.open(os.path.join(OUT, "methods.js"), "w", encoding="utf-8") as f:
    f.write("window.MAO_METHODS=" + js + ";")
print("methods.js KB:", len(js) // 1024)
