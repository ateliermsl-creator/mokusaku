// 加到手機桌面（安裝教學）：內容與流程比照「三星蔥工具箱」。
// 依裝置自動顯示 iPhone／Android 步驟、偵測 LINE／Facebook 內建瀏覽器、Android 可一鍵安裝。
const $ = (id) => document.getElementById(id);
const APP = '柴柴木作';   // 加到桌面時預設的名稱是 manifest 的 name
const ICON = '柴柴木作圖示';

export const inAppName = () => {
  const ua = navigator.userAgent;
  return /\bLine\//i.test(ua) ? 'LINE' : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'Facebook' : /Instagram/i.test(ua) ? 'Instagram' : /MicroMessenger/i.test(ua) ? '微信' : '';
};
// iPadOS 的 Safari 會假裝成 Mac
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (/Macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints > 1 || /Mobile\//.test(navigator.userAgent)));
export const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

let deferredInstall = null;      // Android Chrome 的「安裝」提示事件
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
window.addEventListener('appinstalled', () => { deferredInstall = null; });

async function copyUrl() {
  const url = location.href.split('#')[0];
  try { await navigator.clipboard.writeText(url); alert('已複製網址，請打開 Safari 貼上網址。'); } catch { prompt('請複製這個網址，貼到 Safari 開啟', url); }
}
function inAppHelp() {
  const n = inAppName(), where = isIOS() ? '右下角的「分享」圖示 ⬆ →「在 Safari 開啟」' : '右上角選單 ⋮ →「以其他瀏覽器開啟」或「在 Chrome 開啟」';
  return { n, where };
}

/** 每一頁頂端的內建瀏覽器提醒 */
export function showInAppBanner() {
  const el = $('iab'); if (!el) return;
  let hide = false;
  try { hide = !!sessionStorage.getItem('iabHide'); } catch { /* ignore */ }
  if (!inAppName() || hide) { el.hidden = true; return; }
  const hp = inAppHelp();
  el.hidden = false;
  el.innerHTML = `⚠ 你在 <b>${hp.n} 內建瀏覽器</b>，不能加入主畫面，資料也和 ${isIOS() ? 'Safari' : 'Chrome'} 分開存放。請點${hp.where}。<br><button type="button" class="sec" id="iabCopy">複製網址</button> <button type="button" class="sec" id="iabHide">先不要提醒</button>`;
  $('iabCopy').onclick = copyUrl;
  $('iabHide').onclick = () => { try { sessionStorage.setItem('iabHide', '1'); } catch { /* ignore */ } el.hidden = true; };
}

export function renderInstall() {
  const ios = isIOS(), android = /Android/i.test(navigator.userAgent), iab = inAppName();
  const iosSteps = `<ol class="steps"><li>用 <b>Safari</b> 開啟本網址（不是 LINE、Facebook 內建瀏覽器，也不是 Chrome）。</li>
    <li>點 <b>分享</b> 圖示（方形加向上箭頭 ⬆）：iPhone 在畫面<b>下方中間</b>，iPad 在畫面<b>右上角</b>網址列旁。</li>
    <li>往下滑，點 <b>「加入主畫面」</b>。</li>
    <li>名稱會是「${APP}」，按右上角 <b>「加入」</b>。</li>
    <li>回到桌面，點<b>${ICON}</b>開啟，以後都從這個圖示進來。</li></ol>`;
  const andSteps = `<ol class="steps"><li>用 <b>Chrome</b> 開啟本網址（不是 LINE、Facebook 內建瀏覽器）。</li>
    <li>點右上角選單 <b>⋮</b>。</li>
    <li>點 <b>「加到主畫面」</b> 或 <b>「安裝應用程式」</b>。</li>
    <li>在跳出的視窗按 <b>「安裝」</b> 或 <b>「新增」</b>。</li>
    <li>回到桌面，點<b>${ICON}</b>開啟。</li></ol>
    <p class="cnote">Samsung Internet：點選單 ≡ →「新增頁面到」→「主畫面」。</p>`;
  const sec = $('page-install');
  sec.innerHTML = `<h2>📲 加到手機桌面</h2>
    ${isStandalone() ? '<div class="note-ok">✓ 你現在就是從桌面圖示開啟的，已經安裝好了。</div>' : ''}
    ${iab ? `<div class="note-warn">⚠ 你現在在 <b>${iab} 內建瀏覽器</b>，無法加入主畫面。請先改用 ${ios ? 'Safari' : 'Chrome'} 開啟：點${inAppHelp().where}。<br><button type="button" class="sec" id="inCopy">複製網址</button></div>` : ''}
    <div class="box"><b>為什麼要加到桌面？</b><ul><li>點一下圖示就開，像一般 App，沒有網址列。</li><li>第一次要有網路載入，之後<b>沒有網路也能用</b>。</li><li>不會被當成一般網頁，手機比較不會清掉資料。</li></ul></div>
    ${android && deferredInstall ? '<div class="row"><button type="button" id="instNow">⬇ 一鍵安裝到桌面</button></div>' : ''}
    <div class="box"><h3>${ios ? '🍎 iPhone／iPad（你的裝置）' : android ? '🤖 Android 手機（你的裝置）' : '📱 手機'}</h3>${ios ? iosSteps : android ? andSteps : iosSteps}</div>
    <details class="box"><summary>${ios ? 'Android 手機怎麼做' : 'iPhone／iPad 怎麼做'}</summary><div>${ios ? andSteps : iosSteps}</div></details>
    <div class="box"><b>先看這幾點</b><ul>
      <li>iPhone／iPad：<b>桌面圖示和 Safari 的資料是分開存放的</b>。建議<b>先加到桌面，再從圖示開始使用</b>。</li>
      <li>你在工具箱裡輸入的尺寸、我的詞條，只存在這支手機的瀏覽器，不會上傳；換手機或清除瀏覽器資料就會消失。</li>
      <li>更新：有網路時開啟圖示，會自動換成新版，不必重新安裝；如果畫面沒變，把 App 從多工畫面完全關掉再重開一次。</li></ul></div>
    <div class="row"><button type="button" class="sec" id="inCopy2">複製網址</button></div>`;
  $('inCopy')?.addEventListener('click', copyUrl);
  $('inCopy2').onclick = copyUrl;
  $('instNow')?.addEventListener('click', async () => {
    try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch { /* ignore */ }
    deferredInstall = null; renderInstall();
  });
}
