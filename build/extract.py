# -*- coding: utf-8 -*-
"""
从工作空间抽取《毛泽东选集》数据 -> 网页用 JS bundle
输出: mao-site/data/core.js, mao-site/data/v1.js .. v5.js
"""
import os, re, io, json, glob, sys

ROOT = r"C:\Users\Iovoeyl\Desktop\work"
OUT = os.path.join(ROOT, "mao-site", "data")
os.makedirs(OUT, exist_ok=True)

VOLUMES = [
    (1, "01、第一卷", "01、第一卷evidence", "第一次国内革命战争时期 · 第二次国内革命战争时期", "1925–1937"),
    (2, "02、第二卷", "02、第二卷evidence", "抗日战争时期（上）", "1937–1941"),
    (3, "03、第三卷", "03、第三卷evidence", "抗日战争时期（下）", "1939–1945"),
    (4, "04、第四卷", "04、第四卷evidence", "第三次国内革命战争时期", "1945–1949"),
    (5, "05、第五卷", "05、第五卷evidence", "社会主义革命和社会主义建设时期", "1949–1957"),
]

CN = {"零": 0, "○": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
      "六": 6, "七": 7, "八": 8, "九": 9}


def cn_num(s):
    """中文数字 -> int, 支持 一九二五 / 二十五 / 十 / 三十"""
    s = s.strip()
    if not s:
        return None
    # 纯阿拉伯
    if s.isdigit():
        return int(s)
    # 含"十"的复合数：十二月 / 二十一日 / 三十
    if "十" in s:
        a, _, b = s.partition("十")
        tens = CN.get(a, 1) if a else 1
        ones = CN.get(b[0], 0) if b else 0   # b 可能带"月/日"，只取首字
        return tens * 10 + ones
    # 逐位（如 一九二五 -> 1,9,2,5；一月 -> 1）
    digits = [CN[c] for c in s if c in CN]
    if len(digits) == len(s) and digits:
        return int("".join(map(str, digits)))
    return None


DATE_RE = re.compile(r"[（(]\s*(一?九[一二三四五六七八九十○零〇]{2,3})年"
                     r"(?:([一二三四五六七八九十○零〇]{1,3})月)?"
                     r"(?:([一二三四五六七八九十○零〇]{1,3})[日号])?"
                     r"[^）)]{0,20}[)）]")


def parse_date(text):
    m = DATE_RE.search(text)
    if not m:
        return None, None
    y = cn_num(m.group(1).replace("一", "") if m.group(1).startswith("一九") is False else m.group(1))
    # 处理 "一九二五"
    ys = m.group(1)
    if ys.startswith("一九"):
        y = 1900 + cn_num(ys[2:])
    elif ys.startswith("九"):
        y = 1900 + cn_num(ys[1:])
    else:
        y = cn_num(ys)
    mo = cn_num(m.group(2)) if m.group(2) else None
    d = cn_num(m.group(3)) if m.group(3) else None
    if not y or not (1900 <= y <= 2000):
        return None, None
    label = f"{y}年" + (f"{mo}月" if mo else "") + (f"{d}日" if d else "")
    return f"{y:04d}-{mo or 0:02d}-{d or 0:02d}", label


def split_sections(text):
    """按 ## 分节，返回 {title: body}"""
    secs = {}
    parts = re.split(r"\n## ", text)
    for p in parts:
        if not p.strip():
            continue
        lines = p.split("\n", 1)
        title = lines[0].strip().lstrip("#").strip()
        body = lines[1] if len(lines) > 1 else ""
        secs[title] = body
    return secs


def sub_sections(body):
    """按 ### 分子节 -> [(title, text)]"""
    out = []
    for chunk in re.split(r"\n### ", body):
        if not chunk.strip():
            continue
        ls = chunk.split("\n", 1)
        t = ls[0].strip()
        b = ls[1].strip() if len(ls) > 1 else ""
        out.append((t, b))
    return out


def clean_md(s):
    """轻量清理：去 [[wikilink]] 只留显示名，去 yaml 块"""
    s = re.sub(r"```yaml[\s\S]*?```", "", s)
    s = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\]]+)\]\]", r"\1", s)
    return s.strip()


