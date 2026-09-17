/* =========================================================================
 * 方法论工坊 mod-methods.js
 * -------------------------------------------------------------------------
 * 数据来源：
 *   1) window.MAO_CORE.skills  —— 22 个方法论的正文（body，SKILL.md 精简版）
 *   2) window.MAO_CORE.glossary —— 22 条术语（用于详情面板的交叉链接）
 *   3) window.MAO_CORE.articles —— 篇目表（用于把「出处」链到原文）
 *   4) mao-vol1/SKILL.md 的「路由速查表」+ INDEX.md 的「引用图 / 推荐学习顺序」
 *      → 本文件内的 META（触发词库）、EDGES（依赖关系）、PATHS（组合路径）
 *      都是这两份蒸馏产物的转写，未额外编造。
 * 契约：MAO.md / MAO.el / MAO.esc / MAO.openArticle(v,i)
 * 零依赖、单文件、纯原生 JS。
 * ========================================================================= */
(function () {
  'use strict';

  /* ---------- 全局契约的惰性取值（避免加载顺序问题） ---------- */
  function M() { return window.MAO || {}; }
  function esc(s) {
    var m = M();
    if (typeof m.esc === 'function') return m.esc(s == null ? '' : String(s));
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function md(s) {
    var m = M();
    if (typeof m.md === 'function') return m.md(String(s == null ? '' : s));
    return esc(s).replace(/\n/g, '<br>');
  }
  function mk(tag, cls, html) {
    var m = M(), e = null;
    if (typeof m.el === 'function') { try { e = m.el(tag, cls, html); } catch (err) { e = null; } }
    if (e && e.nodeType) return e;
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  /* 五卷方法数据（window.MAO_METHODS，按需加载）与卷二~五的同构缓存 */
  var volData = null;
  var volSkillCache = {};

  /* 卷二~五的方法 → 与第一卷 skill 完全同构的对象。
     这样卡片墙（cardOf）、详情面板（openSkill）、章节导航、出处跳转都能直接复用，
     呈现方式与第一卷保持一致，差异只在数据本身。 */
  function volSkills(v) {
    if (volSkillCache[v]) return volSkillCache[v];
    var raw = (volData && volData[String(v)]) || [];
    var vname = '第' + '一二三四五'[v - 1] + '卷';
    var list = raw.map(function (it) {
      var subs = it.sub || [];
      var srcs = [];
      subs.forEach(function (b) {
        (b.p || []).forEach(function (p) { if (srcs.indexOf(p) < 0) srcs.push(p); });
      });
      var body = subs.length
        ? subs.map(function (b) {
          var seg = '## ' + b.t + '\n\n' + (b.d || '');
          if (b.p && b.p.length) seg += '\n\n**出处：** ' + b.p.join(' · ');
          return seg;
        }).join('\n\n')
        : '## 说明\n\n该条方法在原文中没有进一步拆分的做法。';
      return {
        id: 'v' + v + '::' + it.t,
        title: it.t,
        desc: it.d || '',
        group: vname,
        body: body,
        __subs: subs,
        __srcs: srcs
      };
    });
    volSkillCache[v] = list;
    return list;
  }

  function skills() {
    if (state && state.vol > 0) return volSkills(state.vol);
    var c = window.MAO_CORE || {};
    return Array.isArray(c.skills) ? c.skills : [];
  }
  function glossary() {
    var c = window.MAO_CORE || {};
    return Array.isArray(c.glossary) ? c.glossary : [];
  }
  function findSkill(id) {
    var l = skills();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  /* 篇名 → 篇目对象（用于「出处」跳转原文）。覆盖全部五卷，不再限定第一卷。 */
  function findArticleByTitle(title) {
    var l = (window.MAO_CORE || {}).articles || [];
    for (var i = 0; i < l.length; i++) if (l[i].t === title) return l[i];
    return null;
  }

  /* =======================================================================
   * 一、分组
   * ===================================================================== */
  var GROUPS = ['认识与分析', '决策与执行', '组织与领导', '竞争与战略', '信任与合作', '条件与可行性'];

  /* =======================================================================
   * 二、22 个方法论的元数据
   *   claim : 一句话主张（取自 mao-vol1/INDEX.md 的 skill 列表）
   *   src   : 原文出处篇目（取自各 skill 的 references/full.md「R — 原文」）
   *   kw    : 触发关键词库（取自 mao-vol1/SKILL.md「路由速查表」的触发信号，
   *           并补足常见口语说法，供诊断器做包含匹配）
   * ===================================================================== */
  var META = {
    'investigation-seven-steps': {
      claim: '调查研究七步法：结论产生于调查末尾，未查即断等于瞎说',
      src: ['反对本本主义', '湖南农民运动考察报告', '矛盾论'],
      kw: ['调查', '摸清', '摸底', '先摸清情况', '数据从哪来', '数据', '证据', '凭什么这么说', '凭什么', '你凭什么', '事实', '情况不明', '不了解', '接手新项目', '现有结论', '核实', '大家都说', '是真的吗', '真的吗', '信息不足', '现状', '走访', '一手', '没有发言权', '听说']
    },
    'three-checks-anti-subjectivity': {
      claim: '反主观三查：主观性 / 片面性 / 表面性自查',
      src: ['矛盾论'],
      kw: ['太主观', '主观', '片面', '表面', '考虑不周', '不全面', '想当然', '拍脑袋', '自查', '偏见', '我觉得', '盲区', '只看到一面', '一厢情愿', '自以为是', '决策质量', '有没有漏', '立场先行']
    },
    'concrete-analysis': {
      claim: '具体问题具体分析：反公式套用，先辨特殊性再套原则',
      src: ['矛盾论'],
      kw: ['照搬', '套用', '套公式', '公式', '模板', '别人的经验', '直接拿来', '情况不一样', '不一样', '适用吗', '适用', '特殊性', '复制', '最佳实践', '生搬硬套', '水土不服', '因地制宜', '通用方案', '能不能用']
    },
    'internal-external-cause': {
      claim: '内因外因分析：内因是根据，外因是条件',
      src: ['矛盾论'],
      kw: ['为什么失败', '为什么', '怪环境', '怪自己', '根因', '归因', '复盘', '同样的环境', '结果不同', '内因', '外因', '自身问题', '大环境', '客观原因', '主观原因', '差异', '到底是谁的问题', '症结']
    },
    'main-contradiction': {
      claim: '抓主要矛盾：捉住它一切迎刃而解，主次动态转化',
      src: ['矛盾论'],
      kw: ['先解决哪个', '先处理哪个', '优先级', '排优先级', '关键', '重点', '抓重点', '一堆问题', '多个问题', '同时爆', '千头万绪', '理不清', '头绪', '排序', '哪个最重要', '核心', '眉毛胡子', '主要', '纲']
    },
    'part-and-whole': {
      claim: '部分与全体评估法：不以一时一地的局部得失判全局',
      src: ['论反对日本帝国主义的策略'],
      kw: ['局部', '全局', '整体', '全盘', '大局', '止损还是继续', '里程碑', '黄了', '一着不慎', '阶段失败', '这个阶段', '部分', '权重', '得不偿失', '怎么看全局', '算不算失败', '长远看']
    },
    'stakeholder-analysis': {
      claim: '利益相关者分析：从利益结构推政治态度 / 立场',
      src: ['中国社会各阶级的分析', '湖南农民运动考察报告'],
      kw: ['谁会支持', '谁会反对', '站哪边', '蛋糕', '动机', '利益', '立场', '敌友', '谁受益', '谁受损', '相关方', '干系人', '阻力', '摆平', '他们怎么想', '合作方', '分析对方']
    },
    'authority-reality-check': {
      claim: '唯实不唯上：权威指示的正确性来自符合实际，而非出自权威',
      src: ['反对本本主义'],
      kw: ['老板说', '老板的方案', '领导说', '上级', '权威', '书上', '大厂', '专家说', '要不要听', '本本主义', '教条', '指示', '照做', '质疑', '我觉得不对', '方案不对', '照搬大厂', '要不要质疑']
    },
    'decision-chain': {
      claim: '决策链：侦察 → 判断 → 决心 → 部署，不可倒置',
      src: ['中国革命战争的战略问题'],
      kw: ['决策', '做决定', '拍板', '定下来', '判断', '决心', '部署', '决策失误', '决策老出错', '拿不定主意', '犹豫', '怎么决定', '信息不够', '流程', '系统地', '下决心']
    },
    'existence-conditions': {
      claim: '存在条件检验法：逐条核实「看似不可能之事」的生存条件',
      src: ['中国的红色政权为什么能够存在？'],
      kw: ['能活吗', '活下去', '行得通', '行不通', '可行性', '凭什么是我们', '凭什么', '小品牌', '看似不可能', '不可能', '条件', '前提', '生存', '成立吗', '能不能做', '机会渺茫', '必要条件', '这事能成吗']
    },
    'concentration-of-force': {
      claim: '集中兵力原则：一个时间一个主要方向，局部以十当一',
      src: ['井冈山的斗争'],
      kw: ['资源不够', '资源有限', '资源', '人手不够', '钱不够', '预算', '太分散', '分散', '摊大饼', '都想抓', '什么都想做', '聚焦', '往哪投', '投哪里', '该往哪投', '投入', '集中', '一个方向', '取舍', '战线太长', '多线', '精力有限']
    },
    'annihilation-thinking': {
      claim: '歼灭战思维：伤其十指不如断其一指，做透关键点',
      src: ['中国革命战争的战略问题'],
      kw: ['忙死了', '没突破', '没成果', '救火', '总在救火', '全面开花', '半成品', '做透', '关键点', '没进展', '白忙', '突破', '打穿', '做一半', '收尾', '见效', '深度', '做了很多']
    },
    'sixteen-character-tactics': {
      claim: '游击十六字诀：敌进我退 / 敌驻我扰 / 敌疲我打 / 敌退我追的行动节奏',
      src: ['星星之火，可以燎原'],
      kw: ['打不过', '正面', '敌进我退', '避其锐气', '消耗', '不对称', '游击', '骚扰', '周旋', '硬碰硬', '巨头', '弱势', '灵活', '机动', '袭扰', '蚕食', '正面刚']
    },
    'strategic-retreat-active-defense': {
      claim: '战略退却与积极防御：退却是有终点的战略步骤，防守内含反攻',
      src: ['中国革命战争的战略问题'],
      kw: ['该坚持还是撤退', '该坚持还是撤', '撤退', '硬撑', '收缩', '止损', '退让', '保实力', '保存实力', '防守', '反击', '放弃', '退出', '投入很多', '沉没成本', '战略放弃', '转攻']
    },
    'protracted-war': {
      claim: '持久战思维：战略持久、战役速决',
      src: ['论反对日本帝国主义的策略'],
      kw: ['要等多久', '多久', '速胜', '长期', '长期规划', '耐心', '时间', '决战', '持久', '慢慢来', '熬', '急不得', '节奏', '别急', '三年', '长期战']
    },
    'united-front': {
      claim: '统一战线策略：联合一切可联合的，同时保住中心支柱',
      src: ['论反对日本帝国主义的策略'],
      kw: ['要不要合作', '合作', '联合', '拉拢', '结盟', '统一战线', '盟友', '对家', '有过节', '竞对', '竞争对手', '靠得住', '反咬', '一起做', '抱团', '争取', '团结', '阵营', '伙伴']
    },
    'principled-concession': {
      claim: '有原则有条件的让步：让步会计 + 不可让步清单',
      src: ['中国共产党在抗日时期的任务'],
      kw: ['让步', '谈判', '底线', '妥协', '让多少', '退一步', '他让我', '交换', '条件', '原则', '讨价还价', '协商', '让到什么程度', '利益交换', '开价']
    },
    'actions-over-words': {
      claim: '以行动检验承诺：诺言转化为可验证清单',
      src: ['关于蒋介石声明的声明'],
      kw: ['靠谱吗', '光说不练', '说了没做', '可信吗', '承诺', '验证', '兑现', '言行', '画饼', '空口', '看他做', '兑现率', '诚信', '观察', '说到做到', '靠不靠谱']
    },
    'mass-line-mobilization': {
      claim: '群众路线动员法：先解决对方的实际问题，换真心支持',
      src: ['关心群众生活，注意工作方法'],
      kw: ['动员', '没人听', '大家支持', '让大家', '喊口号', '投入', '群众', '积极性', '号召', '凝聚', '人心', '跟随', '意愿', '员工', '参与', '士气', '真正投入']
    },
    'org-diagnosis-discipline': {
      claim: '组织诊断与纪律：表现 — 来源 — 纠正，配民主集中制',
      src: ['关于纠正党内的错误思想'],
      kw: ['团队', '没劲', '风气', '执行力', '推不动', '落不了地', '批评', '纪律', '民主集中', '组织', '懒散', '内耗', '管理', '整改', '散漫', '团队问题', '协作']
    },
    'cadre-criteria': {
      claim: '干部识别标准清单：德才兼备的可检验清单',
      src: ['为争取千百万群众进入抗日民族统一战线而斗争'],
      kw: ['选谁', '招人', '招聘', '提拔', '独当一面', '人才', '评估这个人', '这个人行吗', '用人', '干部', '胜任', '候选人', '德才', '关键岗位', '谁合适', '面试']
    },
    'practice-knowledge-loop': {
      claim: '实践 - 认识循环：干中学，每轮循环深化一层',
      src: ['实践论'],
      kw: ['上手', '新领域', '边做边学', '干中学', '快速学习', '迭代', '试错', '经验', '成长', '复盘', '入门', '摸索', '实践', '学习方法', '陌生', '怎么做起', '从零']
    }
  };

  /* =======================================================================
   * 三、依赖关系（转写自 INDEX.md 的引用图）
   *   dep  : A 是 B 的前置（先 A 后 B）
   *   comp : 配套，常同时调用
   *   con  : 对照 / 互为替代，需比较后取舍
   * ===================================================================== */
  var EDGES = [
    ['investigation-seven-steps', 'decision-chain', 'dep'],
    ['investigation-seven-steps', 'practice-knowledge-loop', 'con'],
    ['investigation-seven-steps', 'three-checks-anti-subjectivity', 'comp'],
    ['investigation-seven-steps', 'concrete-analysis', 'comp'],
    ['investigation-seven-steps', 'main-contradiction', 'dep'],
    ['investigation-seven-steps', 'existence-conditions', 'dep'],
    ['stakeholder-analysis', 'united-front', 'dep'],
    ['united-front', 'principled-concession', 'comp'],
    ['principled-concession', 'actions-over-words', 'comp'],
    ['actions-over-words', 'cadre-criteria', 'dep'],
    ['main-contradiction', 'concentration-of-force', 'dep'],
    ['concentration-of-force', 'annihilation-thinking', 'dep'],
    ['concentration-of-force', 'protracted-war', 'con'],
    ['existence-conditions', 'protracted-war', 'dep'],
    ['protracted-war', 'sixteen-character-tactics', 'comp'],
    ['sixteen-character-tactics', 'strategic-retreat-active-defense', 'con'],
    ['part-and-whole', 'strategic-retreat-active-defense', 'dep'],
    ['strategic-retreat-active-defense', 'annihilation-thinking', 'comp'],
    ['org-diagnosis-discipline', 'mass-line-mobilization', 'con'],
    ['mass-line-mobilization', 'practice-knowledge-loop', 'comp'],
    ['mass-line-mobilization', 'principled-concession', 'con'],
    ['main-contradiction', 'internal-external-cause', 'comp'],
    ['authority-reality-check', 'concrete-analysis', 'con']
  ];
  var EDGE_TYPE = { dep: '前置依赖', comp: '配套组合', con: '对照取舍' };

  /* =======================================================================
   * 四、经典组合路径（转写自 INDEX.md「推荐学习顺序」+ 引用图）
   * ===================================================================== */
  var PATHS = [
    {
      name: '取证 → 判主次 → 下决心',
      use: '信息不足、结论有争议，需要先摸清事实再拍板。',
      chain: ['investigation-seven-steps', 'main-contradiction', 'decision-chain'],
      why: '引用图：decision-chain 与 main-contradiction 均 depends-on 调查；决策链的第一步就是「侦察」。'
    },
    {
      name: '排序 → 聚焦 → 歼灭',
      use: '一堆问题并存、资源有限，需要一个能真正打出结果的突破口。',
      chain: ['main-contradiction', 'concentration-of-force', 'annihilation-thinking'],
      why: '推荐学习顺序第 4 条明确的战略执行主链路：抓主要矛盾 → 集中兵力 → 歼灭战。'
    },
    {
      name: '辨立场 → 定联合 → 谈让步 → 验承诺',
      use: '要跟外部力量合作、结盟或谈判，既想借力又怕被反噬。',
      chain: ['stakeholder-analysis', 'united-front', 'principled-concession', 'actions-over-words'],
      why: '推荐学习顺序第 9 条；引用图中 SA→UF 依赖、UF 与 PC 配套、PC 与 AW 配套。'
    },
    {
      name: '先验生存条件 → 再定时间尺度',
      use: '事情看起来几乎不可能，需要判断「能不能活」以及「要熬多久」。',
      chain: ['existence-conditions', 'protracted-war'],
      why: '推荐学习顺序第 6 条；引用图：protracted-war depends-on existence-conditions。'
    },
    {
      name: '判全局得失 → 有计划退却 → 日常行动节奏',
      use: '处于劣势、正面打不过，要决定「退不退」以及退了之后怎么打。',
      chain: ['part-and-whole', 'strategic-retreat-active-defense', 'sixteen-character-tactics'],
      why: '推荐学习顺序第 7 条；引用图：战略退却 depends-on 部分与全体，与十六字诀互为对照。'
    },
    {
      name: '先学会验人 → 再谈选人',
      use: '要提拔、招聘或把关键岗位交出去，需要一套可检验的判断标准。',
      chain: ['actions-over-words', 'cadre-criteria'],
      why: '推荐学习顺序第 8 条；引用图：actions-over-words depends-on cadre-criteria 的上下游关系。'
    },
    {
      name: '对外动员 → 复盘迭代',
      use: '需要让大家真正投入，并在推进中不断升级做法。',
      chain: ['mass-line-mobilization', 'practice-knowledge-loop'],
      why: '引用图：mass-line-mobilization composes-with practice-knowledge-loop。'
    }
  ];

  /* =======================================================================
   * 五、常见场景快捷入口（点击后填入诊断框）
   * ===================================================================== */
  var SCENES = [
    '团队推不动，交代的事总落不了地，执行力差，士气也不高',
    '资源不够，钱和人都不多，该往哪投，什么都想抓又怕摊大饼',
    '要不要跟竞对合作，他们靠得住吗，会不会反咬一口',
    '天天在救火，做了很多但没成果，全是半成品，没有突破',
    '这件事该坚持还是撤退，已经投入很多，该硬撑还是止损',
    '老板的方案我觉得不对，但他是权威，我要不要照做',
    '新领域怎么快速上手，边做边学，怎么迭代试错',
    '多个问题同时爆了，千头万绪，先处理哪个，怎么排优先级',
    '他承诺的事靠谱吗，光说不练，怎么验证他说到做到',
    '谈判要让步，让多少合适，底线在哪',
    '这事看起来几乎不可能，能行得通吗，凭什么是我们',
    '大家都这么说，是真的吗，数据从哪来，要不要先摸清情况'
  ];

  /* =======================================================================
   * 六、样式（本模块私有，全部 mw- 前缀，不污染全局）
   * ===================================================================== */
  var STYLE = [
    '.mw-intro{background:var(--paper-2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:var(--r);padding:18px 20px;margin-bottom:22px}',
    '.mw-intro p{margin:0 0 .7em;font-size:14px;line-height:1.9;color:var(--ink-2)}',
    '.mw-intro p:last-child{margin-bottom:0}',
    '.mw-intro b{color:var(--ink)}',
    '.mw-jump{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}',
    '.mw-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}',
    '.mw-field{flex:1;min-width:260px;position:relative}',
    '.mw-field textarea{width:100%;min-height:76px;resize:vertical;padding:12px 14px;border:1px solid var(--line-2);border-radius:var(--r);background:var(--paper);font-family:var(--sans);font-size:14px;line-height:1.7;color:var(--ink);outline:none}',
    '.mw-field textarea:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(158,43,37,.08)}',
    '.mw-scenes{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 4px}',
    '.mw-scene{font-size:12.5px}',
    '.mw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}',
    '.mw-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:16px 17px;border:1px solid var(--line);border-radius:var(--r);background:var(--paper);cursor:pointer;transition:all .18s}',
    '.mw-card:hover{border-color:var(--line-2);box-shadow:0 4px 16px rgba(26,22,19,.07);transform:translateY(-2px)}',
    '.mw-card.on{border-color:var(--red);box-shadow:0 0 0 2px rgba(158,43,37,.12)}',
    '.mw-card-t{font-family:var(--serif);font-size:17.5px;font-weight:700;color:var(--ink);line-height:1.35;display:flex;align-items:baseline;gap:8px}',
    '.mw-card-t i{font-style:normal;font-family:var(--sans);font-size:11px;font-weight:400;color:#fff;background:var(--red);border-radius:3px;padding:1px 5px;flex:none}',
    '.mw-card-c{font-size:13px;color:var(--ink-2);line-height:1.75}',
    '.mw-sig{display:flex;gap:5px;flex-wrap:wrap}',
    '.mw-src{font-size:11.5px;color:var(--ink-3);border-top:1px dashed var(--line);padding-top:8px;margin-top:2px}',
    '.mw-src a{color:var(--blue);text-decoration:none;border-bottom:1px dotted var(--blue);margin-right:8px;cursor:pointer}',
    '.mw-src a:hover{color:var(--red);border-bottom-color:var(--red)}',
    '.mw-panel{background:var(--paper);border:1px solid var(--line-2);border-radius:var(--r);margin-bottom:18px;overflow:hidden}',
    '.mw-panel-h{padding:18px 20px 14px;background:var(--paper-2);border-bottom:1px solid var(--line);position:relative}',
    '.mw-panel-t{font-family:var(--serif);font-size:23px;font-weight:700;color:var(--ink);line-height:1.3;padding-right:36px}',
    '.mw-panel-c{font-size:13.5px;color:var(--ink-2);margin-top:8px;line-height:1.8}',
    '.mw-x{position:absolute;top:14px;right:14px;width:30px;height:30px;border:1px solid var(--line-2);background:var(--paper);border-radius:50%;cursor:pointer;color:var(--ink-2);font-size:16px;line-height:1;display:grid;place-items:center}',
    '.mw-x:hover{background:var(--red);color:#fff;border-color:var(--red)}',
    '.mw-secnav{display:flex;gap:6px;flex-wrap:wrap;padding:10px 20px;border-bottom:1px solid var(--line);background:var(--paper)}',
    '.mw-secnav button{padding:5px 12px;border:1px solid var(--line);background:var(--paper-3);border-radius:20px;font-size:12.5px;color:var(--ink-2);cursor:pointer;font-family:var(--sans)}',
    '.mw-secnav button:hover{border-color:var(--gold);color:var(--ink)}',
    '.mw-panel-b{padding:20px 22px 30px}',
    '.mw-terms{margin-top:20px;padding:14px 16px;background:var(--paper-2);border-radius:var(--r);border:1px solid var(--line)}',
    '.mw-terms h4{font-family:var(--serif);font-size:15px;color:var(--ink);margin:0 0 8px}',
    '.mw-term{display:block;margin-bottom:8px;font-size:13px;color:var(--ink-2);line-height:1.7}',
    '.mw-term b{color:var(--red);font-family:var(--serif)}',
    '.mw-term em{font-style:normal;color:var(--ink-3);font-size:12px}',
    '.mw-res{margin-top:16px}',
    '.mw-main{border:1px solid var(--line-2);border-left:3px solid var(--red);border-radius:var(--r);padding:16px 18px;background:var(--paper)}',
    '.mw-alt{border:1px solid var(--line);border-radius:var(--r);padding:13px 16px;margin-top:10px;background:var(--paper-2)}',
    '.mw-hit{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 0}',
    '.mw-hit span{background:rgba(184,137,58,.14);color:#8a6524;border:1px solid rgba(184,137,58,.3);border-radius:3px;font-size:11.5px;padding:1px 7px}',
    '.mw-bar{height:6px;background:var(--paper-3);border-radius:4px;overflow:hidden;margin-top:10px}',
    '.mw-bar i{display:block;height:100%;border-radius:4px;transition:width .4s}',
    '.mw-score{font-size:12px;color:var(--ink-3);margin-top:6px;display:flex;justify-content:space-between}',
    '.mw-steps{margin:10px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2);line-height:1.85}',
    '.mw-steps li{margin-bottom:.3em}',
    '.mw-low{border:1px dashed var(--line-2);border-radius:var(--r);padding:18px;background:var(--paper-2);color:var(--ink-2);font-size:14px;line-height:1.9;margin-top:14px}',
    '.mw-low b{font-family:var(--serif);color:var(--ink);font-size:15px;display:block;margin-bottom:6px}',
    '.mw-path{border:1px solid var(--line);border-radius:var(--r);padding:15px 17px;background:var(--paper);margin-bottom:12px}',
    '.mw-path-t{font-family:var(--serif);font-size:16px;font-weight:700;color:var(--ink);margin-bottom:6px}',
    '.mw-path-u{font-size:13.5px;color:var(--ink-2);line-height:1.8;margin-bottom:10px}',
    '.mw-chain{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
    '.mw-node{padding:5px 11px;border:1px solid var(--line-2);border-radius:var(--r);background:var(--paper-2);font-size:13px;color:var(--ink);cursor:pointer;font-family:var(--sans);transition:all .16s}',
    '.mw-node:hover{background:var(--red);color:#fff;border-color:var(--red)}',
    '.mw-arrow{color:var(--gold);font-size:13px}',
    '.mw-path-w{font-size:11.5px;color:var(--ink-3);margin-top:10px;line-height:1.7;border-top:1px dashed var(--line);padding-top:8px}',
    '.mw-sec{margin-bottom:26px}',
    '.mw-grp{margin-bottom:22px}',
    '.mw-grp-h{display:flex;align-items:center;gap:10px;margin:0 0 12px}',
    '.mw-grp-h span.n{font-size:12px;color:var(--ink-3);background:var(--paper-3);border-radius:20px;padding:2px 9px}',
    '.mw-none{padding:36px 16px;text-align:center;color:var(--ink-3);font-size:14px;font-family:var(--serif)}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('mw-style')) return;
    var s = document.createElement('style');
    s.id = 'mw-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  /* =======================================================================
   * 七、工具函数
   * ===================================================================== */
  function claimOf(s) {
    var m = META[s.id] || {};
    if (s.desc) return s.desc;
    return m.claim || s.title || s.id;
  }
  /* 卡片上的「要点标签」：第一卷用人工整理的触发信号；
     卷二~五没有触发词库，改用该条方法的具体做法名充当要点（同样是真实数据，不臆造） */
  function kwOf(id) {
    if (META[id] && META[id].kw) return META[id].kw;
    var s = findSkill(id);
    if (s && s.__subs) {
      // 做法名较长，卡片上只取前 3 条，避免撑破卡片
      return s.__subs.slice(0, 3).map(function (b) { return b.t; });
    }
    return [];
  }
  /* 卡片上的「出处」：第一卷用 META 白名单；卷二~五用该方法各具体做法标注的篇目 */
  function srcOf(id) {
    if (META[id] && META[id].src) return META[id].src;
    var s = findSkill(id);
    return (s && s.__srcs) || [];
  }

  /* 取 body 中的 ## 章节标题，做成小导航 */
  function sectionTitles(body) {
    var out = [], lines = String(body || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = /^##\s+(.+?)\s*$/.exec(lines[i]);
      if (!m) continue;
      var t = m[1]
        .replace(/^[IVXLCE]+\s*[—–-]\s*/, '')  // 去掉 "I — " / "E — " 前缀
        .replace(/[（(][^）)]*[）)]\s*$/, '')    // 去掉结尾的 (Execution)
        .replace(/[★☆]/g, '')
        .trim();
      if (t) out.push(t);
    }
    return out;
  }

  /* 取 ## E 步骤里的编号步骤，作为「核心步骤摘要」（最多 4 条） */
  function stepSummary(body) {
    var lines = String(body || '').split('\n'), out = [], inE = false;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (/^##\s+/.test(L)) { inE = /^##\s+E\b/.test(L) || /步骤|Execution/.test(L); continue; }
      if (!inE) continue;
      var m = /^\s*\d+\.\s+\**(.+?)\**\s*$/.exec(L);
      if (m) {
        var t = m[1].replace(/[（(][^）)]*[）)]/g, '').trim();
        if (t) out.push(t);
      }
      if (out.length >= 5) break;
    }
    return out.slice(0, 4);
  }

  /* 归一化：去空白与常见标点，便于包含匹配 */
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[\s，,。.！!？?；;：:、"'“”‘’（）()《》\[\]【】…~～\-—_/\\|]+/g, '');
  }

  /* =======================================================================
   * 八、诊断器：打分逻辑
   *   - 关键词包含匹配：input 中包含 kw 即命中
   *   - 权重按关键词长度：2-3 字 = 2 分，4-5 字 = 3 分，6 字以上 = 4 分
   *     （越长的触发语越具体，误命中概率越低，故权重更高）
   *   - 多关键词命中加权：每多命中 1 个，额外 +1.5（命中越密集越可信）
   *   - 阈值 6 分：低于阈值判定为「不适配」，按原体系设计诚实降级，不硬套
   * ===================================================================== */
  function kwWeight(kw) {
    var n = kw.length;
    if (n >= 6) return 4;
    if (n >= 4) return 3;
    return 2;
  }
  var THRESHOLD = 6;
  var FULL = 12; // 换算「匹配度」的满分基准

  function score(text, id) {
    var t = norm(text);
    if (!t) return { score: 0, hits: [] };
    var kws = kwOf(id), hits = [], s = 0;
    for (var i = 0; i < kws.length; i++) {
      var k = norm(kws[i]);
      if (!k) continue;
      if (t.indexOf(k) !== -1) { hits.push(kws[i]); s += kwWeight(kws[i]); }
    }
    if (hits.length > 1) s += (hits.length - 1) * 1.5;
    return { score: s, hits: hits };
  }

  function diagnose(text) {
    var list = skills(), res = [];
    for (var i = 0; i < list.length; i++) {
      var r = score(text, list[i].id);
      res.push({ id: list[i].id, score: r.score, hits: r.hits });
    }
    res.sort(function (a, b) { return b.score - a.score; });
    return res;
  }

  /* 与主方法相关的其它方法：来自 EDGES（依赖 / 配套 / 对照） */
  function relatedOf(id) {
    var out = [];
    for (var i = 0; i < EDGES.length; i++) {
      var a = EDGES[i][0], b = EDGES[i][1], t = EDGES[i][2];
      if (a === id) out.push({ id: b, type: t, dir: 'down' });
      else if (b === id) out.push({ id: a, type: t, dir: 'up' });
    }
    return out;
  }

  /* 给出「先用 X 再用 Y」式的调用顺序理由 */
  function comboReason(mainId, rel) {
    var A = claimOf(findSkill(mainId) || { id: mainId, title: mainId });
    var s = findSkill(rel.id);
    var B = s ? s.title : rel.id;
    var Bs = s ? claimOf(s) : '';
    if (rel.type === 'comp') {
      return '与「' + B + '」是配套组合：' + (Bs || B) + '。本方法定主干，它补另一侧，通常同时调用。';
    }
    if (rel.type === 'dep') {
      return rel.dir === 'up'
        ? '前置：先用「' + B + '」打底（' + (Bs || B) + '），再进入「' + A.split('：')[0] + '」，否则判断会悬空。'
        : '后续：本方法定完方向后，用「' + B + '」落地（' + (Bs || B) + '）。';
    }
    return '对照：若本方法不适用，可与「' + B + '」比较后取舍——' + (Bs || B) + '。';
  }

  /* =======================================================================
   * 九、模块主体
   * ===================================================================== */
  var state = { g: '全部', q: '', open: null, diag: '' };

  var refs = {};   // 容器引用
  var timer = null;

  function render(root, head, query) {
    injectStyle();
    injectVolStyle();
    state = { g: '全部', q: '', open: null, diag: '', vol: 0, volCap: 60 };
    refs = {};
    root.innerHTML = '';

    /* 与其他页面保持一致：内容统一包在 .wrap 里（max-width 1240 + 左右留白） */
    var wrap = mk('div', 'wrap');
    root.appendChild(wrap);
    refs.wrap = wrap;

    wrap.appendChild(buildIntro());
    wrap.appendChild(buildVolBar());    // 卷切换：第一 ~ 五卷
    wrap.appendChild(buildWall());      // A（第一卷：22 个精炼方法论）
    wrap.appendChild(buildDiag());      // B
    wrap.appendChild(buildPaths());     // C

    /* 重复渲染同一容器时先解绑，避免事件叠加 */
    if (root.__mwClick) root.removeEventListener('click', root.__mwClick);
    root.__mwClick = onClick;
    root.addEventListener('click', onClick);
    renderGrid();
    syncVol();

    /* 深链支持：① 全局搜索命中方法论时写入 mao_skill_focus，这里自动展开 */
    var focus = null;
    try { focus = sessionStorage.getItem('mao_skill_focus'); } catch (e) { focus = null; }
    if (focus && findSkill(focus)) {
      try { sessionStorage.removeItem('mao_skill_focus'); } catch (e2) { /* 忽略 */ }
      openSkill(focus);
    }
    /* ② #/methods?q=xxx 预填诊断框并立即诊断 */
    if (query && query.q && refs.diagInput) {
      refs.diagInput.value = String(query.q);
      state.diag = String(query.q);
      runDiag();
    }
  }

  /* ---------- 顶部说明 ---------- */
  function buildIntro() {
    var sec = mk('section', 'mw-sec');
    var box = mk('div', 'mw-intro');
    box.innerHTML =
      '<p>这里有两层内容，用上方「方法论来源」切换：<b>第一卷</b>是 <b>18 篇文章蒸馏出的 22 个方法论</b>，' +
      '每个都带触发条件、操作步骤与适用边界（原形态是一套 agent skill：含「骨架 / 步骤 / 边界」三段）；' +
      '<b>第二至五卷</b>则是该卷各篇逐篇解构中抽取、并做过跨篇去重的方法条目，' +
      '颗粒度更细，每条标注具体做法与出处篇目。</p>' +
      '<p><b>怎么用：</b>① 不知道该用哪个方法 → 用下方「问题诊断器」描述你的现实困境，它会按触发信号匹配；' +
      '② 已经知道要看哪个 → 直接在卡片墙点开全文，正文顶部有章节小导航；' +
      '③ 一个方法不够 → 看页面底部的「组合路径」，那里给出的是有依赖关系支撑的调用顺序；' +
      '④ 想按卷查方法 → 用上面的切换条，或到「整书速览 → 方法图谱」一次浏览五卷全部方法。</p>' +
      '<p class="muted small">这套体系自带一条设计原则：<b>不硬套</b>。若你的问题不属于方法论能处理的范围' +
      '（纯事实查询、日常琐事、范式完全不同的专业问题），诊断器会明确告知不适配，而不是硬塞一个答案。</p>';

    var jump = mk('div', 'mw-jump');
    [['卡片墙', 'mw-wall'], ['问题诊断器', 'mw-diag'], ['组合路径', 'mw-paths']].forEach(function (p) {
      var b = mk('button', 'chip', esc(p[0]));
      b.setAttribute('data-act', 'jump');
      b.setAttribute('data-id', p[1]);
      jump.appendChild(b);
    });
    box.appendChild(jump);
    sec.appendChild(box);
    return sec;
  }

  /* =======================================================================
   * 卷切换与「第二 ~ 五卷」方法视图
   * 第一卷：22 个经完整蒸馏的方法论（卡片墙 / 诊断器 / 组合路径）
   * 其余四卷：该卷各篇逐篇解构中抽取、跨篇去重后的方法条目
   * ===================================================================== */

  /* 各卷方法论特征（据该卷篇目与方法条目归纳） */
  var VOL_NOTE = {
    2: '这是「以弱对强、把时间当资源」的一卷。方法集中在三处：怎样把互相矛盾的因素全部摆出来比较，从而判断整体前途，' +
       '而不是抓住一个因素就下结论；怎样在必须维持的合作关系里保住自主——联合又斗争、让步设边界、斗争自设分寸；' +
       '怎样把一场无法速胜的战争拆成有阶段的长期部署。把「持久」从一句决心变成可执行的安排，是这一卷的方法底色。',
    3: '这一卷方法数量最少，方向也最「向内」——它处理的是组织自身的问题。集中在三类：怎样统一认识（学习、检查、' +
       '批评与自我批评的成套程序）；怎样把一般号召落到具体单位（一般和个别相结合、领导和群众相结合）；' +
       '怎样在文艺、经济、政策这些具体领域里避免主观主义。把「纠正错误」做成一套可重复、可推广的程序，是它的特征。',
    4: '方法数量最多的一卷，因为几乎每篇都是临机的判断与部署。集中在四类：怎样以对方实际做过的事、而非它宣称的意图来判断对手；' +
       '怎样在劣势期不计较一城一地、专打歼灭有生力量；怎样用一次次小胜累积出力量对比的根本变化；以及大量纠偏类方法——' +
       '按地区条件分级施策、划清打击界限、对可争取者区别对待。把「赢」拆成可累积、可检验的小步骤，是这一卷的方法特征。',
    5: '工作对象从战场转到了国家，方法也随之转向「控制节奏」。集中在四类：力量有限时怎样分配打击面（不要四面出击，' +
       '在一个方向让步以集中另一个方向）；怎样用一条总方向统摄各项具体政策，以便判断走得过快还是过慢；' +
       '怎样按条件成熟度分步推进改造、并留出「刹车」的余地；怎样区分矛盾性质、分别用说服或强制的方法处理。' +
       '把治理当成一个需要校准节奏的过程，是这一卷的方法特征。'
  };

  var volData = null;   // window.MAO_METHODS 缓存

  function injectVolStyle() {
    if (document.getElementById('mw-vstyle')) return;
    var s = document.createElement('style');
    s.id = 'mw-vstyle';
    s.textContent = [
      '.mw-volbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:6px 0 4px;' +
        'padding:14px 16px;background:var(--paper-2);border:1px solid var(--line);border-radius:var(--r)}',
      '.mw-volbar-lab{font-family:var(--serif);font-weight:700;font-size:14px;color:var(--ink);margin-right:4px}',
      '.mw-volbar-hint{margin-left:auto}',
      '.mw-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-right:auto}',
      '.mw-volhead-meta{font-size:12.5px;color:var(--ink-3)}',
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- 卷切换条 ---------- */
  function buildVolBar() {
    var sec = mk('section', 'mw-sec mw-volbar');
    sec.id = 'mw-volbar';
    sec.appendChild(mk('span', 'mw-volbar-lab', '方法论来源'));
    refs.volChips = [];
    var opts = [{ v: 0, t: '第一卷', n: skills().length }];
    [2, 3, 4, 5].forEach(function (v) { opts.push({ v: v, t: MKVOL(v), n: null }); });
    opts.forEach(function (o) {
      var b = mk('button', 'chip' + (state.vol === o.v ? ' on' : ''),
        esc(o.t) + (o.n ? ' <span class="n">' + o.n + '</span>' : ''));
      b.setAttribute('data-act', 'vol');
      b.setAttribute('data-id', String(o.v));
      if (o.v === 0) b.title = '22 个经完整蒸馏的方法论（含步骤与适用边界）';
      else b.title = '该卷方法条目（逐篇解构抽取 + 跨篇去重）';
      refs.volChips.push(b);
      sec.appendChild(b);
    });
    refs.volHint = mk('span', 'mw-volbar-hint small muted', '');
    sec.appendChild(refs.volHint);
    return sec;
  }

  function MKVOL(v) {
    var m = M();
    return (typeof m.volName === 'function') ? m.volName(v) : ('第' + '一二三四五'[v - 1] + '卷');
  }

  /* ---------- 卷切换：统一由卡片墙承载，只换数据源与说明文字 ---------- */
  function syncVol() {
    var first = state.vol === 0;

    /* 诊断器与组合路径只针对第一卷那 22 个精炼方法论，其余卷隐藏 */
    ['mw-diag', 'mw-paths'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = first ? '' : 'none';
    });

    /* 卷切换条高亮 */
    (refs.volChips || []).forEach(function (b) {
      var on = parseInt(b.getAttribute('data-id'), 10) === state.vol;
      b.className = 'chip' + (on ? ' on' : '');
    });

    /* 卡片墙标题 */
    var title = document.getElementById('mw-wall-title');
    if (title) {
      if (first) {
        title.innerHTML = '方法论卡片墙';
      } else {
        var meta = (M().volMeta ? M().volMeta(state.vol) : null) || {};
        title.innerHTML = esc(MKVOL(state.vol)) + ' · 方法论卡片墙<small>' + esc(meta.span || '') +
          (meta.count ? (' · ' + meta.count + ' 篇') : '') + '</small>';
      }
    }

    /* 卷方法论特征说明 */
    var note = document.getElementById('mw-volnote');
    if (note) {
      if (first) { note.innerHTML = ''; note.style.display = 'none'; }
      else { note.innerHTML = md(VOL_NOTE[state.vol] || ''); note.style.display = ''; }
    }

    if (refs.volHint) {
      refs.volHint.textContent = first
        ? '第一卷 18 篇蒸馏出的精炼方法论，含触发信号、操作步骤与适用边界'
        : '从该卷各篇逐篇解构中抽取、跨篇去重后的方法条目';
    }

    if (first) { renderGroupBar(); renderGrid(); return; }

    /* 卷二~五：按需加载方法数据后，用同一套卡片重建 */
    if (volData) { renderGroupBar(); renderGrid(); return; }
    if (refs.grid) {
      refs.grid.className = '';
      refs.grid.innerHTML = '';
      refs.grid.appendChild(mk('div', 'mw-none', '正在载入本卷方法…'));
    }
    var m = M();
    if (typeof m.methods !== 'function') {
      if (refs.grid) refs.grid.innerHTML = '<div class="mw-none">方法数据不可用</div>';
      return;
    }
    var want = state.vol;
    m.methods().then(function (d) {
      volData = d || {};
      if (state.vol !== want) return;   // 加载期间用户已切走
      renderGroupBar();
      renderGrid();
    }).catch(function () {
      if (refs.grid) refs.grid.innerHTML = '<div class="mw-none">方法数据加载失败</div>';
    });
  }

  /* ---------- A. 卡片墙 ---------- */
  function buildWall() {
    var sec = mk('section', 'mw-sec');
    sec.id = 'mw-wall';

    var h2 = mk('h2', 'sec-title', '方法论卡片墙');
    h2.id = 'mw-wall-title';
    sec.appendChild(h2);

    /* 卷二~五的卷方法论特征说明（第一卷时隐藏） */
    var note = mk('div', 'mw-volnote');
    note.id = 'mw-volnote';
    note.style.display = 'none';
    sec.appendChild(note);

    var bar = mk('div', 'mw-toolbar');
    refs.chipsBox = mk('div', 'mw-chips');
    refs.chipsBox.id = 'mw-chips';
    bar.appendChild(refs.chipsBox);

    var sp = mk('div', 'mw-field');
    sp.style.maxWidth = '240px';
    sp.style.flex = '0 1 240px';
    var inp = mk('input', '', '');
    inp.type = 'search';
    inp.placeholder = '搜索方法名 / 主张 / 要点…';
    inp.setAttribute('data-role', 'wallq');
    inp.style.cssText = 'width:100%;padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r);background:var(--paper);font-family:var(--sans);font-size:13px;color:var(--ink);outline:none';
    inp.addEventListener('input', function () { state.q = inp.value; renderGrid(); });
    sp.appendChild(inp);
    bar.appendChild(sp);
    sec.appendChild(bar);
    refs.wallInput = inp;
    refs.toolbar = bar;

    refs.detail = mk('div', '', '');
    sec.appendChild(refs.detail);
    refs.grid = mk('div', 'mw-grid');
    sec.appendChild(refs.grid);
    return sec;
  }

  /* 分组栏：第一卷显示 6 个分组；卷二~五只有一卷，只显示「全部」 */
  function renderGroupBar() {
    var box = refs.chipsBox;
    if (!box) return;
    box.innerHTML = '';
    var list = skills();
    function chip(label, n, active, id) {
      var b = mk('button', 'chip' + (active ? ' on' : ''),
        esc(label) + ' <span class="n">' + n + '</span>');
      b.setAttribute('data-act', 'group');
      b.setAttribute('data-id', id);
      return b;
    }
    box.appendChild(chip('全部', list.length, state.g === '全部', '全部'));
    if (state.vol > 0) return;   // 卷二~五不按 6 组细分
    GROUPS.forEach(function (g) {
      var n = list.filter(function (s) { return s.group === g; }).length;
      if (!n) return;
      box.appendChild(chip(g, n, state.g === g, g));
    });
  }

  function renderGrid() {
    var q = norm(state.q);
    var list = skills().filter(function (s) {
      if (state.vol === 0 && state.g !== '全部' && s.group !== state.g) return false;
      if (!q) return true;
      var hay = norm(s.title + claimOf(s) + kwOf(s.id).join(''));
      return hay.indexOf(q) !== -1;
    });

    refs.grid.innerHTML = '';
    if (!list.length) {
      refs.grid.className = '';
      refs.grid.appendChild(mk('div', 'mw-none', state.vol > 0
        ? '没有匹配的方法。换个关键词，或点「全部」看本卷完整方法。'
        : '没有匹配的方法论。换个关键词，或点「全部」看完整 22 个。'));
      return;
    }
    refs.grid.className = 'mw-grid';

    /* 卷二~五：不按 6 组分区，直接平铺——卡片与详情面板仍复用第一卷那套。
       这些卷条目多（88~223 个），分批渲染以免首屏卡顿。 */
    if (state.vol > 0) {
      var cap = state.volCap || 60;
      list.slice(0, cap).forEach(function (s) { refs.grid.appendChild(cardOf(s)); });
      if (list.length > cap) {
        var more = mk('button', 'btn', '显示更多（还有 ' + (list.length - cap) + ' 个）');
        more.style.cssText = 'grid-column:1/-1;justify-self:center;margin-top:10px';
        more.addEventListener('click', function () {
          state.volCap = cap + 60;
          renderGrid();
        });
        refs.grid.appendChild(more);
      }
      return;
    }

    /* 按分组分区 */
    var order = state.g === '全部' ? GROUPS : [state.g];
    order.forEach(function (g) {
      var sub = list.filter(function (s) { return s.group === g; });
      if (!sub.length) return;
      var wrap = mk('div', 'mw-grp');
      wrap.style.gridColumn = '1 / -1';
      var h = mk('h3', 'mw-grp-h', esc(g) + '<span class="n">' + sub.length + '</span>');
      wrap.appendChild(h);
      var inner = mk('div', 'mw-grid');
      sub.forEach(function (s) { inner.appendChild(cardOf(s)); });
      wrap.appendChild(inner);
      refs.grid.appendChild(wrap);
    });

    /* 未归入 6 组的兜底 */
    var rest = list.filter(function (s) { return GROUPS.indexOf(s.group) === -1; });
    if (rest.length) {
      var w2 = mk('div', 'mw-grp');
      w2.style.gridColumn = '1 / -1';
      w2.appendChild(mk('h3', 'mw-grp-h', '其它<span class="n">' + rest.length + '</span>'));
      var i2 = mk('div', 'mw-grid');
      rest.forEach(function (s) { i2.appendChild(cardOf(s)); });
      w2.appendChild(i2);
      refs.grid.appendChild(w2);
    }
  }

  function cardOf(s) {
    var c = mk('div', 'mw-card' + (state.open === s.id ? ' on' : ''));
    c.setAttribute('data-act', 'open');
    c.setAttribute('data-id', esc(s.id));
    c.innerHTML =
      '<div class="mw-card-t">' + esc(s.title) + '<i>' + esc(s.group) + '</i></div>' +
      '<div class="mw-card-c">' + esc(claimOf(s)) + '</div>' +
      '<div class="mw-sig">' + kwOf(s.id).slice(0, 5).map(function (k) {
        return '<span class="chip" style="cursor:default">' + esc(k) + '</span>';
      }).join('') + '</div>' +
      '<div class="mw-src">' + (srcOf(s.id).length
        ? '出自：' + srcOf(s.id).map(function (t) {
          var a = findArticleByTitle(t);
          return a
            ? '<a data-act="article" data-v="' + a.v + '" data-i="' + a.i + '">' + esc(t) + '</a>'
            : esc(t);
        }).join('')
        : '<span class="muted">出处：正文未提供，不臆测</span>') + '</div>';
    return c;
  }

  /* ---------- 详情面板（就地展开） ---------- */
  function openSkill(id) {
    state.open = id;
    renderGrid();
    var s = findSkill(id);
    if (!s) return;

    refs.detail.innerHTML = '';
    var p = mk('div', 'mw-panel');

    var h = mk('div', 'mw-panel-h');
    var x = mk('button', 'mw-x', '×');
    x.setAttribute('data-act', 'close');
    x.title = '收起';
    h.appendChild(x);
    h.appendChild(mk('div', 'mw-panel-t', esc(s.title)));
    h.appendChild(mk('div', 'mw-panel-c',
      esc(claimOf(s)) + '<br><span class="muted small">分组：' + esc(s.group) +
      (srcOf(s.id).length ? '　·　原文出处：' + esc(srcOf(s.id).join('、')) : '') + '</span>'));
    p.appendChild(h);

    /* 章节小导航 */
    var titles = sectionTitles(s.body);
    if (titles.length > 1) {
      var nav = mk('div', 'mw-secnav');
      titles.forEach(function (t, i) {
        var b = mk('button', '', esc((i + 1) + '. ' + t));
        b.setAttribute('data-act', 'sec');
        b.setAttribute('data-id', String(i));
        nav.appendChild(b);
      });
      p.appendChild(nav);
    }

    var body = mk('div', 'mw-panel-b md');
    body.innerHTML = md(s.body);
    var h2s = body.querySelectorAll('h2');
    for (var i = 0; i < h2s.length; i++) h2s[i].id = 'mw-h-' + i;
    p.appendChild(body);

    /* 相关术语交叉链接（来自 MAO_CORE.glossary） */
    var terms = glossary().filter(function (t) {
      return s.body.indexOf(t.t) !== -1 || s.title.indexOf(t.t) !== -1;
    }).slice(0, 4);
    if (terms.length) {
      var tb = mk('div', 'mw-terms');
      tb.appendChild(mk('h4', '', '相关概念（摘自本站术语词典）'));
      terms.forEach(function (t) {
        tb.appendChild(mk('div', 'mw-term',
          '<b>' + esc(t.t) + '</b>　' + esc(t.d || '') +
          (t.src ? '<br><em>出处：' + esc(t.src) + '</em>' : '')));
      });
      body.appendChild(tb);
    }

    refs.detail.appendChild(p);
    if (p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeSkill() {
    state.open = null;
    refs.detail.innerHTML = '';
    renderGrid();
  }

  /* ---------- B. 问题诊断器 ---------- */
  function buildDiag() {
    var sec = mk('section', 'mw-sec');
    sec.id = 'mw-diag';
    sec.appendChild(mk('h2', 'sec-title', '问题诊断器'));
    var tip = mk('p', 'muted small',
      '描述你当前遇到的困境或要做的决定（一句话就够）。诊断器会把你的措辞与 22 个方法的触发信号做匹配，' +
      '给出主推方法与配套方法；匹配不上时它会直说，不会硬套。');
    tip.style.margin = '-6px 0 12px';
    sec.appendChild(tip);

    var wrap = mk('div', 'card');
    var f = mk('div', 'mw-field');
    var ta = mk('textarea', '', '');
    ta.placeholder = '例如：资源不够，什么都想抓，该往哪投……';
    ta.setAttribute('data-role', 'diag');
    f.appendChild(ta);
    wrap.appendChild(f);

    var sc = mk('div', 'mw-scenes');
    SCENES.forEach(function (t) {
      var b = mk('button', 'chip mw-scene', esc(t.length > 18 ? t.slice(0, 18) + '…' : t));
      b.title = t;
      b.setAttribute('data-act', 'scene');
      b.setAttribute('data-id', esc(t));
      sc.appendChild(b);
    });
    wrap.appendChild(sc);

    var row = mk('div', 'mw-toolbar');
    row.style.margin = '12px 0 0';
    var go = mk('button', 'btn btn-primary', '诊断');
    go.setAttribute('data-act', 'diag');
    var cl = mk('button', 'btn btn-ghost', '清空');
    cl.setAttribute('data-act', 'clear');
    row.appendChild(go);
    row.appendChild(cl);
    wrap.appendChild(row);

    refs.diagInput = ta;
    refs.result = mk('div', 'mw-res');
    wrap.appendChild(refs.result);
    sec.appendChild(wrap);

    ta.addEventListener('input', function () {
      state.diag = ta.value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { runDiag(); }, 200);
    });
    return sec;
  }

  function runDiag() {
    var text = (refs.diagInput && refs.diagInput.value || '').trim();
    var r = refs.result;
    r.innerHTML = '';
    if (!text) {
      r.appendChild(mk('div', 'mw-low', '<b>还没输入</b>在上面写一句你的困境，或点一个常见场景试试。'));
      return;
    }

    var res = diagnose(text);
    var top = res[0];
    var topScore = top ? top.score : 0;

    /* 不适配：诚实降级 */
    if (topScore < THRESHOLD) {
      r.appendChild(mk('div', 'mw-low',
        '<b>这个问题不太适配毛选方法论</b>' +
        '输入里没有命中任何一个方法的触发信号（最高分 ' + topScore.toFixed(1) + '，阈值 ' + THRESHOLD + '）。' +
        '按这套体系的原始设计，这种情况应当退回通用推理：先把事实与约束列清楚，再按常识做取舍，' +
        '而不是给一个现实困境硬套一个不相干的方法。<br>' +
        '<span class="muted small">提示：毛选方法论主要处理"资源受限、多方博弈、需要判断与组织"的现实复杂问题；' +
        '纯事实查询、日常琐事、以及范式完全不同的专业问题（如代码调试、医学诊断）不在其适用范围内。</span>'));
      return;
    }

    var rate = Math.min(100, Math.round(topScore / FULL * 100));
    var color = rate >= 70 ? 'var(--red)' : 'var(--gold)';
    var main = findSkill(top.id);

    /* 主推方法 */
    var box = mk('div', 'mw-main');
    var steps = stepSummary(main.body);
    box.innerHTML =
      '<div class="mw-card-t">主推：' + esc(main.title) + '</div>' +
      '<div class="mw-card-c" style="margin-top:6px">' + esc(claimOf(main)) + '</div>' +
      '<div class="mw-hit">' + top.hits.slice(0, 8).map(function (h) {
        return '<span>' + esc(h) + '</span>';
      }).join('') + '</div>' +
      '<div class="mw-bar"><i style="width:' + rate + '%;background:' + color + '"></i></div>' +
      '<div class="mw-score"><span>匹配度 ' + rate + '%（命中 ' + top.hits.length + ' 个触发信号）</span>' +
      '<span>' + esc(main.group) + '</span></div>' +
      (steps.length
        ? '<div style="margin-top:12px;font-size:13px;color:var(--ink-3)">核心步骤</div><ol class="mw-steps">' +
          steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>'
        : '') +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" data-act="open" data-id="' + esc(main.id) + '">查看完整方法</button>' +
      '<button class="btn btn-ghost" data-act="copy">复制诊断结果</button></div>';
    r.appendChild(box);

    /* 配套方法：优先取同样命中的，其次取依赖/配套关系 */
    var rels = relatedOf(top.id);
    var scored = [];
    for (var i = 1; i < res.length; i++) {
      if (res[i].score < THRESHOLD) break;
      var rel = null;
      for (var j = 0; j < rels.length; j++) if (rels[j].id === res[i].id) rel = rels[j];
      scored.push({ id: res[i].id, rel: rel, hit: true });
    }
    var picked = scored.slice(0, 2);
    if (picked.length < 2) {
      var order = { comp: 0, dep: 1, con: 2 };
      var cand = rels.slice().sort(function (a, b) { return (order[a.type] || 3) - (order[b.type] || 3); });
      for (var k = 0; k < cand.length && picked.length < 2; k++) {
        var dup = false;
        for (var p = 0; p < picked.length; p++) if (picked[p].id === cand[k].id) dup = true;
        if (!dup) picked.push({ id: cand[k].id, rel: cand[k], hit: false });
      }
    }

    if (picked.length) {
      picked.forEach(function (it) {
        var s2 = findSkill(it.id);
        if (!s2) return;
        var reason = it.rel
          ? comboReason(top.id, it.rel)
          : '与「' + esc(main.title) + '」在输入里同时被命中，可并行参考：' + esc(claimOf(s2)) + '。';
        var a = mk('div', 'mw-alt');
        var tag = it.rel ? EDGE_TYPE[it.rel.type] : '同时命中';
        a.innerHTML =
          '<div class="mw-card-t" style="font-size:15.5px">配套：' + esc(s2.title) +
          ' <i style="font-style:normal;font-size:11px;color:#fff;background:var(--gold);border-radius:3px;padding:1px 5px">' +
          esc(tag) + '</i></div>' +
          '<div class="mw-card-c" style="margin-top:6px">' + esc(reason) + '</div>' +
          '<div style="margin-top:9px"><button class="btn btn-ghost" data-act="open" data-id="' +
          esc(s2.id) + '">查看方法</button></div>';
        r.appendChild(a);
      });
      var order2 = mk('div', 'muted small',
        '建议调用顺序：先用主推方法定主干，再按上面的' +
        '「前置 / 配套」关系依次调用——组合不宜超过 3 个方法，否则容易过度工程。');
      order2.style.marginTop = '10px';
      r.appendChild(order2);
    }

    refs.lastDiag = { text: text, main: main, picked: picked, rate: rate, top: top };
  }

  /* 复制诊断结果为文本 */
  function copyDiag() {
    var d = refs.lastDiag;
    if (!d) return;
    var lines = [];
    lines.push('【毛选方法论 · 问题诊断】');
    lines.push('我的问题：' + d.text);
    lines.push('');
    lines.push('主推方法：' + d.main.title + '（匹配度 ' + d.rate + '%）');
    lines.push('主张：' + claimOf(d.main));
    lines.push('命中触发信号：' + d.top.hits.join('、'));
    var st = stepSummary(d.main.body);
    if (st.length) lines.push('核心步骤：' + st.map(function (t, i) { return (i + 1) + ') ' + t; }).join('；'));
    if (d.picked.length) {
      lines.push('');
      lines.push('配套方法：');
      d.picked.forEach(function (it) {
        var s = findSkill(it.id);
        if (!s) return;
        lines.push('- ' + s.title + '（' + (it.rel ? EDGE_TYPE[it.rel.type] : '同时命中') + '）' +
          (it.rel ? '：' + comboReason(d.main.id, it.rel) : ''));
      });
    }
    var txt = lines.join('\n');
    var done = function () {
      var b = refs.result.querySelector('[data-act="copy"]');
      if (b) { var o = b.textContent; b.textContent = '已复制 ✓'; setTimeout(function () { b.textContent = o; }, 1600); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt, done); });
    } else {
      fallbackCopy(txt, done);
    }
  }
  function fallbackCopy(txt, done) {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* 忽略 */ }
    document.body.removeChild(ta);
  }

  /* ---------- C. 组合路径 ---------- */
  function buildPaths() {
    var sec = mk('section', 'mw-sec');
    sec.id = 'mw-paths';
    sec.appendChild(mk('h2', 'sec-title', '经典组合路径'));
    var tip = mk('p', 'muted small',
      '以下路径来自蒸馏产物中的依赖关系图与推荐学习顺序，不是随意拼凑的前后顺序；点任一节点可直接打开该方法。');
    tip.style.margin = '-6px 0 14px';
    sec.appendChild(tip);

    PATHS.forEach(function (p) {
      var box = mk('div', 'mw-path');
      box.appendChild(mk('div', 'mw-path-t', esc(p.name)));
      box.appendChild(mk('div', 'mw-path-u', '适用场景：' + esc(p.use)));
      var chain = mk('div', 'mw-chain');
      p.chain.forEach(function (id, i) {
        if (i) chain.appendChild(mk('span', 'mw-arrow', '→'));
        var s = findSkill(id);
        var b = mk('button', 'mw-node', esc(s ? s.title : id));
        b.title = s ? claimOf(s) : id;
        b.setAttribute('data-act', 'open');
        b.setAttribute('data-id', esc(id));
        chain.appendChild(b);
      });
      box.appendChild(chain);
      box.appendChild(mk('div', 'mw-path-w', '依据：' + esc(p.why)));
      sec.appendChild(box);
    });
    return sec;
  }

  /* ---------- 事件委托 ---------- */
  function onClick(e) {
    var t = e.target;
    var node = t;
    while (node && node !== e.currentTarget) {
      var act = node.getAttribute && node.getAttribute('data-act');
      if (act) break;
      node = node.parentNode;
    }
    if (!node || node === e.currentTarget) return;
    var act = node.getAttribute('data-act');
    var id = node.getAttribute('data-id');

    if (act === 'vol') {
      state.vol = parseInt(id, 10) || 0;
      state.g = '全部';       // 换卷即重置分组筛选
      state.q = '';           // 与搜索词
      state.open = null;      // 并收起已展开的详情
      state.volCap = 60;      // 分批渲染计数复位
      if (refs.wallInput) refs.wallInput.value = '';
      syncVol();
      var wall = document.getElementById('mw-wall');
      if (wall && wall.scrollIntoView) wall.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (act === 'group') {
      state.g = id;
      var bar = node.parentNode;
      var bs = bar.querySelectorAll('.chip');
      for (var i = 0; i < bs.length; i++) {
        var on = bs[i] === node;
        bs[i].className = 'chip' + (on ? ' on' : '');
      }
      renderGrid();
    } else if (act === 'open') {
      openSkill(id);
    } else if (act === 'close') {
      closeSkill();
    } else if (act === 'sec') {
      var el = document.getElementById('mw-h-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (act === 'article') {
      var m = M();
      if (typeof m.openArticle === 'function') {
        m.openArticle(parseInt(node.getAttribute('data-v'), 10), parseInt(node.getAttribute('data-i'), 10));
      }
    } else if (act === 'scene') {
      if (refs.diagInput) { refs.diagInput.value = id; state.diag = id; }
      runDiag();
      refs.diagInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (act === 'diag') {
      runDiag();
    } else if (act === 'clear') {
      if (refs.diagInput) refs.diagInput.value = '';
      refs.result.innerHTML = '';
      refs.lastDiag = null;
    } else if (act === 'copy') {
      e.stopPropagation();
      copyDiag();
    } else if (act === 'jump') {
      var target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* =======================================================================
   * 注册模块
   * ===================================================================== */
  window.Modules = window.Modules || {};
  window.Modules.methods = {
    id: 'methods',
    title: '方法论工坊',
    render: render
  };
})();
