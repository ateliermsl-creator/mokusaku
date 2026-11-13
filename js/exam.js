// 匠師備考（傳統匠師資格審查・日式大木作）：題庫與出題邏輯（純函式，不碰 DOM，方便測試）。
//
// 數值規則：題目一律附出處；法規題的條文是透過網頁工具擷取重點、還沒逐字核對，所以標 status 'check'（待核對），
// 使用者在全國法規資料庫核對後才改成 'ok'。不放任何沒有出處的數字。

export const LAW_ACT = '《文化資產保存法》（115.07.01 修正版）';
export const LAW_REG = '《古蹟修復及再利用辦法》（115.08.05 修正版）';

export const STATUS = { ok: '已核對', check: '待核對' };

// 題目格式：kind 'tf'（是非，opts 固定 ○／✕）或 'mc'（單選）；ans 是正確選項的索引（從 0 起）
const TF = ['○ 對', '✕ 錯'];
const RAW_LAW = [
  // ───── 文化資產保存法 ─────
  ['mc', '下列何者「不屬於」《文化資產保存法》所稱的有形文化資產？', ['紀念建築', '聚落建築群', '傳統工藝', '文化景觀'], 2, '傳統工藝屬於無形文化資產。', 'act', '第 3 條'],
  ['mc', '「與歷史、文化、藝術等領域有重要貢獻之人物相關，應予保存之建造物及附屬設施」，指的是：', ['古蹟', '歷史建築', '紀念建築', '史蹟'], 2, '', 'act', '第 3 條'],
  ['mc', '建築式樣、風格特殊或與景觀協調，具歷史、藝術或科學價值的「建造物群或街區」，屬於：', ['聚落建築群', '文化景觀', '史蹟', '古蹟'], 0, '', 'act', '第 3 條'],
  ['tf', '古蹟依主管機關區分為國定、直轄市定、縣（市）定三類。', TF, 0, '', 'act', '第 17 條'],
  ['mc', '歷史建築、紀念建築由哪一級機關審查登錄後公告？', ['文化部', '直轄市、縣（市）主管機關', '內政部', '鄉（鎮、市、區）公所'], 1, '登錄後並報中央主管機關備查。', 'act', '第 18 條'],
  ['tf', '《文化資產保存法》在中央的主管機關是內政部。', TF, 1, '中央主管機關為文化部。', 'act', '第 4 條'],
  ['tf', '暫定古蹟於審議期間內視同古蹟，應予管理維護，審議期間以六個月為限。', TF, 0, '必要時得延長一次。', 'act', '第 20 條'],
  ['mc', '古蹟應保存原有的：', ['用途及產權', '形貌及工法', '材料及色彩', '面積及高度'], 1, '', 'act', '第 24 條第 1 項'],
  ['tf', '古蹟修復一律不得採用現代科技與工法。', TF, 1, '必要時得採用，以增加抗震、防災、防潮、防蛀等機能及存續年限。', 'act', '第 24 條第 2 項'],
  ['tf', '古蹟整體性修復及再利用過程中，應分階段舉辦說明會、公聽會，公開相關資訊並通知當地居民參與。', TF, 0, '', 'act', '第 24 條第 5 項'],
  ['mc', '古蹟因重大災害毀損，所有人、使用人或管理人應於災後多久內提報「搶修計畫」、多久內提出「修復計畫」？', ['7 日／3 個月', '30 日／6 個月', '30 日／1 年', '60 日／6 個月'], 1, '兩者都要經主管機關核准。', 'act', '第 27 條'],
  ['mc', '直轄市、縣（市）主管機關登錄者稱「文化資產保存技術」；中央主管機關登錄者稱：', ['國家級保存技術', '重要文化資產保存技術', '重要傳統工藝', '人間國寶'], 1, '並據以認定其保存者；定義見第 95 條。', 'act', '第 96 條'],
  // ───── 古蹟修復及再利用辦法 ─────
  ['mc', '下列何者「不是」本辦法所列古蹟修復及再利用的辦理事項？', ['修復或再利用計畫', '規劃設計', '工作報告書', '使用執照申請'], 3, '所列為：修復或再利用計畫、規劃設計、施工、監造、工作報告書、其他相關事項。', 'reg', '第 2 條'],
  ['mc', '下列何者是「修復計畫」應包括的項目？', ['招商營運方案', '傳統匠師技藝及材料分析調查', '工程保固計畫', '建築執照申請'], 1, '同條另有：文獻史料蒐集及修復沿革考證、現況調查、原有工法調查及施工方法研究、必要之解體調查等。', 'reg', '第 3 條第 1 項'],
  ['mc', '解體調查由誰在認為有必要時，報請主管機關同意後進行？', ['施工廠商', '監造單位', '執行主持人', '傳統匠師'], 2, '', 'reg', '第 8 條'],
  ['tf', '解體調查應採對原結構組織損害最少的方法為之。', TF, 0, '', 'reg', '第 8 條'],
  ['mc', '下列何者「不符合」本辦法所稱傳統匠師的資格？', ['經主管機關認定的文化資產保存技術保存者', '列於內政部刊印之臺閩地區傳統工匠名錄的匠師', '具相當傳統技術及成果，經中央主管機關審查通過並公告者', '持有建築師證書者'], 3, '', 'reg', '第 12 條'],
  ['tf', '工作報告書應記錄參與人員與匠師的施工過程、技術、流派，並附資格文件。', TF, 0, '', 'reg', '第 7 條'],
  ['mc', '工程實際進度達多少時，應提出期中報告送主管機關審查？', ['30%', '50%', '70%', '竣工時'], 1, '竣工後再提期末報告。', 'reg', '第 17 條'],
  ['mc', '修復或再利用的說明會、公聽會，日期與地點至少應於幾日前公告？', ['3 日', '7 日', '14 日', '30 日'], 1, '', 'reg', '第 18 條'],
  ['tf', '修復時要以新品替換非原件，施工廠商可依現場狀況自行決定。', TF, 1, '須經該古蹟主管機關審查通過。', 'reg', '第 16 條'],
  ['mc', '施工時遇到現況與規劃設計不符，應如何處理？', ['施工廠商自行調整', '監造人會同規劃設計人報主管機關同意後處理', '業主口頭同意即可', '停工並重新招標'], 1, '', 'reg', '第 16 條'],
];

