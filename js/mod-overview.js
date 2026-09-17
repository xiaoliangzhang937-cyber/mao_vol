/* ============================================================
   模块：概览（首页） / 整书速览
   ============================================================ */
(function () {
  'use strict';
  var M = window.Modules = window.Modules || {};

  /* 各卷知名篇目（标题关键词，匹配不到则自动忽略，不臆造） */
  var FAMOUS = {
    1: ['中国社会各阶级的分析', '湖南农民运动考察报告', '星星之火，可以燎原',
        '反对本本主义', '实践论', '矛盾论'],
    2: ['反对自由主义', '论持久战', '新民主主义论', '中国共产党在民族战争中的地位'],
    3: ['改造我们的学习', '整顿党的作风', '反对党八股', '为人民服务', '愚公移山', '论联合政府'],
    4: ['抗日战争胜利后的时局和我们的方针', '目前形势和我们的任务', '论人民民主专政'],
    5: ['中国人民站起来了', '关于农业合作化问题', '增强党的团结，继承党的传统']
  };

  /* 全书六大论点块（据整书理解整理） */
  var BLOCKS = [
    { n: '一', t: '阶级分析定敌友', d: '一切政治决策的起点：从经济地位推政治态度，先分敌友再定策略。',
      c: 'var(--v1)', p: ['中国社会各阶级的分析', '湖南农民运动考察报告', '怎样分析农村阶级'] },
    { n: '二', t: '革命道路与根据地建设', d: '在力量悬殊下走"工农武装割据、波浪式推进"的长期路线。',
      c: 'var(--v2)', p: ['中国的红色政权为什么能够存在？', '井冈山的斗争', '星星之火，可以燎原'] },
    { n: '三', t: '思想建党与组织建设', d: '组织能否执行路线，取决于思想是否统一。',
      c: 'var(--v3)', p: ['关于纠正党内的错误思想', '整顿党的作风', '反对党八股'] },
    { n: '四', t: '调查研究定方案', d: '"没有调查，没有发言权"；一切方案从调查中来。',
      c: 'var(--v4)', p: ['反对本本主义', '必须注意经济工作', '关心群众生活，注意工作方法'] },
    { n: '五', t: '统一战线扩同盟', d: '联合一切可联合的力量，同时保持主导权；让步有原则。',
      c: 'var(--v5)', p: ['论反对日本帝国主义的策略', '中国共产党在抗日时期的任务', '论联合政府'] },
    { n: '六', t: '军事战略与哲学总纲', d: '把前述一切上升为系统方法论：战略防御、实践认识论、矛盾分析法。',
      c: 'var(--red)', p: ['中国革命战争的战略问题', '实践论', '矛盾论'] }
  ];

  function findArt(title) {
    var list = MAO.articles;
    for (var i = 0; i < list.length; i++) if (list[i].t === title) return list[i];
    for (var j = 0; j < list.length; j++) {
      if (list[j].t.indexOf(title) >= 0 || title.indexOf(list[j].t) >= 0) return list[j];
    }
    return null;
  }

  function statBlock() {
    var arts = MAO.articles;
    var words = arts.reduce(function (s, a) { return s + (a.w || 0); }, 0);
    var dated = arts.filter(function (a) { return a.d; });
    var years = dated.map(function (a) { return parseInt(String(a.d).slice(0, 4), 10); });
    var y0 = Math.min.apply(null, years), y1 = Math.max.apply(null, years);
    return {
      vols: MAO.volumes.length, arts: arts.length,
      words: words, span: (y1 - y0), y0: y0, y1: y1,
      skills: MAO.skills.length, quotes: MAO.quotes.length,
      glossary: MAO.glossary.length
    };
  }

  /* ---------------- 首页 ---------------- */
  M.overview = {
    id: 'overview',
    title: '概览',
    render: function (root, head) {
      var S = statBlock();

      /* --- Hero --- */
      var hero = MAO.el('section', 'hero');
      var hi = MAO.el('div', 'wrap hero-inner');

      var left = MAO.el('div', 'hero-text');
      left.innerHTML =
        '<div class="hero-eyebrow">选 集 · 文 献 · 方 法</div>' +
        '<h1><span class="zh">毛泽东选集</span></h1>' +
        '<div class="sub">一九二五 — 一九五七 · 五卷 · ' + S.arts + ' 篇</div>' +
        '<p class="lede">' +
        '这是一套写于极端处境下的决策记录：敌强我弱、资源匮乏、信息不足、时间紧迫。' +
        '它之所以值得反复读，不在于立场，而在于它提供了一整套<strong>在不利条件下如何认识形势、如何组织力量、如何把不可能变成可能</strong>的方法。' +
        '本站把五卷原文、逐篇解构与由此蒸馏出的 ' + S.skills + ' 个方法论放在一起，供检索、对照与实际调用。' +
        '</p>';

      var acts = MAO.el('div', 'hero-actions');
      var b1 = MAO.el('button', 'btn btn-primary', '进入阅览室 →');
      b1.onclick = function () { MAO.go('#/library'); };
      var b2 = MAO.el('button', 'btn', '方法论工坊');
      b2.onclick = function () { MAO.go('#/methods'); };
      var b3 = MAO.el('button', 'btn', '历史时间轴');
      b3.onclick = function () { MAO.go('#/timeline'); };
      acts.appendChild(b1); acts.appendChild(b2); acts.appendChild(b3);
      left.appendChild(acts);

      var stats = MAO.el('div', 'hero-stats');
      [
        [S.vols, '卷'], [S.arts, '篇'], [Math.round(S.words / 10000), '万字'],
        [S.span, '年跨度'], [S.skills, '个方法论'], [S.quotes, '条金句']
      ].forEach(function (p) {
        var d = MAO.el('div', 'stat');
        d.innerHTML = '<div class="n">' + p[0] + '<i>' + p[1] + '</i></div>';
        stats.appendChild(d);
      });
      left.appendChild(stats);
      hi.appendChild(left);

      /* 五卷书脊 */
      var spines = MAO.el('div', 'hero-spines');
      MAO.volumes.forEach(function (v) {
        var h = 120 + v.count * 2.6;
        var sp = MAO.el('div', 'spine');
        sp.style.height = Math.min(h, 250) + 'px';
        sp.style.background = 'linear-gradient(180deg, ' + MAO.volColor(v.n) + ', ' +
          shade(MAO.volColor(v.n), -22) + ')';
        sp.innerHTML = '<span>' + MAO.esc(v.name) + '</span><em>' + MAO.esc(v.span || '') + '</em>';
        sp.title = v.name + ' · ' + v.count + ' 篇 · ' + (v.era || '');
        sp.onclick = function () { MAO.go('#/library?v=' + v.n); };
        spines.appendChild(sp);
      });
      hi.appendChild(spines);
      hero.appendChild(hi);
      root.appendChild(hero);

      /* --- 最近阅读（有记录才显示） --- */
      var recent = MAO.recent();
      if (recent.length) {
        var w0 = MAO.el('div', 'wrap');
        w0.style.marginTop = '36px';
        w0.appendChild(MAO.el('h3', 'sec-title',
          '继续阅读' + '<small>本机最近打开过的篇目</small>'));
        var rg = MAO.el('div', 'vol-grid');
        recent.slice(0, 6).forEach(function (r) {
          var c = MAO.el('div', 'card hoverable');
          c.style.cursor = 'pointer';
          c.style.borderLeft = '3px solid ' + MAO.volColor(r.v);
          c.innerHTML =
            '<div style="display:flex;gap:7px;align-items:center;margin-bottom:7px">' +
            '<span class="vol-badge vol-' + r.v + '">' + MAO.volName(r.v) + '</span>' +
            '<span class="small muted">第 ' + r.i + ' 篇</span></div>' +
            '<div style="font-family:var(--serif);font-size:16px;font-weight:700;line-height:1.5">' +
            MAO.esc(r.t) + '</div>';
          c.onclick = function () { MAO.openArticle(r.v, r.i); };
          rg.appendChild(c);
        });
        w0.appendChild(rg);
        root.appendChild(w0);
      }

      /* --- 五卷总览 --- */
      var w1 = MAO.el('div', 'wrap');
      w1.style.marginTop = '40px';
      w1.appendChild(MAO.el('h3', 'sec-title',
        '五卷分期' + '<small>五卷对应五个历史时期，每卷的主题与方法重心不同</small>'));
      var grid = MAO.el('div', 'vol-grid');

      MAO.volumes.forEach(function (v) {
        var c = MAO.el('div', 'vol-card v' + v.n);
        var list = MAO.articles.filter(function (a) { return a.v === v.n; });
        var wsum = list.reduce(function (s, a) { return s + (a.w || 0); }, 0);
        var pics = (FAMOUS[v.n] || []).map(findArt).filter(Boolean).slice(0, 3);

        c.innerHTML =
          '<div class="vt"><span class="vol-badge vol-' + v.n + '">' + MAO.esc(v.name) + '</span></div>' +
          '<div class="vy">' + MAO.esc(v.span || '') + '</div>' +
          '<div class="ve">' + MAO.esc(v.era || '') + '</div>' +
          '<div class="vm">' +
          '<div><b>' + v.count + '</b>篇</div>' +
          '<div><b>' + Math.round(wsum / 10000) + '</b>万字</div>' +
          '<div><b>' + (v.period && v.period[0] ? v.period[0].slice(0, 4) : '?') + '</b>起年</div>' +
          '</div>' +
          (pics.length ? '<div class="vpics"><b>代表篇目　</b>' +
            pics.map(function (p) { return MAO.esc(p.t); }).join('　') + '</div>' : '');
        c.onclick = function () { MAO.go('#/library?v=' + v.n); };
        grid.appendChild(c);
      });
      w1.appendChild(grid);
      root.appendChild(w1);

      /* --- 全书骨架六块 --- */
      var w2 = MAO.el('div', 'wrap');
      w2.style.marginTop = '20px';
      w2.appendChild(MAO.el('h3', 'sec-title',
        '全书的六根支柱' + '<small>按历史进程归类的六个一级论点块，呈"应用 → 抽象"的螺旋结构</small>'));
      var bg = MAO.el('div', 'vol-grid');
      BLOCKS.forEach(function (b) {
        var c = MAO.el('div', 'card hoverable');
        c.style.borderTop = '3px solid ' + b.c;
        var links = b.p.map(function (t) {
          var a = findArt(t);
          return a ? '<span class="tag" data-v="' + a.v + '" data-i="' + a.i + '" style="cursor:pointer">' +
            MAO.esc(a.t) + '</span>' : '<span class="muted small">' + MAO.esc(t) + '</span>';
        }).join('');
        c.innerHTML =
          '<div style="font-family:var(--serif);font-size:17px;font-weight:700;margin-bottom:6px">' +
          '<span style="color:' + b.c + ';margin-right:8px">' + b.n + '</span>' + MAO.esc(b.t) + '</div>' +
          '<div style="font-size:13.5px;color:var(--ink-2);line-height:1.8;margin-bottom:12px">' +
          MAO.esc(b.d) + '</div>' + links;
        MAO.$$('.tag[data-v]', c).forEach(function (n) {
          n.onclick = function (e) {
            e.stopPropagation();
            MAO.openArticle(parseInt(n.getAttribute('data-v'), 10), parseInt(n.getAttribute('data-i'), 10));
          };
        });
        bg.appendChild(c);
      });
      w2.appendChild(bg);
      root.appendChild(w2);

      /* --- 本站导览 --- */
      var w3 = MAO.el('div', 'wrap');
      w3.style.marginTop = '20px';
      w3.appendChild(MAO.el('h3', 'sec-title', '站内导览<small>六个入口，各有侧重</small>'));
      var ng = MAO.el('div', 'vol-grid');
      [
        ['timeline', '历史时间轴', '1925–1957 年 ' + S.arts + ' 篇文章的年代分布与密度，可缩放查看'],
        ['library', '文章阅览室', '按卷、标签、关键词检索；每篇配三分钟速读、论证结构与原文'],
        ['methods', '方法论工坊', S.skills + ' 个精炼方法论 + 问题诊断器；并附五卷方法图谱'],
        ['glossary', '概念词典', S.glossary + ' 个核心术语（分卷可查），重点在"作者本意 ≠ 日常用法"'],
        ['quotes', '金句摭拾', S.quotes + ' 条原文引录，标注出处，可复制'],
        ['digest', '整书速览', '五卷同一模板：主旨、核心问题、骨架、关键术语、可迁移方法、读时要打的折扣']
      ].forEach(function (n) {
        var c = MAO.el('div', 'card hoverable');
        c.style.cursor = 'pointer';
        c.innerHTML = '<div style="font-family:var(--serif);font-size:17px;font-weight:700;margin-bottom:6px">' +
          MAO.esc(n[1]) + '</div>' +
          '<div style="font-size:13.5px;color:var(--ink-2);line-height:1.8">' + MAO.esc(n[2]) + '</div>';
        c.onclick = function () { MAO.go('#/' + n[0]); };
        ng.appendChild(c);
      });
      w3.appendChild(ng);
      root.appendChild(w3);

      /* --- 数据说明 --- */
      var w4 = MAO.el('div', 'wrap');
      w4.style.marginTop = '20px';
      var note = MAO.el('div', 'card');
      note.style.cssText = 'background:var(--paper-3);border-style:dashed';
      note.innerHTML =
        '<div style="font-family:var(--serif);font-size:15px;font-weight:700;margin-bottom:8px">关于本站数据</div>' +
        '<div style="font-size:13px;color:var(--ink-2);line-height:1.9">' +
        '正文取自五卷原文共 ' + MAO.fmtNum(S.words) + ' 字；每篇的"三分钟速读 / 文章结构 / 关键论证 / 核心概念 / 方法候选"' +
        '由逐篇解构生成。整书速览按五卷分别整理了主旨、骨架、关键术语与精华长文；' +
        '方法图谱收录从五卷逐篇解构中抽取并跨篇去重的方法，每个方法标注具体做法与出自哪些篇目；' +
        '另有 ' + S.skills + ' 个经完整蒸馏、带触发条件与适用边界的方法论，见「方法论工坊」。' +
        '本站以文献与方法论视角编排，供检索与研读之用。' +
        '</div>';
      w4.appendChild(note);
      root.appendChild(w4);
    }
  };

  /* ---------------- 整书速览 ---------------- */
  M.digest = {
    id: 'digest',
    title: '整书速览',
    render: function (root, head) {
      if (head) {
        head.innerHTML = '<div class="wrap"><h2>整书速览<span class="en">Digest</span></h2>' +
          '<p>先看五卷各自在讲什么，再深入全书的结构、解释与批判性审视。批判部分为研读视角的整理，供独立思考参考。</p></div>';
      }
      var wrap = MAO.el('div', 'wrap');
      var tabs = MAO.el('div', 'drawer-tabs');
      tabs.style.cssText = 'padding:0;border:1px solid var(--line);border-radius:var(--r) var(--r) 0 0;background:var(--paper-2);margin-bottom:0';
      var pane = MAO.el('div', 'card prose md');
      pane.style.cssText = 'border-radius:0 0 var(--r) var(--r);border-top:none;max-width:none';

      var D = MAO.data || {};
      var INTROS = D.volIntros || [];

      /* --- Tab 1：五卷速览 --- */
      function paneVolumes() {
        if (!INTROS.length) return '<div class="empty">暂无内容</div>';
        var h = '<p class="muted small" style="margin-bottom:18px">五卷对应五个历史时期，各有各的主题与读法。点击篇目名可直接进入原文。</p>';
        INTROS.forEach(function (it) {
          var v = it.n;
          var meta = MAO.volMeta(v) || {};
          var links = (it.must || []).map(function (t) {
            var a = findArt(t);
            return a
              ? '<span class="tag" data-v="' + a.v + '" data-i="' + a.i + '" style="cursor:pointer">' + MAO.esc(a.t) + '</span>'
              : '<span class="tag">' + MAO.esc(t) + '</span>';
          }).join('');
          h +=
            '<div style="border:1px solid var(--line);border-left:4px solid ' + MAO.volColor(v) +
            ';border-radius:var(--r);background:var(--paper-2);padding:18px 20px;margin-bottom:16px">' +
            '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px">' +
            '<span class="vol-badge vol-' + v + '">' + MAO.esc(MAO.volName(v)) + '</span>' +
            '<span style="font-family:var(--serif);font-size:18px;font-weight:700;color:var(--ink)">' + MAO.esc(it.theme || '') + '</span>' +
            '<span class="muted mono" style="font-size:12px">' + MAO.esc(meta.span || '') + ' · ' + (meta.count || '') + ' 篇</span>' +
            '</div>' +
            '<div style="font-size:14.5px;line-height:2;color:var(--ink-2)">' + MAO.md(it.text || '') + '</div>' +
            (links ? '<div style="margin-top:10px"><b class="small" style="color:var(--ink)">必读篇目　</b>' + links + '</div>' : '') +
            '</div>';
        });
        return h;
      }

      /* --- Tab 4：方法图谱（五卷全量，数据驱动） --- */
      var MS = { all: null, cur: 0, q: '', limit: 40, flat: [] };

      function flattenMethods(data) {
        var flat = [];
        [1, 2, 3, 4, 5].forEach(function (v) {
          (data[String(v)] || []).forEach(function (it) {
            flat.push({ v: v, t: it.t, d: it.d, sub: it.sub || [] });
          });
        });
        return flat;
      }

      function filteredMethods() {
        var q = MS.q.trim().toLowerCase();
        var arr = MS.flat.filter(function (m) { return !MS.cur || m.v === MS.cur; });
        if (!q) return arr;
        return arr.filter(function (m) {
          if (m.t.toLowerCase().indexOf(q) >= 0 || (m.d || '').toLowerCase().indexOf(q) >= 0) return true;
          for (var i = 0; i < m.sub.length; i++) {
            if ((m.sub[i].t + (m.sub[i].d || '')).toLowerCase().indexOf(q) >= 0) return true;
          }
          return false;
        });
      }

      function renderMethodList(listEl, moreEl, reset) {
        if (reset) MS.limit = 40;
        var arr = filteredMethods();
        var n = Math.min(MS.limit, arr.length);
        var h = '';
        for (var i = 0; i < n; i++) {
          var m = arr[i];
          h += '<div class="mg-item" data-i="' + i + '" style="border:1px solid var(--line);border-left:3px solid ' +
            MAO.volColor(m.v) + ';border-radius:var(--r);background:var(--paper-2);padding:13px 16px;margin-bottom:9px;cursor:pointer">' +
            '<div style="display:flex;gap:9px;align-items:flex-start">' +
            '<span class="vol-badge vol-' + m.v + '" style="margin-top:2px">' + MAO.volName(m.v) + '</span>' +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-family:var(--serif);font-size:15.5px;font-weight:700;line-height:1.5">' + MAO.esc(m.t) + '</div>' +
            (m.d ? '<div class="small mute" style="color:var(--ink-2);line-height:1.8;margin-top:4px">' + MAO.esc(m.d) + '</div>' : '') +
            '<div class="mg-sub" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line-2)"></div>' +
            '</div></div></div>';
        }
        listEl.innerHTML = h || '<div class="empty">没有匹配的方法，换个词试试</div>';
        moreEl.style.display = n < arr.length ? '' : 'none';
        moreEl.textContent = '加载更多（还有 ' + (arr.length - n) + ' 个）';

        MAO.$$('.mg-item', listEl).forEach(function (node) {
          node.onclick = function () {
            var m = arr[parseInt(node.getAttribute('data-i'), 10)];
            var box = node.querySelector('.mg-sub');
            if (box.style.display === 'none') {
              var s = '<div class="small" style="color:var(--ink-3);margin-bottom:6px">具体做法 ' + m.sub.length + ' 条</div>';
              m.sub.forEach(function (x) {
                s += '<div style="margin-bottom:9px"><div style="font-size:14px;color:var(--ink);font-weight:600">' +
                  MAO.esc(x.t) + '</div>' +
                  (x.d ? '<div class="small" style="color:var(--ink-2);line-height:1.75;margin-top:2px">' + MAO.esc(x.d) + '</div>' : '') +
                  (x.p && x.p.length ? '<div style="margin-top:4px">出处：' + x.p.map(function (p) {
                    var a = findArt(p);
                    return a ? '<span class="tag" data-v="' + a.v + '" data-i="' + a.i + '" style="cursor:pointer">' +
                      MAO.esc(a.t) + '</span>' : '<span class="tag">' + MAO.esc(p) + '</span>';
                  }).join('') + '</div>' : '') + '</div>';
              });
              box.innerHTML = s;
              box.style.display = '';
              MAO.$$('.tag[data-v]', box).forEach(function (t) {
                t.onclick = function (e) {
                  e.stopPropagation();
                  MAO.openArticle(parseInt(t.getAttribute('data-v'), 10), parseInt(t.getAttribute('data-i'), 10));
                };
              });
            } else { box.style.display = 'none'; }
          };
        });
      }

      function paneMethods() {
        var box = MAO.el('div', '');
        var head = MAO.el('div', '');
        head.innerHTML =
          '<p class="muted small" style="margin-bottom:14px">' +
          '下面是从五卷 217 篇逐篇解构中抽取、并做跨篇去重后的方法：' +
          '每个方法下列出它的具体做法与出自哪些篇目，点方法展开、点篇目读原文。' +
          '另有 22 个经完整蒸馏、带触发条件与适用边界的方法，见「方法论工坊」。</p>';

        // 工坊入口
        var wshop = MAO.el('div', 'card hoverable');
        wshop.style.cssText = 'cursor:pointer;margin-bottom:16px;background:var(--gold-soft);border-color:rgba(184,137,58,.3)';
        wshop.innerHTML = '<div style="font-family:var(--serif);font-size:16px;font-weight:700;margin-bottom:4px">' +
          '方法论工坊 → ' + MAO.skills.length + ' 个精炼方法（含问题诊断器）</div>' +
          '<div class="small" style="color:var(--ink-2);line-height:1.7">' +
          '第一卷 18 篇蒸馏出的可调用方法论，每个都有触发信号、操作步骤与适用边界；输入你的现实困境可自动匹配。</div>';
        wshop.onclick = function () { MAO.go('#/methods'); };
        head.appendChild(wshop);

        // 卷切换 + 搜索
        var bar = MAO.el('div', '');
        bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px';
        var chips = MAO.el('div', '');
        chips.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
        var inp = MAO.el('input', '');
        inp.type = 'search';
        inp.placeholder = '搜索方法名 / 说明…';
        inp.style.cssText = 'flex:1;min-width:180px;padding:7px 12px;border:1px solid var(--line);border-radius:20px;' +
          'background:var(--paper-2);font-size:13px;font-family:var(--sans);color:var(--ink);outline:none';
        bar.appendChild(chips);
        bar.appendChild(inp);

        var listEl = MAO.el('div', '');
        var moreEl = MAO.el('button', 'btn', '');
        moreEl.style.margin = '14px 0 0';

        function drawChips() {
          chips.innerHTML = '';
          var counts = {};
          MS.flat.forEach(function (m) { counts[m.v] = (counts[m.v] || 0) + 1; });
          var opts = [{ v: 0, t: '全部', n: MS.flat.length }];
          [1, 2, 3, 4, 5].forEach(function (v) {
            opts.push({ v: v, t: MAO.volName(v), n: counts[v] || 0 });
          });
          opts.forEach(function (o) {
            var c = MAO.el('button', 'chip' + (MS.cur === o.v ? ' on' : ''),
              MAO.esc(o.t) + ' <span class="n">' + o.n + '</span>');
            c.style.border = MS.cur === o.v ? '' : '1px solid var(--line)';
            if (MS.cur === o.v) c.style.background = MAO.volColor(o.v) || 'var(--red)';
            c.onclick = function () {
              MS.cur = o.v; MS.limit = 40;
              drawChips(); renderMethodList(listEl, moreEl, false);
            };
            chips.appendChild(c);
          });
        }

        inp.addEventListener('input', MAO.debounce(function () {
          MS.q = inp.value; MS.limit = 40;
          renderMethodList(listEl, moreEl, false);
        }, 180));

        moreEl.onclick = function () {
          MS.limit += 60;
          renderMethodList(listEl, moreEl, false);
        };

        box.appendChild(head);
        box.appendChild(bar);
        box.appendChild(listEl);
        box.appendChild(moreEl);

        if (MS.all) {
          MS.flat = MS.flat.length ? MS.flat : flattenMethods(MS.all);
          drawChips(); renderMethodList(listEl, moreEl, true);
        } else {
          listEl.innerHTML = '<div class="skeleton" style="height:60px;margin-bottom:9px"></div>' +
            '<div class="skeleton" style="height:60px;margin-bottom:9px"></div>' +
            '<div class="skeleton" style="height:60px"></div>';
          MAO.methods().then(function (d) {
            MS.all = d; MS.flat = flattenMethods(d);
            drawChips(); renderMethodList(listEl, moreEl, true);
          }).catch(function () {
            listEl.innerHTML = '<div class="empty">方法数据加载失败</div>';
          });
        }
        return box;
      }

      var VC = D.volContent || {};

      /* --- 卷切换器：在 pane 内切换 1–5 卷 --- */
      function volSwitch(cur, onChange) {
        var bar = MAO.el('div', '');
        bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;' +
          'padding-bottom:12px;border-bottom:1px solid var(--line)';
        [1, 2, 3, 4, 5].forEach(function (v) {
          var met = MAO.volMeta(v) || {};
          var on = cur === v;
          var b = MAO.el('button', 'chip' + (on ? ' on' : ''),
            MAO.esc(MAO.volName(v)) + ' <span class="n">' + (met.span || '') + '</span>');
          if (on) {
            b.style.background = MAO.volColor(v);
            b.style.borderColor = MAO.volColor(v);
          } else {
            b.style.border = '1px solid var(--line)';
            if (!(VC[String(v)] || v === 1)) { b.style.opacity = '.5'; }
          }
          b.onclick = function () { onChange(v); };
          bar.appendChild(b);
        });
        return bar;
      }

      /* --- 可迁移的方法（数据驱动，取自五卷方法图谱） --- */
      function methodsBlock(v) {
        var box = MAO.el('div', '');
        function paint() {
          if (!MS.flat || !MS.flat.length) {
            box.innerHTML = '<div class="skeleton" style="height:70px;margin-bottom:9px"></div>' +
              '<div class="skeleton" style="height:70px"></div>';
            return;
          }
          var mine = MS.flat.filter(function (m) { return m.v === v; });
          if (!mine.length) { box.innerHTML = ''; return; }
          var h = '<h3>本卷可迁移的方法（' + mine.length + ' 个）</h3>' +
            '<div class="muted small" style="margin:-6px 0 12px">从本卷各篇的逐篇解构中抽取、并做跨篇去重后的方法。' +
            '点击方法进入「方法论工坊」查看完整步骤与适用边界。</div>';
          h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px">';
          mine.slice(0, 6).forEach(function (m) {
            h += '<div class="card hoverable" data-skill="' + MAO.esc(m.t) + '" style="cursor:pointer;padding:13px 15px;border-left:3px solid ' +
              MAO.volColor(v) + '">' +
              '<div style="font-family:var(--serif);font-size:15px;font-weight:700;line-height:1.5">' + MAO.esc(m.t) + '</div>' +
              '<div class="small" style="color:var(--ink-2);line-height:1.7;margin-top:4px">' +
              MAO.esc((m.d || '').slice(0, 40)) + '</div></div>';
          });
          h += '</div>';
          h += '<button class="btn" data-goto-mg="' + v + '" style="margin-top:12px">查看本卷全部 ' + mine.length + ' 个方法 →</button>' +
            '<button class="btn" data-goto-shop="1" style="margin-top:12px;margin-left:8px">方法论工坊（含问题诊断器）→</button>';
          box.innerHTML = h;
          var go = box.querySelector('[data-goto-mg]');
          // 预设方法图谱的卷筛选，然后切到该方法图谱页签
          if (go) go.onclick = function () { MS.cur = v; MS.limit = 40; show(3); };
          var shop = box.querySelector('[data-goto-shop]');
          if (shop) shop.onclick = function () { MAO.go('#/methods'); };
        }
        if (MS.flat && MS.flat.length) paint();
        else {
          MAO.methods().then(function (d) {
            if (!MS.flat || !MS.flat.length) MS.flat = flattenMethods(d);
            paint();
          }).catch(function () { box.innerHTML = ''; });
        }
        return box;
      }

      /* --- 结构化渲染某卷总览（主旨/问题/骨架/术语/方法/折扣） ---
             五卷共用同一模板，内容差异只体现在数据上 --- */
      function renderVolOverview(v) {
        var box = MAO.el('div', '');
        var c = VC[String(v)] || {};
        var h = '';
        if (c.thesis) {
          h += '<blockquote style="font-size:15.5px;line-height:1.95;border-left-color:' + MAO.volColor(v) + '">' +
            MAO.md(c.thesis) + '</blockquote>';
        }
        if (c.problem) {
          h += '<h3>本卷要解决的核心问题</h3><div style="font-size:14.5px;line-height:1.95;color:var(--ink-2)">' +
            MAO.md(c.problem) + '</div>';
        }
        if (c.blocks && c.blocks.length) {
          h += '<h3>骨架（主要论点及其关系）</h3>';
          h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:11px;margin:12px 0 18px">';
          c.blocks.forEach(function (b) {
            var links = (b.p || []).map(function (t) {
              var a = findArt(t);
              return a ? '<span class="tag" data-v="' + a.v + '" data-i="' + a.i + '" style="cursor:pointer">' +
                MAO.esc(a.t) + '</span>' : '';
            }).join('');
            h += '<div style="border:1px solid var(--line);border-left:3px solid ' + MAO.volColor(v) +
              ';border-radius:var(--r);background:var(--paper-2);padding:14px 16px">' +
              '<div style="font-family:var(--serif);font-size:15.5px;font-weight:700;margin-bottom:6px">' +
              '<span style="color:' + MAO.volColor(v) + ';margin-right:7px">' + MAO.esc(b.n || '') + '</span>' +
              MAO.esc(b.t || '') + '</div>' +
              '<div class="small" style="color:var(--ink-2);line-height:1.8">' + MAO.md(b.d || '') + '</div>' +
              (links ? '<div style="margin-top:9px">' + links + '</div>' : '') + '</div>';
          });
          h += '</div>';
        }
        if (c.terms && c.terms.length) {
          h += '<h3>关键术语（作者本意 ≠ 日常用法）</h3>';
          c.terms.forEach(function (t) {
            h += '<div style="border-left:3px solid var(--red);padding:2px 0 2px 14px;margin-bottom:14px">' +
              '<div style="font-family:var(--serif);font-size:15px;font-weight:700;margin-bottom:3px">' + MAO.esc(t.t || '') + '</div>' +
              (t.d ? '<div class="small" style="color:var(--ink-2);line-height:1.8"><b>作者的定义：</b>' + MAO.md(t.d) + '</div>' : '') +
              (t.diff ? '<div class="small" style="color:var(--red);line-height:1.8"><b>与常识的差异：</b>' + MAO.md(t.diff) + '</div>' : '') +
              '</div>';
          });
        }
        box.innerHTML = h;
        // 方法板块（异步填充，排在术语之后）
        box.appendChild(methodsBlock(v));
        // 折扣放在最后
        if (c.caveat) {
          var cv = MAO.el('div', '');
          cv.innerHTML = '<h3>读这一卷要打的折扣</h3>' +
            '<div style="background:var(--gold-soft);border:1px solid rgba(184,137,58,.3);border-radius:var(--r);' +
            'padding:14px 18px;font-size:14px;line-height:1.9;color:var(--ink-2)">' + MAO.md(c.caveat) + '</div>';
          box.appendChild(cv);
        }
        if (!box.textContent.trim() && !box.children.length) {
          box.innerHTML = '<div class="empty">该卷内容整理中</div>';
        }
        return box;
      }

      /* --- Tab 2：全书总览（五卷同一模板） --- */
      function paneOverview() {
        var box = MAO.el('div', '');
        var body = MAO.el('div', '');
        function show(v) {
          body.innerHTML = '';
          body.appendChild(volSwitch(v, show));
          var c = renderVolOverview(v);
          body.appendChild(c);
          bindTags(c);
        }
        box.appendChild(body);
        show(1);
        return box;
      }

      /* --- Tab 3：精华长文（五卷可切换） --- */
      function paneEssence() {
        var box = MAO.el('div', '');
        var body = MAO.el('div', '');
        function show(v) {
          body.innerHTML = '';
          body.appendChild(volSwitch(v, show));
          var c = MAO.el('div', '');
          var src = v === 1
            ? (D.digest || '').replace(/^#\s+.*$/m, '')
            : ((VC[String(v)] || {}).essence || '');
          c.innerHTML = src ? MAO.md(src) : '<div class="empty">该卷精华整理中</div>';
          body.appendChild(c);
          bindTags(c);
        }
        box.appendChild(body);
        show(1);
        return box;
      }

      /* 给 pane 内的篇目标签绑定跳转 */
      function bindTags(scope) {
        MAO.$$('.tag[data-v]', scope).forEach(function (n) {
          n.onclick = function () {
            MAO.openArticle(parseInt(n.getAttribute('data-v'), 10), parseInt(n.getAttribute('data-i'), 10));
          };
        });
      }

      var SRC = [
        { t: '五卷速览', fn: paneVolumes },
        { t: '全书总览', fn: paneOverview },
        { t: '精华长文', fn: paneEssence },
        { t: '方法图谱', fn: paneMethods }
      ];

      function show(idx) {
        MAO.$$('button', tabs).forEach(function (b, bi) { b.classList.toggle('on', bi === idx); });
        var src = SRC[idx];
        if (src.fn) {
          var r = src.fn();
          if (typeof r === 'string') { pane.innerHTML = r; }
          else { pane.innerHTML = ''; pane.appendChild(r); }
          // 篇目跳转
          MAO.$$('.tag[data-v]', pane).forEach(function (n) {
            n.onclick = function () {
              MAO.openArticle(parseInt(n.getAttribute('data-v'), 10), parseInt(n.getAttribute('data-i'), 10));
            };
          });
          // 方法卡跳工坊
          MAO.$$('[data-skill]', pane).forEach(function (n) {
            n.onclick = function () {
              try { sessionStorage.setItem('mao_skill_focus', n.getAttribute('data-skill')); } catch (e) {}
              MAO.go('#/methods');
            };
          });
        } else {
          var note = src.note ? '<p class="muted small" style="margin-bottom:14px">（' + src.note + '整理）</p>' : '';
          pane.innerHTML = note + (MAO.md(src.s) || '<div class="empty">暂无内容</div>');
        }
      }

      SRC.forEach(function (s, i) {
        var b = MAO.el('button', i === 0 ? 'on' : '', s.t);
        b.onclick = function () { show(i); };
        tabs.appendChild(b);
      });

      wrap.appendChild(tabs);
      wrap.appendChild(pane);
      root.appendChild(wrap);
      show(0);
    }
  };

  /* 颜色加深/变浅 */
  function shade(hex, p) {
    var c = String(hex).replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    r = Math.max(0, Math.min(255, r + p)); g = Math.max(0, Math.min(255, g + p)); b = Math.max(0, Math.min(255, b + p));
    return '#' + [r, g, b].map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
})();
