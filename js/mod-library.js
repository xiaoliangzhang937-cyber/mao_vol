/* ============================================================
 * 文章阅览室  mod-library.js
 * 纯静态 / 零依赖 / 单文件。数据：window.MAO_CORE + MAO.vol(v)
 * 对外暴露：window.Modules.library = { id, title, render, open }
 *   · render(body, head, q) —— app.js 路由挂载时调用
 *   · open(v, i)            —— 被 MAO.openArticle 优先调用（app.js 契约）
 * 依赖契约：MAO.esc / MAO.el / MAO.md / MAO.vol / MAO.go
 * 注意：本文件不使用 IIFE，内部成员统一以 Lib / lib 前缀命名
 * ============================================================ */

/* ------------------------------------------------------------
 * 一、常量
 * ---------------------------------------------------------- */
var LIB_PAGE = 40;          // 分段懒加载每页条数
var LIB_PREVIEW = 3000;     // 原文首次渲染字数
var LIB_TAG_TOP = 40;       // 标签云取前 N 个

// 三分钟速读的固定问答顺序
var LIB_DIGEST_KEYS = ['为什么写', '主要在解决什么问题', '作者最后给出的答案', '全文怎么推进'];

// 详情分区定义（顺序即锚点顺序）
var LIB_SECTIONS = [
  { k: 'digest', t: '三分钟速读' },
  { k: 'structure', t: '文章结构' },
  { k: 'arguments', t: '关键论证' },
  { k: 'concepts', t: '概念 / 方法' },
  { k: 'text', t: '原文' }
];

/* ------------------------------------------------------------
 * 二、运行时状态
 * ---------------------------------------------------------- */
var LibS = {
  ready: false,        // 是否已挂载
  root: null,          // view-body 容器
  head: null,          // view-head 容器
  // 筛选条件
  q: '',               // 关键词
  vol: 0,              // 卷号，0 = 全部
  tags: [],            // 已选标签（多选）
  sort: 'default',     // default | date | words
  // 列表
  all: [],             // 规范化后的全量文章
  list: [],            // 当前筛选结果
  shown: 0,            // 已渲染条数
  lastSig: '',         // 上次筛选条件的指纹，避免重复重算
  // 抽屉
  drawerEl: null, maskEl: null, bodyEl: null,
  cur: null,           // {v,i}
  token: 0,            // 异步竞态令牌
  pushed: false,       // 当前抽屉是否由本模块 push 出的历史条目
  cache: {},           // v-i -> {ev, tx} 简易缓存
  textState: { size: 'md', full: false }
};

/* ------------------------------------------------------------
 * 三、工具函数（优先复用全局 MAO，缺失时本地兜底）
 * ---------------------------------------------------------- */
