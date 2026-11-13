/* Shanie學習 — 靜態每日學習小幫手。資料只存在瀏覽器 localStorage。 */
(function () {
  'use strict';
  const TZ = 'Asia/Taipei';
  const KEY = 'shanie:';
  const $app = document.getElementById('app');
  const S = { data: {}, lists: [], dwe: null, talk: null, daily: null };

  // ---------- 小工具 ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(KEY + k); } catch (e) {} }
  };
  function todayStr() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  const toUTC = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
  const addDays = (s, n) => new Date(toUTC(s) + n * 86400000).toISOString().slice(0, 10);
  const weekday = s => new Date(toUTC(s)).getUTCDay();
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const mondayOf = s => addDays(s, -((weekday(s) + 6) % 7));
  const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  function settings() {
    return Object.assign({ childName: 'Shanie', birth: '2023-05-15', starts: {}, dweColor: 'blue', dweProgram: 1, dweStart: null }, store.get('settings', {}));
  }
  function saveSettings(p) { store.set('settings', Object.assign(settings(), p)); }
  function age(birth, today) {
    const [by, bm, bd] = birth.split('-').map(Number); const [ty, tm, td] = today.split('-').map(Number);
    let m = (ty - by) * 12 + (tm - bm); if (td < bd) m--;
    return Math.floor(m / 12) + ' 歲 ' + (m % 12) + ' 個月';
  }

  // ---------- 封面 ----------
  function coverHTML(b, cls) {
    const ph = `<div class="ph">${esc(b.title)}<small>${b.cover ? '封面載入中' : '暫無封面'}</small></div>`;
    if (!b.cover || !b.cover.url) return `<div class="cover ${cls || ''}">${ph}</div>`;
    const big = cls === 'big' ? b.cover.url.replace('-M.jpg', '-L.jpg') : b.cover.url;
    return `<div class="cover ${cls || ''}"><img loading="lazy" alt="${esc(b.title)} 封面" src="${esc(big)}?default=false" onerror="this.parentNode.innerHTML='<div class=&quot;ph&quot;>'+this.alt.replace(' 封面','')+'<small>暫無封面</small></div>'"></div>`;
  }

  // ---------- 週次書單邏輯 ----------
  function bookMap(list) { const m = {}; list.books.forEach(b => m[b.id] = b); return m; }
  function listStart(list) { const s = settings().starts[list.id]; return s || null; }
  function listPosition(list, today) {
    const start = listStart(list) || today;
    const days = diffDays(start, today);
    if (days < 0) return { notStarted: true, start, days, week: 1, round: 1, dayInWeek: 1 };
    const absWeek = Math.floor(days / 7) + 1;
    const n = list.weeksPerRound || list.weeks.length;
    return { start, days, absWeek, week: ((absWeek - 1) % n) + 1, round: Math.floor((absWeek - 1) / n) + 1, dayInWeek: (days % 7) + 1 };
  }
  function weekBooks(list, w) { const wk = list.weeks[w - 1]; return wk && wk.books ? wk.books : []; }
  function todaysSet(list, pos) {
    const wk = list.weeks[pos.week - 1];
    const bm = bookMap(list);
    if (wk.type === 'new') {
      const ids = wk.books;
      return { wk, ids, books: ids.map(i => bm[i]), focus: bm[ids[(pos.dayInWeek - 1) % ids.length]], label: `第 ${pos.week} 週（新書週）` };
    }
    const rv = wk.reviewWeeks;
    const which = rv[Math.max(pos.days, 0) % rv.length];
    const ids = weekBooks(list, which);
    return { wk, ids, books: ids.map(i => bm[i]), focus: bm[ids[Math.floor(Math.max(pos.days, 0) / rv.length) % ids.length]], label: `第 ${pos.week} 週（複習週：第 ${rv[0]}–${rv[rv.length - 1]} 週）`, reviewOf: which };
  }

  // ---------- 今天頁 ----------
  function renderToday() {
    const t = todayStr(), st = settings();
    const list = S.lists[0];
    const pos = listPosition(list, t);
    const set = todaysSet(list, pos);
    const dwe = S.dwe, color = dwe.colors.find(c => c.id === st.dweColor) || dwe.colors[0];
    const dweDay = st.dweStart ? diffDays(st.dweStart, t) + 1 : null;
    const wd = weekday(t);
    const rotId = dwe.rotation[String(wd)];
    const rotItem = dwe.official.find(o => o.id === rotId);
    const focus = set.focus;
    const playsKey = `plays:${t}:${focus.id}`;

    let h = '';
    h += `<section class="card"><div class="kicker">${t.replace(/-/g, '/')}（星期${WD[wd]}）· 台北時間</div>
      <div class="plan-title">今天的學習計劃</div>
      <div class="chips"><span class="chip">📖 廖彩杏 ${pos.notStarted ? '尚未開始' : `第 ${pos.week} 週 · 第 ${pos.dayInWeek} 天` + (pos.round > 1 ? ` · 第 ${pos.round} 輪` : '')}</span>
      <span class="chip" style="background:${color.hex}22">🎬 寰宇 ${esc(color.name)} · 第 ${st.dweProgram} 集${dweDay && dweDay > 0 ? ` · 這個顏色第 ${dweDay} 天` : ''}</span></div>`;
    if (!listStart(list)) h += `<div class="notice">還沒設定廖彩杏開始日，先當作<b>今天是第 1 週第 1 天</b>。<button class="btn sm" data-act="startToday">就從今天開始</button> <a href="#settings">改日期</a></div>`;
    if (pos.notStarted) h += `<div class="notice">廖彩杏書單預計 ${esc(pos.start)} 開始，下面先預覽第 1 週。</div>`;
    if (!st.dweStart) h += `<div class="notice">寰宇進度還沒設定（顏色、第幾集、這個顏色從哪天開始）。<a href="#settings">去設定</a></div>`;
    h += `<p class="muted" style="margin:6px 0 0;font-size:14px">建議順序：① 寰宇官方步驟 → ② 家長常見補充（可選）→ ③ 排字母與 phonics → ④ 廖彩杏共讀 → ⑤ 今天可以說的話。順序可依作息調整。</p></section>`;

    // ① DWE 官方
    const doneK = id => `done:${t}:${id}`;
    const li = (o, extra) => {
      const d = store.get(doneK(o.id), false);
      return `<li class="${d ? 'done' : ''}"><input type="checkbox" data-done="${o.id}" ${d ? 'checked' : ''} aria-label="${esc(o.name)}"><div><b>${esc(o.name)}${extra || ''}</b><div class="how">${esc(o.how)}</div></div></li>`;
    };
    const daily = dwe.official.filter(o => o.group === 'daily');
    const stage = dwe.official.filter(o => o.group !== 'daily');
    h += `<section class="card sec-official"><div class="kicker">① 寰宇 DWE · 官方步驟 <span class="badge b-off">官方</span></div>
      <h2>${esc(color.name)} · 第 ${st.dweProgram} 集</h2>
      <p class="how muted" style="font-size:14px;margin:0">同一個顏色、同一集的教材一起用。官網建議每天從 5–20 分鐘開始，可以拆開在不同時段做。</p>
      <h3>每天的主軸（同顏色、第 ${st.dweProgram} 集）</h3><ul class="check">${daily.map(o => li(o, o.id === 'sp' || o.id === 'ta' ? `<span class="badge b-off">第 ${st.dweProgram} 集</span>` : '')).join('')}</ul>
      <h3>同顏色的其他官方教材</h3><p class="how muted" style="font-size:13px;margin:0">官方沒有公開每天要做哪一項；有上手指南或顧問進度就照那個做。</p>
      <ul class="check">${stage.map(o => li(o)).join('')}</ul>
      <details><summary>官方說明的來源與限制</summary><p style="font-size:14px">${esc(dwe.officialNote)}</p><p style="font-size:14px">${esc(dwe.officialTime)}</p></details></section>`;

    // ② 家長常見補充
    const sup = dwe.supplements;
    h += `<section class="card sec-sup"><div class="kicker">② 家長常見補充 <span class="badge b-sup">非官方</span></div>
      <h2>可以選著用的小方法</h2>
      <p class="how muted" style="font-size:14px;margin:0">這些是其他家長常用的做法，不是寰宇的官方步驟。孩子最近不太想玩寰宇時，可以挑一兩個讓它輕鬆一點。</p>
      ${rotItem ? `<div class="notice" style="margin-top:10px">本站建議今天加做：<b>${esc(rotItem.name)}</b> <span class="badge b-site">本站輪替・非官方</span><br><span style="font-size:13px">${esc(dwe.rotationNote)}</span></div>` : ''}
      <ul class="check">${sup.map(o => { const d = store.get(doneK(o.id), false); return `<li class="${d ? 'done' : ''}"><input type="checkbox" data-done="${o.id}" ${d ? 'checked' : ''}><div><b>${esc(o.name)}</b><div class="how">${esc(o.how)}</div></div></li>`; }).join('')}</ul></section>`;

    // ③ 每天固定
    const habits = (S.daily && S.daily.items) || [];
    if (habits.length) {
      const sayHTML0 = x => `<div class="say"><div class="zh">${esc(x.zh)}</div><div class="en">“${esc(x.en)}”</div><div class="re">孩子可能回：${esc(x.reply)}</div></div>`;
      h += `<section class="card sec-daily"><div class="kicker">③ 每天固定</div>
        <h2>${esc(S.daily.title)}</h2>
        <ul class="check">${habits.map(o => {
          const d = store.get(doneK(o.id), false);
          const links = (o.links || []).map(l => `<a class="btn sm ${l.kind === 'audio' ? 'ghost' : ''}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>${l.note ? `<span class="muted" style="font-size:12px">${esc(l.note)}</span>` : ''}`).join('');
          const says = (o.say || []).map(sayHTML0).join('');
          return `<li class="${d ? 'done' : ''}"><input type="checkbox" data-done="${esc(o.id)}" ${d ? 'checked' : ''} aria-label="${esc(o.name)}"><div><b>${esc(o.name)}</b><div class="how">${esc(o.how)}</div><div class="habit-links">${links}</div>${says ? `<div class="talk" style="margin-top:10px">${says}</div>` : ''}</div></li>`;
        }).join('')}</ul></section>`;
    }

    // ④ 廖彩杏
    const plays = store.get(playsKey, 0);
    h += `<section class="card"><div class="kicker">④ 廖彩杏共讀 · 今天拿這本</div>
      <div class="hero" style="margin-top:8px">${coverHTML(focus, 'big')}<div>
        <h3>${esc(focus.title)}</h3><div class="muted">${esc(focus.author)}</div>
        <div class="chips"><span class="chip">${esc(set.label)}</span>${set.reviewOf ? `<span class="chip">今天複習第 ${set.reviewOf} 週那組</span>` : ''}<span class="chip">書單第 ${focus.no} 本</span></div>
        <div style="font-size:14px">這週整組都要聽，今天先拿這本當<b>共讀主角</b>。廖彩杏的方法是這組書每天播放 3 次。</div>
        <div class="plays" aria-label="今天播放次數">今天第幾次：${[1, 2, 3].map(n => `<button class="dot ${plays >= n ? 'on' : ''}" data-play="${n}">${n}</button>`).join('')}</div>
        ${focus.note ? `<div class="note" style="margin-top:6px">※ ${esc(focus.note)}</div>` : ''}
      </div></div>
      <h3>這組的書（點一下換今天的主角）</h3>
      <div class="set">${set.books.map(b => `<button class="mini ${b.id === focus.id ? 'on' : ''}" data-focus="${b.id}">${coverHTML(b)}<div class="t">${esc(b.title)}</div></button>`).join('')}</div>
    </section>`;

    // ④ 說話
    const talk = S.talk;
    const tags = focus.tags || ['story'];
    let pool = [];
    tags.forEach(tg => (talk.tags[tg] || []).forEach(x => pool.push(x)));
    if (!pool.length) pool = talk.tags.story;
    const seed = hash(t + focus.id);
    const pick = (arr, n) => { const out = []; const a = arr.slice(); let s = seed; while (a.length && out.length < n) { s = (s * 1103515245 + 12345) >>> 0; out.push(a.splice(s % a.length, 1)[0]); } return out; };
    const bookLines = [talk.book[seed % talk.book.length]].concat(pick(pool, 2));
    const dweLines = [].concat(pick(talk.dwe.ta, 1), pick(talk.dwe[rotId] || talk.dwe.sa, 1), pick(talk.dwe.sp, 1));
    const sayHTML = x => `<div class="say"><div class="zh">${esc(x.zh)}</div><div class="en">“${esc(x.en)}”</div><div class="re">孩子可能回：${esc(x.reply)}</div></div>`;
    h += `<section class="card sec-talk"><div class="kicker">⑤ 今天可以說的話</div>
      <h2>跟 ${esc(st.childName)} 一起說</h2><p class="muted" style="font-size:13px;margin:0">${esc(talk.note)}</p>
      <h3>📖 讀《${esc(focus.title)}》時</h3><div class="talk">${bookLines.map(sayHTML).join('')}</div>
      <h3>🎬 玩寰宇時</h3><div class="talk">${dweLines.map(sayHTML).join('')}</div></section>`;

    $app.innerHTML = h;
    $app.querySelectorAll('[data-done]').forEach(el => el.addEventListener('change', () => { store.set(doneK(el.dataset.done), el.checked); el.closest('li').classList.toggle('done', el.checked); }));
    $app.querySelectorAll('[data-play]').forEach(el => el.addEventListener('click', () => { const n = +el.dataset.play; store.set(playsKey, plays === n ? n - 1 : n); renderToday(); }));
    $app.querySelectorAll('[data-focus]').forEach(el => el.addEventListener('click', () => { store.set(`focus:${t}`, el.dataset.focus); renderToday(); }));
    const st2 = $app.querySelector('[data-act=startToday]');
    if (st2) st2.addEventListener('click', () => { const s = settings(); s.starts[list.id] = t; saveSettings(s); renderToday(); });
  }

  // 使用者在今天頁點了別本當主角
  const _todaysSet = todaysSet;
  todaysSet = function (list, pos) {
    const r = _todaysSet(list, pos);
    const f = store.get(`focus:${todayStr()}`, null);
    if (f && r.ids.includes(f)) r.focus = bookMap(list)[f];
    return r;
  };

  // ---------- 書單頁 ----------
  function renderLists(q) {
    const st = settings(); const t = todayStr();
    const id = store.get('activeList', S.lists[0].id);
    const list = S.lists.find(l => l.id === id) || S.lists[0];
    const bm = bookMap(list); const pos = listPosition(list, t);
    const own = store.get('own', {});
    q = (q || '').trim().toLowerCase();
    let h = `<section class="card"><div class="listtabs">${S.lists.map(l => `<button class="btn sm ${l.id === list.id ? '' : 'ghost'}" data-list="${l.id}">${esc(l.name)}</button>`).join('')}<span class="muted" style="font-size:13px">之後可加其他書單</span></div>
      <h2>${esc(list.name)}</h2><p style="font-size:14px;margin:4px 0">${esc(list.method)}</p>
      <p class="muted" style="font-size:13px;margin:4px 0">版本：${esc(list.edition)}・共 ${list.books.length} 本・${list.weeks.length} 週</p>
      <input type="search" id="q" placeholder="搜尋書名或作者" value="${esc(q)}" style="max-width:100%;margin-top:8px"></section><section class="card">`;
    const bookRow = b => `<div class="book">${coverHTML(b)}<div><div class="t">${esc(b.title)}</div><div class="muted">${esc(b.author)}</div>${b.isbn ? `<div class="muted">參考版 ISBN ${esc(b.isbn)}</div>` : ''}${b.note ? `<div class="note">※ ${esc(b.note)}</div>` : ''}<button class="own ${own[b.id] ? 'on' : ''}" data-own="${b.id}">${own[b.id] ? '✓ 我有這本' : '＋ 我有這本'}</button>${b.openLibrary ? ` <a style="font-size:12px" href="${esc(b.openLibrary)}" target="_blank" rel="noopener">書目</a>` : ''}</div></div>`;
    if (q) {
      const hits = list.books.filter(b => (b.title + ' ' + b.author).toLowerCase().includes(q));
      const weeksOf = id => list.weeks.filter(w => w.books && w.books.includes(id)).map(w => w.week);
      h += `<h3>找到 ${hits.length} 本</h3><div class="books">${hits.map(b => bookRow(b).replace('</div></div>', `<div class="muted">第 ${weeksOf(b.id).join('、')} 週</div></div></div>`)).join('')}</div>`;
    } else {
      list.weeks.forEach(w => {
        const cur = !pos.notStarted && w.week === pos.week;
        const date = addDays(pos.start, (w.week - 1) * 7 + ((pos.round || 1) - 1) * 7 * list.weeks.length);
        h += `<div class="week ${cur ? 'cur' : ''}" id="w${w.week}"><h3>第 ${w.week} 週 ${cur ? '<span class="badge b-site">這週</span>' : ''} <span class="muted" style="font-size:13px;font-weight:400">${date.slice(5).replace('-', '/')} 起</span></h3>`;
        if (w.type === 'new') h += `<div class="books">${w.books.map(i => bookRow(bm[i])).join('')}</div>`;
        else h += `<p class="muted" style="margin:0">複習週：輪流聽第 ${w.reviewWeeks.join('、')} 週的書。</p>`;
        h += `</div>`;
      });
    }
    h += `</section><section class="card"><h3>資料來源</h3><ul class="src">${list.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul></section>`;
    $app.innerHTML = h;
    const qi = $app.querySelector('#q');
    qi.addEventListener('input', () => { const v = qi.value; renderLists(v); const n = $app.querySelector('#q'); n.focus(); n.setSelectionRange(v.length, v.length); });
    $app.querySelectorAll('[data-own]').forEach(el => el.addEventListener('click', () => { const o = store.get('own', {}); o[el.dataset.own] = !o[el.dataset.own]; store.set('own', o); el.classList.toggle('on'); el.textContent = o[el.dataset.own] ? '✓ 我有這本' : '＋ 我有這本'; }));
    $app.querySelectorAll('[data-list]').forEach(el => el.addEventListener('click', () => { store.set('activeList', el.dataset.list); renderLists(); }));
    if (!q && !pos.notStarted) { const c = document.getElementById('w' + pos.week); if (c && !renderLists._scrolled) { renderLists._scrolled = true; setTimeout(() => c.scrollIntoView({ block: 'start' }), 50); } }
  }

  // ---------- 寰宇說明頁 ----------
  function renderDwe() {
    const d = S.dwe;
    const srcLinks = ix => ix.map(i => d.sources[i] ? `<a href="${esc(d.sources[i].url)}" target="_blank" rel="noopener">[${i + 1}]</a>` : '').join(' ');
    let h = `<section class="card sec-official"><div class="kicker">官方說明 <span class="badge b-off">官方</span></div><h2>寰宇 DWE 官方跑法（公開資料整理）</h2>
      <p style="font-size:14px">${esc(d.officialNote)}</p>
      <h3>四個顏色</h3><div class="chips">${d.colors.map(c => `<span class="chip" style="background:${c.hex}22">${esc(c.name)}：第 ${c.programs.join('、')} 集</span>`).join('')}</div>
      <h3>各教材怎麼用</h3><ul class="check">${d.official.map(o => `<li><div><b>${esc(o.name)}</b><div class="how">${esc(o.how)} ${srcLinks(o.src)}</div></div></li>`).join('')}</ul>
      <p style="font-size:14px">${esc(d.officialTime)} ${srcLinks([10])}</p></section>
      <section class="card sec-sup"><div class="kicker">家長常見補充 <span class="badge b-sup">非官方</span></div><h2>大家常加的做法</h2>
      <ul class="check">${d.supplements.map(o => `<li><div><b>${esc(o.name)}</b><div class="how">${esc(o.how)} ${srcLinks(o.src)}</div></div></li>`).join('')}</ul>
      <p style="font-size:13px" class="muted">${esc(d.rotationNote)}</p></section>
      <section class="card"><h3>來源</h3><ol class="src">${d.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ol></section>`;
    $app.innerHTML = h;
  }

  // ---------- 設定頁 ----------
  function renderSettings() {
    const st = settings(), t = todayStr();
    const list = S.lists[0]; const pos = listPosition(list, t);
    const color = S.dwe.colors.find(c => c.id === st.dweColor) || S.dwe.colors[0];
    let h = `<section class="card"><h2>孩子</h2><div class="grid2"><div><label>名字</label><input type="text" id="name" value="${esc(st.childName)}"></div>
      <div><label>生日</label><input type="date" id="birth" value="${esc(st.birth)}"><div class="muted" style="font-size:13px">今天 ${esc(age(st.birth, t))}</div></div></div></section>
      <section class="card"><h2>廖彩杏書單進度</h2>
      <label>第 1 週第 1 天是哪一天</label><input type="date" id="lstart" value="${esc(listStart(list) || '')}">
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm ghost" data-ls="today">從今天開始</button><button class="btn sm ghost" data-ls="monday">從這週一開始</button></div>
      <label>或直接跳到：今天是第幾週</label><input type="number" id="jump" min="1" max="52" value="${pos.notStarted ? 1 : pos.week}" style="max-width:120px"> <button class="btn sm" id="dojump">套用</button>
      <p class="muted" style="font-size:13px">每 7 天換下一週；52 週跑完會自動從第 1 週開始第 2 輪。</p></section>
      <section class="card sec-official"><h2>寰宇 DWE 進度</h2><div class="grid2">
      <div><label>目前顏色</label><select id="dcolor">${S.dwe.colors.map(c => `<option value="${c.id}" ${c.id === color.id ? 'selected' : ''}>${esc(c.name)}（第 ${c.programs.join('、')} 集）</option>`).join('')}</select></div>
      <div><label>目前第幾集</label><select id="dprog">${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option ${n === +st.dweProgram ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label>這個顏色從哪天開始</label><input type="date" id="dstart" value="${esc(st.dweStart || '')}"></div></div>
      <p class="muted" style="font-size:13px">換顏色或換集數時回來這裡改；本站不會自動幫你換集，跟著你的上手指南或顧問進度走。</p></section>
      <section class="card"><h2>資料</h2><p class="muted" style="font-size:14px">設定、打勾和「我有這本」都只存在這台裝置的瀏覽器裡，換手機要重新設定。</p>
      <button class="btn sm ghost" id="reset">清除這台裝置的所有紀錄</button></section>`;
    $app.innerHTML = h;
    const v = id => document.getElementById(id);
    v('name').onchange = () => saveSettings({ childName: v('name').value || 'Shanie' });
    v('birth').onchange = () => { saveSettings({ birth: v('birth').value }); renderSettings(); };
    const setStart = d => { const s = settings(); s.starts[list.id] = d; saveSettings(s); renderSettings(); };
    v('lstart').onchange = () => v('lstart').value && setStart(v('lstart').value);
    $app.querySelectorAll('[data-ls]').forEach(b => b.onclick = () => setStart(b.dataset.ls === 'today' ? t : mondayOf(t)));
    v('dojump').onclick = () => { const n = Math.min(52, Math.max(1, +v('jump').value || 1)); setStart(addDays(t, -(n - 1) * 7)); };
    v('dcolor').onchange = () => { const c = S.dwe.colors.find(x => x.id === v('dcolor').value); saveSettings({ dweColor: c.id, dweProgram: c.programs[0] }); renderSettings(); };
    v('dprog').onchange = () => { const n = +v('dprog').value; const c = S.dwe.colors.find(x => x.programs.includes(n)); saveSettings({ dweProgram: n, dweColor: c.id }); renderSettings(); };
    v('dstart').onchange = () => saveSettings({ dweStart: v('dstart').value || null });
    v('reset').onclick = () => { if (confirm('確定清除這台裝置上 Shanie學習 的所有設定與紀錄？')) { Object.keys(localStorage).filter(k => k.startsWith(KEY)).forEach(k => localStorage.removeItem(k)); renderSettings(); } };
  }

  // ---------- 路由 ----------
  function route() {
    const v = (location.hash || '#today').slice(1);
    document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
    const st = settings();
    document.getElementById('subline').textContent = `${st.childName} · ${age(st.birth, todayStr())} · 每天打開看今天要做什麼`;
    ({ today: renderToday, lists: () => { renderLists._scrolled = false; renderLists(); }, dwe: renderDwe, settings: renderSettings }[v] || renderToday)();
    if (v !== 'lists') window.scrollTo(0, 0);
  }

  async function load() {
    const j = u => fetch(u, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
    try {
      const idx = await j('data/lists/index.json');
      S.lists = await Promise.all(idx.bookLists.map(l => j(l.file)));
      S.dwe = await j(idx.programs.find(p => p.id === 'dwe').file);
      S.talk = await j(idx.talk);
      if (idx.daily) S.daily = await j(idx.daily);
    } catch (e) { $app.innerHTML = '<p class="pad">資料載入失敗，請重新整理。</p>'; return; }
    window.addEventListener('hashchange', route);
    let last = todayStr();
    setInterval(() => { const n = todayStr(); if (n !== last) { last = n; route(); } }, 60000);
    route();
  }
  load();
})();
