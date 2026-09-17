/* 冒烟测试：用 jsdom 加载站点，逐个渲染视图，捕获异常与 console 错误 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require(
  path.join('C:/Users/Iovoeyl/.workbuddy/binaries/node/workspace/node_modules/jsdom')
);

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const logs = [];

const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
vc.on('warn', (...a) => logs.push('warn: ' + a.join(' ')));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  // 去掉外链资源引入，改为手动注入
  .replace(/<script src="[^"]+"><\/script>/g, '')
  .replace(/<link[^>]*>/g, '');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole: vc,
});

const { window } = dom;
// jsdom 缺少的 API 补齐
window.scrollTo = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
window.requestAnimationFrame = cb => setTimeout(cb, 0);
window.navigator.clipboard = { writeText: () => Promise.resolve() };

function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  try {
    window.eval(code);
  } catch (e) {
    errors.push('加载 ' + rel + ' 失败: ' + e.message);
  }
}

['data/core.js', 'js/app.js', 'js/mod-overview.js', 'js/mod-timeline.js',
 'js/mod-library.js', 'js/mod-methods.js', 'js/mod-concepts.js'].forEach(f => {
  if (fs.existsSync(path.join(ROOT, f))) load(f);
  else logs.push('缺失文件: ' + f);
});

// 手动触发 boot（app.js 在 DOMContentLoaded 或立即执行；jsdom 下重新执行一次路由）
const results = [];
function renderView(id, q) {
  const before = errors.length;
  window.location.hash = '#/' + id;
  try {
    window.MAO.route();
  } catch (e) {
    errors.push('渲染 ' + id + ' 抛错: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
    results.push({ id, ok: false, note: '抛错: ' + e.message });
    return;
  }
  const view = window.document.querySelector('#view');
  const nodes = view ? view.querySelectorAll('*').length : 0;
  const text = view ? view.textContent.trim().slice(0, 70) : '';
  const newErr = errors.length - before;
  results.push({ id, ok: newErr === 0 && nodes > 5, nodes, note: text.replace(/\s+/g, ' ') });
}

// 等待 app.js 的 boot 完成后再逐个渲染
setTimeout(() => {
  const mods = Object.keys(window.Modules || {});
  results.push({ id: '[已注册模块]', ok: true, nodes: mods.length, note: mods.join(', ') });

  ['overview', 'timeline', 'library', 'methods', 'glossary', 'quotes', 'digest'].forEach(m => {
    if (window.Modules[m]) renderView(m);
    else results.push({ id: m, ok: false, nodes: 0, note: '模块未注册' });
  });

  console.log('\n================ 冒烟测试结果 ================');
  results.forEach(r => {
    console.log(`${r.ok ? '  OK  ' : ' FAIL '} ${String(r.id).padEnd(16)} 节点数:${String(r.nodes).padEnd(6)} ${r.note}`);
  });
  console.log('\n---------------- console 错误 ----------------');
  if (!errors.length) console.log('  无');
  else errors.forEach(e => console.log('  ✗ ' + e));
  if (logs.length) {
    console.log('\n---------------- 提示 ----------------');
    logs.slice(0, 10).forEach(l => console.log('  · ' + l));
  }
  const fail = results.filter(r => !r.ok).length;
  console.log('\n结果: ' + (results.length - fail) + '/' + results.length + ' 通过，错误 ' + errors.length + ' 条\n');
  process.exit(fail || errors.length ? 1 : 0);
}, 300);
