import test from 'node:test';
import assert from 'node:assert/strict';
import { TERMS, CATEGORIES, CONF } from '../js/glossary.js';
import { search, norm, makeCustom } from '../js/glossary-search.js';

test('詞庫資料完整性', () => {
  const ids = new Set();
  for (const t of TERMS) {
    assert.ok(!ids.has(t.id), `重複 id ${t.id}`); ids.add(t.id);
    assert.ok(CATEGORIES.includes(t.cat), `${t.ja}: 分類 ${t.cat}`);
    assert.ok(t.ja.trim(), 'ja 空白');
    if (t.ja === '—') assert.equal(t.kana, '', '「無直接對應」不應有假名');
    else assert.match(t.kana, /^[ぁ-ゖー・／]+$/, `${t.ja}: 假名要用平假名 → ${t.kana}`);
    assert.ok(Array.isArray(t.slang) && Array.isArray(t.links) && Array.isArray(t.alias), `${t.ja}: slang/links/alias`);
    for (const l of t.links) assert.ok(l.label && (l.disabled || /^#\//.test(l.href)), `${t.ja}: link`);
    assert.ok(Array.isArray(t.tw) && t.tw.length > 0 && t.tw.every((x) => x.trim()), `${t.ja}: tw`);
    assert.ok(['v', 'c', 'q'].includes(t.conf) && t.conf in CONF, `${t.ja}: conf`);
    // 已查證必須附來源：網址，或文獻出處（要有章節或圖號）
    if (t.conf === 'v') assert.match(t.src, /^https?:\/\/|§|圖|段落/, `${t.ja}: 已查證必須附來源`);
  }
  assert.ok(TERMS.length >= 100);
});

test('同一個「日文 + 分類」不重複', () => {
  const seen = new Set();
  for (const t of TERMS) {
    const k = `${t.cat}|${t.ja}`;
    assert.ok(!seen.has(k), `重複詞條 ${k}`); seen.add(k);
  }
});

test('正規化：片假名、全形、空白', () => {
  assert.equal(norm('タルキ'), 'たるき');
  assert.equal(norm(' たる き '), 'たるき');
  assert.equal(norm('ＡＢＣ'), 'abc');
  assert.equal(norm('プレカット'), 'ぷれかっと');
  assert.equal(norm(null), '');
});

const firstJa = (r) => r[0]?.ja;

test('日→台：漢字、平假名、片假名都能查', () => {
  assert.equal(firstJa(search(TERMS, { q: '垂木' })), '垂木');
  assert.equal(firstJa(search(TERMS, { q: 'たるき' })), '垂木');
  assert.equal(firstJa(search(TERMS, { q: 'タルキ' })), '垂木');
  assert.equal(firstJa(search(TERMS, { q: 'すみぎ' })), '隅木');
  assert.equal(firstJa(search(TERMS, { q: 'プレカット' })), 'プレカット');
});

test('台→日：中文能查到日文', () => {
  const ja = (q) => search(TERMS, { q, dir: 'tw' }).map((t) => t.ja);
  assert.ok(ja('角梁').includes('隅木'));
  assert.ok(ja('椽').includes('垂木'));
  assert.ok(ja('燕尾').includes('蟻継ぎ'));
  assert.ok(ja('墨斗').includes('墨壺'));
  assert.ok(ja('抄平').includes('水盛り'));
  assert.ok(ja('榫卯').includes('仕口・継手'));
});

test('現場行話也能查（台→日）', () => {
  const ja = (q) => search(TERMS, { q, dir: 'tw' }).map((t) => t.ja);
  assert.ok(ja('Kak-á').includes('垂木'));
  assert.ok(ja('ヌキ').includes('貫'));
  assert.ok(ja('ドダイ').includes('土台'));
  // 「Taruki」只存在於行話欄：台→日查得到，日文欄位查不到
  assert.ok(ja('Taruki').includes('垂木'));
  assert.equal(search(TERMS, { q: 'Taruki', dir: 'ja' }).length, 0);
});

test('同名異義警示：束', () => {
  const tsuka = TERMS.filter((t) => t.warn.includes('同名異義'));
  const keys = tsuka.map((t) => t.ja);
  assert.ok(keys.includes('小屋束') && keys.includes('—'));
  // 日式小屋束＝文獻的「短木柱」；瓜筒只是近似，不能直接列為台灣用語，更不能對到台式的「束」
  const ko = TERMS.find((t) => t.ja === '小屋束');
  assert.deepEqual(ko.tw, ['短木柱']);
  assert.ok(!ko.tw.includes('瓜筒') && !ko.tw.includes('束仔'));
});

test('不收錄未經查證的說法當作正式名稱', () => {
  const allTw = TERMS.flatMap((t) => t.tw);
  for (const bad of ['銀錠榫', '十字卡榫', '勾頭搭掌榫', '掛鎌榫', '羊角榫', '引独鈷']) {
    assert.ok(!allTw.includes(bad), `不應把「${bad}」列為台灣用語`);
  }
});

test('完全相符排在前面', () => {
  const r = search(TERMS, { q: '梁' });
  assert.equal(r[0].ja, '梁');
});

test('方向與分類篩選', () => {
  assert.equal(search(TERMS, { q: '椽', dir: 'ja' }).length, 0); // 日文欄位沒有「椽」
  assert.ok(search(TERMS, { q: '椽', dir: 'tw' }).length > 0);
  const roof = search(TERMS, { cat: '屋架・屋頂' });
  assert.ok(roof.length > 5 && roof.every((t) => t.cat === '屋架・屋頂'));
  assert.equal(search(TERMS, { q: '垂木', cat: '工具' }).length, 0);
  assert.equal(search(TERMS, {}).length, TERMS.length);
});

test('查不到時回傳空陣列', () => {
  assert.deepEqual(search(TERMS, { q: 'ぽよぽよぷるん' }), []);
});

test('自訂詞條', () => {
  const c = makeCustom({ ja: ' 野垂木 ', kana: 'のだるき', tw: '暗椽、隱椽，  ', note: '看不到的椽木' }, 123);
  assert.equal(c.ja, '野垂木'); assert.deepEqual(c.tw, ['暗椽', '隱椽']); assert.equal(c.conf, 'u');
  assert.throws(() => makeCustom({ ja: '', tw: 'x' }));
  assert.throws(() => makeCustom({ ja: 'x', tw: ' 、 ' }));
  // 自訂詞條可被搜尋，也可用「我的詞條」分類篩選
  const all = [...TERMS, c];
  assert.equal(firstJa(search(all, { q: 'のだるき' })), '野垂木');
  assert.deepEqual(search(all, { cat: '我的詞條' }).map((t) => t.ja), ['野垂木']);
  assert.ok(search(all, { q: '暗椽', dir: 'tw' }).length === 1);
});

import { DIAGRAMS, COMPARE, renderDiagramSvg } from '../js/diagrams.js';

test('構架圖：每個構件都對得到詞庫詞條', () => {
  assert.deepEqual(DIAGRAMS.map((d) => d.id), ['wa', 'yo', 'tw']);
  for (const d of DIAGRAMS) assert.ok(d.explain && d.explain.heading && d.explain.points.length >= 4, `${d.id}: 缺少說明`);
  for (const d of DIAGRAMS) {
    const ids = new Set();
    for (const p of d.parts) {
      assert.ok(!ids.has(p.id), `重複構件 id ${p.id}`); ids.add(p.id);
      const [cat, ja] = p.ref;
      assert.ok(TERMS.some((t) => t.cat === cat && t.ja === ja), `${d.id}/${p.id}: 找不到詞條 ${cat}|${ja}`);
      assert.ok(p.shapes.includes('<'), `${p.id}: 沒有圖形`);
    }
    const svg = renderDiagramSvg(d);
    for (const p of d.parts) assert.ok(svg.includes(`data-id="${p.id}"`));
    assert.ok(d.parts.length >= 9);
  }
});

test('洋小屋：詞條、構件、日文別名、同名不同力警示', () => {
  const get = (ja) => TERMS.find((t) => t.ja === ja);
  for (const ja of ['洋小屋', '陸梁', '合掌', '真束', '方杖', '和小屋']) assert.ok(get(ja), `缺少 ${ja}`);
  assert.equal(search(TERMS, { q: 'ようごや' })[0].ja, '洋小屋');
  assert.equal(search(TERMS, { q: 'ろくばり' })[0].ja, '陸梁');
  assert.equal(search(TERMS, { q: 'がっしょう' })[0].ja, '合掌');
  assert.equal(search(TERMS, { q: 'トラス', dir: 'ja' })[0].ja, '洋小屋');      // 日文別名
  assert.equal(search(TERMS, { q: 'キングポスト' })[0].ja, '洋小屋');
  assert.ok(search(TERMS, { q: '桁架', dir: 'tw' }).some((t) => t.ja === '洋小屋'));
  assert.ok(search(TERMS, { q: '上弦桿', dir: 'tw' }).some((t) => t.ja === '合掌'));
  assert.ok(get('真束').warn.includes('受拉') && get('真束').warn.includes('受壓'));
  assert.ok(get('和小屋').warn.includes('沒有斜撐') && get('洋小屋').warn.includes('桁架觀念'));
  assert.equal(get('洋小屋').cat, '屋架・屋頂');
});

test('和小屋與洋小屋各自有說明，並有對照表', () => {
  const wa = DIAGRAMS.find((d) => d.id === 'wa'), yo = DIAGRAMS.find((d) => d.id === 'yo');
  assert.ok(wa.explain.heading.includes('和小屋') && yo.explain.heading.includes('洋小屋'));
  assert.ok(wa.explain.points.some((p) => p.includes('小屋束')) && !wa.explain.points.some((p) => p.includes('陸梁')));
  assert.ok(yo.explain.points.some((p) => p.includes('陸梁') && p.includes('合掌')) && yo.explain.points.some((p) => p.includes('真束')));
  assert.equal(COMPARE.heads.length, 3);
  for (const row of COMPARE.rows) assert.equal(row.length, 3);
  assert.ok(COMPARE.rows.some((r) => r[0].includes('束') && r[2].includes('受拉')));
  // 洋小屋圖含四個桁架構件
  const names = yo.parts.map((p) => p.aria);
  for (const n of ['陸梁', '合掌', '真束', '方杖', '土台', '柱']) assert.ok(names.includes(n), `洋小屋圖缺少 ${n}`);
  // 和小屋、洋小屋的下部一致（都有土台與柱），差別只在屋架
  const waNames = wa.parts.map((p) => p.aria);
  assert.ok(waNames.includes('土台') && waNames.includes('柱'));
});

// ───── 《古蹟木作修復技術》V-2「日式木構造與修復」逐項對照（文獻明載的用語，不可被改回自己猜的說法） ─────
test('文獻明載的台灣用語：日文詞條的第一個台灣用語要與文獻一致', () => {
  const expect = {
    '通し柱': '通柱', '管柱': '管柱', '土台': '木地檻', '布基礎': '連續基礎', '床束': '短木柱',
    '大引': '地板樑', '根太': '樓板格柵', '火打梁': '火打樑', '追掛大栓継ぎ': '犁壁榫', '鎌継ぎ': '蛇頭榫',
    '腰掛蟻継ぎ': '燕尾榫', '和小屋': '和式屋架', '洋小屋': '西式屋架', '合掌': '人字大料', '真束': '正同柱',
    '方杖': '腰支斜角撐', '陸梁': '水平大料', '吊束': '吊鞍', '小屋梁': '小屋樑', '小屋束': '短木柱',
    '羽子板ボルト': '魚尾螺栓', '母屋': '桁條', '棟木': '脊枋木', '垂木': '椽條',
  };
  for (const [ja, tw] of Object.entries(expect)) {
    const t = TERMS.find((x) => x.ja === ja);
    assert.ok(t, `缺少 ${ja}`);
    assert.equal(t.tw[0], tw, `${ja} 應為 ${tw}`);
    assert.equal(t.conf, 'v', `${ja} 文獻有載，應為已查證`);
    assert.ok(t.src.includes('古蹟木作修復技術') || /^https?:/.test(t.src), `${ja}: 出處`);
  }
  // 我先前自己猜的名稱，文獻沒有，不能再當台灣用語
  const allTw = TERMS.flatMap((t) => t.tw);
  for (const bad of ['分層柱', '床下短柱', '懸垂桿（吊桿）', '中柱桿', '斜腹桿', '斜撐桿']) assert.ok(!allTw.includes(bad), `不應收錄「${bad}」`);
  // 新增的文獻詞條要能查到
  for (const q of ['京呂組', '折置組', '鴨居', '長押', '座敷', '二重梁']) assert.ok(search(TERMS, { q }).length > 0, q);
  assert.equal(search(TERMS, { q: '犁壁榫', dir: 'tw' })[0].ja, '追掛大栓継ぎ');
});

test('洋小屋圖含吊束（吊鞍），並與詞庫對應', () => {
  const yo = DIAGRAMS.find((d) => d.id === 'yo');
  assert.ok(yo.parts.some((p) => p.aria === '吊束'));
  assert.ok(yo.explain.points.some((p) => p.includes('正同柱') && p.includes('人字大料') && p.includes('腰支斜角撐')));
  assert.ok(COMPARE.rows.some((r) => r[0].includes('穩定') && r[1].includes('沒有斜撐')));
});