function libEsc(s) {
  if (window.MAO && typeof MAO.esc === 'function') return MAO.esc(s == null ? '' : s);
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function libEl(tag, cls, html) {
  if (window.MAO && typeof MAO.el === 'function') return MAO.el(tag, cls, html);
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// markdown 渲染：数据里的解析内容统一走 MAO.md
function libMd(s) {
  if (!s) return '';
  if (window.MAO && typeof MAO.md === 'function') return MAO.md(s);
  return '<p>' + libEsc(String(s).replace(/\n+/g, ' ')) + '</p>';
}

function libVolName(v) {
  if (window.MAO && typeof MAO.volName === 'function') return MAO.volName(v);
  return '第' + '一二三四五'[v - 1] + '卷';
}

function libVolColor(v) {
  if (window.MAO && typeof MAO.volColor === 'function') return MAO.volColor(v);
  return ['#9e2b25', '#b5651d', '#b8893a', '#2c4a6b', '#3d6b4a'][v - 1] || '#8a8078';
}

function libFmtDate(d) {
  if (window.MAO && typeof MAO.fmtDate === 'function') return MAO.fmtDate(d);
  return d || '日期未标注';
}

function libFmtWords(w) {
  if (window.MAO && typeof MAO.fmtWords === 'function') return MAO.fmtWords(w);
  if (w >= 10000) return (w / 10000).toFixed(1).replace(/\.0$/, '') + ' 万字';
  return String(w || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' 字';
}

function libPad(n) { return n < 10 ? '0' + n : String(n); }

function libDebounce(fn, ms) {
  var t;
  return function () {
    var a = arguments, c = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(c, a); }, ms || 150);
  };
}

/* ------------------------------------------------------------
 * 四、样式注入（只注入一次，全部使用全局设计变量）
 * ---------------------------------------------------------- */
function libEnsureCss() {
  if (document.getElementById('mod-library-css')) return;
  var css = [
    '.lib-wrap{max-width:var(--maxw);margin:0 auto}',
    /* --- 筛选区 --- */
    '.lib-panel{padding:16px 18px;margin-bottom:16px}',
    '.lib-row{display:flex;gap:12px;align-items:flex-start;padding:9px 0;border-top:1px dashed var(--line)}',
    '.lib-row:first-child{border-top:0;padding-top:2px}',
    '.lib-lb{flex:none;width:44px;padding-top:6px;font-size:12.5px;color:var(--ink-3);letter-spacing:.08em}',
    '.lib-chips{display:flex;gap:8px;flex-wrap:wrap;flex:1;min-width:0}',
    '.lib-search{position:relative;flex:1;min-width:0;display:flex;align-items:center;gap:10px}',
    '.lib-search input{flex:1;min-width:0;padding:9px 32px 9px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);',
    'background:var(--paper);color:var(--ink);font-size:14px;font-family:var(--sans);outline:none;transition:border-color .16s}',
    '.lib-search input:focus{border-color:var(--red)}',
    '.lib-clear-x{position:absolute;right:8px;width:20px;height:20px;border:0;background:none;cursor:pointer;',
    'color:var(--ink-3);font-size:16px;line-height:1;border-radius:50%}',
    '.lib-clear-x:hover{background:var(--paper-3);color:var(--ink)}',
    /* 卷胶囊：带卷色 */
    '.lib-vchip{--vc:var(--ink-2);display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;',
    'border:1px solid var(--line-2);background:var(--paper);color:var(--ink-2);font-size:12.5px;cursor:pointer;',
    'font-family:var(--sans);white-space:nowrap;transition:all .15s}',
    '.lib-vchip .dot{width:7px;height:7px;border-radius:50%;background:var(--vc)}',
    '.lib-vchip:hover{border-color:var(--vc);color:var(--vc)}',
    '.lib-vchip.on{background:var(--vc);border-color:var(--vc);color:#fff}',
    '.lib-vchip.on .dot{background:rgba(255,255,255,.75)}',
    /* 标签云 */
    '.lib-cloud{display:flex;gap:7px;flex-wrap:wrap;flex:1;min-width:0}',
    '.lib-tchip{padding:3px 9px;border-radius:4px;border:1px solid var(--line);background:var(--paper);',
    'cursor:pointer;font-family:var(--sans);white-space:nowrap;transition:all .15s}',
    '.lib-tchip:hover{border-color:var(--red);color:var(--red)}',
    '.lib-tchip.on{background:var(--red);border-color:var(--red);color:#fff}',
    '.lib-tchip .n{opacity:.55;font-size:.85em;margin-left:3px}',
    /* --- 结果条 --- */
    '.lib-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 2px 14px;font-size:13px;color:var(--ink-2)}',
    '.lib-bar b{color:var(--red);font-family:var(--serif);font-size:15px}',
    '.lib-bar .sp{flex:1}',
    /* --- 文章卡片 --- */
    '.lib-list{display:flex;flex-direction:column;gap:10px}',
    '.lib-item{position:relative;display:flex;gap:0;overflow:hidden;background:var(--paper-2);border:1px solid var(--line);',
    'border-radius:var(--r);cursor:pointer;transition:box-shadow .2s,transform .2s,border-color .2s}',
    '.lib-item:hover{border-color:var(--line-2);box-shadow:var(--shadow);transform:translateY(-1px)}',
    '.lib-item:focus-visible{outline:2px solid var(--red);outline-offset:2px}',
    '.lib-spine{flex:none;width:4px;background:var(--vc,var(--line-2))}',
    '.lib-main{flex:1;min-width:0;padding:13px 16px 14px}',
    '.lib-vn{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink-3);font-family:var(--sans)}',
    '.lib-vn i{width:8px;height:8px;border-radius:2px;background:var(--vc,var(--ink-3));display:inline-block}',
    '.lib-vn em{font-style:normal;font-family:var(--mono);color:var(--ink-2)}',
    '.lib-t{font-family:var(--serif);font-size:18.5px;font-weight:700;line-height:1.45;color:var(--ink);margin:5px 0 6px}',
    '.lib-item:hover .lib-t{color:var(--red)}',
    '.lib-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--ink-3);margin-bottom:7px}',
    '.lib-meta .dot{opacity:.4}',
    '.lib-sum{font-size:13.5px;line-height:1.75;color:var(--ink-2);font-family:var(--sans);',
    'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    /* 加载更多 / 空态 */
    '.lib-more{padding:22px 0;text-align:center}',
    '.lib-end{padding:26px 0;text-align:center;font-size:12.5px;color:var(--ink-3);font-family:var(--serif)}',
    /* --- 抽屉 --- */
    '.lib-mask{position:fixed;inset:0;background:rgba(26,22,19,.42);z-index:410;opacity:0;pointer-events:none;transition:opacity .25s}',
    '.lib-mask.on{opacity:1;pointer-events:auto}',
    '.lib-drawer{position:fixed;top:0;right:0;bottom:0;width:min(900px,96vw);background:var(--paper);z-index:411;',
    'border-left:1px solid var(--line-2);box-shadow:-20px 0 60px rgba(26,22,19,.18);',
    'transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column}',
    '.lib-drawer.on{transform:none}',
    '.lib-dhead{flex:none;position:relative;padding:18px 24px 12px;border-bottom:1px solid var(--line);background:var(--paper-2)}',
    '.lib-dclose{position:absolute;top:16px;right:18px;width:32px;height:32px;border:1px solid var(--line-2);',
    'background:var(--paper);border-radius:50%;cursor:pointer;color:var(--ink-2);font-size:17px;line-height:1;',
    'display:grid;place-items:center;transition:all .16s}',
    '.lib-dclose:hover{background:var(--red);border-color:var(--red);color:#fff}',
    '.lib-dtitle{font-family:var(--serif);font-size:25px;font-weight:700;line-height:1.3;color:var(--ink);padding-right:40px}',
    '.lib-dmeta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:12.5px;color:var(--ink-3)}',
    '.lib-dmeta .vb{display:inline-flex;align-items:center;justify-content:center;height:20px;padding:0 7px;',
    'border-radius:4px;color:#fff;font-size:11px;font-family:var(--serif);font-weight:700}',
    /* 锚点小导航 */
    '.lib-anchors{flex:none;display:flex;gap:2px;padding:0 24px;border-bottom:1px solid var(--line);',
    'background:var(--paper);overflow-x:auto}',
    '.lib-anchors button{padding:10px 13px;border:none;background:none;cursor:pointer;font-size:13px;',
    'color:var(--ink-3);font-family:var(--sans);border-bottom:2px solid transparent;white-space:nowrap;transition:all .16s}',
    '.lib-anchors button:hover{color:var(--ink)}',
    '.lib-anchors button.on{color:var(--red);border-bottom-color:var(--red);font-weight:600}',
    '.lib-dbody{flex:1;overflow-y:auto;padding:22px 24px 60px;position:relative;scroll-behavior:smooth}',
    '.lib-sec{scroll-margin-top:8px}',
    '.lib-sec+.lib-sec{margin-top:34px;padding-top:24px;border-top:1px solid var(--line)}',
    '.lib-sech{font-family:var(--serif);font-size:19px;font-weight:700;margin:0 0 14px;padding-left:11px;',
    'border-left:3px solid var(--red);line-height:1.3;color:var(--ink)}',
    /* 上下篇 */
    '.lib-dfoot{flex:none;display:flex;gap:10px;padding:11px 24px;border-top:1px solid var(--line);background:var(--paper-2)}',
    '.lib-navbtn{flex:1;min-width:0;text-align:left;padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);',
    'background:var(--paper);cursor:pointer;font-family:var(--sans);transition:all .16s;overflow:hidden}',
    '.lib-navbtn:hover:not(:disabled){border-color:var(--red);color:var(--red)}',
    '.lib-navbtn:disabled{opacity:.4;cursor:not-allowed}',
    '.lib-navbtn .k{display:block;font-size:11px;color:var(--ink-3);margin-bottom:2px}',
    '.lib-navbtn .v{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    /* 原文工具条 */
    '.lib-tbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:12px;',
    'border-bottom:1px dashed var(--line)}',
    '.lib-tbar .lb{font-size:12px;color:var(--ink-3)}',
    '.lib-sz{display:inline-flex;border:1px solid var(--line-2);border-radius:var(--r-sm);overflow:hidden}',
    '.lib-sz button{padding:4px 12px;border:none;background:var(--paper);cursor:pointer;font-size:12.5px;',
    'color:var(--ink-2);font-family:var(--sans);border-right:1px solid var(--line)}',
    '.lib-sz button:last-child{border-right:0}',
    '.lib-sz button.on{background:var(--red);color:#fff}',
    '.lib-para{font-family:var(--serif);color:var(--ink);line-height:2.05}',
    '.lib-para p{margin:0 0 15px;text-align:justify}',
    '.lib-para p.first{font-weight:700;font-size:1.05em}',
    '.lib-para[data-size=sm]{font-size:15px;line-height:1.9}',
    '.lib-para[data-size=md]{font-size:17px;line-height:2.05}',
    '.lib-para[data-size=lg]{font-size:19.5px;line-height:2.2}',
    '.lib-readmore{margin-top:18px}',
    /* 速读问答卡 */
    '.lib-qas{display:grid;gap:12px}',
    '.lib-qa .qq{font-family:var(--serif);font-size:14.5px;font-weight:700;color:var(--red);margin-bottom:6px;',
    'padding-left:10px;border-left:2px solid var(--red-soft)}',
    '.lib-qa .aa{font-size:13.5px;line-height:1.85;color:var(--ink-2);font-family:var(--sans)}',
    '.lib-methodnote{margin-top:14px;padding:11px 14px;background:var(--gold-soft);border:1px solid rgba(184,137,58,.25);',
    'border-radius:var(--r-sm);font-size:12.5px;color:var(--ink-2);line-height:1.8}',
    'html.lib-locked,html.lib-locked body{overflow:hidden}',
    '@media (max-width:720px){',
    '.lib-row{flex-direction:column;gap:6px}',
    '.lib-lb{width:auto;padding-top:0}.lib-dbody,.lib-dhead,.lib-anchors{padding-left:16px;padding-right:16px}',
    '.lib-dfoot{padding:10px 16px}.lib-t{font-size:17px}}'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'mod-library-css';
  st.textContent = css;
  document.head.appendChild(st);
}

/* ------------------------------------------------------------
 * 五、数据准备
 * ---------------------------------------------------------- */
function libArticles() {
  if (LibS.all.length) return LibS.all;
  var core = window.MAO_CORE || {};
  var vols = core.volumes || [];
  var meta = {};
  vols.forEach(function (v) { meta[v.n] = v; });

  var out = (core.articles || []).filter(function (a) {
    // 剔除 i=0 的卷首页占位数据，只保留真实篇目
    return a && typeof a.v === 'number' && typeof a.i === 'number' && a.i >= 1 && a.v >= 1 && a.v <= 5;
  }).map(function (a) {
    var vm = meta[a.v] || {};
    return {
      v: a.v, i: a.i,
      t: a.t || '（无题）',
      d: a.d || '',
      w: a.w || 0,
      tags: a.tags || [],
      s: a.s || '',
      volName: libVolName(a.v),
      era: vm.era || '',
      // 检索用拼接串（小写）
      hay: ((a.t || '') + ' ' + (a.s || '') + ' ' + (a.tags || []).join(' ') + ' ' + (a.dl || '')).toLowerCase()
    };
  });

  out.sort(function (x, y) { return x.v - y.v || x.i - y.i; });
  LibS.all = out;
  return out;
}

/** 聚合标签云：按出现次数降序，取前 LIB_TAG_TOP 个 */
function libTagCloud() {
  if (LibS.tagCloud) return LibS.tagCloud;
  var m = {}, order = [];
  libArticles().forEach(function (a) {
    a.tags.forEach(function (t) {
      if (m[t] == null) { m[t] = 0; order.push(t); }
      m[t]++;
    });
  });
  var arr = order.map(function (t) { return { t: t, n: m[t] }; })
    .sort(function (x, y) { return y.n - x.n || (x.t < y.t ? -1 : 1); })
    .slice(0, LIB_TAG_TOP);
  LibS.tagCloud = arr;
  return arr;
}

/* ------------------------------------------------------------
 * 六、筛选 / 排序
 * ---------------------------------------------------------- */
function libSignature() {
  return [LibS.q, LibS.vol, LibS.tags.slice().sort().join(','), LibS.sort].join('|');
}

function libApplyFilters() {
  var all = libArticles();
  var q = LibS.q.trim().toLowerCase();
  var tags = LibS.tags;

  var list = all.filter(function (a) {
    if (LibS.vol && a.v !== LibS.vol) return false;
    for (var k = 0; k < tags.length; k++) {
      if (a.tags.indexOf(tags[k]) < 0) return false;   // 多选取交集
    }
    if (q && a.hay.indexOf(q) < 0) return false;
    return true;
  });

  if (LibS.sort === 'date') {
    list.sort(function (x, y) {
      var kx = window.MAO && MAO.dateKey ? MAO.dateKey(x.d) : 99999999;
      var ky = window.MAO && MAO.dateKey ? MAO.dateKey(y.d) : 99999999;
      return kx - ky || x.v - y.v || x.i - y.i;
    });
  } else if (LibS.sort === 'words') {
    list.sort(function (x, y) { return y.w - x.w || x.v - y.v || x.i - y.i; });
  }
  // default：保持卷→篇序

  LibS.list = list;
  LibS.shown = 0;
  LibS.lastSig = libSignature();
}

/* ------------------------------------------------------------
 * 七、hash 读写（示例：#/library?v=4&tag=群众路线&q=调查&a=4-12）
 * ---------------------------------------------------------- */
function libParams() {
  var h = window.location.hash || '';
  var qi = h.indexOf('?');
  if (qi < 0) return { _base: 'library' };
  var base = h.slice(0, qi).replace(/^#\/?/, '');
  var out = { _base: base || 'library' };
  h.slice(qi + 1).split('&').forEach(function (kv) {
    if (!kv) return;
    var p = kv.split('=');
    var k = decodeURIComponent(p[0] || '');
    var val = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
    if (k === 'tag') (out.tag = out.tag || []).push(val);   // 支持重复参数
    else out[k] = val;
  });
  return out;
}

/** 生成 hash；withA 决定是否把当前打开的文章写进去 */
function libHash(withA, v, i) {
  var p = [];
  if (LibS.vol) p.push('v=' + LibS.vol);
  if (LibS.sort && LibS.sort !== 'default') p.push('sort=' + LibS.sort);
  if (LibS.tags.length) p.push('tag=' + LibS.tags.map(encodeURIComponent).join(','));
  if (LibS.q) p.push('q=' + encodeURIComponent(LibS.q));
  if (withA) {
    var vv = v != null ? v : (LibS.cur ? LibS.cur.v : 0);
    var ii = i != null ? i : (LibS.cur ? LibS.cur.i : 0);
    if (vv) p.push('a=' + vv + '-' + ii);
  }
  return '#/library' + (p.length ? '?' + p.join('&') : '');
}

/** 筛选条件变化写回 URL：只替换当前历史条目，避免污染前进/后退 */
function libSyncHash() {
  var target = libHash(true);
  try {
    window.history.replaceState(null, '', target);
  } catch (e) { /* file:// 下可能受限，忽略即可 */ }
}

/* ------------------------------------------------------------
 * 八、列表渲染
 * ---------------------------------------------------------- */
function libItemHtml(a) {
  var c = libVolColor(a.v);
  var meta = [];
  meta.push(libEsc(libFmtDate(a.d)));
  meta.push(libFmtWords(a.w));
  var mh = '<span>' + meta[0] + '</span><span class="dot">·</span><span>' + meta[1] + '</span>';
  if (a.tags.length) {
    mh += (a.tags.slice(0, 4).map(function (t) {
      return '<span class="tag">' + libEsc(t) + '</span>';
    }).join(''));
  }
  return '<div class="lib-spine" style="--vc:' + c + '"></div>' +
    '<div class="lib-main">' +
    '<div class="lib-vn" style="--vc:' + c + '"><i></i>' + libEsc(a.volName) +
    '<em>第 ' + a.i + ' 篇</em></div>' +
    '<h3 class="lib-t">' + libEsc(a.t) + '</h3>' +
    '<div class="lib-meta">' + mh + '</div>' +
    (a.s ? '<p class="lib-sum">' + libEsc(a.s) + '</p>' : '') +
    '</div>';
}

function libRenderList(reset) {
  var listBox = LibS.listEl;
  var moreBox = LibS.moreEl;
  if (!listBox) return;

  if (reset) listBox.innerHTML = '';

  var total = LibS.list.length;

  // 结果条
  LibS.barEl.innerHTML =
    '找到 <b>' + total + '</b> 篇' +
    (LibS.q || LibS.vol || LibS.tags.length ? '（共 ' + LibS.all.length + ' 篇）' : '') +
    '<span class="sp"></span>' +
    (LibS.q || LibS.vol || LibS.tags.length || LibS.sort !== 'default'
      ? '<button class="btn btn-ghost" id="lib-clear" type="button">清除筛选</button>' : '');

  var clr = LibS.barEl.querySelector('#lib-clear');
  if (clr) clr.onclick = function () { libResetFilters(); };

  if (!total) {
    listBox.innerHTML = '<div class="card" style="text-align:center;padding:26px">' +
      '<div class="empty" style="padding:14px 0">没有符合条件的文章</div>' +
      '<div class="small muted">试试减少标签、换个关键词，或切换到全部卷次。</div></div>';
    moreBox.innerHTML = '';
    return;
  }

  // 分段追加
  var end = Math.min(LibS.shown + LIB_PAGE, total);
  if (end > LibS.shown) {
    var frag = document.createDocumentFragment();
    for (var k = LibS.shown; k < end; k++) {
      var a = LibS.list[k];
      var el = libEl('article', 'lib-item', libItemHtml(a));
      el.setAttribute('data-v', a.v);
      el.setAttribute('data-i', a.i);
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      frag.appendChild(el);
    }
    listBox.appendChild(frag);
    LibS.shown = end;
  }

  if (LibS.shown < total) {
    moreBox.innerHTML = '<button class="btn" id="lib-next" type="button">继续加载（还有 ' +
      (total - LibS.shown) + ' 篇）</button>';
    var nb = moreBox.querySelector('#lib-next');
    if (nb) nb.onclick = function () { libRenderList(false); };
  } else {
    moreBox.innerHTML = '<div class="lib-end">— 已显示全部 ' + total + ' 篇 —</div>';
  }
}

/** 卡片区事件委托：点击 / 回车进入详情 */
function libBindListEvents() {
  LibS.listEl.addEventListener('click', function (e) {
    var it = e.target.closest ? e.target.closest('.lib-item') : null;
    if (!it) return;
    libRequestOpen(parseInt(it.getAttribute('data-v'), 10), parseInt(it.getAttribute('data-i'), 10));
  });
  LibS.listEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var it = e.target.closest ? e.target.closest('.lib-item') : null;
    if (!it) return;
    e.preventDefault();
    libRequestOpen(parseInt(it.getAttribute('data-v'), 10), parseInt(it.getAttribute('data-i'), 10));
  });
}

/* ------------------------------------------------------------
 * 九、筛选交互
 * ---------------------------------------------------------- */
function libResetFilters() {
  LibS.q = ''; LibS.vol = 0; LibS.tags = []; LibS.sort = 'default';
  LibS.input.value = '';
  libRefreshUI();
  libApplyFilters();
  libRenderList(true);
  libSyncHash();
}

function libToggleTag(t) {
  var p = LibS.tags.indexOf(t);
  if (p >= 0) LibS.tags.splice(p, 1); else LibS.tags.push(t);
  libRefreshUI();
  libApplyFilters();
  libRenderList(true);
  libSyncHash();
}

function libRefreshUI() {
  // 卷胶囊
  Array.prototype.forEach.call(LibS.volRow.children, function (b) {
    b.classList.toggle('on', parseInt(b.getAttribute('data-v'), 10) === LibS.vol);
  });
  // 排序胶囊
  Array.prototype.forEach.call(LibS.sortRow.children, function (b) {
    b.classList.toggle('on', b.getAttribute('data-s') === LibS.sort);
  });
  // 标签云
  Array.prototype.forEach.call(LibS.cloudRow.children, function (b) {
    b.classList.toggle('on', LibS.tags.indexOf(b.getAttribute('data-t')) >= 0);
  });
}

function libBuildFilters() {
  var core = window.MAO_CORE || {};
  var vols = core.volumes || [];

  // 搜索框
  var search = libEl('div', 'lib-search');
  var input = libEl('input');
  input.type = 'search';
  input.placeholder = '检索篇名 / 摘要 / 标签，例如「调查」「群众路线」';
  input.setAttribute('aria-label', '检索文章');
  input.autocomplete = 'off';
  LibS.input = input;
  search.appendChild(input);

  var x = libEl('button', 'lib-clear-x', '×');
  x.type = 'button';
  x.setAttribute('aria-label', '清空关键词');
  x.onclick = function () { input.value = ''; LibS.q = ''; libApplyFilters(); libRenderList(true); libSyncHash(); input.focus(); };
  search.appendChild(x);

  input.addEventListener('input', libDebounce(function () {
    LibS.q = input.value || '';
    libApplyFilters();
    libRenderList(true);
    libSyncHash();
  }, 150));
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; LibS.q = ''; libApplyFilters(); libRenderList(true); libSyncHash(); }
  });

  // 卷筛选
  var volRow = libEl('div', 'lib-chips');
  LibS.volRow = volRow;
  var allBtn = libEl('button', 'lib-vchip', '全部');
  allBtn.type = 'button';
  allBtn.setAttribute('data-v', '0');
  allBtn.onclick = function () {
    LibS.vol = 0; libRefreshUI(); libApplyFilters(); libRenderList(true); libSyncHash();
  };
  volRow.appendChild(allBtn);
  vols.forEach(function (v) {
    var b = libEl('button', 'lib-vchip', '<span class="dot"></span>' + libEsc(v.name || libVolName(v.n)) +
      '<span class="n">' + (v.count || 0) + '</span>');
    b.type = 'button';
    b.style.setProperty('--vc', libVolColor(v.n));
    b.setAttribute('data-v', v.n);
    b.title = (v.era || '') + '（' + (v.span || '') + '）';
    b.onclick = function () {
      LibS.vol = LibS.vol === v.n ? 0 : v.n;
      libRefreshUI(); libApplyFilters(); libRenderList(true); libSyncHash();
    };
    volRow.appendChild(b);
  });

  // 排序
  var sortRow = libEl('div', 'lib-chips');
  LibS.sortRow = sortRow;
  [['default', '卷内顺序'], ['date', '按时间'], ['words', '按字数']].forEach(function (s) {
    var b = libEl('button', 'lib-vchip', s[1]);
    b.type = 'button';
    b.setAttribute('data-s', s[0]);
    b.onclick = function () {
      LibS.sort = s[0];
      libRefreshUI(); libApplyFilters(); libRenderList(true); libSyncHash();
    };
    sortRow.appendChild(b);
  });

  // 标签云
  var cloud = libEl('div', 'lib-cloud');
  LibS.cloudRow = cloud;
  var tags = libTagCloud();
  var maxN = tags.length ? tags[0].n : 1;
  var minN = tags.length ? tags[tags.length - 1].n : 1;
  tags.forEach(function (tg) {
    var r = maxN === minN ? 1 : (tg.n - minN) / (maxN - minN);
    var b = libEl('button', 'lib-tchip', libEsc(tg.t) + '<span class="n">' + tg.n + '</span>');
    b.type = 'button';
    b.setAttribute('data-t', tg.t);
    b.title = tg.t + ' · 出现 ' + tg.n + ' 次';
    // 频次越高：字号越大、颜色越深
    b.style.fontSize = (12 + Math.round(r * 3.5)) + 'px';
    b.style.color = tg.n >= 5 ? 'var(--red)' : (tg.n >= 3 ? 'var(--ink)' : 'var(--ink-2)');
    b.style.borderColor = tg.n >= 5 ? 'var(--red-soft)' : 'var(--line)';
    b.onclick = function () { libToggleTag(tg.t); };
    cloud.appendChild(b);
  });
  if (!tags.length) cloud.innerHTML = '<span class="small muted">暂无标签</span>';

  // 组装面板
  var panel = libEl('section', 'card lib-panel');
  panel.appendChild(libRow('检索', search));
  panel.appendChild(libRow('卷次', volRow));
  panel.appendChild(libRow('排序', sortRow));
  panel.appendChild(libRow('标签', cloud));
  return panel;
}