def strip_links(s):
    s = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\]]+)\]\]", r"\1", s)
    return s


QUOTE_RE = re.compile(r"[“\"]([^“”\"]{12,80})[”\"]")


BAD_QUOTE = re.compile(r"[\n*#|]|\[\[|P\d{3}|→|〔|〕|【|】|^\s*[，。、；：,.]")
# 句首为连接/虚词 -> 断句残片
BAD_HEAD = set("的了，。、；：,.!?而并则且又也还但却及与或再把被使让对为由从向给其之是有这那他说道但即如使因故所以并且")
GOOD_TAIL = "。！？"


def quote_score(q):
    """给金句打分，>=2 才保留"""
    s = 0
    if q[0] not in BAD_HEAD:
        s += 1
    if q[-1] in GOOD_TAIL:
        s += 1
    if "，" in q or "、" in q:
        s += 1
    if 14 <= len(q) <= 40:
        s += 1
    if re.search(r"(是|要|必须|不|没有|就|只有|才|因为|所以|我们|应当|决)", q):
        s += 1
    return s


def extract_quotes(text, limit=3, min_score=4):
    """提取带引号的完整短句作为金句候选（严格去脏 + 打分）"""
    out, seen = [], set()
    cands = []
    for m in QUOTE_RE.finditer(text):
        q = m.group(1).strip()
        if BAD_QUOTE.search(q) or q in seen:
            continue
        if not (10 <= len(q) <= 46):
            continue
        seen.add(q)
        sc = quote_score(q)
        if sc >= min_score:
            cands.append((sc, q))
    cands.sort(key=lambda x: -x[0])
    for _, q in cands[:limit]:
        out.append(q)
    return out


def parse_tags(tag_raw):
    """兼容 '#tag #tag' 与 '主题：A、B、C' 两种格式"""
    tags = []
    for t in re.findall(r"#([^\s#]+)", tag_raw):
        t = t.strip()
        if t and t != "待整理":
            tags.append(t)
    if not tags:
        for line in tag_raw.split("\n"):
            lm = re.match(r"^(主题|问题结构|对象|方法|场景)[：:]\s*(.+)$", line.strip())
            if lm:
                for t in re.split(r"[、,，/]", lm.group(2)):
                    t = t.strip()
                    if t and t != "待整理":
                        tags.append(t)
    # 去重保序
    seen, res = set(), []
    for t in tags:
        if t not in seen:
            seen.add(t)
            res.append(t)
    return res[:8]


# ---------- 长文清洗：去掉蒸馏流水线的内部痕迹，面向访客重写口径 ----------
def clean_pipeline(text):
    """清除质量门/处理时间/本地路径/[x]勾选框等流水线内部内容"""
    if not text:
        return text
    # 1) 删除"质量门检查"整节（至文件尾或下一个一级分隔）
    text = re.sub(r"\n##+\s*✅?\s*质量门检查[\s\S]*?(?=\n## |\Z)", "\n", text)
    # 2) 删除流水线元信息行
    text = re.sub(r"^\s*[-*]?\s*\*\*(版本来源|处理时间|用户确认时间)\*\*.*$\n?", "", text, flags=re.M)
    text = re.sub(r"^\s*\*\*用户确认时间\*\*.*$\n?", "", text, flags=re.M)
    # 3) 删除"本产品是流水线阶段产物"类说明引用行
    text = re.sub(r"^>\s*本文档是[^\n]*流水线[^\n]*$\n?", "", text, flags=re.M)
    text = re.sub(r"^>\s*本文由[^\n]*蒸馏生成[^\n]*$\n?", "", text, flags=re.M)
    text = re.sub(r"^>\s*[^\n]*cangjie[^\n]*$\n?", "", text, flags=re.M, )
    text = re.sub(r"^>\s*后续所有[^\n]*$\n?", "", text, flags=re.M)
    # 4) 删除"预估 skill 数量"小节（内部排期口径）
    text = re.sub(r"\n###+\s*预估 skill 数量[\s\S]*?(?=\n### |\n## |\Z)", "\n", text)
    # 5) checkbox -> 普通列表
    text = re.sub(r"^(\s*)- \[[ xX]\]\s+", r"\1- ", text, flags=re.M)
    # 6) 章节标题去工程化
    text = text.replace("### 可 skill 化的内容", "### 书中蕴含的可复用方法")
    text = text.replace("### 不适合 skill 化的内容", "### 不宜抽离为通用方法的内容")
    text = re.sub(r"##+\s*1\.\s*结构\s*\(Structural\)", "## 一、全书结构", text)
    text = re.sub(r"##+\s*2\.\s*解释\s*\(Interpretive\)", "## 二、关键解释", text)
    re.sub(r"##+\s*3\.\s*批判\s*\(Critical\)\s*★?", "## 三、批判性审视", text)
    text = re.sub(r"##+\s*3\.\s*批判\s*\(Critical\)\s*★?", "## 三、批判性审视", text)
    text = re.sub(r"##+\s*4\.\s*应用潜力\s*\(Applicability\)", "## 四、应用潜力", text)
    text = text.replace("（阶段 0 产出）", "").replace("(阶段 0 产出)", "")
    text = re.sub(r"（阶段[\d.]+\s*[^）]*）", "", text)
    text = re.sub(r"阶段\s*1\.5\s*三重验证后定[^\n]*", "", text)
    # 7) 顶部一级标题改为面向访客的口径（渲染时会去 h1，这里兜底）
    text = re.sub(r"^#\s+.*$", "# 整书速览", text, count=1, flags=re.M)
    # 8) 收敛多余空行
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


