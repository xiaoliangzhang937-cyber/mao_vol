/*
 * mod-concepts.js —— 概念词典 & 金句摭拾 两个模块
 * 纯静态、零依赖，仅依赖全局契约：window.MAO_CORE 数据 与 window.MAO 工具
 * 依赖的 MAO 接口：MAO.esc() / MAO.el() / MAO.go() / MAO.openArticle(v,i)
 */
(function () {
  'use strict';

  var MAO = window.MAO || {};
  var C = window.MAO_CORE || {};
  var GLOSSARY = C.glossary || [];
  var QUOTES = C.quotes || [];
  var ARTICLES = C.articles || [];
  var SKILLS = C.skills || [];
  var VOLUMES = C.volumes || [];

  var esc = MAO.esc || function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var el = MAO.el || function (tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  /* ============ 一次性注入本模块样式（带 mc- 前缀，避免与其它模块冲突） ============ */
  var CSS_ID = 'mao-mod-concepts-css';
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      '.mc-wrap{max-width:1180px;margin:0 auto;padding:8px 24px 40px}',

      /* --- 通用页头 --- */
      '.mc-head{margin-bottom:18px}',
      '.mc-head h2{font-family:var(--serif);font-size:26px;color:var(--ink);margin:0 0 8px;letter-spacing:1px}',
      '.mc-head p{font-size:14px;line-height:1.9;color:var(--ink-2);margin:0;max-width:820px}',
      '.mc-head .mc-em{color:var(--red);font-weight:600}',

      /* --- 工具条 --- */
      '.mc-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:16px 0 18px;padding:12px 14px;background:var(--paper-2);border:1px solid var(--line);border-radius:var(--r)}',
      '.mc-search{flex:1;min-width:200px;padding:8px 12px;font-size:14px;font-family:var(--sans);color:var(--ink);background:var(--paper);border:1px solid var(--line-2);border-radius:6px;outline:none}',
      '.mc-search:focus{border-color:var(--gold)}',
      '.mc-count{font-size:12px;color:var(--ink-3);white-space:nowrap}',

      /* --- 词典网格 --- */
      '.mc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;align-items:start}',

      /* --- 术语卡片 --- */
      '.mc-tcard{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;cursor:pointer;transition:border-color .2s,box-shadow .2s}',
      '.mc-tcard:hover{border-color:var(--line-2);box-shadow:0 2px 10px rgba(26,22,19,.06)}',
      '.mc-tcard.open{border-color:var(--gold)}',
      '.mc-tcard:focus{outline:2px solid var(--gold);outline-offset:2px}',
      '.mc-front{display:flex;align-items:flex-start;gap:10px;padding:14px 16px}',
      '.mc-tname{font-family:var(--serif);font-size:18px;color:var(--ink);line-height:1.5;flex:1}',
      '.mc-tarrow{flex:none;width:18px;height:18px;margin-top:4px;color:var(--ink-3);font-size:12px;line-height:18px;text-align:center;transition:transform .2s}',
      '.mc-tcard.open .mc-tarrow{transform:rotate(90deg);color:var(--gold)}',
      '.mc-tbrief{font-size:13px;line-height:1.8;color:var(--ink-2);padding:0 16px 14px;margin-top:-6px}',
      '.mc-body{display:none;padding:0 16px 16px;border-top:1px dashed var(--line)}',
      '.mc-tcard.open .mc-body{display:block;animation:mcFade .25s ease}',
      '@keyframes mcFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}',

      /* --- 词条内小标题块 --- */
      '.mc-blk{margin-top:14px}',
      '.mc-blk-h{font-size:12px;font-weight:600;letter-spacing:1px;color:var(--ink-3);margin-bottom:6px;display:flex;align-items:center;gap:6px}',
      '.mc-blk-h::before{content:"";width:3px;height:12px;background:var(--line-2);border-radius:2px}',
      '.mc-blk-p{font-size:13.5px;line-height:1.95;color:var(--ink-2);font-family:var(--serif)}',

      /* --- 「与常识的差异」：视觉上重点突出 --- */
      '.mc-diff{background:#fdf3ef;border-left:3px solid var(--red);border-radius:0 6px 6px 0;padding:12px 14px;margin-top:14px}',
      '.mc-diff .mc-blk-h{color:var(--red)}',
      '.mc-diff .mc-blk-h::before{background:var(--red)}',
      '.mc-diff-note{font-size:13px;line-height:1.9;color:var(--ink-2);font-family:var(--serif);margin-bottom:8px}',
      '.mc-drow{display:flex;gap:9px;padding:7px 0;border-top:1px dashed rgba(158,43,37,.18)}',
      '.mc-drow:first-of-type{border-top:none}',
      '.mc-dsym{flex:none;width:20px;height:20px;border-radius:50%;font-size:12px;line-height:20px;text-align:center;font-family:var(--sans)}',
      '.mc-drow.neg .mc-dsym{background:rgba(158,43,37,.1);color:var(--red)}',
      '.mc-drow.pos .mc-dsym{background:rgba(61,107,74,.12);color:var(--green)}',
      '.mc-dtxt{font-size:13.5px;line-height:1.9;font-family:var(--serif)}',
      '.mc-drow.neg .mc-dtxt{color:var(--ink-2);text-decoration:line-through;text-decoration-color:rgba(158,43,37,.35)}',
      '.mc-drow.pos .mc-dtxt{color:var(--ink);font-weight:600}',

      /* --- 出处 / 交叉链接 --- */
      '.mc-src{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
      '.mc-srclink{padding:3px 9px;font-size:12.5px;font-family:var(--serif);color:var(--blue);background:#eef2f7;border:1px solid #d8e0ea;border-radius:14px;cursor:pointer;transition:.15s}',
      '.mc-srclink:hover{background:var(--blue);color:#fff;border-color:var(--blue)}',
      '.mc-srcdead{padding:3px 9px;font-size:12.5px;font-family:var(--serif);color:var(--ink-3);background:var(--paper-2);border:1px dashed var(--line-2);border-radius:14px}',
      '.mc-xlink{display:inline-flex;align-items:center;gap:5px;margin-top:14px;padding:6px 12px;font-size:13px;color:var(--gold);background:#faf3e6;border:1px solid #eadcc0;border-radius:16px;cursor:pointer;transition:.15s}',
      '.mc-xlink:hover{background:var(--gold);color:#fff;border-color:var(--gold)}',

      /* --- 卷筛选 chip --- */
      '.mc-vol{padding:5px 12px;font-size:13px;color:var(--ink-2);background:var(--paper);border:1px solid var(--line-2);border-radius:16px;cursor:pointer;transition:.15s}',
      '.mc-vol:hover{border-color:var(--gold)}',
      '.mc-vol.on{color:#fff;border-color:transparent}',
      '.mc-vol.on.v1{background:var(--v1)}.mc-vol.on.v2{background:var(--v2)}.mc-vol.on.v3{background:var(--v3)}.mc-vol.on.v4{background:var(--v4)}.mc-vol.on.v5{background:var(--v5)}',
      '.mc-vol.on.v0{background:var(--ink-2)}',

      /* --- 每日一句 --- */
      '.mc-daily{position:relative;margin-bottom:24px;padding:30px 34px 26px;background:var(--paper-2);border:1px solid var(--line-2);border-radius:var(--r);overflow:hidden}',
      '.mc-daily::before{content:"\\201C";position:absolute;top:-4px;left:10px;font-family:var(--serif);font-size:110px;line-height:1;color:var(--red);opacity:.13}',
      '.mc-daily-tag{display:inline-block;padding:3px 10px;font-size:12px;letter-spacing:2px;color:#fff;background:var(--red);border-radius:3px;margin-bottom:14px}',
      '.mc-daily-q{position:relative;font-family:var(--serif);font-size:24px;line-height:2;color:var(--ink);margin:0 0 14px;max-width:900px}',
      '.mc-daily-f{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:13px;color:var(--ink-2)}',
      '.mc-daily-src{font-family:var(--serif);cursor:pointer;color:var(--blue)}',
      '.mc-daily-src:hover{text-decoration:underline}',

      /* --- 金句瀑布流 --- */
      '.mc-qgrid{column-count:3;column-gap:14px}',
      '@media(max-width:900px){.mc-qgrid{column-count:2}}',
      '@media(max-width:600px){.mc-qgrid{column-count:1}.mc-daily-q{font-size:20px}.mc-daily{padding:24px 20px 20px}}',
      '.mc-qgrid.fading{opacity:0;transition:opacity .18s}',
      '.mc-qcard{position:relative;break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid;margin:0 0 14px;padding:18px 18px 14px;border:1px solid var(--line);border-radius:var(--r);cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s}',
      '.mc-qcard.a{background:var(--paper)}',
      '.mc-qcard.b{background:var(--paper-2)}',
      '.mc-qcard:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:0 4px 14px rgba(26,22,19,.08)}',
      '.mc-qtext{font-family:var(--serif);font-size:19px;line-height:1.95;color:var(--ink)}',
      '.mc-qfoot{display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:10px;border-top:1px dashed var(--line)}',
      '.mc-vb{flex:none;padding:2px 7px;font-size:11px;color:#fff;border-radius:3px}',
      '.mc-vb.v1{background:var(--v1)}.mc-vb.v2{background:var(--v2)}.mc-vb.v3{background:var(--v3)}.mc-vb.v4{background:var(--v4)}.mc-vb.v5{background:var(--v5)}',
      '.mc-qsrc{font-family:var(--serif);font-size:12.5px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mc-copy{flex:none;margin-left:auto;padding:3px 10px;font-size:12px;font-family:var(--sans);color:var(--ink-3);background:transparent;border:1px solid var(--line-2);border-radius:12px;cursor:pointer;transition:.15s}',
      '.mc-copy:hover{color:var(--ink);border-color:var(--gold);background:var(--paper)}',
      '.mc-copy.ok{color:var(--green);border-color:var(--green)}',
      '.mc-copy.bad{color:var(--red);border-color:var(--red)}',

      /* --- 空状态 / 加载更多 --- */
      '.mc-empty{padding:60px 20px;text-align:center;color:var(--ink-3);font-size:14px;background:var(--paper-2);border:1px dashed var(--line-2);border-radius:var(--r)}',
      '.mc-more{margin:24px 0 8px;text-align:center}',
      '.mc-more button{min-width:180px}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ============ 通用小工具 ============ */

  // 卷徽标文字（取自数据，取不到则回退）
  function volName(n) {
    for (var i = 0; i < VOLUMES.length; i++) if (VOLUMES[i].n === n) return VOLUMES[i].name;
    return '第' + n + '卷';
  }

  // 打开原文（缺 v/i 时静默忽略）
  function openArticle(v, i) {
    if (!MAO.openArticle || v == null || i == null) return;
    MAO.openArticle(v, i);
  }

  // 按标题匹配文章，返回 {v,i,t} 或 null
  function findArticle(title) {
    var t = String(title || '').trim();
    if (!t) return null;
    var k, a;
    for (k = 0; k < ARTICLES.length; k++) {
      a = ARTICLES[k];
      if (a.t === t) return a;
    }
    if (t.length < 2) return null;
    // 退一步：双向包含匹配（标题可能有副标题或标点差异）
    for (k = 0; k < ARTICLES.length; k++) {
      a = ARTICLES[k];
      if (!a.t) continue;
      if (a.t.indexOf(t) >= 0 || t.indexOf(a.t) >= 0) return a;
    }
    return null;
  }

  // 复制文本，回调 ok 表示成败
  function copyText(text, cb) {
    function fallback() {
      var ok = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { ok = false; }
      cb(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { cb(true); }, fallback);
    } else {
      fallback();
    }
  }

  // 给复制按钮做「已复制 / 复制失败」的短暂反馈
  function flashCopy(btn) {
    return function (ok) {
      btn.textContent = ok ? '已复制' : '复制失败';
      btn.className = 'mc-copy ' + (ok ? 'ok' : 'bad');
      setTimeout(function () {
        btn.textContent = '复制';
        btn.className = 'mc-copy';
      }, 1400);
    };
  }

  /* ================================================================
   * 模块一：概念词典
   * ============================================================== */

  // 术语 → 方法论 skill 的手工映射（模糊匹配兜底）
  var TERM_SKILL = {
    '阶级分析': 'stakeholder-analysis',
    '主要矛盾': 'main-contradiction',
    '矛盾的特殊性（具体问题具体分析）': 'concrete-analysis',
    '内因和外因': 'internal-external-cause',
    '主观主义（主观性、片面性、表面性）': 'three-checks-anti-subjectivity',
    '感性认识和理性认识': 'practice-knowledge-loop',
    '实践（真理的标准）': 'practice-knowledge-loop',
    '本本主义': 'authority-reality-check',
    '没有调查，没有发言权': 'investigation-seven-steps',
    '统一战线': 'united-front',
    '关门主义': 'united-front',
    '有原则有条件的让步': 'principled-concession',
    '工农武装割据': 'existence-conditions',
    '积极防御和消极防御': 'strategic-retreat-active-defense',
    '战略退却': 'strategic-retreat-active-defense',
    '歼灭战': 'annihilation-thinking',
    '集中兵力': 'concentration-of-force',
    '游击战术（十六字诀）': 'sixteen-character-tactics',
    '群众路线（关心群众生活）': 'mass-line-mobilization'
  };

  function skillById(id) {
    for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i];
    return null;
  }

  // 术语 → 相关方法论（手工优先，其次按标题模糊匹配）
  function skillForTerm(term) {
    var byMap = skillById(TERM_SKILL[term]);
    if (byMap) return byMap;
    var core = String(term).replace(/（.*$/, '').trim();
    if (core.length < 2) return null;
    var i, s;
    for (i = 0; i < SKILLS.length; i++) {
      s = SKILLS[i];
      if (s.title && (s.title.indexOf(core) >= 0 || core.indexOf(s.title) >= 0)) return s;
    }
    for (i = 0; i < SKILLS.length; i++) {
      s = SKILLS[i];
      if (s.desc && s.desc.indexOf(core) >= 0) return s;
    }
    return null;
  }

  // 把 diff 拆成 ≠（常见误解）与 =（作者本意）两组；拆不动返回 null
  function splitDiff(diff) {
    var s = String(diff || '').trim();
    if (!s) return null;
    if (s.indexOf('≠') < 0 && s.indexOf('=') < 0) return null;
    var parts = s.split(/(?=[≠=])/);
    var note = '', neg = [], pos = [];
    parts.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      var sym = p.charAt(0);
      var rest = p.slice(1).replace(/^[　\s]+/, '').trim();
      if (sym === '≠') neg.push(rest);
      else if (sym === '=') pos.push(rest);
      else note += (note ? ' ' : '') + p; // 首个符号之前的引导语
    });
    if (!neg.length && !pos.length) return null;
    return { note: note, neg: neg, pos: pos };
  }

  // 渲染「与常识的差异」
  function renderDiff(diff) {
    var parsed = splitDiff(diff);
    var html = '<div class="mc-diff">';
    html += '<div class="mc-blk-h">与常识的差异</div>';
    if (!parsed) {
      html += '<div class="mc-dtxt" style="font-family:var(--serif);font-size:13.5px;line-height:1.9;color:var(--ink)">' + esc(diff) + '</div>';
      html += '</div>';
      return html;
    }
    if (parsed.note) html += '<div class="mc-diff-note">' + esc(parsed.note) + '</div>';
    parsed.neg.forEach(function (t) {
      html += '<div class="mc-drow neg"><span class="mc-dsym">≠</span><span class="mc-dtxt">' + esc(t) + '</span></div>';
    });
    parsed.pos.forEach(function (t) {
      html += '<div class="mc-drow pos"><span class="mc-dsym">=</span><span class="mc-dtxt">' + esc(t) + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  // 渲染「出处」：按 / 分割，逐条尝试匹配文章
  function renderSrc(src) {
    var items = String(src || '').split('/');
    var html = '<div class="mc-blk"><div class="mc-blk-h">出处</div><div class="mc-src">';
    var any = false;
    items.forEach(function (raw) {
      var name = String(raw).trim();
      if (!name) return;
      any = true;
      var a = findArticle(name);
      if (a) {
        html += '<span class="mc-srclink" data-v="' + a.v + '" data-i="' + a.i + '" title="打开《' + esc(a.t) + '》">' + esc(name) + '</span>';
      } else {
        html += '<span class="mc-srcdead" title="未在篇目索引中匹配到">' + esc(name) + '</span>';
      }
    });
    html += '</div></div>';
    return any ? html : '';
  }

  // 单张术语卡
  function termCardHTML(g) {
    var brief = String(g.d || '').slice(0, 40);
    var skill = skillForTerm(g.t);
    var vs = '';
    if (g.vol) {
      vs = '<span class="vol-badge vol-' + g.vol + '" style="margin-right:7px;flex:none">' +
        esc((window.MAO && MAO.volName) ? MAO.volName(g.vol) : ('第' + g.vol + '卷')) + '</span>';
    }
    var html = '';
    html += '<div class="mc-tcard" tabindex="0" role="button" aria-expanded="false">';
    html += '<div class="mc-front">' + vs + '<div class="mc-tname">' + esc(g.t) + '</div><div class="mc-tarrow">▶</div></div>';
    html += '<div class="mc-tbrief">' + esc(brief) + '…</div>';
    html += '<div class="mc-body">';
    html += '<div class="mc-blk"><div class="mc-blk-h">作者的定义</div><div class="mc-blk-p">' + esc(g.d) + '</div></div>';
    html += renderDiff(g.diff);
    if (g.why) {
      html += '<div class="mc-blk"><div class="mc-blk-h">为何重要</div><div class="mc-blk-p">' + esc(g.why) + '</div></div>';
    }
    html += renderSrc(g.src);
    if (skill) {
      html += '<div class="mc-xlink" data-skill="' + esc(skill.id) + '">相关方法论：' + esc(skill.title) + ' →</div>';
    }
    html += '</div></div>';
    return html;
  }

  window.Modules = window.Modules || {};
  window.Modules.glossary = {
    id: 'glossary',
    title: '概念词典',
    render: function (root, head, query) {
      injectCSS();
      root.innerHTML = '';
      // 支持深链：#/glossary?q=术语名（全局搜索跳过来时预填并自动展开）
      var preset = (query && query.q) ? String(query.q) : '';

      var wrap = el('div', 'mc-wrap');
      wrap.innerHTML =
        '<div class="mc-head">' +
        '<h2>概念词典</h2>' +
        '<p>这里收录《毛泽东选集》五卷中的 <b>' + GLOSSARY.length + '</b> 个核心术语。释义取自原文语境，重点在于' +
        '<span class="mc-em">「作者本意 ≠ 日常用法」</span>——很多词今天仍在用，但意思已经漂移。' +
        '点开卡片，可看作者的定义与常识用法的差别；第一卷的术语另附原文出处与方法论交叉链接。</p>' +
        '</div>' +
        '<div class="mc-bar">' +
        '<input class="mc-search" type="search" placeholder="搜索术语名或释义，如：矛盾、调查、让步…" />' +
        '<button class="btn" id="mcToggleAll">全部展开</button>' +
        '<span class="mc-count" id="mcTCount"></span>' +
        '</div>' +
        '<div class="mc-chips" id="mcTChips"></div>' +
        '<div class="mc-grid" id="mcTGrid"></div>' +
        '<div class="mc-empty" id="mcTEmpty" style="display:none">没有匹配的术语，换个词试试。</div>';

      root.appendChild(wrap);

      var grid = wrap.querySelector('#mcTGrid');
      var empty = wrap.querySelector('#mcTEmpty');
      var count = wrap.querySelector('#mcTCount');
      var input = wrap.querySelector('.mc-search');
      var toggleBtn = wrap.querySelector('#mcToggleAll');
      var chipsEl = wrap.querySelector('#mcTChips');
      var current = GLOSSARY;
      var curVol = 0;
      var kw = '';

      /* 分卷筛选：按术语所属卷过滤（第一卷含原 22 条蒸馏术语） */
      function drawChips() {
        if (!chipsEl) return;
        var counts = {};
        GLOSSARY.forEach(function (g) {
          var v = g.vol || 1;
          counts[v] = (counts[v] || 0) + 1;
        });
        var h = '';
        function chip(v, label, n) {
          var on = curVol === v;
          var c = window.MAO.volColor ? MAO.volColor(v) : '#9e2b25';
          return '<button class="chip' + (on ? ' on' : '') + '" data-vol="' + v + '" style="' +
            (on ? 'background:' + c + ';border-color:' + c + ';color:#fff' : 'border:1px solid var(--line)') + '">' +
            label + ' <span class="n">' + n + '</span></button>';
        }
        h += chip(0, '全部', GLOSSARY.length);
        [1, 2, 3, 4, 5].forEach(function (v) {
          if (!counts[v]) return;
          h += chip(v, MAO.volName(v), counts[v]);
        });
        chipsEl.innerHTML = h;
        Array.prototype.forEach.call(chipsEl.querySelectorAll('.chip'), function (b) {
          b.onclick = function () {
            curVol = parseInt(b.getAttribute('data-vol'), 10) || 0;
            drawChips();
            apply();
          };
        });
      }

      function apply() {
        current = GLOSSARY.filter(function (g) {
          if (curVol && (g.vol || 1) !== curVol) return false;
          if (!kw) return true;
          var hay = [g.t, g.d, g.diff, g.why, g.src].join(' ').toLowerCase();
          return hay.indexOf(kw) >= 0;
        });
        paint();
      }

      function paint() {
        if (!current.length) {
          grid.innerHTML = '';
          grid.style.display = 'none';
          empty.style.display = 'block';
          count.textContent = '0 / ' + GLOSSARY.length + ' 条';
          return;
        }
        empty.style.display = 'none';
        grid.style.display = '';
        var h = '';
        for (var i = 0; i < current.length; i++) h += termCardHTML(current[i]);
        grid.innerHTML = h;
        count.textContent = current.length + ' / ' + GLOSSARY.length + ' 条';
        toggleBtn.textContent = '全部展开';
      }

      // 搜索：术语名 + 释义全文（定义 / 差异 / 为何重要 / 出处）
      input.addEventListener('input', function () {
        kw = String(input.value || '').trim().toLowerCase();
        // 一旦开始搜索就回到全卷范围，避免带着卷筛选导致搜不到
        if (kw && curVol) { curVol = 0; drawChips(); }
        apply();
      });

      // 卡片展开 / 出处跳转 / 方法论交叉链接（统一事件委托）
      grid.addEventListener('click', function (e) {
        var link = e.target.closest ? e.target.closest('.mc-srclink') : null;
        if (link) {
          e.stopPropagation();
          openArticle(+link.getAttribute('data-v'), +link.getAttribute('data-i'));
          return;
        }
        var x = e.target.closest ? e.target.closest('.mc-xlink') : null;
        if (x) {
          e.stopPropagation();
          try { sessionStorage.setItem('mao_skill_focus', x.getAttribute('data-skill')); } catch (err) { /* 隐私模式下忽略 */ }
          if (MAO.go) MAO.go('#/methods');
          return;
        }
        var card = e.target.closest ? e.target.closest('.mc-tcard') : null;
        if (card) {
          var open = card.classList.toggle('open');
          card.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
      });

      // 键盘可达性
      grid.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest ? e.target.closest('.mc-tcard') : null;
        if (!card) return;
        e.preventDefault();
        var open = card.classList.toggle('open');
        card.setAttribute('aria-expanded', open ? 'true' : 'false');
      });

      toggleBtn.addEventListener('click', function () {
        var cards = grid.querySelectorAll('.mc-tcard');
        var expand = toggleBtn.textContent === '全部展开';
        for (var i = 0; i < cards.length; i++) {
          cards[i].classList.toggle('open', expand);
          cards[i].setAttribute('aria-expanded', expand ? 'true' : 'false');
        }
        toggleBtn.textContent = expand ? '全部收起' : '全部展开';
      });

      if (chipsEl) {
        chipsEl.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap;margin:12px 0 4px';
      }
      drawChips();
      paint();

      // 深链进入：预填关键词并展开首个命中卡片
      if (preset) {
        input.value = preset;
        kw = String(preset).trim().toLowerCase();
        apply();
        var first = grid.querySelector('.mc-tcard');
        if (first) {
          first.classList.add('open');
          first.setAttribute('aria-expanded', 'true');
          if (first.scrollIntoView) first.scrollIntoView({ block: 'center' });
        }
      }
    }
  };

  /* ================================================================
   * 模块二：金句摭拾
   * ============================================================== */

  var PAGE = 30;

  // 以「年-月-日」为种子的伪随机：同一天结果稳定
  function todaySeed() {
    var d = new Date();
    var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function quoteCardHTML(q, idx) {
    var tone = (idx % 2 === 0) ? 'a' : 'b';
    var html = '<div class="mc-qcard ' + tone + '" data-v="' + q.v + '" data-i="' + q.i + '" title="点击打开原文">';
    html += '<div class="mc-qtext">' + esc(q.q) + '</div>';
    html += '<div class="mc-qfoot">';
    html += '<span class="mc-vb v' + q.v + '">' + esc(volName(q.v)) + '</span>';
    html += '<span class="mc-qsrc">——《' + esc(q.t) + '》</span>';
    html += '<button class="mc-copy" data-copy="' + esc(q.q + ' ——《' + q.t + '》') + '">复制</button>';
    html += '</div></div>';
    return html;
  }

  window.Modules.quotes = {
    id: 'quotes',
    title: '金句摭拾',
    render: function (root) {
      injectCSS();
      root.innerHTML = '';

      var wrap = el('div', 'mc-wrap');
      wrap.innerHTML =
        '<div class="mc-head">' +
        '<h2>金句摭拾</h2>' +
        '<p>共 <b>' + QUOTES.length + '</b> 条，取自原文与逐篇解构中的引录，均标注出处篇目。' +
        '点击卡片跳到原文，点「复制」可带走「金句 ——《篇名》」。</p>' +
        '</div>' +
        '<div class="mc-daily" id="mcDaily"></div>' +
        '<div class="mc-bar">' +
        '<span class="mc-vol v0 on" data-v="0">全部</span>' +
        '<span class="mc-vol v1" data-v="1">' + esc(volName(1)) + '</span>' +
        '<span class="mc-vol v2" data-v="2">' + esc(volName(2)) + '</span>' +
        '<span class="mc-vol v3" data-v="3">' + esc(volName(3)) + '</span>' +
        '<span class="mc-vol v4" data-v="4">' + esc(volName(4)) + '</span>' +
        '<span class="mc-vol v5" data-v="5">' + esc(volName(5)) + '</span>' +
        '<input class="mc-search" type="search" placeholder="搜索金句或篇名…" />' +
        '<button class="btn" id="mcShuffle">换一批</button>' +
        '<span class="mc-count" id="mcQCount"></span>' +
        '</div>' +
        '<div class="mc-qgrid" id="mcQGrid"></div>' +
        '<div class="mc-empty" id="mcQEmpty" style="display:none">没有匹配的金句，换个词或换一卷试试。</div>' +
        '<div class="mc-more" id="mcMore" style="display:none"><button class="btn btn-primary">加载更多</button></div>';

      root.appendChild(wrap);

      var grid = wrap.querySelector('#mcQGrid');
      var empty = wrap.querySelector('#mcQEmpty');
      var moreBox = wrap.querySelector('#mcMore');
      var moreBtn = moreBox.querySelector('button');
      var count = wrap.querySelector('#mcQCount');
      var input = wrap.querySelector('.mc-search');
      var chips = wrap.querySelectorAll('.mc-vol');
      var dailyBox = wrap.querySelector('#mcDaily');

      var pool = QUOTES.slice();   // 当前顺序（换一批时被打乱）
      var vol = 0;                 // 0 = 全部
      var page = 1;

      // ---- 每日一句 ----
      function paintDaily() {
        if (!QUOTES.length) { dailyBox.style.display = 'none'; return; }
        var dq = QUOTES[todaySeed() % QUOTES.length];
        var a = findArticle(dq.t);
        dailyBox.innerHTML =
          '<span class="mc-daily-tag">今日一句</span>' +
          '<p class="mc-daily-q">' + esc(dq.q) + '</p>' +
          '<div class="mc-daily-f">' +
          '<span class="mc-vb v' + dq.v + '">' + esc(volName(dq.v)) + '</span>' +
          '<span class="mc-daily-src" data-v="' + dq.v + '" data-i="' + dq.i + '">——《' + esc(dq.t) + '》</span>' +
          '<button class="mc-copy" data-copy="' + esc(dq.q + ' ——《' + dq.t + '》') + '">复制</button>' +
          '</div>';
      }

      // ---- 当前筛选结果 ----
      function filtered() {
        var kw = String(input.value||'').trim().toLowerCase();
        var out = pool.filter(function (q) {
          if (vol && q.v !== vol) return false;
          if (!kw) return true;
          return (String(q.q) + ' ' + String(q.t)).toLowerCase().indexOf(kw) >= 0;
        });
        return out;
      }

      function paint(fade) {
        var list = filtered();
        var shown = list.slice(0, page * PAGE);

        function draw() {
          if (!shown.length) {
            grid.innerHTML = '';
            grid.style.display = 'none';
            empty.style.display = 'block';
            moreBox.style.display = 'none';
            count.textContent = '0 条';
            return;
          }
          empty.style.display = 'none';
          grid.style.display = '';
          var h = '';
          for (var i = 0; i < shown.length; i++) h += quoteCardHTML(shown[i], i);
          grid.innerHTML = h;
          count.textContent = '已显示 ' + shown.length + ' / ' + list.length + ' 条';
          moreBox.style.display = shown.length < list.length ? 'block' : 'none';
          grid.classList.remove('fading');
        }

        if (fade) {
          grid.classList.add('fading');
          setTimeout(draw, 180);
        } else {
          draw();
        }
      }

      // 卷筛选
      Array.prototype.forEach.call(chips, function (c) {
        c.addEventListener('click', function () {
          Array.prototype.forEach.call(chips, function (x) { x.classList.remove('on'); });
          c.classList.add('on');
          vol = +c.getAttribute('data-v');
          page = 1;
          paint(true);
        });
      });

      // 搜索
      input.addEventListener('input', function () {
        page = 1;
        paint(false);
      });

      // 换一批：打乱顺序后重取首批（带淡出淡入）
      wrap.querySelector('#mcShuffle').addEventListener('click', function () {
        pool = shuffle(QUOTES);
        page = 1;
        paint(true);
      });

      // 加载更多
      moreBtn.addEventListener('click', function () {
        page++;
        paint(false);
      });

      // 卡片点击：复制按钮优先，其次跳原文
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.mc-copy') : null;
        if (btn) {
          e.stopPropagation();
          copyText(btn.getAttribute('data-copy'), flashCopy(btn));
          return;
        }
        var card = e.target.closest ? e.target.closest('.mc-qcard') : null;
        if (card) openArticle(+card.getAttribute('data-v'), +card.getAttribute('data-i'));
      });

      // 每日一句区：出处跳转 + 复制
      dailyBox.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.mc-copy') : null;
        if (btn) { copyText(btn.getAttribute('data-copy'), flashCopy(btn)); return; }
        var s = e.target.closest ? e.target.closest('.mc-daily-src') : null;
        if (s) openArticle(+s.getAttribute('data-v'), +s.getAttribute('data-i'));
      });

      paintDaily();
      paint(false);
    }
  };
})();
