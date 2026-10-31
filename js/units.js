// 尺貫法 ⇄ 公制 的換算與混合算式解析。
// 內部一律以 mm 為單位。
// 1 尺 = 10/33 m = 303.0303… mm（台尺與日本尺相同）。

export const SHAKU_MM = 10000 / 33;

export const UNITS = {
  '丈': SHAKU_MM * 10, // 台灣傳統：1 丈 = 10 尺
  '間': SHAKU_MM * 6,  // 日式：1 間 = 6 尺
  '台尺': SHAKU_MM,
  '尺': SHAKU_MM,
  '寸': SHAKU_MM / 10,
  '分': SHAKU_MM / 100,
  '厘': SHAKU_MM / 1000,
  'mm': 1,
  'cm': 10,
  'm': 1000,
};

// 1:√2 常數（曲尺裏目用）  2:數字  3:單位  4:運算符
const TOKEN = /\s*(?:(√2)|(\d+(?:\.\d+)?|\.\d+)|(mm|cm|m|丈|間|台尺|尺|寸|分|厘)|([+\-*/()]))/y;

function normalize(src) {
  return String(src)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[−–—ー]/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/，/g, ',');
}

function tokenize(s) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < s.length) {
    if (/\s/.test(s[pos])) { pos++; continue; }
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(s);
    if (!m) throw new Error(`無法辨識「${s[pos]}」`);
    if (m[1] !== undefined) tokens.push({ t: 'num', v: Math.SQRT2 });
    else if (m[2] !== undefined) tokens.push({ t: 'num', v: parseFloat(m[2]) });
    else if (m[3] !== undefined) tokens.push({ t: 'unit', v: m[3] });
    else tokens.push({ t: 'op', v: m[4] });
    pos = TOKEN.lastIndex;
  }
  return tokens;
}

function parse(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const isOp = (t, ...ops) => t && t.t === 'op' && ops.includes(t.v);

  function expr() {
    let v = term();
    while (isOp(peek(), '+', '-')) {
      const op = tokens[i++].v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    while (isOp(peek(), '*', '/')) {
      const op = tokens[i++].v;
      const r = unary();
      if (op === '/' && r === 0) throw new Error('不能除以 0');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function unary() {
    const t = peek();
    if (isOp(t, '-', '+')) {
      i++;
      const v = unary();
      return t.v === '-' ? -v : v;
    }
    return primary();
  }
  function primary() {
    const t = tokens[i++];
    if (!t) throw new Error('算式不完整');
    if (isOp(t, '(')) {
      const v = expr();
      if (!isOp(tokens[i++], ')')) throw new Error('缺少右括號 )');
      return v;
    }
    if (t.t === 'num') {
      if (!(peek() && peek().t === 'unit')) return t.v; // 沒寫單位 → mm
      let sum = t.v * UNITS[tokens[i++].v];
      // 3間2尺5寸：連續「數字+單位」相加
      while (peek() && peek().t === 'num' && tokens[i + 1] && tokens[i + 1].t === 'unit') {
        sum += tokens[i].v * UNITS[tokens[i + 1].v];
        i += 2;
      }
      return sum;
    }
    throw new Error(t.t === 'unit' ? `「${t.v}」前面少了數字` : `位置不對：「${t.v}」`);
  }

  const v = expr();
  if (i < tokens.length) throw new Error('算式有多餘的部分');
  return v;
}

/** 解析長度算式，回傳 mm。空字串回傳 null；語法錯誤丟出 Error。 */
export function evalLength(src) {
  const s = normalize(src);
  if (!s.trim()) return null;
  const v = parse(tokenize(s));
  if (!Number.isFinite(v)) throw new Error('結果不是有效的數字');
  return v;
}

/** 把長度拆成 { sign, big, shaku, sun, bun }（bigShaku：1 個「大單位」等於幾尺；四捨五入到 0.1 分） */
export function splitShaku(mm, bigShaku) {
  let tenth = Math.round((Math.abs(mm) / SHAKU_MM) * 1000); // 單位：0.1 分（1 尺 = 1000）
  const big = Math.floor(tenth / (bigShaku * 1000)); tenth %= bigShaku * 1000;
  const shaku = Math.floor(tenth / 1000); tenth %= 1000;
  const sun = Math.floor(tenth / 100); tenth %= 100;
  return { sign: mm < 0 ? -1 : 1, big, shaku, sun, bun: tenth / 10 };
}

function fmtParts(mm, bigName, bigShaku) {
  if (!Number.isFinite(mm)) return '—';
  const { sign, big, shaku, sun, bun } = splitShaku(mm, bigShaku);
  let out = '';
  if (big) out += `${big}${bigName}`;
  if (shaku) out += `${shaku}尺`;
  if (sun) out += `${sun}寸`;
  if (bun) out += `${bun}分`;
  return out ? (sign < 0 ? '−' : '') + out : '0';
}

/** mm → 「20尺8寸9分6厘」（尺為最大單位，精算到厘＝0.1 分） */
export function toShakuRi(mm) {
  if (!Number.isFinite(mm)) return '—';
  const { sign, shaku, sun, bun } = splitShaku(mm, 1e6);
  const fen = Math.floor(bun + 1e-9);
  const li = Math.round((bun - fen) * 10);
  let out = '';
  if (shaku) out += `${shaku}尺`;
  if (sun) out += `${sun}寸`;
  if (fen) out += `${fen}分`;
  if (li) out += `${li}厘`;
  return out ? (sign < 0 ? '−' : '') + out : '0';
}

/** mm → 台尺「2丈5寸4.5分」（四捨五入到 0.1 分；丈 = 10 尺） */
export const toTaiShaku = (mm) => fmtParts(mm, '丈', 10);

/** mm → 日式「3間2尺5寸4.5分」（間 = 6 尺） */
export const toKenShaku = (mm) => fmtParts(mm, '間', 6);

export function fmtMm(mm, digits = 1) {
  if (!Number.isFinite(mm)) return '—';
  const v = +mm.toFixed(digits);
  return `${Object.is(v, -0) ? 0 : v}`;
}

/** mm → 尺（小數） */
export function toShaku(mm, digits = 3) {
  if (!Number.isFinite(mm)) return '—';
  return `${+(mm / SHAKU_MM).toFixed(digits)}`;
}