VOLUME_INTROS = [
    {
        "n": 1,
        "theme": "从分析社会到分析矛盾",
        "text": ("本卷收文 18 篇，时间跨度 1925—1937 年，覆盖大革命失败前后与十年土地革命战争。"
                 "主线是一条认识路线的展开：先以《中国社会各阶级的分析》立下\"从经济地位推政治态度\"的分析起点，"
                 "经《湖南农民运动考察报告》的实地调查、井冈山时期的红色政权论证、《反对本本主义》的\"没有调查，没有发言权\"，"
                 "最终收束于《实践论》《矛盾论》两篇哲学总纲——把十年流血得来的经验，上升为系统的认识论与方法论。"
                 "读这一卷，重点是看\"在极端不利的环境里如何认识形势\"。"),
        "must": ["中国社会各阶级的分析", "反对本本主义", "实践论", "矛盾论"],
    },
    {
        "n": 2,
        "theme": "持久战与新民主主义",
        "text": ("本卷收文 40 篇，时间跨度 1937—1941 年，全面抗战爆发后的头四年。"
                 "核心问题从\"如何生存\"转向\"如何胜利\"：《论持久战》驳\"亡国论\"与\"速胜论\"，"
                 "把战争拆解为三个阶段的动态推演；《新民主主义论》回答\"中国向何处去\"，"
                 "给出政治、经济、文化的整体纲领；统一战线由被迫转向自觉——联合又斗争、有原则有条件的让步。"
                 "读这一卷，重点是看\"弱势方如何把时间变成资源\"。"),
        "must": ["反对自由主义", "论持久战", "新民主主义论"],
    },
    {
        "n": 3,
        "theme": "整风、群众路线与联合政府",
        "text": ("本卷收文 31 篇，时间跨度 1941—1945 年，延安整风至抗战胜利。"
                 "战场之外，这一卷处理的是\"组织自身\"：《改造我们的学习》《整顿党的作风》《反对党八股》"
                 "构成整风三部曲，诊治主观主义、宗派主义与党八股；"
                 "《为人民服务》《愚公移山》把宗旨讲成普通人能记住的话；"
                 "《论联合政府》则是战后中国方案的系统陈述。"
                 "读这一卷，重点是看\"一个组织如何清理自己的思想\"。"),
        "must": ["改造我们的学习", "整顿党的作风", "反对党八股", "为人民服务", "愚公移山", "论联合政府"],
    },
    {
        "n": 4,
        "theme": "战略决战的指挥记录",
        "text": ("本卷收文 70 篇，为五卷中篇数最多，时间跨度 1945—1949 年，第三次国内革命战争。"
                 "几乎每篇都是临机的时局判断与作战指挥：从\"抗日战争胜利后的时局和我们的方针\"的预言，"
                 "到\"集中优势兵力，各个歼灭敌人\"的十大军事原则，再到《论人民民主专政》为新中国定调。"
                 "文风也从长篇论著转向短促的电报式指令——判断、决断、再判断。"
                 "读这一卷，重点是看\"优势如何从劣势中长出来\"。"),
        "must": ["抗日战争胜利后的时局和我们的方针", "目前形势和我们的任务", "论人民民主专政"],
    },
    {
        "n": 5,
        "theme": "建国的治理与改造",
        "text": ("本卷收文 58 篇，时间跨度 1949—1957 年，中华人民共和国成立到社会主义改造基本完成。"
                 "主题从\"打赢\"转向\"治理\"：政权力量的组织、抗美援朝的决策、财政经济状况的好转、"
                 "农业合作化的争论与推进、知识分子问题与思想政治领域的工作。"
                 "与前三卷相比，这一卷的对象更多是建设中的利益协调与思想统一。"
                 "读这一卷，重点是看\"胜利之后如何面对新的复杂性\"。"),
        "must": ["中国人民站起来了", "关于农业合作化问题", "增强党的团结，继承党的传统"],
    },
]


