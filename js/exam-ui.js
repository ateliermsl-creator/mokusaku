// 匠師備考：介面（練習題／術科提醒）。所有文字一律用 textContent（透過 h()），不用 innerHTML。
import { h } from './dom.js';
import { TERMS } from './glossary.js';
import {
  LAW_QUESTIONS, STATUS, termQuestions, buildQuiz, RULES, RULES_SRC, RULES_URL,
  sanitizeExam,
} from './exam.js';
import { sanitizeReview, answerReview, dueIds, nextDue, dayNum, sanitizeSession } from './review.js';

const $ = (id) => document.getElementById(id);
const QUIZ_NS = [5, 10];   // 一回幾題：工地休息時間短，可以選 5 題
const TABS = [['quiz', '練習題'], ['rules', '術科提醒']];

export function createExamUI({ state, save }) {
  const terms = termQuestions(TERMS);
  const ALL = [...LAW_QUESTIONS, ...terms];
  const known = new Set(ALL.map((q) => q.id));
  let exam = sanitizeExam(state.exam, known);
  // 錯題改用間隔複習；舊版錯題本的題目搬過來，當作今天到期
  let review = sanitizeReview(state.examReview, known, { legacy: exam.wrong });
  exam = { ...exam, wrong: [] };
  let tab = TABS.some(([k]) => k === state.examTab) ? state.examTab : 'quiz';
  let quizN = QUIZ_NS.includes(state.examN) ? state.examN : 10;
  let set = 'law';
  let quiz = null;   // { list, i, picked, score }
  const byId = new Map(ALL.map((q) => [q.id, q]));

  // 做到一半的這一回：App 被關掉後接著做（已作答的那題直接跳下一題）
  const sess = sanitizeSession(state.examQuiz, known);
  if (sess) { set = sess.set; quiz = { list: sess.ids.map((id) => byId.get(id)), i: sess.i, picked: -1, score: sess.score, resumed: true }; }

  const persist = () => { state.exam = exam; state.examReview = review; save(); };
  function saveSession() {
    if (quiz && quiz.i < quiz.list.length) state.examQuiz = { set, ids: quiz.list.map((q) => q.id), i: quiz.i, score: quiz.score, a: quiz.picked >= 0 };
    else delete state.examQuiz;
    save();
  }
  persist();

  function chips(items, current, onPick, label) {
    return h('div', { class: 'chips', 'aria-label': label },
      items.map(([v, text]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === current), text, onclick: () => onPick(v) })));
  }

  /* ---------- 練習題 ---------- */
  function setLabel(k) {
    if (k === 'law') return `法規（${LAW_QUESTIONS.length}）`;
    if (k === 'term') return `名詞（${terms.length}）`;
    const due = dueIds(review).length;
    return `錯題複習（今天 ${due}／共 ${review.length}）`;
  }

  function start(all = false) {
    const wrong = all ? review.map((e) => e[0]) : dueIds(review);
    const list = buildQuiz(ALL, { set, n: quizN, wrong });
    quiz = list.length ? { list, i: 0, picked: -1, score: 0 } : null;
    saveSession();
    render();
  }
  function next() {
    quiz.i += 1; quiz.picked = -1; quiz.resumed = false;
    saveSession();
    render();
    window.scrollTo(0, 0);
  }

  function questionCard() {
    const q = quiz.list[quiz.i];
    const done = quiz.picked >= 0;
    const card = h('article', { class: 'term ex-q' });
    card.append(h('div', { class: 'term-top' },
      h('span', { class: `conf ${q.status === 'ok' ? 'conf-v' : 'conf-q'}`, text: STATUS[q.status] }),
      h('span', { class: 'cat', text: `${q.set === 'law' ? '法規' : '名詞'}・${q.kind === 'tf' ? '是非' : '單選'}・第 ${quiz.i + 1}／${quiz.list.length} 題` })));
    card.append(h('p', { class: 'ex-stem', text: q.q }));
    const opts = h('div', { class: 'ex-opts' });
    q.opts.forEach((o, k) => {
      let cls = 'ex-opt';
      if (done && k === q.ans) cls += ' right';
      else if (done && k === quiz.picked) cls += ' wrong';
      opts.append(h('button', { type: 'button', class: cls, disabled: done, text: q.kind === 'tf' ? o : `(${'ABCD'[k]}) ${o}`,
        onclick: () => pick(k) }));
    });
    card.append(opts);
    if (done) {
      const ok = quiz.picked === q.ans;
      card.append(h('p', { class: `ex-res ${ok ? 'right' : 'wrong'}`, role: 'status', text: ok ? '✓ 答對了' : `✕ 答錯，正確答案是 ${q.kind === 'tf' ? q.opts[q.ans] : `(${'ABCD'[q.ans]})`}` }));
      if (q.exp) card.append(h('div', { class: 'nt ex-exp', text: q.exp }));
      card.append(h('div', { class: 'cite', text: `📖 出處：${q.src}` }));
      if (q.status === 'check') card.append(h('p', { class: 'note', text: '這題的條文還沒逐字核對，請以全國法規資料庫為準。' }));
      // 「下一題」固定在畫面最下方、整排寬：拇指搆得到，位置也不會隨題目長短跳動
      card.append(h('div', { class: 'ex-nextbar' }, h('button', { type: 'button', class: 'ex-next', text: quiz.i + 1 < quiz.list.length ? '下一題 ›' : '看成績',
        onclick: next })));
    }
    return card;
  }

  function pick(k) {
    const q = quiz.list[quiz.i];
    if (quiz.picked >= 0) return;
    quiz.picked = k;
    if (k === q.ans) quiz.score += 1;
    review = answerReview(review, q.id, k === q.ans, dayNum());
    persist();
    saveSession();
    render();
  }

  function renderQuiz(box) {
    box.append(chips(['law', 'term', 'wrong'].map((k) => [k, setLabel(k)]), set, (v) => { set = v; quiz = null; saveSession(); render(); }, '題目範圍'));
    if (!quiz) {
      const due = dueIds(review).length;
      const n = set === 'wrong' ? due : set === 'law' ? LAW_QUESTIONS.length : terms.length;
      box.append(h('p', { class: 'note', text: set === 'law'
        ? '依文資法與古蹟修復及再利用辦法出題，每題附條號。條文是從網路擷取重點、還沒逐字核對，所以標「待核對」。'
        : set === 'term' ? '從名詞庫「已查證」的詞條自動出題（日文→台灣、台灣→日文），出處同名詞庫。'
          : '答錯的題目隔天會再出；複習答對，3 天後再出；再答對，7 天後再出；連續答對 3 次就移出。' }));
      box.append(chips(QUIZ_NS.map((k) => [k, `一回 ${k} 題`]), quizN, (v) => { quizN = v; state.examN = v; save(); render(); }, '一回幾題'));
      if (set === 'wrong' && !due) {
        if (!review.length) box.append(h('p', { class: 'empty', text: '錯題本是空的，先去做幾題吧。' }));
        else {
          const d = nextDue(review) - dayNum();
          box.append(h('p', { class: 'empty', text: `今天沒有要複習的題目。下一批在 ${d <= 1 ? '明天' : `${d} 天後`}到期。` }));
          box.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: `全部錯題先做一次（${Math.min(quizN, review.length)} 題）`, onclick: () => start(true) })));
          box.append(h('p', { class: 'note', text: '還沒到期就先答對，不會提早移出；答錯會重新從隔天開始算。' }));
        }
        return;
      }
      if (n) box.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', text: `開始（${Math.min(quizN, n)} 題）`, onclick: () => start() })));
      return;
    }
    if (quiz.resumed && quiz.i < quiz.list.length) box.append(h('p', { class: 'note-ok', text: `接著上次做：第 ${quiz.i + 1}／${quiz.list.length} 題，目前答對 ${quiz.score} 題。` }));
    if (quiz.i >= quiz.list.length) {
      box.append(h('div', { class: 'term ex-end' },
        h('p', { class: 'ex-score', text: `${quiz.score}／${quiz.list.length}` }),
        h('p', { class: 'note', text: `錯題本目前 ${review.length} 題，今天到期 ${dueIds(review).length} 題。` }),
        h('div', { class: 'acts' },
          h('button', { type: 'button', class: 'btnlink', text: '再來一回', onclick: () => start() }),
          h('button', { type: 'button', class: 'btnlink ghost', text: '回題目範圍', onclick: () => { quiz = null; saveSession(); render(); } }))));
      return;
    }
    box.append(questionCard());
  }

  /* ---------- 術科提醒 ---------- */
  function renderRules(box) {
    box.append(h('p', { class: 'note', text: '以下整理自官方試場規則（重點摘錄，條文待核對）。術科的評分細項官方沒有公開，這裡只列「會被扣分」的規定。' }));
    for (const r of RULES) {
      box.append(h('div', { class: 'term' },
        h('div', { class: 'term-top' }, h('span', { class: 'conf conf-q', text: r.pts }), h('span', { class: 'cat', text: r.art })),
        h('ul', { class: 'ex-list' }, r.items.map((x) => h('li', { text: x })))));
    }
    box.append(h('div', { class: 'cite', text: `📖 出處：${RULES_SRC}` }));
    box.append(h('div', { class: 'acts' }, h('a', { class: 'btnlink ghost', href: RULES_URL, target: '_blank', rel: 'noopener noreferrer', text: '📎 查看原文 PDF' })));
  }

  function render() {
    const root = $('ex-root');
    root.textContent = '';
    root.append(h('div', { class: 'seg', role: 'tablist' }, TABS.map(([k, label]) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(k === tab), text: label,
      onclick: () => { tab = k; state.examTab = k; save(); render(); },
    }))));
    const box = h('div', {});
    root.append(box);
    if (tab === 'quiz') renderQuiz(box);
    else renderRules(box);
  }

  return { render };
}