function libRow(label, ctrl) {
  var r = libEl('div', 'lib-row');
  r.appendChild(libEl('span', 'lib-lb', libEsc(label)));
  r.appendChild(ctrl);
  return r;
}

/** 从 hash 还原筛选条件（返回是否发生了变化） */
function libRestoreFilters() {
  var p = libParams();
  var tagRaw = (p.tag || []).join(',');
  var tags = tagRaw ? tagRaw.split(',').filter(Boolean) : [];
  var vol = parseInt(p.v, 10) || 0;
  var sort = ['default', 'date', 'words'].indexOf(p.sort) >= 0 ? p.sort : 'default';
  var q = p.q || '';
  if (vol === LibS.vol && sort === LibS.sort && q === LibS.q &&
    tags.join(',') === LibS.tags.join(',')) return false;
  LibS.vol = vol; LibS.sort = sort; LibS.q = q; LibS.tags = tags;
  if (LibS.input) LibS.input.value = q;
  return true;
}

/* ------------------------------------------------------------
 * 十、详情抽屉
 * ---------------------------------------------------------- */
function libEnsureDrawer() {
  if (LibS.drawerEl) return;

  var mask = libEl('div', 'lib-mask');
  document.body.appendChild(mask);
  mask.addEventListener('click', function () { libRequestClose(); });

  var drawer = libEl('aside', 'lib-drawer');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');

  var head = libEl('div', 'lib-dhead');
  var close = libEl('button', 'lib-dclose', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '关闭');
  close.onclick = function () { libRequestClose(); };
  head.appendChild(libEl('h2', 'lib-dtitle', ''));
  head.appendChild(libEl('div', 'lib-dmeta', ''));
  head.appendChild(close);

  var anchors = libEl('nav', 'lib-anchors');
  LIB_SECTIONS.forEach(function (s) {
    var b = libEl('button', '', s.t);
    b.type = 'button';
    b.setAttribute('data-k', s.k);
    b.onclick = function () { libScrollTo(s.k); };
    anchors.appendChild(b);
  });

  var body = libEl('div', 'lib-dbody');
  body.addEventListener('scroll', libDebounce(libSpyAnchors, 60), { passive: true });

  var foot = libEl('div', 'lib-dfoot');
  foot.innerHTML =
    '<button class="lib-navbtn" id="lib-prev" type="button"><span class="k">上一篇</span><span class="v">—</span></button>' +
    '<button class="lib-navbtn" id="lib-next-art" type="button" style="text-align:right">' +
    '<span class="k">下一篇</span><span class="v">—</span></button>';

  drawer.appendChild(head);
  drawer.appendChild(anchors);
  drawer.appendChild(body);
  drawer.appendChild(foot);
  document.body.appendChild(drawer);

  LibS.maskEl = mask;
  LibS.drawerEl = drawer;
  LibS.headEl = head;
  LibS.anchorEl = anchors;
  LibS.bodyEl = body;
  LibS.footEl = foot;

  foot.querySelector('#lib-prev').onclick = function () { libStep(-1); };
  foot.querySelector('#lib-next-art').onclick = function () { libStep(1); };
}