def read(p):
    for enc in ("utf-8", "utf-8-sig", "gbk"):
        try:
            return io.open(p, encoding=enc).read()
        except Exception:
            continue
    return ""


# ---------------- 主流程 ----------------
core = {"volumes": [], "articles": [], "skills": [], "glossary": [],
        "overview": "", "digest": "", "quotes": []}
vol_detail = {i: {} for i in range(1, 6)}
vol_text = {i: {} for i in range(1, 6)}

for vno, vdir, edir, era, span in VOLUMES:
    vpath = os.path.join(ROOT, vdir)
    epath = os.path.join(ROOT, edir)
    files = sorted(glob.glob(os.path.join(vpath, "*.md")))
    # 排除卷合集文件（如 第一卷.md）
    files = [f for f in files if not re.match(r"^第.卷\.md$", os.path.basename(f))]

    for f in files:
        base = os.path.basename(f)[:-3]
        m = re.match(r"^(\d+)、(.+)$", base)
        if m:
            idx, title = int(m.group(1)), m.group(2)
        else:
            idx, title = 999, base
        # 跳过卷合集文件（如 "第一卷.md" / "00、第四卷.md"）
        if re.match(r"^第[一二三四五]卷$", title):
            continue
        raw = read(f)
        date_iso, date_label = parse_date(raw[:4000])
        body = clean_md(raw)
        words = len(re.sub(r"\s", "", body))

        # evidence
        ev_path = None
        for cand in glob.glob(os.path.join(epath, base + "*.evidence.md")):
            ev_path = cand
            break
        ev = {}
        tags = []
        if ev_path:
            et = clean_md(read(ev_path))
            secs = split_sections(et)
            digest = {}
            for st, sb in sub_sections(secs.get("三分钟读懂本文", "")):
                digest[st] = sb.strip()
            ev = {
                "digest": digest,
                "structure": secs.get("文章结构", "").strip(),
                "arguments": secs.get("关键论证与证据", "").strip(),
                "concepts": secs.get("核心概念", "").strip(),
                "methods": secs.get("双层方法候选", "").strip(),
                "methodStruct": secs.get("方法结构", "").strip(),
            }
            tags = parse_tags(secs.get("标签", ""))
            # 金句：evidence 论证 + 原文（各取若干，原文要求更高分）
            for q in extract_quotes(secs.get("关键论证与证据", ""), limit=3):
                core["quotes"].append({"q": q, "t": title, "v": vno, "i": idx})
            for q in extract_quotes(body, limit=4, min_score=5):
                core["quotes"].append({"q": q, "t": title, "v": vno, "i": idx})

        one_line = ""
        if ev.get("digest"):
            for k in ("作者最后给出的答案", "主要在解决什么问题", "为什么写"):
                if ev["digest"].get(k):
                    one_line = re.sub(r"\s+", " ", ev["digest"][k])[:110]
                    break

        core["articles"].append({
            "v": vno, "i": idx, "t": title, "d": date_iso, "dl": date_label,
            "w": words, "tags": tags, "s": one_line,
        })
        vol_detail[vno][idx] = ev
        vol_text[vno][idx] = body

    core["volumes"].append({
        "n": vno, "name": f"第{'一二三四五'[vno-1]}卷", "era": era, "span": span,
        "count": len(files),
        "period": [min([a["d"] for a in core["articles"] if a["v"] == vno and a["d"]] or [""]),
                   max([a["d"] for a in core["articles"] if a["v"] == vno and a["d"]] or [""])],
    })
    print(f"卷{vno}: {len(files)} 篇")

