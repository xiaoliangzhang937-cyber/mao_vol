# -*- coding: utf-8 -*-
"""
把「精选方法」的三个来源合并成一份结构化数据：
  1. curated_v{N}.md   —— I(骨架) / E(步骤) / 出处（由 method_dedup_index 精选而来）
  2. cls_final.json     —— 六类分类（规则分类 + 人工校准）
  3. bound_v{N}.json    —— B(边界)（子智能体撰写）
输出：curated_methods.json
"""
import io, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))


def load(p, default=None):
    fp = os.path.join(HERE, p)
    if not os.path.isfile(fp):
        return default
    return json.loads(io.open(fp, encoding='utf-8').read())


cls = load('cls_final.json', {})
out = {}

for v in ('2', '3', '4', '5'):
    txt = io.open(os.path.join(HERE, 'curated_v%s.md' % v), encoding='utf-8').read()
    txt = re.sub(r'^###\s*', '', txt)   # 首个块前无换行，先去掉开头的 ###
    bounds = load('bound_v%s.json' % v, {})
    items = []
    for blk in re.split(r'\n### ', txt):
        if not blk.strip():
            continue
        lines = blk.split('\n')
        m = re.match(r'^(\d+-\d+)\s*\|\s*(.+)$', lines[0])
        if not m:
            continue
        key, name = m.group(1), m.group(2).strip()
        i_txt, steps, srcs = '', [], []
        for ln in lines[1:]:
            if ln.startswith('**I(骨架)**'):
                i_txt = re.sub(r'^\*\*I\(骨架\)\*\*[:：]\s*', '', ln).strip()
            elif ln.startswith('**出处**'):
                s = re.sub(r'^\*?\*?出处\*?\*?[:：]\s*', '', ln).strip()
                srcs = [x.strip() for x in s.split('、') if x.strip()] if s else []
            elif ln.strip().startswith('- '):
                seg = ln.strip()[2:]
                if '：' in seg:
                    st, sd = seg.split('：', 1)
                    steps.append({'t': st.strip(), 'd': sd.strip()})
                else:
                    steps.append({'t': seg.strip(), 'd': ''})
        c = cls.get(key, {})
        items.append({
            't': name,
            'i': i_txt,
            'e': steps,
            'b': bounds.get(name, ''),
            'g': c.get('group', '认识与分析'),
            'p': srcs,
        })
    out[v] = items
    nb = sum(1 for it in items if it['b'])
    print('卷%s: %d 个方法（I齐全 %d / E条数 %d / B已补 %d / 出处齐全 %d）' % (
        v, len(items),
        sum(1 for it in items if it['i']),
        sum(len(it['e']) for it in items),
        nb,
        sum(1 for it in items if it['p'])))

with io.open(os.path.join(HERE, 'curated_methods.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
tot = sum(len(v) for v in out.values())
print('合计 %d 个精选方法 → curated_methods.json' % tot)