function libSkeleton() {
  return '<div class="skeleton" style="height:26px;width:52%;margin-bottom:16px"></div>' +
    '<div class="skeleton" style="height:96px;margin-bottom:12px"></div>' +
    '<div class="skeleton" style="height:96px;margin-bottom:12px"></div>' +
    '<div class="skeleton" style="height:150px;margin-bottom:12px"></div>' +
    '<div class="skeleton" style="height:96px"></div>';
}

/** 打开抽屉：由列表点击触发（push 一条历史，便于前进/后退关闭） */
function libRequestOpen(v, i) {
  var target = libHash(true, v, i);
  if (window.location.hash === target) { libOpenDrawer(v, i); return; }
  LibS.pushed = true;
  window.location.hash = target;   // hashchange -> libOpenDrawer
  // 兜底：个别环境下 hash 未触发 hashchange
  requestAnimationFrame(function () {
    if (!LibS.cur || LibS.cur.v !== v || LibS.cur.i !== i) libOpenDrawer(v, i);
  });
}

/** 关闭抽屉（用户点击关闭 / ESC / 遮罩） */
function libRequestClose() {
  if (LibS.pushed) {
    LibS.pushed = false;
    var before = window.location.hash;
    window.history.back();     // 回退到没有 a 参数的条目 -> hashchange -> libCloseDrawer
    setTimeout(function () {
      // 没有可回退的历史时兜底直接关闭
      if (LibS.cur && window.location.hash === before) libHardClose();
    }, 120);
    return;
  }
  libHardClose();
}

