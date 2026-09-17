/* ============================================================
   毛选文献站 · 核心运行时
   数据加载 / 路由 / 工具 / 全局搜索
   ============================================================ */
(function () {
  'use strict';

  /* 老浏览器（Safari < 14）缺少 Element.scrollTo，补一个最小实现 */
  if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
    Element.prototype.scrollTo = function (o) {
      if (o == null) return;
      if (typeof o === 'number') { this.scrollLeft = 0; this.scrollTop = o; return; }
      if (typeof o.top === 'number') this.scrollTop = o.top;
      if (typeof o.left === 'number') this.scrollLeft = o.left;
    };
  }

  var MAO = window.MAO = {};

  /* ---------- DOM 工具 ---------- */
  MAO.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  MAO.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  MAO.$ = function (sel, root) { return (root || document).querySelector(sel); };
  MAO.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  MAO.debounce = function (fn, ms) {
    var t; return function () {
      var a = arguments, c = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 150);
    };
  };

  /* ---------- 极简 Markdown 渲染 ---------- */
  MAO.md = function (src) {
    if (!src) return '';
    var s = String(src);
    var out = [], lines = s.split(/\r?\n/), i, line;
    var inList = null;   // 'ul' | 'ol'
    var para = [];

    function flushPara() {
      if (para.length) {
        out.push('<p>' + inline(para.join('<br>')) + '</p>');
        para = [];
      }
    }
    function closeList() {
      if (inList) { out.push('</' + inList + '>'); inList = null; }
    }
    function inline(t) {
      t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      // [P012] / [P003–P008] 引用标记
      t = t.replace(/\[((?:Pp?\d{3})(?:[–\-—][Pp]?\d{3})?(?:\s*[、,，]\s*[Pp]?\d{3}(?:[–\-—][Pp]?\d{3})?)*)\]/g,
        function (m, p) { return '<span class="pmark">' + p + '</span>'; });
      // 语料里的单元格换行符 <br>：转义后恢复为真正的换行
      t = t.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
      return t;
    }

    /* --- markdown 表格 ---
       | a | b | 开头的连续行，第二行为 |---|---| 分隔行 */
    function tryTable(idx) {
      var rows = [];
      var j = idx;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) { rows.push(lines[j].trim()); j++; }
      if (rows.length < 2) return null;
      // 第二行必须形如 |---|---| 才视为表格
      if (!/^\|[\s:|-]+\|$/.test(rows[1])) return null;
      function cells(row) {
        return row.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
      }
      var head = cells(rows[0]);
      var html = ['<table><thead><tr>'];
      head.forEach(function (c) { html.push('<th>' + inline(c) + '</th>'); });
      html.push('</tr></thead><tbody>');
      for (var r = 2; r < rows.length; r++) {
        var cs = cells(rows[r]);
        html.push('<tr>');
        head.forEach(function (_, ci) {
          html.push('<td>' + inline(cs[ci] != null ? cs[ci] : '') + '</td>');
        });
        html.push('</tr>');
      }
      html.push('</tbody></table>');
      return { html: html.join(''), next: j };
    }

    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      var t = line.trim();
      if (!t) { flushPara(); closeList(); continue; }

      // 表格（若命中则整体消费）
      if (/^\s*\|/.test(line)) {
        var tb = tryTable(i);
        if (tb) {
          flushPara(); closeList();
          out.push(tb.html);
          i = tb.next - 1;
          continue;
        }
      }

      var h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushPara(); closeList();
        var lv = Math.min(h[1].length, 4);
        out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>');
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushPara(); closeList(); out.push('<hr>'); continue; }
      if (/^>\s?/.test(t)) {
        flushPara(); closeList();
        out.push('<blockquote>' + inline(t.replace(/^>\s?/, '')) + '</blockquote>');
        continue;
      }
      if (/^```/.test(t)) { flushPara(); continue; }

      var li = t.match(/^([-*+])\s+(.*)$/);
      if (li) {
        flushPara();
        if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
        out.push('<li>' + inline(li[2]) + '</li>');
        continue;
      }
      var oi = t.match(/^(\d+)[.)、]\s+(.*)$/);
      if (oi) {
        flushPara();
        if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
        out.push('<li>' + inline(oi[2]) + '</li>');
        continue;
      }
      // 缩进续行并入当前列表项
      if (inList && /^\s{2,}/.test(line)) { out.push('<li>' + inline(t) + '</li>'); continue; }
      if (/^表格[:：]/.test(t)) continue;
      closeList();
      para.push(t);
    }
    flushPara(); closeList();
    return out.join('\n');
  };

  /* ---------- 数据 ---------- */
  var CORE = window.MAO_CORE || { volumes: [], articles: [], skills: [], glossary: [], quotes: [] };
  MAO.data = CORE;
  MAO.articles = CORE.articles || [];
  MAO.volumes = CORE.volumes || [];
  MAO.skills = CORE.skills || [];
  MAO.glossary = CORE.glossary || [];
  MAO.quotes = CORE.quotes || [];

  MAO.art = function (v, i) {
    for (var k = 0; k < MAO.articles.length; k++) {
      var a = MAO.articles[k];
      if (a.v === v && a.i === i) return a;
    }
    return null;
  };
  MAO.volMeta = function (n) {
    for (var k = 0; k < MAO.volumes.length; k++) if (MAO.volumes[k].n === n) return MAO.volumes[k];
    return null;
  };
  MAO.volColor = function (n) {
    return ['#9e2b25', '#b5651d', '#b8893a', '#2c4a6b', '#3d6b4a'][n - 1] || '#8a8078';
  };
  MAO.volName = function (n) { return '第' + '一二三四五'[n - 1] + '卷'; };
  MAO.fmtNum = function (n) {
    return String(n == null ? 0 : n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  MAO.fmtWords = function (w) {
    if (w >= 10000) return (w / 10000).toFixed(1).replace(/\.0$/, '') + ' 万字';
    return MAO.fmtNum(w) + ' 字';
  };
  /** 日期显示：缺月/缺日时优雅降级 */
  MAO.fmtDate = function (d) {
    if (!d) return '日期未标注';
    var p = String(d).split('-');
    var y = p[0], m = parseInt(p[1], 10), dd = parseInt(p[2], 10);
    if (!m) return y + ' 年';
    if (!dd) return y + ' 年 ' + m + ' 月';
    return y + ' 年 ' + m + ' 月 ' + dd + ' 日';
  };
  /** 排序用的数值键（缺月补 6，缺日补 15，保证排序稳定） */
  MAO.dateKey = function (d) {
    if (!d) return 99999999;
    var p = String(d).split('-');
    var y = parseInt(p[0], 10) || 9999;
    var m = parseInt(p[1], 10) || 6;
    var dd = parseInt(p[2], 10) || 15;
    return y * 10000 + m * 100 + dd;
  };

  /* ---------- 分卷数据按需加载 ---------- */
  var volCache = {}, volPending = {};
  MAO.vol = function (n) {
    if (volCache[n]) return Promise.resolve(volCache[n]);
    if (volPending[n]) return volPending[n];
    volPending[n] = new Promise(function (res, rej) {
      var varName = 'MAO_V' + n;
      if (window[varName]) { volCache[n] = window[varName]; return res(window[varName]); }
      var sc = document.createElement('script');
      sc.src = 'data/v' + n + '.js';
      sc.onload = function () {
        var d = window[varName] || { ev: {}, tx: {} };
        volCache[n] = d; res(d);
      };
      sc.onerror = function () { rej(new Error('加载第' + n + '卷数据失败')); };
      document.head.appendChild(sc);
    });
    return volPending[n];
  };
  MAO.volSync = function (n) { return volCache[n] || null; };

  /* ---------- 五卷方法图谱（按需加载） ---------- */
  var methCache = null, methPending = null;
  MAO.methods = function () {
    if (methCache) return Promise.resolve(methCache);
    if (methPending) return methPending;
    methPending = new Promise(function (res, rej) {
      if (window.MAO_METHODS) { methCache = window.MAO_METHODS; return res(methCache); }
      var sc = document.createElement('script');
      sc.src = 'data/methods.js';
      sc.onload = function () { methCache = window.MAO_METHODS || {}; res(methCache); };
      sc.onerror = function () { rej(new Error('方法数据加载失败')); };
      document.head.appendChild(sc);
    });
    return methPending;
  };

  /* ---------- 模块注册与路由 ---------- */
  var Modules = window.Modules = window.Modules || {};
  MAO.Modules = Modules;

  var NAV = [
    { id: 'overview', title: '概览', hash: '#/overview' },
    { id: 'timeline', title: '时间轴', hash: '#/timeline' },
    { id: 'library', title: '阅览室', hash: '#/library' },
    { id: 'methods', title: '方法论工坊', hash: '#/methods' },
    { id: 'glossary', title: '概念词典', hash: '#/glossary' },
    { id: 'quotes', title: '金句', hash: '#/quotes' },
    { id: 'digest', title: '整书速览', hash: '#/digest' }
  ];
  MAO.NAV = NAV;

  MAO.go = function (hash) {
    if (window.location.hash === hash) { route(); return; }
    window.location.hash = hash;
  };

  function parseHash() {
    var h = window.location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var q = {};
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var p = kv.split('=');
        q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      });
      h = h.slice(0, qi);
    }
    return { id: h || 'overview', q: q };
  }

  var current = null;
  function route() {
    var r = parseHash();
    var mod = Modules[r.id] || Modules.overview;
    if (!mod) return;
    // 导航高亮
    MAO.$$('.nav-links a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('href') === '#/' + r.id);
    });
    var view = MAO.$('#view');
    if (current !== r.id) {
      current = r.id;
      view.innerHTML = '';
      var head = MAO.el('div', 'view-head');
      view.appendChild(head);
      var body = MAO.el('div', 'view-body fade-in');
      view.appendChild(body);
      try {
        mod.render(body, head, r.q);
      } catch (e) {
        console.error('[模块渲染失败]', r.id, e);
        body.innerHTML = '<div class="empty">该模块加载出错：' + MAO.esc(e.message) + '</div>';
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }
  MAO.route = route;

  /* ---------- 文章详情抽屉（供各模块复用） ---------- */
  var drawerEl = null, overlayEl = null, lastFocus = null;

  function ensureDrawer() {
    if (drawerEl) return;
    overlayEl = MAO.el('div', 'overlay');
    document.body.appendChild(overlayEl);
    drawerEl = MAO.el('div', 'drawer');
    document.body.appendChild(drawerEl);
    overlayEl.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawerEl && drawerEl.classList.contains('on')) closeDrawer();
    });
  }

  var TABS = [
    { k: 'digest', t: '三分钟速读' },
    { k: 'structure', t: '文章结构' },
    { k: 'arguments', t: '关键论证' },
    { k: 'concepts', t: '核心概念' },
    { k: 'methods', t: '方法候选' },
    { k: 'text', t: '原文' }
  ];

  function renderDrawer(v, i) {
    var a = MAO.art(v, i);
    if (!a) return;
    drawerEl.innerHTML = '';

    var head = MAO.el('div', 'drawer-head');
    head.innerHTML =
      '<div class="dt">' + MAO.esc(a.t) + '</div>' +
      '<div class="dm">' +
      '<span class="vol-badge vol-' + v + '">' + MAO.volName(v) + '</span>' +
      '<span>第 ' + i + ' 篇</span><span>·</span>' +
      '<span>' + MAO.esc(MAO.fmtDate(a.d)) + '</span><span>·</span>' +
      '<span>' + MAO.fmtWords(a.w) + '</span>' +
      (a.tags && a.tags.length ? '<span>·</span><span>' + MAO.esc(a.tags.slice(0, 4).join(' / ')) + '</span>' : '') +
      '</div>';
    var close = MAO.el('button', 'drawer-close', '×');
    close.setAttribute('aria-label', '关闭');
    close.onclick = closeDrawer;
    head.appendChild(close);
    drawerEl.appendChild(head);

    var tabs = MAO.el('div', 'drawer-tabs');
    var bodyWrap = MAO.el('div', 'drawer-body');
    TABS.forEach(function (tb, idx) {
      var b = MAO.el('button', idx === 0 ? 'on' : '', tb.t);
      b.onclick = function () {
        MAO.$$('button', tabs).forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        showTab(tb.k);
      };
      tabs.appendChild(b);
    });
    drawerEl.appendChild(tabs);
    drawerEl.appendChild(bodyWrap);

    var loaded = null;
    function showTab(k) {
      if (!loaded) {
        bodyWrap.innerHTML = '<div class="skeleton" style="height:220px;margin-bottom:12px"></div>' +
          '<div class="skeleton" style="height:120px"></div>';
        MAO.vol(v).then(function (d) {
          loaded = (d.ev && d.ev[i]) || {};
          loaded.__tx = (d.tx && d.tx[i]) || '';
          showTab(k);
        }).catch(function () {
          bodyWrap.innerHTML = '<div class="empty">本篇暂无解析数据</div>';
        });
        return;
      }
      bodyWrap.innerHTML = '';
      bodyWrap.scrollTop = 0;
      if (k === 'digest') {
        var dg = loaded.digest || {};
        var keys = ['为什么写', '主要在解决什么问题', '作者最后给出的答案', '全文怎么推进'];
        var any = false;
        keys.forEach(function (kk) {
          if (!dg[kk]) return;
          any = true;
          var c = MAO.el('div', 'qa-card');
          c.innerHTML = '<div class="qq">' + MAO.esc(kk) + '</div>' +
            '<div class="aa">' + MAO.md(dg[kk]) + '</div>';
          bodyWrap.appendChild(c);
        });
        if (!any) bodyWrap.innerHTML = '<div class="empty">本篇暂无速读内容</div>';
      } else if (k === 'text') {
        var tx = loaded.__tx || '';
        if (!tx) { bodyWrap.innerHTML = '<div class="empty">暂无原文</div>'; return; }
        var bar = MAO.el('div', '', '');
        bar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap';
        bar.innerHTML = '<span class="small muted">字号</span>';
        ['小', '中', '大'].forEach(function (sz, si) {
          var b = MAO.el('button', 'btn btn-ghost', sz);
          b.style.cssText = 'padding:3px 10px;font-size:12px';
          b.onclick = function () {
            txtEl.style.fontSize = ['15px', '17px', '19px'][si];
            txtEl.style.lineHeight = ['1.85', '2', '2.15'][si];
          };
          bar.appendChild(b);
        });
        bodyWrap.appendChild(bar);
        var txtEl = MAO.el('div', 'md');
        txtEl.style.fontSize = '17px';
        txtEl.style.lineHeight = '2';
        // 长文分段渲染，避免卡顿
        var LIMIT = 6000;
        if (tx.length > LIMIT) {
          txtEl.innerHTML = MAO.md(tx.slice(0, LIMIT));
          var more = MAO.el('button', 'btn btn-primary', '继续阅读全文（剩余 ' +
            MAO.fmtWords(tx.length - LIMIT) + '）');
          more.style.marginTop = '18px';
          more.onclick = function () {
            txtEl.innerHTML = MAO.md(tx);
            more.remove();
          };
          bodyWrap.appendChild(txtEl);
          bodyWrap.appendChild(more);
        } else {
          txtEl.innerHTML = MAO.md(tx);
          bodyWrap.appendChild(txtEl);
        }
        var top = MAO.el('button', 'btn btn-ghost', '↑ 回到顶部');
        top.style.marginTop = '24px';
        top.onclick = function () { bodyWrap.scrollTop = 0; };
        bodyWrap.appendChild(top);
      } else {
        var src = loaded[k] || '';
        if (!src) { bodyWrap.innerHTML = '<div class="empty">本篇暂无此部分内容</div>'; return; }
        var d2 = MAO.el('div', 'md');
        d2.innerHTML = MAO.md(src);
        bodyWrap.appendChild(d2);
      }
    }
    showTab('digest');
  }

  function openDrawer(v, i) {
    ensureDrawer();
    lastFocus = document.activeElement;
    drawerEl.classList.add('on');
    overlayEl.classList.add('on');
    document.body.style.overflow = 'hidden';
    renderDrawer(v, i);
  }
  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove('on');
    overlayEl.classList.remove('on');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  MAO.closeDrawer = closeDrawer;

  /* ---------- 最近阅读（localStorage） ---------- */
  var RECENT_KEY = 'mao_recent_v1';
  MAO.markRead = function (v, i) {
    try {
      var a = MAO.art(v, i); if (!a) return;
      var list = MAO.recent();
      list = list.filter(function (x) { return !(x.v === v && x.i === i); });
      list.unshift({ v: v, i: i, t: a.t, ts: Date.now() });
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)));
    } catch (e) { /* 隐私模式下忽略 */ }
  };
  MAO.recent = function () {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch (e) { return []; }
  };

  /** 打开文章：如果阅览室模块提供自己的抽屉就用它的，否则用内置抽屉 */
  MAO.openArticle = function (v, i) {
    MAO.markRead(v, i);
    var lib = Modules.library;
    if (lib && typeof lib.open === 'function') {
      try { lib.open(v, i); return; } catch (e) { console.warn('[library.open 失败，回退内置抽屉]', e); }
    }
    openDrawer(v, i);
  };

  /* ---------- 全局搜索 ---------- */
  function buildSearchIndex() {
    var idx = [];
    MAO.articles.forEach(function (a) {
      idx.push({ type: '文章', id: a.v + '-' + a.i, t: a.t,
        sub: MAO.fmtDate(a.d) + ' · ' + MAO.fmtWords(a.w),
        kw: (a.t + ' ' + (a.s || '') + ' ' + (a.tags || []).join(' ')).toLowerCase() });
    });
    MAO.skills.forEach(function (s) {
      idx.push({ type: '方法论', id: s.id, t: s.title || s.id,
        sub: s.group || '', kw: (s.title + ' ' + s.desc + ' ' + s.id).toLowerCase() });
    });
    MAO.glossary.forEach(function (g) {
      idx.push({ type: '概念', id: g.t, t: g.t, sub: '术语',
        kw: (g.t + ' ' + (g.d || '') + ' ' + (g.diff || '')).toLowerCase() });
    });
    return idx;
  }
  var SINDEX = null;

  function initSearch() {
    var box = MAO.$('#gsearch');
    var panel = MAO.$('#gsearch-panel');
    if (!box || !panel) return;
    var input = box.querySelector('input');
    SINDEX = buildSearchIndex();

    function run(q) {
      q = (q || '').trim().toLowerCase();
      if (!q) { panel.classList.remove('on'); panel.innerHTML = ''; return; }
      var res = [];
      for (var k = 0; k < SINDEX.length && res.length < 24; k++) {
        var it = SINDEX[k];
        if (it.t.toLowerCase().indexOf(q) >= 0) res.unshift(it);
        else if (it.kw.indexOf(q) >= 0) res.push(it);
      }
      if (!res.length) {
        panel.innerHTML = '<div class="empty" style="padding:26px">未找到「' + MAO.esc(q) + '」相关内容</div>';
      } else {
        panel.innerHTML = res.slice(0, 20).map(function (it) {
          return '<div class="s-item" data-type="' + MAO.esc(it.type) + '" data-id="' + MAO.esc(it.id) + '">' +
            '<span class="s-ty">' + MAO.esc(it.type) + '</span>' +
            '<span class="s-t">' + MAO.esc(it.t) + '</span>' +
            '<span class="s-sb">' + MAO.esc(it.sub) + '</span></div>';
        }).join('');
        MAO.$$('.s-item', panel).forEach(function (n) {
          n.onclick = function () {
            var ty = n.getAttribute('data-type'), id = n.getAttribute('data-id');
            panel.classList.remove('on'); input.value = '';
            if (ty === '文章') {
              var p = id.split('-');
              MAO.openArticle(parseInt(p[0], 10), parseInt(p[1], 10));
            } else if (ty === '方法论') {
              sessionStorage.setItem('mao_skill_focus', id);
              MAO.go('#/methods');
            } else {
              MAO.go('#/glossary?q=' + encodeURIComponent(id));
            }
          };
        });
      }
      panel.classList.add('on');
    }

    input.addEventListener('input', MAO.debounce(function () { run(input.value); }, 160));
    input.addEventListener('focus', function () { if (input.value) run(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; panel.classList.remove('on'); input.blur(); }
      if (e.key === 'Enter') {
        var first = panel.querySelector('.s-item');
        if (first) first.click();
        else { MAO.go('#/library?q=' + encodeURIComponent(input.value)); panel.classList.remove('on'); }
      }
    });
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target) && !panel.contains(e.target)) panel.classList.remove('on');
    });
  }

  /* ---------- 回到顶部 ---------- */
  function initToTop() {
    var b = MAO.el('button', 'totop', '↑');
    b.setAttribute('aria-label', '回到顶部');
    document.body.appendChild(b);
    b.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); };
    window.addEventListener('scroll', function () {
      b.classList.toggle('on', window.scrollY > 500);
    }, { passive: true });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    // 导航链接
    var nl = MAO.$('.nav-links');
    if (nl) {
      nl.innerHTML = NAV.map(function (n) {
        return '<a href="' + n.hash + '" data-id="' + n.id + '">' + n.title + '</a>';
      }).join('');
    }
    initSearch();
    initToTop();
    window.addEventListener('hashchange', route);
    if (!window.location.hash) window.location.hash = '#/overview';
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
