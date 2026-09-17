/* ============================================================
 * 历史时间轴模块  mod-timeline.js
 * 纯静态 / 零依赖 / 单文件。数据来源 window.MAO_CORE（data/core.js）
 * 对外暴露：window.Modules.timeline = { id, title, render(root) }
 * 依赖契约：MAO.esc / MAO.el / MAO.openArticle(v,i) （缺失时自动降级）
 * ============================================================ */
(function () {
  'use strict';

  var CORE = window.MAO_CORE || {};
  var VOLS = CORE.volumes || [];
  var ALL = CORE.articles || [];

  /* ---------- 通用小工具 ---------- */

  // HTML 转义：优先用全局 MAO.esc，缺失时本地兜底
  function esc(s) {
    if (window.MAO && typeof window.MAO.esc === 'function') return window.MAO.esc(s == null ? '' : String(s));
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 建元素：优先用全局 MAO.el
  function el(tag, cls, html) {
    if (window.MAO && typeof window.MAO.el === 'function') return window.MAO.el(tag, cls, html);
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // 打开文章详情
  function openArt(v, i) {
    if (window.MAO && typeof window.MAO.openArticle === 'function') window.MAO.openArticle(v, i);
  }

  // 千分位
  function num(n) {
    return String(n == null ? 0 : n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // 稳定哈希（用于同月文章的确定性抖动，避免每次重绘跳动）
  function hash01(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return ((h % 1000) / 1000);
  }

  /* ---------- 日期解析 ----------
   * d 形如 "1925-12-01"，缺月/缺日以 00 占位：
   *   "1937-08-00" -> 1937 年 8 月（日按 15 号）
   *   "1941-03-00" -> 1941 年 3 月
   * 缺月时按年中（7 月）处理，绝不当成 0 月以免向左错位一整年。
   * 返回小数年（便于线性映射到 x 轴），无日期返回 null。
   */
  function fracYear(d) {
    if (!d || typeof d !== 'string') return null;
    var p = d.split('-');
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) || 0;
    var dd = parseInt(p[2], 10) || 0;
    if (!y) return null;
    if (!m) m = 7;          // 缺月：年中
    if (!dd) dd = 15;       // 缺日：月中
    return y + (m - 1) / 12 + (dd - 1) / 30 / 12;
  }

  function yearOf(d) {
    return d ? parseInt(String(d).slice(0, 4), 10) : null;
  }

  /* ---------- 数据准备 ----------
   * i === 0 的条目是「卷首说明」（标题就是卷名、无摘要无标签），不参与时间轴与列表，
   * 但仍计入「未标注日期」统计，与全站 219 篇的口径保持一致。
   */
  var FRONT = ALL.filter(function (a) { return a.i === 0; });
  // 复制一份再加私有字段，避免污染 window.MAO_CORE 上的共享对象
  var ARTS = ALL.filter(function (a) { return a.i > 0; }).map(function (a) {
    var c = {}; for (var k in a) c[k] = a[k]; return c;
  });
  var DATED = ARTS.filter(function (a) { return !!a.d; });
  var NO_DATE = ALL.filter(function (a) { return !a.d; });   // 3 篇：2 篇卷首说明 + 1 篇未标注日期的讲话

  // 给每篇文章挂上解析后的小数年与年份
  ARTS.forEach(function (a) {
    a._fy = fracYear(a.d);
    a._y = yearOf(a.d);
    a._noDate = !a.d;
  });

  var YEARS = [];
  (function () {
    var min = 9999, max = 0;
    DATED.forEach(function (a) { if (a._y < min) min = a._y; if (a._y > max) max = a._y; });
    if (min > max) { min = 1925; max = 1957; }
    for (var y = min; y <= max; y++) YEARS.push(y);
  })();
  var Y_MIN = YEARS[0], Y_MAX = YEARS[YEARS.length - 1];
  var DOM_MIN = Y_MIN, DOM_MAX = Y_MAX + 1;   // 视窗可平移的完整边界（小数年）

  // 卷主题色（与全局 CSS 变量一致）
  function volColor(n) { return 'var(--v' + n + ')'; }

  // 按年聚合：篇数 + 主导卷
  var BY_YEAR = {};
  YEARS.forEach(function (y) { BY_YEAR[y] = { y: y, n: 0, vols: {} }; });
  DATED.forEach(function (a) {
    var b = BY_YEAR[a._y];
    if (!b) return;
    b.n++;
    b.vols[a.v] = (b.vols[a.v] || 0) + 1;
  });
  Object.keys(BY_YEAR).forEach(function (y) {
    var b = BY_YEAR[y], best = 0, bn = 1;
    Object.keys(b.vols).forEach(function (v) { if (b.vols[v] > best) { best = b.vols[v]; bn = parseInt(v, 10); } });
    b.dom = bn;
  });

  // 统计：最高产年份 / 最长篇幅
  var TOP_YEAR = { y: null, n: 0 };
  YEARS.forEach(function (y) { if (BY_YEAR[y].n > TOP_YEAR.n) TOP_YEAR = { y: y, n: BY_YEAR[y].n }; });
  var LONGEST = null;
  ARTS.forEach(function (a) { if (!LONGEST || a.w > LONGEST.w) LONGEST = a; });

  // 圆点半径：按字数 sqrt 映射，3px ~ 9px（直径感观更均衡）
  var W_MIN = Infinity, W_MAX = 0;
  ARTS.forEach(function (a) { if (a.w < W_MIN) W_MIN = a.w; if (a.w > W_MAX) W_MAX = a.w; });
  if (!isFinite(W_MIN)) { W_MIN = 0; W_MAX = 1; }
  function dotR(w) {
    var t = (w - W_MIN) / (W_MAX - W_MIN || 1);
    t = Math.sqrt(Math.max(0, Math.min(1, t)));
    return 3 + t * 6;
  }

  /* ---------- 一次性注入模块样式（沿用全局设计变量） ---------- */
  function injectStyle() {
    if (document.getElementById('tl-style')) return;
    var css = [
      '.tl-wrap{display:flex;flex-direction:column;gap:18px}',
      '.tl-desc{font-family:var(--sans);font-size:13px;color:var(--ink-3);line-height:1.7;margin:0}',
      /* 统计小卡 */
      '.tl-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}',
      '.tl-stat{background:var(--paper-2);border:1px solid var(--line);border-radius:var(--r);padding:10px 12px}',
      '.tl-stat b{display:block;font-family:var(--serif);font-size:22px;color:var(--ink);line-height:1.2}',
      '.tl-stat span{display:block;font-family:var(--sans);font-size:11px;color:var(--ink-3);margin-top:3px;letter-spacing:.04em}',
      '.tl-stat.tl-link{cursor:pointer;transition:border-color .15s,background .15s}',
      '.tl-stat.tl-link:hover{border-color:var(--line-2);background:var(--paper-3)}',
      '.tl-stat.tl-link b{font-size:15px;line-height:1.5;color:var(--ink)}',
      /* 时期分带 */
      '.tl-bands{display:flex;gap:3px;border-radius:var(--r);overflow:hidden;border:1px solid var(--line)}',
      '.tl-band{flex:0 0 auto;min-width:0;padding:9px 10px;cursor:pointer;border:0;text-align:left;color:#fff;font-family:var(--sans);',
      'transition:filter .15s,opacity .15s;overflow:hidden;background:var(--v1)}',
      '.tl-band:hover{filter:brightness(1.08)}',
      '.tl-band.on{box-shadow:inset 0 0 0 2px var(--ink);filter:brightness(1.12)}',
      '.tl-band.off{opacity:.45}',
      '.tl-band em{display:block;font-style:normal;font-family:var(--serif);font-size:13px;line-height:1.35;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tl-band i{display:block;font-style:normal;font-size:11px;opacity:.9;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      /* 图表工具条 */
      '.tl-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.tl-hint{font-family:var(--sans);font-size:11px;color:var(--ink-3)}',
      '.tl-range{display:flex;align-items:center;gap:6px;font-family:var(--sans);font-size:12px;color:var(--ink-2)}',
      '.tl-range input[type=range]{width:132px;accent-color:var(--red)}',
      '.tl-legend{display:flex;gap:12px;flex-wrap:wrap;margin-left:auto}',
      '.tl-lg{display:inline-flex;align-items:center;gap:5px;font-family:var(--sans);font-size:11px;color:var(--ink-2);cursor:pointer;background:none;border:0;padding:0}',
      '.tl-lg s{width:9px;height:9px;border-radius:50%;display:inline-block;text-decoration:none}',
      '.tl-lg.on{color:var(--ink);font-weight:600}',
      /* 画布 */
      '.tl-stage{position:relative;border:1px solid var(--line);border-radius:var(--r);background:var(--paper);padding:8px 4px 4px}',
      '.tl-svg{display:block;width:100%;touch-action:none;cursor:grab;user-select:none}',
      /* SVG 内的配色一律走 CSS 类：var() 在表现属性里不生效，只能写在样式里 */
      '.tl-svg text{font-family:var(--sans);font-size:11px;fill:var(--ink-2)}',
      '.tl-svg .tl-mute{fill:var(--ink-3)}',
      '.tl-svg .tl-lane-a{fill:var(--paper-2)}',
      '.tl-svg .tl-lane-b{fill:var(--paper-3)}',
      '.tl-svg .tl-grid{stroke:var(--line)}',
      '.tl-svg .tl-gridmj{stroke:var(--line-2)}',
      '.tl-svg .tl-base{stroke:var(--ink-3)}',
      '.tl-svg circle{stroke:var(--paper);stroke-width:.8}',
      '.tl-svg.dragging{cursor:grabbing}',
      '.tl-dot{cursor:pointer;transition:opacity .12s}',
      '.tl-tip{position:absolute;z-index:9;pointer-events:none;opacity:0;transition:opacity .1s;',
      'max-width:280px;background:var(--ink);color:var(--paper);border-radius:8px;padding:8px 10px;',
      'font-family:var(--sans);font-size:12px;line-height:1.6;box-shadow:0 6px 18px rgba(26,22,19,.22)}',
      '.tl-tip.on{opacity:1}',
      '.tl-tip b{display:block;font-family:var(--serif);font-size:13px;margin-bottom:3px}',
      '.tl-tip i{font-style:normal;color:#d9cfbe}',
      /* 密度条 */
      '.tl-den{display:flex;align-items:flex-end;gap:2px;height:84px;padding:0 4px;border-bottom:1px solid var(--line)}',
      '.tl-dbar{flex:1 1 0;min-width:0;position:relative;cursor:pointer;background:var(--v1);border-radius:2px 2px 0 0;',
      'transition:opacity .15s,filter .15s;opacity:.85}',
      '.tl-dbar:hover,.tl-dbar.on{opacity:1;filter:brightness(1.1)}',
      '.tl-dbar.dim{opacity:.22}',
      '.tl-daxis{display:flex;gap:2px;padding:0 4px;margin-top:4px}',
      '.tl-daxis span{flex:1 1 0;min-width:0;text-align:center;font-family:var(--sans);font-size:10px;color:var(--ink-3)}',
      /* 列表 */
      '.tl-lhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tl-chip{font-family:var(--sans);font-size:11px}',
      '.tl-list{display:flex;flex-direction:column;gap:2px;margin-top:6px}',
      '.tl-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;',
      'border-bottom:1px dashed var(--line);padding:8px 6px;cursor:pointer;border-radius:6px;',
      'font-family:var(--sans);transition:background .12s}',
      '.tl-row:hover{background:var(--paper-2)}',
      '.tl-row .d{flex:0 0 108px;font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}',
      '.tl-row .t{flex:1 1 auto;font-family:var(--serif);font-size:14px;color:var(--ink);',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tl-row .w{flex:0 0 auto;font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}',
      '.tl-row .b{flex:0 0 auto;font-size:10px;color:#fff;padding:2px 6px;border-radius:999px}',
      '.tl-more{align-self:flex-start;margin-top:10px}',
      '.tl-empty{font-family:var(--sans);font-size:13px;color:var(--ink-3);padding:14px 6px}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'tl-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ============================================================
   *  render
   * ============================================================ */
  function render(root, head) {
    injectStyle();

    // 复用/清理上一实例（导航离开再回来时避免监听泄漏）
    if (root._tl && root._tl.destroy) root._tl.destroy();

    root.innerHTML = '<div class="tl-wrap"><div class="tl-empty">正在整理 1925–1957 年的篇目时序…</div></div>';

    var wrap = root.firstChild;
    wrap.className = 'wrap tl-wrap';   // 与全站 .wrap 容器保持一致

    /* ---- 内部状态 ---- */
    var S = {
      dom0: DOM_MIN, dom1: DOM_MAX,     // 当前视窗（小数年）
      filter: null,                     // null | {type:'vol'|'year', val:Number}
      shown: 50,                        // 列表已渲染条数
      destroy: function () {
        if (S._ro) { try { S._ro.disconnect(); } catch (e) {} }
        window.removeEventListener('resize', S._onResize);
      }
    };
    root._tl = S;

    var svgEl = null, gMain = null, tipEl = null, stageEl = null;
    var hostEl = null, denEl = null, denAxisEl = null;
    var listEl = null, moreEl = null, lTitleEl = null, chipBox = null;
    var sStart = null, sEnd = null, sLab = null;

    /* ---------- 1. 标题（优先交给视图头部 head，与其余模块一致） ---------- */
    var desc = '毛选五卷 ' + ALL.length + ' 篇，写作时间横跨 ' + Y_MIN + '–' + Y_MAX +
      ' 年。横轴为时间，五条泳道对应五卷，圆点大小表示篇幅；滚轮缩放、拖拽平移，点圆点直接进入原文。';
    if (head) {
      head.innerHTML = '<div class="wrap"><h2>历史时间轴<span class="en">Timeline</span></h2>' +
        '<p>' + esc(desc) + '</p></div>';
    } else {
      var headFallback = el('div', '');
      headFallback.innerHTML = '<h2 class="sec-title">历史时间轴</h2><p class="tl-desc">' + esc(desc) + '</p>';
      wrap.appendChild(headFallback);
    }

    var stats = el('div', 'tl-stats');
    function statCard(label, value, onClick) {
      var c = el('div', 'tl-stat' + (onClick ? ' tl-link' : ''));
      c.innerHTML = '<b>' + value + '</b><span>' + esc(label) + '</span>';
      if (onClick) c.addEventListener('click', onClick);
      return c;
    }
    stats.appendChild(statCard('篇目总数（含卷首说明 ' + FRONT.length + ' 篇）', num(ALL.length)));
    stats.appendChild(statCard('有明确写作日期', num(DATED.length)));
    stats.appendChild(statCard('未标注日期', num(NO_DATE.length)));
    stats.appendChild(statCard('时间跨度', Y_MIN + '–' + Y_MAX + '（' + (Y_MAX - Y_MIN) + ' 年）'));
    stats.appendChild(statCard('写作最多的年份',
      TOP_YEAR.y ? TOP_YEAR.y + ' 年 · ' + TOP_YEAR.n + ' 篇' : '—',
      TOP_YEAR.y ? function () { setFilter({ type: 'year', val: TOP_YEAR.y }); } : null));
    stats.appendChild(statCard('篇幅最长的一篇',
      LONGEST ? esc(LONGEST.t) + ' · ' + num(LONGEST.w) + ' 字' : '—',
      LONGEST ? function () { openArt(LONGEST.v, LONGEST.i); } : null));
    wrap.appendChild(stats);

    /* ---------- 2. 时期分带 ---------- */
    var bands = el('div', 'tl-bands');
    // 宽度按各卷年跨度比例
    var spans = VOLS.map(function (v) {
      var a = v.period && v.period[0] ? yearOf(v.period[0]) : Y_MIN;
      var b = v.period && v.period[1] ? yearOf(v.period[1]) : Y_MAX;
      if (b <= a) b = a + 1;
      return Math.max(0.6, b - a);
    });
    var spanSum = spans.reduce(function (a, b) { return a + b; }, 0) || 1;
    VOLS.forEach(function (v, k) {
      var b = el('button', 'tl-band');
      b.type = 'button';
      b.style.flex = '0 0 ' + (spans[k] / spanSum * 100).toFixed(3) + '%';
      b.style.background = volColor(v.n);
      b.title = v.era + '　' + v.span + '　' + v.count + ' 篇';
      b.innerHTML = '<em>' + esc(v.name + '　' + (v.era || '')) + '</em>' +
        '<i>' + esc(v.span) + ' · ' + v.count + ' 篇</i>';
      b.addEventListener('click', function () {
        setFilter(S.filter && S.filter.type === 'vol' && S.filter.val === v.n ? null : { type: 'vol', val: v.n });
      });
      b._v = v.n;
      bands.appendChild(b);
    });
    wrap.appendChild(bands);

    /* ---------- 3. 主时间轴 ---------- */
    stageEl = el('div', 'tl-stage');
    wrap.appendChild(stageEl);

    var bar = el('div', 'tl-bar');
    bar.style.padding = '0 8px';
    var btnReset = el('button', 'btn', '重置视图');
    btnReset.type = 'button';
    btnReset.style.fontSize = '12px';
    btnReset.addEventListener('click', function () { resetView(); });
    bar.appendChild(btnReset);

    var rng = el('div', 'tl-range');
    rng.innerHTML = '<span>年份区间</span>';
    sStart = document.createElement('input');
    sStart.type = 'range'; sStart.min = Y_MIN; sStart.max = Y_MAX; sStart.value = Y_MIN;
    sEnd = document.createElement('input');
    sEnd.type = 'range'; sEnd.min = Y_MIN; sEnd.max = Y_MAX; sEnd.value = Y_MAX;
    sLab = el('span', '', Y_MIN + ' – ' + Y_MAX);
    sLab.style.fontVariantNumeric = 'tabular-nums';
    [sStart, sEnd].forEach(function (s) {
      s.addEventListener('input', function () {
        var a = parseInt(sStart.value, 10), b = parseInt(sEnd.value, 10);
        if (a > b) { var t = a; a = b; b = t; }
        setView(a, Math.min(Y_MAX, b) + 1);
        syncSliders();
      });
      rng.appendChild(s);
    });
    rng.appendChild(sLab);
    bar.appendChild(rng);
    bar.appendChild(el('span', 'tl-hint', '滚轮缩放 · 按住拖拽平移'));
    stageEl.appendChild(bar);

    // 图例（兼作按卷筛选）
    var legend = el('div', 'tl-legend');
    VOLS.forEach(function (v) {
      var g = el('button', 'tl-lg');
      g.type = 'button';
      g.innerHTML = '<s style="background:' + volColor(v.n) + '"></s>' + esc(v.name);
      g.addEventListener('click', function () {
        setFilter(S.filter && S.filter.type === 'vol' && S.filter.val === v.n ? null : { type: 'vol', val: v.n });
      });
      g._v = v.n;
      legend.appendChild(g);
    });
    bar.appendChild(legend);

    hostEl = el('div', '');
    stageEl.appendChild(hostEl);

    tipEl = el('div', 'tl-tip');
    stageEl.appendChild(tipEl);

    /* ---------- 4. 年份密度条 ---------- */
    var denTitle = el('div', 'tl-lhead');
    denTitle.style.marginTop = '4px';
    denTitle.innerHTML = '<h3 class="sec-title" style="font-size:15px;margin:0">按年篇数密度</h3>' +
      '<span class="tl-hint">点击柱体只看某一年</span>';
    wrap.appendChild(denTitle);

    denEl = el('div', 'tl-den');
    denAxisEl = el('div', 'tl-daxis');
    var maxN = 1;
    YEARS.forEach(function (y) { if (BY_YEAR[y].n > maxN) maxN = BY_YEAR[y].n; });
    YEARS.forEach(function (y) {
      var b = BY_YEAR[y];
      var d = el('div', 'tl-dbar' + (b.n ? '' : ' dim'));
      d.style.height = (b.n ? Math.max(6, b.n / maxN * 100) : 3) + '%';
      d.style.background = volColor(b.dom);
      d._y = y;
      d.addEventListener('mousemove', function (e) {
        showTip(e, '<b>' + y + ' 年</b><i>' + b.n + ' 篇 · 主导卷：第' + '一二三四五'[b.dom - 1] + '卷</i>');
      });
      d.addEventListener('mouseleave', hideTip);
      d.addEventListener('click', function () {
        setFilter(S.filter && S.filter.type === 'year' && S.filter.val === y ? null : { type: 'year', val: y });
      });
      denEl.appendChild(d);

      var lb = el('span', '', (y % 5 === 0 || y === Y_MIN || y === Y_MAX) ? String(y).slice(2) : '');
      denAxisEl.appendChild(lb);
    });
    wrap.appendChild(denEl);
    wrap.appendChild(denAxisEl);

    /* ---------- 5. 筛选后的文章列表 ---------- */
    var lhead = el('div', 'tl-lhead');
    lhead.style.marginTop = '14px';
    lTitleEl = el('h3', 'sec-title', '篇目列表');
    lTitleEl.style.fontSize = '15px';
    lTitleEl.style.margin = '0';
    chipBox = el('span', '');
    lhead.appendChild(lTitleEl);
    lhead.appendChild(chipBox);
    wrap.appendChild(lhead);

    listEl = el('div', 'tl-list');
    wrap.appendChild(listEl);
    moreEl = el('button', 'btn tl-more', '加载更多');
    moreEl.type = 'button';
    moreEl.style.display = 'none';
    moreEl.addEventListener('click', function () { S.shown += 50; renderList(); });
    wrap.appendChild(moreEl);

    /* ============================================================
     *  绘制主时间轴（SVG）
     * ============================================================ */
    var ML = 66, MR = 16, MT = 12, LANE_H = 44, AXIS_H = 48;

    function plotW() {
      var w = hostEl.clientWidth || root.clientWidth || 900;
      return Math.max(240, w - ML - MR);
    }

    function drawSVG() {
      var pw = plotW();
      var ph = VOLS.length * LANE_H;
      var W = pw + ML + MR;
      var H = MT + ph + AXIS_H;

      // SVG 元素只创建一次：拖拽/缩放时仅重画 <g> 内容，
      // 否则每次平移都会换掉正在捕获指针的元素，导致拖拽中断。
      if (!svgEl) {
        svgEl = sv('svg', { class: 'tl-svg' });
        hostEl.appendChild(svgEl);
        gMain = sv('g', {});
        svgEl.appendChild(gMain);
        bindNav();
      }
      svgEl.setAttribute('width', W);
      svgEl.setAttribute('height', H);
      svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      while (gMain.firstChild) gMain.removeChild(gMain.firstChild);

      var d0 = S.dom0, d1 = S.dom1;
      function X(v) { return ML + (v - d0) / (d1 - d0) * pw; }

      // 背景 + 泳道（配色走 class，卷色用内联 style.fill）
      VOLS.forEach(function (v, k) {
        var y = MT + k * LANE_H;
        gMain.appendChild(sv('rect', {
          x: ML, y: y + 2, width: pw, height: LANE_H - 4,
          class: (k % 2 ? 'tl-lane-a' : 'tl-lane-b'), opacity: .5, rx: 4
        }));
        // 泳道左侧色标与卷名
        var chip = sv('rect', { x: 4, y: y + LANE_H / 2 - 5, width: 5, height: 10, rx: 2 });
        chip.style.fill = volColor(v.n);
        gMain.appendChild(chip);
        var tx = sv('text', { x: 14, y: y + LANE_H / 2 + 4 });
        tx.textContent = v.name;
        gMain.appendChild(tx);
      });

      // 年份刻度 + 竖向网格线
      var span = d1 - d0;
      var step = 10;
      [1, 2, 5, 10].some(function (s) { if (span / s <= Math.max(3, pw / 88)) { step = s; return true; } return false; });
      var y0 = Math.ceil(d0), y1 = Math.floor(d1);
      for (var yy = y0; yy <= y1; yy++) {
        var major = (yy % step === 0);
        var x = X(yy);
        if (x < ML - 1 || x > ML + pw + 1) continue;
        gMain.appendChild(sv('line', {
          x1: x, y1: MT, x2: x, y2: MT + ph,
          class: major ? 'tl-gridmj' : 'tl-grid',
          'stroke-width': 1, opacity: major ? .9 : .45
        }));
        if (major) {
          var lt = sv('text', { x: x, y: MT + ph + 18, 'text-anchor': 'middle' });
          lt.textContent = yy;
          gMain.appendChild(lt);
          gMain.appendChild(sv('line', {
            x1: x, y1: MT + ph + 24, x2: x, y2: MT + ph + 28,
            class: 'tl-gridmj', 'stroke-width': 1
          }));
        }
      }
      // 基线
      gMain.appendChild(sv('line', {
        x1: ML, y1: MT + ph, x2: ML + pw, y2: MT + ph,
        class: 'tl-base', 'stroke-width': 1, opacity: .7
      }));
      var axLab = sv('text', { x: ML + pw, y: MT + ph + 44, class: 'tl-mute', 'text-anchor': 'end' });
      axLab.textContent = '年份';
      gMain.appendChild(axLab);

      // 卷起始分隔线（虚线，用该卷主题色）
      VOLS.forEach(function (v, k) {
        if (!v.period || !v.period[0] || k === 0) return;
        var vy = yearOf(v.period[0]);
        if (vy == null) return;
        var x = X(vy);
        if (x < ML || x > ML + pw) return;
        var ln = sv('line', {
          x1: x, y1: MT, x2: x, y2: MT + ph,
          'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: .55
        });
        ln.style.stroke = volColor(v.n);
        gMain.appendChild(ln);
      });

      // 圆点
      var vis = 0;
      ARTS.forEach(function (a) {
        if (a._noDate) return;
        var lane = a.v - 1;
        var x = X(a._fy);
        if (x < ML - 6 || x > ML + pw + 6) return;
        vis++;
        var r = dotR(a.w);
        var h1 = hash01(a.v + '-' + a.i + a.t);
        var h2 = hash01(a.t + '|' + a.d);
        // 横向轻微抖动（±2.2px），纵向在泳道内小幅抖动，避免同月文章完全重叠
        var cx = x + (h1 - .5) * 4.4;
        var cy = MT + lane * LANE_H + LANE_H / 2 + (h2 - .5) * (LANE_H - 2 * r - 8);
        var dim = isDimmed(a);
        var c = sv('circle', {
          cx: cx.toFixed(2), cy: cy.toFixed(2), r: r.toFixed(2),
          class: 'tl-dot', opacity: dim ? .16 : .92
        });
        c.style.fill = volColor(a.v);
        c._a = a;
        c.addEventListener('mouseenter', function () { c.setAttribute('opacity', 1); c.setAttribute('r', (r + 1.6).toFixed(2)); });
        c.addEventListener('mousemove', function (e) { showTip(e, tipHTML(a)); });
        c.addEventListener('mouseleave', function () { c.setAttribute('opacity', dim ? .16 : .92); c.setAttribute('r', r.toFixed(2)); hideTip(); });
        c.addEventListener('click', function (e) {
          if (S._dragged) return;             // 拖拽后不触发点击
          e.stopPropagation();
          openArt(a.v, a.i);
        });
        gMain.appendChild(c);
      });

      // 视窗内无点时的提示
      if (!vis) {
        var nt = sv('text', {
          x: ML + pw / 2, y: MT + ph / 2, class: 'tl-mute', 'text-anchor': 'middle'
        });
        nt.textContent = '当前年份区间内没有篇目';
        gMain.appendChild(nt);
      }

      syncDensity();
    }

    function tipHTML(a) {
      var s = (a.s || '').slice(0, 40);
      return '<b>' + esc(a.t) + '</b>' +
        '<i>' + esc(a.dl || '日期未标注') + ' · ' + num(a.w) + ' 字 · 第' + '一二三四五'[a.v - 1] + '卷</i>' +
        (s ? '<br>' + esc(s) + (a.s.length > 40 ? '…' : '') : '');
    }

    /* ---------- tooltip（跟随鼠标，且不超出 stage 容器） ---------- */
    function showTip(e, html) {
      tipEl.innerHTML = html;
      tipEl.classList.add('on');
      var r = stageEl.getBoundingClientRect();
      var x = e.clientX - r.left + 14;
      var y = e.clientY - r.top + 16;
      var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
      if (x + tw > r.width - 6) x = e.clientX - r.left - tw - 14;
      if (x < 4) x = 4;
      if (y + th > r.height - 4) y = Math.max(4, e.clientY - r.top - th - 12);
      tipEl.style.left = x + 'px';
      tipEl.style.top = y + 'px';
    }
    function hideTip() { tipEl.classList.remove('on'); }

    /* ---------- 缩放 / 平移 ---------- */
    function setView(a, b) {
      var minSpan = 1;
      if (b - a < minSpan) { var c = (a + b) / 2; a = c - minSpan / 2; b = c + minSpan / 2; }
      if (a < DOM_MIN) { b += DOM_MIN - a; a = DOM_MIN; }
      if (b > DOM_MAX) { a -= b - DOM_MAX; b = DOM_MAX; }
      if (a < DOM_MIN) a = DOM_MIN;
      S.dom0 = a; S.dom1 = b;
      drawSVG();
      syncSliders();
    }
    function resetView() { setView(DOM_MIN, DOM_MAX); }

    function syncSliders() {
      var a = Math.max(Y_MIN, Math.min(Y_MAX, Math.floor(S.dom0)));
      var b = Math.max(Y_MIN, Math.min(Y_MAX, Math.ceil(S.dom1) - 1));
      if (b < a) b = a;
      if (sStart.value != a) sStart.value = a;
      if (sEnd.value != b) sEnd.value = b;
      sLab.textContent = a + ' – ' + b;
    }

    // 只在 SVG 元素首次创建时绑定一次（见 drawSVG）
    function bindNav() {
      svgEl.addEventListener('wheel', function (e) {
        e.preventDefault();
        hideTip();
        var pw = plotW();
        var rect = svgEl.getBoundingClientRect();
        var px = Math.max(ML, Math.min(ML + pw, e.clientX - rect.left));
        var at = S.dom0 + (px - ML) / pw * (S.dom1 - S.dom0);
        var f = e.deltaY > 0 ? 1.18 : 1 / 1.18;
        var sp = Math.max(1, Math.min(DOM_MAX - DOM_MIN, (S.dom1 - S.dom0) * f));
        var k = (at - S.dom0) / (S.dom1 - S.dom0);
        setView(at - k * sp, at + (1 - k) * sp);
      }, { passive: false });

      var dragging = false, sx = 0, s0 = 0, sp0 = 0, moved = 0;
      svgEl.addEventListener('pointerdown', function (e) {
        dragging = true; moved = 0; S._dragged = false;
        sx = e.clientX; s0 = S.dom0; sp0 = S.dom1 - S.dom0;
        svgEl.classList.add('dragging');
        try { svgEl.setPointerCapture(e.pointerId); } catch (err) {}
      });
      svgEl.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - sx;
        moved = Math.max(moved, Math.abs(dx));
        if (moved > 3) { hideTip(); S._dragged = true; }
        var pw = plotW();
        var dv = -dx / pw * sp0;           // 平移不改变跨度
        setView(s0 + dv, s0 + dv + sp0);
      });
      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        svgEl.classList.remove('dragging');
        try { svgEl.releasePointerCapture(e.pointerId); } catch (err) {}
        setTimeout(function () { S._dragged = false; }, 0);
      }
      svgEl.addEventListener('pointerup', endDrag);
      svgEl.addEventListener('pointercancel', endDrag);
      // 不监听 pointerleave：设置指针捕获时它可能立刻触发，会把拖拽中断
    }

    /* ---------- 密度条与视图/筛选联动 ---------- */
    function syncDensity() {
      var a = S.dom0, b = S.dom1;
      for (var i = 0; i < denEl.children.length; i++) {
        var d = denEl.children[i], y = d._y;
        var inView = (y + 1) > a && y < b;
        var isOn = S.filter && S.filter.type === 'year' && S.filter.val === y;
        d.classList.toggle('on', !!isOn);
        d.classList.toggle('dim', !(inView || isOn));
      }
    }

    function isDimmed(a) {
      var f = S.filter;
      if (!f) return false;
      if (f.type === 'vol') return a.v !== f.val;
      if (f.type === 'year') return a._y !== f.val;
      return false;
    }

    /* ---------- 筛选 ---------- */
    function setFilter(f) {
      S.filter = f;
      S.shown = 50;
      // 若按年筛选，顺带把视图聚焦到该年前后
      if (f && f.type === 'year') setView(Math.max(DOM_MIN, f.val - 1), Math.min(DOM_MAX, f.val + 2));
      else drawSVG();
      syncBands();
      renderList();
      scrollToList();
    }

    function syncBands() {
      var f = S.filter;
      for (var i = 0; i < bands.children.length; i++) {
        var b = bands.children[i];
        var on = f && f.type === 'vol' && f.val === b._v;
        b.classList.toggle('on', !!on);
        b.classList.toggle('off', !!f && !on);
      }
      for (var j = 0; j < legend.children.length; j++) {
        var g = legend.children[j];
        g.classList.toggle('on', !!(f && f.type === 'vol' && f.val === g._v));
      }
    }

    /* ---------- 文章列表 ---------- */
    function filtered() {
      var arr = ARTS.filter(function (a) {
        var f = S.filter;
        if (!f) return true;
        if (f.type === 'vol') return a.v === f.val;
        if (f.type === 'year') return a._y === f.val;
        return true;
      });
      arr.sort(function (a, b) {
        if (a._noDate !== b._noDate) return a._noDate ? 1 : -1;
        if (a._fy !== b._fy) return (a._fy || 0) - (b._fy || 0);
        if (a.v !== b.v) return a.v - b.v;
        return a.i - b.i;
      });
      return arr;
    }

    function renderList() {
      var arr = filtered();
      var f = S.filter;
      var title = '篇目列表（' + arr.length + ' 篇）';
      lTitleEl.textContent = title;

      chipBox.innerHTML = '';
      if (f) {
        var label = f.type === 'vol' ? ('第' + '一二三四五'[f.val - 1] + '卷 · ' + (VOLS[f.val - 1] ? VOLS[f.val - 1].span : ''))
          : (f.val + ' 年 · ' + (BY_YEAR[f.val] ? BY_YEAR[f.val].n : 0) + ' 篇');
        var chip = el('span', 'chip tl-chip', esc(label) + ' ×');
        chip.title = '清除筛选';
        chip.style.cursor = 'pointer';
        chip.addEventListener('click', function () { setFilter(null); });
        chipBox.appendChild(chip);
      } else {
        chipBox.appendChild(el('span', 'muted', '按时间正序 · 共 ' + arr.length + ' 篇'));
      }

      listEl.innerHTML = '';
      if (!arr.length) {
        listEl.appendChild(el('div', 'tl-empty', '该范围内没有篇目，试试点击上方时期带或清除筛选。'));
        moreEl.style.display = 'none';
        return;
      }
      var n = Math.min(S.shown, arr.length);
      for (var i = 0; i < n; i++) {
        var a = arr[i];
        var row = el('button', 'tl-row');
        row.type = 'button';
        row.innerHTML =
          '<span class="d">' + esc(a.dl || '日期未标注') + '</span>' +
          '<span class="t">' + esc(a.t) + '</span>' +
          '<span class="w">' + num(a.w) + ' 字</span>' +
          '<span class="b" style="background:' + volColor(a.v) + '">' + esc(VOLS[a.v - 1] ? VOLS[a.v - 1].name : ('第' + a.v + '卷')) + '</span>';
        row.title = a.t + '　' + (a.dl || '日期未标注') + '　' + num(a.w) + ' 字';
        (function (aa) {
          row.addEventListener('click', function () { openArt(aa.v, aa.i); });
        })(a);
        listEl.appendChild(row);
      }
      moreEl.style.display = n < arr.length ? '' : 'none';
      moreEl.textContent = '加载更多（还有 ' + (arr.length - n) + ' 篇）';
    }

    function scrollToList() {
      setTimeout(function () {
        try { listEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      }, 40);
    }

    /* ---------- 尺寸变化重绘 ---------- */
    S._onResize = function () { drawSVG(); };
    window.addEventListener('resize', S._onResize);
    if (window.ResizeObserver) {
      S._ro = new ResizeObserver(function () { drawSVG(); });
      S._ro.observe(hostEl);
    }

    /* ---------- 首次渲染 ---------- */
    // 先出一帧 loading 文案，再同步绘制，避免大数据阻塞首屏
    requestAnimationFrame(function () {
      drawSVG();
      syncBands();
      renderList();
      syncSliders();
    });
  }

  window.Modules = window.Modules || {};
  window.Modules.timeline = { id: 'timeline', title: '历史时间轴', render: render };
})();