/** 无历史可回退时的直接关闭：改写当前地址后收起 */
function libHardClose() {
  LibS.pushed = false;
  try {
    window.history.replaceState(null, '', libHash(false));
  } catch (e) { /* 忽略 */ }
  libCloseDrawer();
}

/** 真正渲染并滑出抽屉 */
function libOpenDrawer(v, i) {
  libEnsureDrawer();
  LibS.cur = { v: v, i: i };
  LibS.text = '';          // 清空上一篇的原文
  LibS.textBlocks = null;  // 段落缓存失效

  var art = null;
  libArticles().forEach(function (a) { if (a.v === v && a.i === i) art = a; });
  LibS.drawerEl.querySelector('.lib-dtitle').textContent = art ? art.t : '';

  var metas = [];
  metas.push('<span class="vb" style="background:' + libVolColor(v) + '">' + libEsc(libVolName(v)) + '</span>');
  metas.push('<span>第 ' + i + ' 篇</span>');
  metas.push('<span>' + libEsc(libFmtDate(art ? art.d : '')) + '</span>');
  metas.push('<span>' + libFmtWords(art ? art.w : 0) + '</span>');
  if (art && art.era) metas.push('<span>' + libEsc(art.era) + '</span>');
  LibS.drawerEl.querySelector('.lib-dmeta').innerHTML = metas.join('');

  LibS.bodyEl.innerHTML = libSkeleton();
  LibS.bodyEl.scrollTop = 0;
  LibS.maskEl.classList.add('on');
  LibS.drawerEl.classList.add('on');
  document.documentElement.classList.add('lib-locked');

  libSetAnchors('digest');
  libFillFoot();

  var tk = ++LibS.token;
  var draw = function (d) {
    if (tk !== LibS.token) return;   // 竞态保护
    libFillBody(v, i, d, art);
  };

  var key = v + '-' + i;
  if (LibS.cache[key]) { draw(LibS.cache[key]); return; }
  LibS.cache[key] = null;
  MAO.vol(v).then(function (d) {
    var data = { ev: (d && d.ev && d.ev[i]) || {}, tx: (d && d.tx && d.tx[i]) || '' };
    LibS.cache[key] = data;
    draw(data);
  }).catch(function (err) {
    if (tk !== LibS.token) return;
    LibS.bodyEl.innerHTML = '<div class="empty">本篇解析数据加载失败，请稍后重试。</div>';
    console.error('[library] 卷数据加载失败', err);
  });
}