# ---------- skills ----------
SKILL_DIR = os.path.join(ROOT, "mao-vol1", "skills")
GROUP_HINT = {
    "认识与分析": ["investigation", "authority-reality", "three-checks", "concrete-analysis",
                "internal-external", "main-contradiction", "part-and-whole", "stakeholder"],
    "决策与执行": ["decision-chain", "concentration-of-force", "annihilation", "practice-knowledge"],
    "竞争与战略": ["sixteen-character", "strategic-retreat", "protracted-war"],
    "组织与领导": ["org-diagnosis", "mass-line", "cadre-criteria", "actions-over-words"],
    "信任与合作": ["united-front", "principled-concession"],
    "条件与可行性": ["existence-conditions"],
}
for sd in sorted(os.listdir(SKILL_DIR)):
    sp = os.path.join(SKILL_DIR, sd, "SKILL.md")
    if not os.path.isfile(sp):
        continue
    txt = read(sp)
    fm = re.match(r"^---\n([\s\S]*?)\n---", txt)
    meta = {}
    if fm:
        for line in fm.group(1).split("\n"):
            mm = re.match(r"^([A-Za-z_-]+):\s*(.*)$", line)
            if mm:
                meta[mm.group(1)] = mm.group(2).strip()
    name = meta.get("name", sd)
    desc = meta.get("description", "")
    if desc.startswith("|") or "\n" in desc:
        desc = re.sub(r"\s+", " ", desc.replace("|", " ").replace(">", " ")).strip()
        desc = re.sub(r"^\s*description:\s*", "", desc)
    body = txt[fm.end():] if fm else txt
    # 标题
    h1 = re.search(r"^#\s+(.+)$", body, re.M)
    title = h1.group(1).strip() if h1 else name
    group = "其他"
    for g, keys in GROUP_HINT.items():
        if any(k in sd for k in keys):
            group = g
            break
    core["skills"].append({"id": sd, "name": name, "title": title,
                           "desc": desc[:400], "group": group, "body": body.strip()[:6000]})
print("skills:", len(core["skills"]))

# ---------- glossary ----------
gl = read(os.path.join(ROOT, "mao-vol1", "references", "GLOSSARY.md"))
cur_group = ""
for chunk in re.split(r"\n### ", gl):
    if not chunk.strip():
        continue
    ls = chunk.split("\n", 1)
    head = ls[0].strip()
    rest = ls[1] if len(ls) > 1 else ""
    gm = re.match(r"^\d+[a-z]?\.\s*(.+)$", head)
    if not gm:
        continue
    term = gm.group(1).strip()
    defi, diff, why = "", "", ""
    mm = re.search(r"\*\*作者的定义\*\*:\s*(.*)", rest)
    if mm:
        defi = mm.group(1).strip()
    mm = re.search(r"\*\*与常识的差异\*\*:\s*(.*)", rest)
    if mm:
        diff = mm.group(1).strip()
    mm = re.search(r"\*\*为何重要\*\*:\s*(.*)", rest)
    if mm:
        why = mm.group(1).strip()
    mm = re.search(r"\*\*出处\*\*:\s*(.*)", rest)
    src = mm.group(1).strip() if mm else ""
    core["glossary"].append({"t": term, "d": defi, "diff": diff, "why": why, "src": src})
print("glossary:", len(core["glossary"]))

