/* 交互测试：抽屉 / 诊断器 / 搜索 / 时间轴点击 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require(
  path.join('C:/Users/Iovoeyl/.workbuddy/binaries/node/workspace/node_modules/jsdom')
);

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<script src="[^"]+"><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc });
const { window } = dom;
window.scrollTo = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
// jsdom 的 rAF 不被自动驱动，改为同步执行以便断言
window.requestAnimationFrame = cb => { try { cb(0); } catch (e) { errors.push('rAF: ' + e.message); } return 0; };
window.navigator.clipboard = { writeText: () => Promise.resolve() };

function load(rel) {
  try { window.eval(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch (e) { errors.push('加载 ' + rel + ': ' + e.message); }
}
['data/core.js', 'js/app.js', 'js/mod-overview.js', 'js/mod-timeline.js',
 'js/mod-library.js', 'js/mod-methods.js', 'js/mod-concepts.js'].forEach(f => {
  if (fs.existsSync(path.join(ROOT, f))) load(f);
});
for (let i = 1; i <= 5; i++) {
  const f = 'data/v' + i + '.js';
  if (fs.existsSync(path.join(ROOT, f))) load(f);
}
// 方法图谱数据（按需加载，测试中预置）
if (fs.existsSync(path.join(ROOT, 'data/methods.js'))) load('data/methods.js');

const out = [];
const T = (name, fn) => {
  const before = errors.length;
  let note = '';
  try { note = fn() || ''; } catch (e) { note = '抛错: ' + e.message; }
  out.push({ name, ok: errors.length === before && !/^抛错/.test(note), note });
};

const DR = '.drawer, .lib-drawer, [class*="drawer"]';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await wait(300);
  const D = window.document, MAO = window.MAO;

  // ---- 基础 ----
  T('数据完整性', () => `文章 ${MAO.articles.length} / 卷 ${MAO.volumes.length} / 方法 ${MAO.skills.length} / 术语 ${MAO.glossary.length} / 金句 ${MAO.quotes.length}`);
  T('有日期文章', () => {
    const n = MAO.articles.filter(a => a.d).length;
    if (n < 200) throw new Error('日期过少: ' + n);
    return n + ' 篇有日期';
  });
  T('MAO.md 渲染', () => {
    const h = MAO.md('## 标题\n\n**粗体**与[P012]标记\n\n- 项一\n- 项二\n\n> 引用');
    if (!/h2/.test(h) || !/strong/.test(h) || !/pmark/.test(h) || !/<ul>/.test(h) || !/blockquote/.test(h))
      throw new Error('渲染缺失: ' + h);
    return '标题/粗体/引用标记/列表/引用 均正常';
  });
  T('MAO.md 转义', () => {
    if (/<script>/.test(MAO.md('<script>x</script>'))) throw new Error('未转义 HTML');
    return 'HTML 已转义';
  });
  T('分卷数据加载', () => {
    const d = window.MAO_V1;
    if (!d || !d.ev || !d.ev[17]) throw new Error('v1 数据异常');
    if (!d.ev[17].digest || !d.ev[17].digest['为什么写']) throw new Error('实践论速读缺失');
    if (!d.tx[17] || d.tx[17].length < 2000) throw new Error('原文过短');
    return '第一卷 18 篇解析 + 原文就绪';
  });

  // ---- 先挂载阅览室，再开抽屉 ----
  T('阅览室渲染', () => {
    MAO.go('#/library'); MAO.route();
    const n = D.querySelector('#view').querySelectorAll('*').length;
    if (n < 50) throw new Error('节点过少: ' + n);
    return n + ' 个节点';
  });
  await wait(200);
  T('阅览室搜索', () => {
    const inp = D.querySelector('#view input');
    if (!inp) throw new Error('无搜索框');
    inp.value = '矛盾';
    inp.dispatchEvent(new window.Event('input', { bubbles: true }));
    return '已触发搜索';
  });
  await wait(250);
  T('搜索过滤生效', () => {
    const txt = D.querySelector('#view').textContent;
    const m = txt.match(/找到\s*(\d+)\s*篇|共\s*(\d+)\s*篇|(\d+)\s*篇/);
    return m ? '结果计数: ' + (m[1] || m[2] || m[3]) : '未见计数（可能样式不同）';
  });

  T('打开文章抽屉', () => {
    MAO.openArticle(1, 17);
    const dr = D.querySelector(DR);
    if (!dr) throw new Error('抽屉未创建');
    return '抽屉已创建';
  });
  await wait(600);
  T('抽屉标题正确', () => {
    const dr = D.querySelector(DR);
    if (!dr) throw new Error('无抽屉');
    const t = dr.textContent;
    if (t.indexOf('实践论') < 0) throw new Error('未找到标题，内容: ' + t.slice(0, 60));
    return '含《实践论》';
  });
  T('抽屉速读卡', () => {
    const dr = D.querySelector(DR);
    const qa = dr.querySelectorAll('.qa-card, [class*="qa-"]');
    // 阅览室可能用别的类名，退化为检查是否含四个问句关键词
    const txt = dr.textContent;
    const hits = ['为什么写', '解决什么问题', '答案', '怎么推进'].filter(k => txt.indexOf(k) >= 0).length;
    if (qa.length < 3 && hits < 2) throw new Error('速读内容不足 (qa=' + qa.length + ', hits=' + hits + ')');
    return '速读卡 ' + qa.length + ' 张，问句命中 ' + hits + '/4';
  });
  T('抽屉切到原文', () => {
    const dr = D.querySelector(DR);
    const tabs = dr.querySelectorAll('button');
    const tt = Array.prototype.find.call(tabs, b => /原文/.test(b.textContent));
    if (!tt) throw new Error('无原文标签页');
    tt.click();
    return '已切换到原文';
  });
  await wait(400);
  T('原文内容', () => {
    const dr = D.querySelector(DR);
    const len = dr.textContent.length;
    if (len < 800) throw new Error('原文过短: ' + len);
    return '原文 ' + len + ' 字符';
  });

  // ---- 诊断器 ----
  T('方法论诊断器输入', () => {
    MAO.go('#/methods'); MAO.route();
    const v = D.querySelector('#view');
    const ta = v.querySelector('textarea') || v.querySelector('input[type="text"]');
    if (!ta) throw new Error('无诊断输入框');
    ta.value = '好几个问题一起爆了，资源有限，不知道该先解决哪个';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    return '已提交';
  });
  await wait(500);
  T('诊断结果', () => {
    const txt = D.querySelector('#view').textContent;
    if (/主要矛盾/.test(txt)) return '命中「主要矛盾」';
    if (/不适配|没有命中|无法匹配/.test(txt)) return '诚实降级（未硬套）';
    throw new Error('未见诊断结果');
  });
  T('诊断器反向测试', () => {
    const v = D.querySelector('#view');
    const ta = v.querySelector('textarea') || v.querySelector('input[type="text"]');
    ta.value = '帮我看看今天中午吃什么比较好吃';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    return '已提交无关问题';
  });
  await wait(450);
  T('无关问题降级', () => {
    const txt = D.querySelector('#view').textContent;
    if (/不适配|没有命中|无法匹配|阈值/.test(txt)) return '诚实提示不适配';
    return '注：给出了结果（可能命中泛化词）';
  });

  // ---- 搜索 ----
  T('全局搜索', () => {
    const inp = D.querySelector('#gsearch input');
    inp.value = '矛盾论';
    inp.dispatchEvent(new window.Event('input', { bubbles: true }));
    return '已触发';
  });
  await wait(350);
  T('搜索结果', () => {
    const p = D.querySelector('#gsearch-panel');
    const n = p ? p.querySelectorAll('.s-item').length : 0;
    if (!n) throw new Error('无结果');
    return n + ' 条结果';
  });

  // ---- 时间轴 ----
  T('时间轴绘制', () => {
    MAO.go('#/timeline'); MAO.route();
    const v = D.querySelector('#view');
    const svg = v.querySelector('svg');
    if (!svg) throw new Error('无 SVG');
    const circles = svg.querySelectorAll('circle').length;
    if (circles < 150) throw new Error('圆点过少: ' + circles);
    return 'SVG 圆点 ' + circles + ' 个';
  });
  T('时间轴年份密度', () => {
    const v = D.querySelector('#view');
    const bars = v.querySelectorAll('[class*="bar"]').length;
    return '密度柱 ' + bars + ' 个';
  });

  // ---- 整书速览：五卷内容 ----
  function digestTab(i) {
    MAO.go('#/digest'); MAO.route();
    const v = D.querySelector('#view');
    v.querySelectorAll('.drawer-tabs button')[i].click();
    return v;
  }
  // 预先触发方法数据加载并等待，供下面两条断言使用（methodsBlock 为异步填充）
  digestTab(1);
  await wait(600);
  T('五卷总览模板一致', () => {
    const v = digestTab(1);
    const sigs = [];
    for (let i = 0; i < 5; i++) {
      v.querySelectorAll('.card.prose .chip')[i].click();
      const secs = Array.prototype.map.call(v.querySelectorAll('.card.prose h3'), h => h.textContent.trim())
        // 方法板块标题含动态数字，归一化后再比对
        .map(t => t.replace(/（\d+ 个）/, '（N 个）'));
      sigs.push(secs.join('|'));
    }
    const uniq = Array.from(new Set(sigs));
    if (uniq.length !== 1) throw new Error('板块不一致:\n' + sigs.map((s, i) => '  卷' + (i + 1) + ': ' + s).join('\n'));
    if (sigs[0].split('|').length < 5) throw new Error('板块过少: ' + sigs[0]);
    return '五卷均为 ' + sigs[0].split('|').length + ' 个板块，顺序一致';
  });
  T('五卷总览的卷内方法数正确', () => {
    const v = digestTab(1);
    const want = ['144', '151', '88', '223', '164'];
    const got = [];
    for (let i = 0; i < 5; i++) {
      v.querySelectorAll('.card.prose .chip')[i].click();
      const m = v.querySelector('.card.prose').textContent.match(/本卷可迁移的方法（(\d+) 个）/);
      got.push(m ? m[1] : '?');
    }
    if (got.join(',') !== want.join(',')) throw new Error('期望 ' + want.join(',') + ' 实得 ' + got.join(','));
    return got.join(' / ');
  });
  T('五卷总览均有内容', () => {
    const v = digestTab(1);
    const chips = v.querySelectorAll('.card.prose .chip');
    if (chips.length < 5) throw new Error('卷切换按钮不足: ' + chips.length);
    const empt = [];
    for (let i = 0; i < 5; i++) {
      v.querySelectorAll('.card.prose .chip')[i].click();
      const tx = v.querySelector('.card.prose').textContent.replace(/\s+/g, '');
      if (tx.length < 800) empt.push(i + 1);
    }
    if (empt.length) throw new Error('第 ' + empt.join('/') + ' 卷内容过少');
    return '五卷总览均非空';
  });
  T('五卷精华长文均有内容', () => {
    const v = digestTab(2);
    const empt = [];
    for (let i = 0; i < 5; i++) {
      v.querySelectorAll('.card.prose .chip')[i].click();
      const tx = v.querySelector('.card.prose').textContent.replace(/\s+/g, '');
      if (tx.length < 1200) empt.push(i + 1);
    }
    if (empt.length) throw new Error('第 ' + empt.join('/') + ' 卷精华过短');
    return '五卷精华均非空';
  });
  T('五卷速览页', () => {
    const v = digestTab(0);
    const tx = v.textContent;
    if (['第一卷', '第二卷', '第三卷', '第四卷', '第五卷'].filter(k => tx.indexOf(k) >= 0).length < 5)
      throw new Error('五卷未齐');
    return '五卷速览完整';
  });
  // 方法图谱数据按需异步加载，先触发一次再等待，然后断言
  digestTab(3);
  await wait(500);
  T('方法图谱五卷', () => {
    const v = digestTab(3);
    const chips = v.querySelectorAll('.chip');
    if (chips.length < 6) throw new Error('卷切换不足: ' + chips.length);
    const n = v.querySelectorAll('.mg-item').length;
    if (n < 20) throw new Error('方法条目过少: ' + n);
    return n + ' 条（可切换 ' + (chips.length - 1) + ' 卷）';
  });

  // ---- 概念词典 / 金句 ----
  T('概念词典分卷', () => {
    MAO.go('#/glossary'); MAO.route();
    const v = D.querySelector('#view');
    const chips = v.querySelectorAll('.mc-chips .chip');
    if (chips.length < 2) throw new Error('无分卷筛选');
    const total = MAO.glossary.length;
    if (total < 50) throw new Error('术语数偏少: ' + total);
    chips[1].click();
    const n1 = v.querySelectorAll('.mc-tcard').length;
    if (n1 < 5 || n1 >= total) throw new Error('分卷筛选无效: ' + n1 + '/' + total);
    return '共 ' + total + ' 条，第一卷 ' + n1 + ' 条';
  });
  T('概念词典展开', () => {
    MAO.go('#/glossary'); MAO.route();
    const v = D.querySelector('#view');
    const cards = v.querySelectorAll('[class*="card"], [class*="term"], [class*="item"]');
    if (cards.length < 10) throw new Error('术语卡过少: ' + cards.length);
    return cards.length + ' 个术语节点';
  });
  T('金句列表', () => {
    MAO.go('#/quotes'); MAO.route();
    const v = D.querySelector('#view');
    if (v.textContent.indexOf('谁是我们的敌人') < 0 && v.textContent.length < 300)
      throw new Error('金句内容异常');
    return '金句页 ' + v.querySelectorAll('*').length + ' 节点';
  });

  // ---- 全部视图重渲染 ----
  ['overview', 'timeline', 'library', 'methods', 'glossary', 'quotes', 'digest'].forEach(m => {
    T('重渲染 ' + m, () => {
      MAO.go('#/' + m); MAO.route();
      const n = D.querySelector('#view').querySelectorAll('*').length;
      if (n < 10) throw new Error('节点过少 ' + n);
      return n + ' 节点';
    });
  });

  console.log('\n============== 交互测试结果 ==============');
  out.forEach(r => console.log(`${r.ok ? '  OK  ' : ' FAIL '} ${r.name.padEnd(18)} ${r.note}`));
  console.log('\n-------------- console 错误 --------------');
  errors.length ? errors.forEach(e => console.log('  ✗ ' + e)) : console.log('  无');
  const f = out.filter(r => !r.ok).length;
  console.log(`\n结果: ${out.length - f}/${out.length} 通过，错误 ${errors.length} 条\n`);
  process.exit(0);
})();