function libCloseDrawer() {
  LibS.cur = null;
  LibS.token++;
  if (LibS.drawerEl) {
    LibS.drawerEl.classList.remove('on');
    LibS.maskEl.classList.remove('on');
  }
  document.documentElement.classList.remove('lib-locked');
}

/** 主导：hash 变化后的统一处理 */
function libOnHash() {
  if (!LibS.ready) return;
  var p = libParams();
  if (p._base !== 'library') { libCloseDrawer(); return; }

  var changed = libRestoreFilters();
  if (changed || LibS.lastSig !== libSignature()) {
    libRefreshUI();
    libApplyFilters();
    libRenderList(true);
  }

  var aid = p.a ? String(p.a).split('-') : null;
  var v = aid ? parseInt(aid[0], 10) : 0;
  var i = aid ? parseInt(aid[1], 10) : 0;
  if (v && i) {
    if (!LibS.cur || LibS.cur.v !== v || LibS.cur.i !== i) libOpenDrawer(v, i);
  } else if (LibS.cur) {
    LibS.pushed = false;
    libCloseDrawer();
  }
}

/** 填充详情主体（数据到手后） */
function libFillBody(v, i, data, art) {
  var ev = data.ev || {};
  var tx = data.tx || '';
  LibS.textState = { size: 'md', full: false };

  var html = '';

  /* 1. 三分钟速读 */
  html += '<section class="lib-sec" id="lib-sec-digest"><h3 class="lib-sech">三分钟速读</h3>';
  var dg = ev.digest || {};
  var keys = LIB_DIGEST_KEYS.filter(function (k) { return dg[k]; });
  Object.keys(dg).forEach(function (k) { if (keys.indexOf(k) < 0 && dg[k]) keys.push(k); });
  if (!keys.length) {
    html += '<div class="empty" style="padding:24px 0">本篇暂无速读内容</div>';
  } else {
    html += '<div class="lib-qas">';
    keys.forEach(function (k) {
      html += '<div class="card lib-qa"><div class="qq">' + libEsc(k) + '</div>' +
        '<div class="aa">' + libMd(dg[k]) + '</div></div>';
    });
    html += '</div>';
  }
  html += '</section>';

  /* 2. 文章结构 */
  html += libSection('structure', '文章结构', libMd(ev.structure), '本篇暂无结构解析');

  /* 3. 关键论证 */
  html += libSection('arguments', '关键论证与证据', libMd(ev.arguments), '本篇暂无论证梳理');

  /* 4. 核心概念 / 方法候选 */
  var cm = '';
  if (ev.concepts) cm += '<h4 style="font-family:var(--serif);font-size:15px;margin:0 0 10px;color:var(--ink)">核心概念</h4>' + libMd(ev.concepts);
  if (ev.methods) {
    cm += (cm ? '<div style="height:18px"></div>' : '') +
      '<h4 style="font-family:var(--serif);font-size:15px;margin:0 0 10px;color:var(--ink)">双层方法候选</h4>' + libMd(ev.methods);
  }
  if (ev.methodStruct) {
    cm += '<div class="lib-methodnote"><b>方法结构说明：</b>' + libMd(ev.methodStruct) + '</div>';
  }
  html += libSection('concepts', '核心概念 / 方法', cm, '本篇暂无概念与方法提炼');

  /* 5. 原文 */
  html += '<section class="lib-sec" id="lib-sec-text"><h3 class="lib-sech">原文</h3>';
  if (!tx) {
    html += '<div class="empty" style="padding:24px 0">暂无原文</div></section>';
  } else {
    html += '<div class="lib-tbar">' +
      '<span class="lb">字号</span>' +
      '<span class="lib-sz">' +
      '<button type="button" data-sz="sm">小</button>' +
      '<button type="button" data-sz="md" class="on">中</button>' +
      '<button type="button" data-sz="lg">大</button>' +
      '</span>' +
      '<span style="flex:1"></span>' +
      '<button class="btn btn-ghost" type="button" id="lib-totop">↑ 回到顶部</button>' +
      '</div>' +
      '<div class="lib-para" data-size="md" id="lib-para"></div>' +
      '<div id="lib-morebox"></div>';
    html += '</section>';
  }

  LibS.bodyEl.innerHTML = html;

  // 原文懒渲染
  if (tx) {
    LibS.text = tx;
    libRenderText(false);
    var tb = LibS.bodyEl.querySelector('.lib-tbar');
    tb.addEventListener('click', function (e) {
      var sz = e.target.getAttribute && e.target.getAttribute('data-sz');
      if (sz) libSetTextSize(sz);
      if (e.target.id === 'lib-totop') libDrawerTop();
    });
  }
}