core["overview"] = clean_pipeline(read(os.path.join(ROOT, "mao-vol1", "references", "BOOK_OVERVIEW.md")))
core["digest"] = clean_pipeline(read(os.path.join(ROOT, "mao-vol1", "references", "DIGEST.md")))
core["router"] = read(os.path.join(ROOT, "mao-vol1", "SKILL.md"))
core["volIntros"] = VOLUME_INTROS

# ---------- 各卷的总览与精华（统一 schema，第一卷同样纳入） ----------
vol_content = {}
for vn in (1, 2, 3, 4, 5):
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"vol{vn}_content.json")
    if not os.path.isfile(p):
        print(f"  · 缺 vol{vn}_content.json（该卷总览暂缺）")
        continue
    try:
        obj = json.loads(io.open(p, encoding="utf-8").read())
        # 校验必要字段
        for k in ("thesis", "problem", "blocks", "terms", "caveat"):
            if k not in obj:
                raise KeyError(k)
        # 校验篇名真实存在（否则前端无法跳转）
        titles = {a["t"] for a in core["articles"]}
        bad = []
        for b in obj.get("blocks", []):
            keep = []
            for t in b.get("p", []):
                if t in titles:
                    keep.append(t)
                else:
                    bad.append(t)
            b["p"] = keep
        if bad:
            print(f"  · 卷{vn} 剔除不存在的篇名 {len(bad)} 个: {bad[:3]}")
        vol_content[str(vn)] = obj
        print(f"  · 卷{vn} 内容已并入（骨架 {len(obj['blocks'])} 块 / 精华 {len(obj.get('essence',''))} 字）")
    except Exception as e:
        print(f"  ! vol{vn}_content.json 解析失败：{e}")
core["volContent"] = vol_content

# ---------- 术语词典扩展 ----------
# 原有 22 条来自第一卷蒸馏，标注 vol=1
for g in core["glossary"]:
    g.setdefault("vol", 1)

# 第一卷总览的术语板块：直接取自概念词典的第一卷条目，避免两处维护同一批释义
if "1" in vol_content and not vol_content["1"].get("terms"):
    v1t = [g for g in core["glossary"] if g["vol"] == 1][:10]
    vol_content["1"]["terms"] = [
        {"t": g["t"], "d": g.get("d", ""), "diff": g.get("diff", ""), "why": g.get("why", ""), "src": g.get("src", "")}
        for g in v1t
    ]
    print(f"  · 卷1 术语板块取自概念词典 {len(v1t)} 条")

# 各卷新增术语同样并入概念词典（分卷可查）
_existing = {g["t"] for g in core["glossary"]}
_added = 0
for vn_str, obj in vol_content.items():
    if vn_str == "1":
        continue  # 第一卷术语本就在词典中
    vn = int(vn_str)
    for t in obj.get("terms", []):
        name = (t.get("t") or "").strip()
        if not name or name in _existing:
            continue
        _existing.add(name)
        core["glossary"].append({
            "t": name,
            "d": (t.get("d") or "").strip(),
            "diff": (t.get("diff") or "").strip(),
            "why": "",
            "src": "",
            "vol": vn,
        })
        _added += 1
print(f"  · 概念词典：原有 22 条 + 各卷新增 {_added} 条 = {len(core['glossary'])} 条")

# 去重金句（忽略标点差异），并剔除结尾残缺（以"而/并/但/则/且"收尾）
seen = set()
qs = []
for q in core["quotes"]:
    key = re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", q["q"])
    if not key or len(key) < 8 or key in seen:
        continue
    if q["q"][-1] in "而并但则且与之和同及或":
        continue
    seen.add(key)
    qs.append(q)
core["quotes"] = qs
print("quotes:", len(qs))


def dump(varname, obj, fname):
    js = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    with io.open(os.path.join(OUT, fname), "w", encoding="utf-8") as f:
        f.write(f"window.{varname}=" + js + ";")
    return len(js)


n = dump("MAO_CORE", core, "core.js")
print("core.js KB:", n // 1024)
for i in range(1, 6):
    payload = {"ev": vol_detail[i], "tx": vol_text[i]}
    n = dump(f"MAO_V{i}", payload, f"v{i}.js")
    print(f"v{i}.js KB:", n // 1024)