export const LAW_QUESTIONS = RAW_LAW.map(([kind, q, opts, ans, exp, law, art], i) => ({
  id: `law${String(i + 1).padStart(2, '0')}`,
  set: 'law', kind, q, opts, ans, exp,
  src: `${law === 'act' ? LAW_ACT : LAW_REG} ${art}`,
  status: 'check',
}));

/* ───────────── 名詞題：由名詞庫「已查證」詞條自動出題 ───────────── */

/** 可重現的亂數（同一個 seed 出同樣的題目，方便測試） */
export function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const usable = (t) => t && t.conf === 'v' && t.ja && t.ja !== '—' && Array.isArray(t.tw) && t.tw[0] && t.src;

/**
 * 名詞題：只用「已查證」且有出處的詞條。每個詞條出兩題：日→台、台→日。
 * 干擾選項優先取同分類的其他詞條，答案文字不重複。rnd 決定選項順序。
 */
export function termQuestions(terms, rnd = Math.random) {
  const pool = terms.filter(usable);
  const out = [];
  for (const t of pool) {
    for (const dir of ['ja', 'tw']) {
      const answerOf = (x) => (dir === 'ja' ? x.tw[0] : x.ja);
      const right = answerOf(t);
      const others = pool.filter((x) => x !== t && answerOf(x) !== right);
      const same = shuffle(others.filter((x) => x.cat === t.cat), rnd);
      const rest = shuffle(others.filter((x) => x.cat !== t.cat), rnd);
      const wrong = [];
      for (const x of [...same, ...rest]) {
        const a = answerOf(x);
        if (!wrong.includes(a)) wrong.push(a);
        if (wrong.length === 3) break;
      }
      if (wrong.length < 3) continue;
      const opts = shuffle([right, ...wrong], rnd);
      out.push({
        id: `t-${dir}-${t.ja}`,
        set: 'term', kind: 'mc',
        q: dir === 'ja' ? `日文「${t.ja}」${t.kana ? `（${t.kana}）` : ''}，台灣的說法是？` : `台灣說的「${t.tw[0]}」，日文是？`,
        opts, ans: opts.indexOf(right),
        exp: t.note || '',
        src: t.src,
        status: 'ok',
      });
    }
  }
  return out;
}

/* ───────────── 出一回題目 ───────────── */

/**
 * set：'law'（法規）、'term'（名詞）、'wrong'（錯題本）、'all'（全部）
 * wrong：錯題本裡的題目 id；n：題數
 */
export function buildQuiz(all, { set = 'all', n = 10, wrong = [], rnd = Math.random } = {}) {
  let pool;
  if (set === 'wrong') { const w = new Set(wrong); pool = all.filter((q) => w.has(q.id)); }
  else if (set === 'all') pool = all;
  else pool = all.filter((q) => q.set === set);
  return shuffle(pool, rnd).slice(0, Math.max(0, n));
}

/* ───────────── 讀書檢核表（六大領域；只列項目，不放數值） ───────────── */