function libSection(k, title, bodyHtml, emptyText) {
  return '<section class="lib-sec" id="lib-sec-' + k + '">' +
    '<h3 class="lib-sech">' + libEsc(title) + '</h3>' +
    (bodyHtml ? '<div class="md">' + bodyHtml + '</div>'
      : '<div class="empty" style="padding:24px 0">' + libEsc(emptyText) + '</div>') +
    '</section>';
}

/* ---------- 原文渲染 ---------- */
function libTextBlocks() {
  if (LibS.textBlocks) return LibS.textBlocks;
  var raw = String(LibS.text || '').replace(/\r\n?/g, '\n');
  LibS.textBlocks = raw.split(/\n{2,}/).map(function (s) { return s.trim(); })
    .filter(function (s) { return !!s; });
  return LibS.textBlocks;
}

function libBlockHtml(s) {
  var h = libEsc(s).replace(/\n/g, '<br>');
  // [P012] 引用标记 -> 徽标（与正文风格一致）
  h = h.replace(/\[((?:Pp?\d{3})(?:[–\-—][Pp]?\d{3})?(?:\s*[、,，]\s*[Pp]?\d{3}(?:[–\-—][Pp]?\d{3})?)*)\]/g,
    function (m, p) { return '<span class="pmark">' + p + '</span>'; });
  return '<p>' + h + '</p>';
}

function libRenderText(full) {
  var blocks = libTextBlocks();
  var box = LibS.bodyEl.querySelector('#lib-para');
  var moreBox = LibS.bodyEl.querySelector('#lib-morebox');
  if (!box) return;

  var cut = blocks.length, acc = 0;
  if (!full) {
    for (var k = 0; k < blocks.length; k++) {
      acc += blocks[k].length;
      if (acc > LIB_PREVIEW) { cut = k + 1; break; }
    }
  }
  var shownBlocks = full ? blocks : blocks.slice(0, cut);
  box.innerHTML = shownBlocks.map(function (b, idx) {
    return idx === 0 ? libBlockHtml(b).replace('<p>', '<p class="first">') : libBlockHtml(b);
  }).join('');
  box.setAttribute('data-size', LibS.textState.size);

  if (!full && cut < blocks.length) {
    var rest = 0;
    for (var m = cut; m < blocks.length; m++) rest += blocks[m].length;
    moreBox.innerHTML = '<button class="btn btn-primary lib-readmore" type="button" id="lib-readall">继续阅读全文（剩余 ' +
      libFmtWords(rest) + '）</button>';
    moreBox.querySelector('#lib-readall').onclick = function () {
      LibS.textState.full = true;
      libRenderText(true);
    };
  } else {
    moreBox.innerHTML = '<div class="lib-end">— 全文完 —</div>';
  }
}

function libSetTextSize(sz) {
  LibS.textState.size = sz;
  var box = LibS.bodyEl.querySelector('#lib-para');
  if (box) box.setAttribute('data-size', sz);
  Array.prototype.forEach.call(LibS.bodyEl.querySelectorAll('.lib-sz button'), function (b) {
    b.classList.toggle('on', b.getAttribute('data-sz') === sz);
  });
}

function libDrawerTop() {
  LibS.bodyEl.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- 锚点导航 ---------- */
function libScrollTo(k) {
  var sec = LibS.bodyEl.querySelector('#lib-sec-' + k);
  if (!sec) return;
  LibS.bodyEl.scrollTo({ top: Math.max(0, sec.offsetTop - 8), behavior: 'smooth' });
  libSetAnchors(k);
}

function libSetAnchors(k) {
  Array.prototype.forEach.call(LibS.anchorEl.children, function (b) {
    b.classList.toggle('on', b.getAttribute('data-k') === k);
  });
}

function libSpyAnchors() {
  if (!LibS.bodyEl) return;
  var top = LibS.bodyEl.scrollTop + 90;
  var cur = LIB_SECTIONS[0].k;
  LIB_SECTIONS.forEach(function (s) {
    var sec = LibS.bodyEl.querySelector('#lib-sec-' + s.k);
    if (sec && sec.offsetTop <= top) cur = s.k;
  });
  libSetAnchors(cur);
}

/* ---------- 上一篇 / 下一篇 ---------- */
function libIndexOf(v, i) {
  for (var k = 0; k < LibS.list.length; k++) {
    if (LibS.list[k].v === v && LibS.list[k].i === i) return k;
  }
  return -1;
}

function libFillFoot() {
  if (!LibS.footEl || !LibS.cur) return;
  // 兜底：当前篇不在筛选结果内时（跨模块跳转），用全库顺序
  var pool = LibS.list.length ? LibS.list : LibS.all;
  var pos = libIndexOf(LibS.cur.v, LibS.cur.i);
  if (pos < 0) {
    for (var k = 0; k < LibS.all.length; k++) {
      if (LibS.all[k].v === LibS.cur.v && LibS.all[k].i === LibS.cur.i) pos = k;
    }
    pool = LibS.all;
  }
  var prev = pool[pos - 1], next = pool[pos + 1];
  var pv = LibS.footEl.querySelector('#lib-prev');
  var nx = LibS.footEl.querySelector('#lib-next-art');
  pv.disabled = !prev;
  nx.disabled = !next;
  pv.querySelector('.v').textContent = prev ? prev.t : '没有了';
  nx.querySelector('.v').textContent = next ? next.t : '没有了';
}

function libStep(dir) {
  if (!LibS.cur) return;
  var pool = LibS.list.length ? LibS.list : LibS.all;
  var pos = libIndexOf(LibS.cur.v, LibS.cur.i);
  if (pos < 0) {
    for (var k = 0; k < LibS.all.length; k++) {
      if (LibS.all[k].v === LibS.cur.v && LibS.all[k].i === LibS.cur.i) pos = k;
    }
    pool = LibS.all;
  }
  var target = pool[pos + dir];
  if (!target) return;
  // 上下篇沿用当前历史条目，避免前进/后退堆积
  LibS.pushed = false;
  try {
    window.history.replaceState(null, '', libHash(true, target.v, target.i));
  } catch (e) { /* 忽略 */ }
  LibS.cur = null;
  libOpenDrawer(target.v, target.i);
}

/* ------------------------------------------------------------
 * 十一、模块入口
 * ---------------------------------------------------------- */
function libRender(body, head, q) {
  libEnsureCss();
  libArticles();

  // 已经在页面上（app.js 只在路由 id 变化时重建，这里做幂等保护）
  if (LibS.ready && LibS.root && LibS.root.isConnected) {
    libOnHash();
    return;
  }

  LibS.root = body;
  LibS.head = head;
  LibS.ready = true;

  // 页头
  if (head) {
    head.innerHTML = '<h2>文章阅览室 <span class="en">Library</span></h2>' +
      '<p>五卷共 ' + LibS.all.length + ' 篇。按卷次、时期、标签或关键词定位篇目，' +
      '进入后可读三分钟速读、结构、论证、概念方法与原文全文。</p>';
  }

  // 主体
  var wrap = libEl('div', 'lib-wrap');
  var panel = libBuildFilters();
  wrap.appendChild(panel);

  LibS.barEl = libEl('div', 'lib-bar');
  wrap.appendChild(LibS.barEl);

  LibS.listEl = libEl('div', 'lib-list');
  wrap.appendChild(LibS.listEl);

  LibS.moreEl = libEl('div', 'lib-more');
  wrap.appendChild(LibS.moreEl);

  body.appendChild(wrap);
  libBindListEvents();

  // 从 URL 还原筛选 / 直接打开某篇
  libRestoreFilters();
  libRefreshUI();
  libApplyFilters();

  // 首屏先出一帧加载提示，避免 200+ 篇同步构建造成卡顿
  LibS.listEl.innerHTML = '<div class="card" style="text-align:center;padding:30px">' +
    '<div class="muted">正在整理目录…</div></div>';
  requestAnimationFrame(function () {
    libRenderList(true);
    libWatchMore();
    libOnHash();
  });
}

/** 滚动到底自动追加（IntersectionObserver，不支持则退化为按钮加载） */
function libWatchMore() {
  if (LibS.io) { try { LibS.io.disconnect(); } catch (e) { } }
  if (!window.IntersectionObserver) return;
  LibS.io = new IntersectionObserver(function (entries) {
    if (!entries.length || !entries[0].isIntersecting) return;
    if (LibS.shown < LibS.list.length) libRenderList(false);
  }, { rootMargin: '400px 0px' });
  LibS.io.observe(LibS.moreEl);
}

/* 全局监听：hash 驱动抽屉开合、ESC 关闭 */
window.addEventListener('hashchange', function () { libOnHash(); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && LibS.cur) {
    e.stopPropagation();
    libRequestClose();
  }
});

/* ------------------------------------------------------------
 * 十二、注册
 * ---------------------------------------------------------- */
window.Modules = window.Modules || {};
window.Modules.library = {
  id: 'library',
  title: '文章阅览室',
  render: libRender,
  // MAO.openArticle 会优先调用它（见 app.js）
  open: function (v, i) {
    if (LibS.ready && LibS.root && LibS.root.isConnected) { libRequestOpen(v, i); return; }
    // 尚未挂载：先切到阅览室，带上 a 参数，挂载后由 libOnHash 打开
    var target = libHash(true, v, i);
    if (window.MAO && typeof MAO.go === 'function') MAO.go(target);
    else window.location.hash = target;
  }
};