export const STUDY = [
  { id: 'd1', title: '日式建築概論', items: [
    ['d1a', '空間名稱：玄關、座敷、緣側、押入、床之間'],
    ['d1b', '真壁造與大壁造的差別'],
    ['d1c', '床組・軸組・小屋組各構件的位置', '#/glossary'],
    ['d1d', '和小屋與洋小屋的差異（看構架圖鑑）', '#/glossary'],
    ['d1e', '上棟式與棟札'],
  ] },
  { id: 'd2', title: '文資法規與修復倫理', items: [
    ['d2a', '文資法：古蹟、歷史建築、紀念建築、聚落建築群的定義與分級'],
    ['d2b', '古蹟修復及再利用辦法全文（修復計畫、解體調查、工作報告書、傳統匠師）'],
    ['d2c', '修復倫理：真實性、最小干預、可逆性、可辨識性'],
    ['d2d', '解體前測繪與構件編號'],
  ] },
  { id: 'd3', title: '圖說、力學與規矩術', items: [
    ['d3a', '床伏圖・軸組圖・小屋伏圖怎麼看'],
    ['d3b', '洋小屋各桿件受拉或受壓（看構架圖鑑）', '#/glossary'],
    ['d3c', '曲尺表目・裏目與寸勾配（用計算機驗算）', '#/calc/slope'],
    ['d3d', '隅木（角梁）勾配與展開（用計算機驗算）', '#/calc/sumi'],
  ] },
  { id: 'd4', title: '木材與手工具', items: [
    ['d4a', '常見樹種與使用部位'],
    ['d4b', '含水率公式與纖維飽和點（數值以教材為準）'],
    ['d4c', '木表・木裏與翹曲方向'],
    ['d4d', '背割的目的'],
    ['d4e', '材積（才）換算'],
    ['d4f', '腐朽、白蟻與非破壞檢測'],
    ['d4g', '日式手工具與研磨（鋸、鑿、鉋）'],
  ] },
  { id: 'd5', title: '継手・仕口與修復工序', items: [
    ['d5a', '追掛大栓継ぎ、金輪継ぎ、腰掛鎌継ぎ（看仕口継手速查）', '#/joint'],
    ['d5b', '台持継ぎ、渡りあご、大入れ、蟻掛'],
    ['d5c', '込み栓的拉緊原理（偏移量以教材為準）'],
    ['d5d', '埋木・矧木・根継ぎ'],
    ['d5e', '修復工序：解體 → 調查 → 修補 → 假組 → 組立'],
  ] },
  { id: 'd6', title: '木料品管與職業安全', items: [
    ['d6a', '木料進場查驗與堆放'],
    ['d6b', '圓盤鋸、手壓鉋機的安全裝置'],
    ['d6c', '高處作業與個人防護'],
  ] },
];
export const STUDY_IDS = STUDY.flatMap((d) => d.items.map(([id]) => id));

/* ───────────── 術科試場：防扣分清單（出自官方試場規則，條文待核對） ───────────── */

export const RULES_SRC = '文化部《傳統匠師資格審查學術科測試試場規則》（110.08.31 訂定，111.04.22 修正）';
export const RULES_URL = 'https://themefile.culture.tw/file/2022-05-31/3832e4a6-3aba-46f1-9142-bcf65afdef48/02%E8%A9%A6%E5%A0%B4%E8%A6%8F%E5%89%87.pdf';
export const RULES = [
  { pts: '扣考', items: ['夾帶資料、傳送或接收資訊', '故意毀損他人作品'], art: '第 16 條' },
  { pts: '扣 20 分', items: ['使用未列在工具檢核表上的工具', '與他人交談或借用工具', '手機在指定區域發出聲響', '擅自離場'], art: '第 17 條' },
  { pts: '扣 5 分', items: ['過失毀損自己的試卷或作品', '測試開始前就作答或翻閱試題', '未在指定區域用餐'], art: '第 18 條' },
  { pts: '扣 3 分', items: ['不依安全規範操作工具，經制止仍不聽從或再犯', '未經許可移動桌椅或設備'], art: '第 19 條' },
  { pts: '其他規定', items: ['測試開始後 15 分鐘內要入場，逾時不得入場', '測試開始後 30 分鐘內不得離場', '術科：預備鈴響前 30 分鐘試場關閉，工具要先擺好', '不可在作品上寫姓名、座號等可辨識身分的內容', '不可攜帶或使用手機等資訊器材'], art: '第 4、5、10、11 條' },
];

/* ───────────── 儲存的進度（錯題本、檢核表）：讀取時一律檢查型別 ───────────── */

export const WRONG_MAX = 300;

/** known：目前存在的題目 id 集合（Set）。不在裡面的 id、非字串、過長的都丟掉。 */
export function sanitizeExam(raw, known) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const ids = (v, ok, max) => {
    if (!Array.isArray(v)) return [];
    const out = [];
    for (const x of v.slice(0, max * 2)) {
      if (typeof x !== 'string' || x.length > 80 || !ok(x) || out.includes(x)) continue;
      out.push(x);
      if (out.length >= max) break;
    }
    return out;
  };
  return {
    wrong: ids(o.wrong, (x) => known.has(x), WRONG_MAX),
    done: ids(o.done, (x) => STUDY_IDS.includes(x), STUDY_IDS.length),
  };
}

/** 作答後更新錯題本：答錯加入（放最前面），答對移除 */
export function recordAnswer(exam, id, correct) {
  const rest = exam.wrong.filter((x) => x !== id);
  return { ...exam, wrong: correct ? rest : [id, ...rest].slice(0, WRONG_MAX) };
}

/** 檢核表打勾／取消 */
export function toggleDone(exam, id) {
  if (!STUDY_IDS.includes(id)) return exam;
  return { ...exam, done: exam.done.includes(id) ? exam.done.filter((x) => x !== id) : [...exam.done, id] };
}
