/* 판옵티콘 채용 대시보드 — app.js
   · 홈: 인물 카드 그리드 (사진 + 요약 + 점수)
   · 상세: 인물별 랜딩 페이지 + 채점
   · 상태: results.json(공용 커밋본) ⊕ localStorage(내 브라우저) 후보별 타임스탬프 병합
*/
(function () {
'use strict';

var D = window.D;
var KEY = 'pano_hire_v4';
var LABELS = { 1: '미흡', 2: '부족', 3: '보통', 4: '우수', 5: '탁월' };
var SHORT = { logic: '로직', tech: '협업', biz: '사업', solve: '문제', ai: 'AI', fit: '인성', comm: '소통', gut: '직감' };
var KSHORT = { collab: '개발·디자인·경영진 협업', ai: 'AI 활용', biz: '사업적 사고', person: '인성·성격' };
var AVCOL = [['#7A4099', '#B07FCB'], ['#2F6FDE', '#6FA3F0'], ['#0E8F6E', '#4FC3A1'], ['#C97B00', '#F0B24F'], ['#C2413B', '#E5837E'], ['#4E2566', '#8B5FA8'], ['#1F7A8C', '#5BB3C4']];

var S = {};        // 통합 상태
var RO = false;    // 검토 모드
var FILTER = 'all', SORT = 'score', Q = '';
var FH = null, WT = null;  // 파일 핸들(로컬 HTML 저장용)

/* ───────── 유틸 */
function $(s, r) { return (r || document).querySelector(s); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function oneLine(s) { return String(s || '').replace(/\s*\n+\s*/g, ' / ').trim(); }
function cs(id) { if (!S[id]) S[id] = { scores: {}, memo: {}, flags: {}, checks: {}, verdict: '', rec: '' }; return S[id]; }
function weighted(id) { var t = 0, n = 0, st = cs(id); D.RUBRIC.forEach(function (r) { var v = st.scores[r.key]; if (v) { t += v / 5 * r.w; n++; } }); return { t: Math.round(t), n: n }; }
function verdictFor(t) { for (var i = 0; i < D.VERDICTS.length; i++) if (t >= D.VERDICTS[i].min) return D.VERDICTS[i]; return D.VERDICTS[D.VERDICTS.length - 1]; }
function vlabel(st) { if (!st.verdict) return '–'; for (var i = 0; i < D.VERDICTS.length; i++) if (D.VERDICTS[i].key === st.verdict) return D.VERDICTS[i].label; return '–'; }
function recLabel(k) { return { Y: '추천', H: '보류', N: '비추천' }[k] || '–'; }
function cand(id) { for (var i = 0; i < D.CANDIDATES.length; i++) if (D.CANDIDATES[i].id === id) return D.CANDIDATES[i]; return null; }
function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function stamp() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()); }

/* ───────── 상태 로드 · 저장 */
function loadLocal() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
function mergeState(base, local) {
  var out = {}, ids = {};
  Object.keys(base || {}).forEach(function (k) { ids[k] = 1; });
  Object.keys(local || {}).forEach(function (k) { ids[k] = 1; });
  Object.keys(ids).forEach(function (k) {
    if (k.charAt(0) === '_') return;
    var b = (base || {})[k], l = (local || {})[k];
    if (!b) { out[k] = l; return; }
    if (!l) { out[k] = b; return; }
    out[k] = ((l._ts || '') >= (b._ts || '')) ? l : b;   // 후보별 최신본 채택
  });
  out._base = (base || {})._savedAt || '';
  out._savedAt = (local || {})._savedAt || out._base;
  return out;
}
function save() {
  S._savedAt = new Date().toISOString();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  setChip(FH ? '파일에 저장 중…' : '이 브라우저에 저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), !FH);
  scheduleWrite();
}
function touch(id) { cs(id)._ts = new Date().toISOString(); }
function setChip(t, warn) { var c = $('#saveChip'); if (c) { c.textContent = t; c.className = 'savechip' + (warn ? ' warn' : ''); } }

/* ───────── 아바타 */
function avatar(c, cls) {
  if (c.photo) return '<img src="img/' + c.id + '.jpg" alt="' + esc(c.name) + '" loading="lazy">';
  var p = AVCOL[hash(c.id) % AVCOL.length];
  return '<div class="ini" style="background:linear-gradient(140deg,' + p[0] + ',' + p[1] + ')">' + esc(c.name) + '</div>';
}

/* ───────── 라우팅 */
function go(h) { if (location.hash === h) render(); else location.hash = h; }
window.go = go;
function route() {
  var h = (location.hash || '#/').replace(/^#/, '');
  var m = h.match(/^\/c\/([a-z_]+)/);
  if (m) return { v: 'cand', id: m[1] };
  if (h.indexOf('/compare') === 0) return { v: 'compare' };
  if (h.indexOf('/guide') === 0) return { v: 'guide' };
  return { v: 'home' };
}

/* ───────── 통계 · 목록 */
function rows() {
  return D.CANDIDATES.map(function (c) {
    var st = cs(c.id), w = weighted(c.id);
    return { c: c, st: st, w: w, absent: !!st.absent, scored: !st.absent && w.n > 0 };
  });
}
function statsOf(rs) {
  return {
    total: rs.length,
    done: rs.filter(function (r) { return r.scored; }).length,
    rec: rs.filter(function (r) { return r.st.rec === 'Y'; }).length,
    absent: rs.filter(function (r) { return r.absent; }).length,
    pending: rs.filter(function (r) { return !r.absent && !r.w.n; }).length
  };
}
function filtered() {
  var rs = rows();
  if (FILTER === 'done') rs = rs.filter(function (r) { return r.scored; });
  else if (FILTER === 'rec') rs = rs.filter(function (r) { return r.st.rec === 'Y'; });
  else if (FILTER === 'pending') rs = rs.filter(function (r) { return !r.absent && !r.w.n; });
  else if (FILTER === 'absent') rs = rs.filter(function (r) { return r.absent; });
  if (Q) {
    var q = Q.toLowerCase();
    rs = rs.filter(function (r) {
      return (r.c.name + ' ' + r.c.summary + ' ' + r.c.total + ' ' + r.c.status + ' ' + r.c.edu.join(' ') + ' ' +
        r.c.career.map(function (x) { return x[1] + ' ' + x[2]; }).join(' ')).toLowerCase().indexOf(q) >= 0;
    });
  }
  if (SORT === 'score') rs.sort(function (a, b) { return (b.absent ? -1 : b.w.t) - (a.absent ? -1 : a.w.t); });
  else if (SORT === 'name') rs.sort(function (a, b) { return a.c.name.localeCompare(b.c.name, 'ko'); });
  else if (SORT === 'exp') rs.sort(function (a, b) { return months(b.c.total) - months(a.c.total); });
  return rs;
}
function months(t) { var m = String(t).match(/(\d+)\s*년(?:\s*(\d+)\s*개월)?/); if (m) return (+m[1]) * 12 + (+(m[2] || 0)); var m2 = String(t).match(/(\d+)\s*개월/); return m2 ? +m2[1] : 0; }

/* ───────── 뷰: 홈 대시보드 */
function viewHome() {
  var rs = rows(), st = statsOf(rs), list = filtered();
  var seg = function (v, t) { return '<button class="' + (SORT === v ? 'on' : '') + '" onclick="setSort(\'' + v + '\')">' + t + '</button>'; };
  var stat = function (k, n, l) { return '<div class="stat' + (FILTER === k ? ' on' : '') + '" onclick="setFilter(\'' + k + '\')"><b>' + n + '</b><span>' + l + '</span></div>'; };
  return '' +
    '<div class="dash-hero">' +
      '<h1>프로덕트 기획자 채용 현황</h1>' +
      '<p>' + esc(D.META.sub) + ' · ' + esc(D.META.date) + ' · ' + esc(D.META.owner) + '</p>' +
      '<div class="stats">' +
        stat('all', st.total, '전체 지원자') +
        stat('done', st.done, '면접 완료') +
        stat('rec', st.rec, '2차 추천') +
        stat('pending', st.pending, '면접 예정') +
        stat('absent', st.absent, '미참여') +
      '</div>' +
    '</div>' +
    '<div class="toolbar noprint">' +
      '<div class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<input type="search" id="q" placeholder="이름 · 회사 · 경력 · 학교 검색" value="' + esc(Q) + '" oninput="setQ(this.value)"></div>' +
      '<div class="segs">' + seg('score', '점수순') + seg('exp', '경력순') + seg('name', '이름순') + '</div>' +
    '</div>' +
    (list.length ? '<div class="grid">' + list.map(cardHTML).join('') + '</div>'
      : '<div class="empty"><b>해당하는 지원자가 없습니다</b>필터나 검색어를 바꿔보세요.</div>');
}
function cardHTML(r, i) {
  var c = r.c, st = r.st, w = r.w;
  var v = st.verdict ? vlabel(st) : (w.n ? verdictFor(w.t).label : '');
  var vc = st.verdict === 'SH' || st.verdict === 'H' ? 'g' : st.verdict === 'LN' ? 'y' : st.verdict === 'NH' ? 'r' : 'n';
  var tags = [];
  if (r.absent) tags.push('<span class="tag n">⊘ 면접 미참여</span>');
  else {
    if (v) tags.push('<span class="tag ' + (st.verdict ? vc : 'n') + '">' + esc(v) + (st.verdict ? '' : ' (자동)') + '</span>');
    if (st.rec) tags.push('<span class="tag ' + (st.rec === 'Y' ? 'g' : st.rec === 'H' ? 'y' : 'r') + '">2차 ' + recLabel(st.rec) + '</span>');
    if (!w.n) tags.push('<span class="tag n">면접 예정</span>');
    var fl = D.FLAGS.filter(function (f, i2) { return st.flags[i2]; }).length;
    if (fl) tags.push('<span class="tag r">⚠ ' + fl + '</span>');
  }
  var bars = D.RUBRIC.map(function (x) {
    var s = st.scores[x.key] || 0;
    return '<i class="' + (s ? 'f' : '') + '" style="height:' + (s ? 4 + s * 3.6 : 4) + 'px" title="' + esc(x.name) + ' ' + (s || '-') + '"></i>';
  }).join('');
  return '<article class="pcard' + (r.absent ? ' absent' : '') + '" onclick="go(\'#/c/' + c.id + '\')">' +
    '<div class="ph">' + avatar(c) +
      (SORT === 'score' && w.n && !r.absent ? '<span class="rk">#' + (i + 1) + '</span>' : '') +
      (w.n && !r.absent ? '<span class="sc"><b>' + w.t + '</b><i>/ 100</i></span>' : '') +
    '</div>' +
    '<div class="pbody">' +
      '<div class="pname"><h3>' + esc(c.name) + '</h3><span>' + esc(c.gender) + ' · ' + esc(c.age) + '</span></div>' +
      '<div class="meta-row">' + (tags.join('') || '<span class="tag n">미채점</span>') + '</div>' +
      '<p class="psum">' + esc(c.summary) + '</p>' +
      '<div class="pfoot"><span class="info">경력 ' + esc(c.total.split('(')[0].trim()) + '</span><div class="bars">' + bars + '</div></div>' +
    '</div></article>';
}
window.setFilter = function (f) { FILTER = f; render(); };
window.setSort = function (s) { SORT = s; render(); };
window.setQ = function (v) {
  Q = v;
  var el = $('#app .grid') || $('#app .empty'), list = filtered();
  var html = list.length ? '<div class="grid">' + list.map(cardHTML).join('') + '</div>' : '<div class="empty"><b>해당하는 지원자가 없습니다</b>필터나 검색어를 바꿔보세요.</div>';
  if (el) el.outerHTML = html;
};

/* ───────── 뷰: 상세 */
function viewCand(c) {
  var st = cs(c.id), w = weighted(c.id), v = verdictFor(w.t);
  var rub = {}; D.RUBRIC.forEach(function (r) { rub[r.key] = r; });
  var sc = function (k) {
    var val = st.scores[k];
    return '<div class="score">' + [1, 2, 3, 4, 5].map(function (n) {
      return '<button class="' + (val === n ? 'on' : '') + '" onclick="setScore(\'' + c.id + '\',\'' + k + '\',' + n + ')"><b>' + n + '</b><small>' + LABELS[n] + '</small></button>';
    }).join('') + (RO && !val ? '<span class="mut sm" style="align-self:center">미채점</span>' : '') + '</div>';
  };
  var ta = function (k, ph, h) {
    if (RO) return '<div class="ro' + (st.memo[k] ? '' : ' empty') + '">' + (esc(st.memo[k]) || '기록 없음') + '</div>';
    return '<textarea ' + (h ? 'style="min-height:' + h + 'px"' : '') + ' placeholder="' + esc(ph || '') + '" oninput="setMemo(\'' + c.id + '\',\'' + k + '\',this.value)">' + esc(st.memo[k] || '') + '</textarea>';
  };
  var inp = function (k, ph) { return '<input class="f" type="text" ' + (RO ? 'readonly' : '') + ' placeholder="' + esc(RO ? '–' : (ph || '')) + '" value="' + esc(st.memo[k] || '') + '" oninput="setMemo(\'' + c.id + '\',\'' + k + '\',this.value)">'; };
  var ck = D.CASE.checks.filter(function (x, i) { return st.checks[i]; }).length;
  var fl = D.FLAGS.filter(function (f, i) { return st.flags[i]; });
  var chip = function (b, s) { return '<div class="chip"><b>' + b + '</b><span>' + s + '</span></div>'; };
  var secH = function (id, num, t, hint) { return '<section id="' + id + '"><div class="sec-h"><span class="num">' + num + '</span><h2>' + t + '</h2>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; };

  var out = '';
  if (RO) {
    var done = rows().filter(function (r) { return r.scored; }).length;
    out += '<div class="banner"><div><b>검토 모드</b> — 면접관 기록을 읽기 전용으로 표시합니다. 채점 완료 <b>' + done + '/' + D.CANDIDATES.length + '명</b>' + (S._savedAt ? ' · 최종 ' + new Date(S._savedAt).toLocaleString('ko-KR') : '') + '</div><div class="noprint"><button class="btn" onclick="go(\'#/compare\')">비교표</button></div></div>';
  }
  if (st.absent) {
    out += '<div class="absent-banner"><div class="x">⊘</div><div><h2>면접 미참여</h2><p>' + esc(c.name) + ' 후보는 면접에 참여하지 않았습니다' + (st.memo.absentWhy ? ' — ' + esc(st.memo.absentWhy) : '') + '. 평가 대상에서 제외됩니다.</p></div>' +
      (RO ? '' : '<div class="un"><button class="btn" onclick="setAbsent(\'' + c.id + '\',false)">미참여 취소</button></div>') + '</div>';
  }

  out += '<div class="hero" id="s-profile"><div class="hero-in">' +
    '<div class="hero-ph">' + avatar(c) + '</div>' +
    '<div class="hero-txt">' +
      '<div class="eyebrow">후보 ' + (D.CANDIDATES.indexOf(c) + 1) + ' / ' + D.CANDIDATES.length + ' · 프로덕트 기획자 1차 면접</div>' +
      '<h1>' + esc(c.name) + '<em>' + esc(c.gender) + ' · ' + esc(c.birth) + ' · ' + esc(c.age) + '</em></h1>' +
      '<div class="contact">' + esc(c.phone) + ' &nbsp;·&nbsp; ' + esc(c.email) + ' &nbsp;·&nbsp; ' + esc(c.addr) + '</div>' +
      '<p class="lead">' + esc(c.summary) + '</p>' +
      '<div class="chips">' + chip('학력', c.edu.map(esc).join('<br>')) + chip('총 경력', esc(c.total)) + chip('현재 상태', esc(c.status)) + chip('연봉', esc(c.salary)) + chip('제출 자료', esc(c.files)) + '</div>' +
    '</div></div>' +
    '<div class="hero-meta"><label>면접</label>' +
      (RO ? '<span>' + esc(st.memo.date || '–') + ' ' + esc(st.memo.time || '') + ' · 면접관 ' + esc(st.memo.iv || '–') + '</span>'
          : '<input type="date" value="' + esc(st.memo.date || '') + '" oninput="setMemo(\'' + c.id + '\',\'date\',this.value)">' +
            '<input type="time" value="' + esc(st.memo.time || '') + '" oninput="setMemo(\'' + c.id + '\',\'time\',this.value)">' +
            '<input type="text" placeholder="면접관" style="width:130px" value="' + esc(st.memo.iv || '') + '" oninput="setMemo(\'' + c.id + '\',\'iv\',this.value)">' +
            (st.absent ? '' : '<button class="btn sm" style="margin-left:auto;background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.3)" onclick="askAbsent(\'' + c.id + '\')">면접 미참여 처리</button>')) +
    '</div></div>';

  out += '<div class="subnav noprint"><div class="in">' +
    [['s-career', '경력'], ['s-op', '서류 소견'], ['s-key', '★ 중점 4영역'], ['s-case', '로직 케이스'], ['s-eval', '평가표'], ['s-final', '종합 판정']]
      .map(function (x) { return '<a href="#" onclick="event.preventDefault();jump(\'' + x[0] + '\')">' + x[1] + '</a>'; }).join('') +
    '<span class="live">' + (w.n ? w.t + ' / 100 · ' + w.n + '/' + D.RUBRIC.length : '미채점') + (st.verdict ? ' · ' + vlabel(st) : '') + '</span>' +
    '</div></div>';

  out += '<div class="' + (st.absent ? 'dim' : '') + '">';

  out += secH('s-career', '01', '경력 이력', esc(c.total)) + '<div class="card"><div class="tl">' +
    c.career.map(function (r) { return '<div class="it"><div class="when">' + esc(r[0]) + '</div><div class="org">' + esc(r[1]) + '</div><div class="what">' + esc(r[2]) + '</div></div>'; }).join('') +
    '</div></div></section>';

  out += secH('s-op', '02', '서류 소견', '이력서 기반 · 면접에서 검증') + '<div class="grid2">' +
    '<div class="card op plus"><h3><span class="tag g">강점</span></h3><ul>' + c.strengths.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' +
    '<div class="card op minus"><h3><span class="tag y">확인 필요</span></h3><ul>' + c.concerns.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' +
    '</div>' +
    '<div class="card" style="margin-top:15px"><p class="lbl2">맞춤 질문 (이 지원자 전용)</p><ul style="margin:0;padding-left:19px">' +
    c.questions.map(function (q) { return '<li style="margin:7px 0;font-size:14.8px;line-height:1.6">' + esc(q) + '</li>'; }).join('') + '</ul></div></section>';

  out += secH('s-key', '03', '★ 대표님 중점 확인 4영역', '별도 기록 · 점수는 평가표에 자동 반영') +
    D.KEYQ.map(function (k) {
      var r = rub[k.rubric];
      return '<div class="key"><div class="band" style="background:' + k.color + '"><h3>' + esc(k.title) + '</h3><span class="to">→ 평가표 「' + esc(r.name) + '」 ' + r.w + '점</span></div>' +
        '<div class="body"><ul class="guide editonly">' + k.guide.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' +
        '<p class="scale editonly">' + esc(k.scale) + '</p>' +
        ta('key_' + k.key, '실제 사례 · 발언 그대로 · 수준 · 인상', 155) +
        '<div class="scorerow"><span class="lbl">점수</span>' + sc(k.rubric) + '</div></div></div>';
    }).join('') + '</section>';

  out += secH('s-case', '04', '로직 케이스 결과', '산모 입·퇴실 상태 관리 · ' + ck + '/5') + '<div class="card">' +
    '<div class="quote editonly" style="font-size:14.5px">“' + esc(D.CASE.prompt) + '”</div>' +
    D.CASE.checks.map(function (x, i) { return '<label class="chk' + (st.checks[i] ? ' on' : '') + '"><input type="checkbox" ' + (st.checks[i] ? 'checked' : '') + ' onchange="setCheck(\'' + c.id + '\',' + i + ',this.checked)"><span>' + esc(x) + '</span></label>'; }).join('') +
    '<div style="margin-top:13px">' + ta('case', '설계 내용 · 접근 방식 · 특이점') + '</div></div></section>';

  out += secH('s-eval', '05', '평가표', RO ? '' : '클릭 채점 · ' + D.RUBRIC.length + '항목') + '<div class="card">' +
    D.RUBRIC.map(function (r) {
      return '<div class="ev"><div><div class="nm">' + esc(r.name) + '<span>' + r.w + '점</span></div>' +
        '<div class="anc"><b>5</b> ' + esc(r.a5) + ' &nbsp;·&nbsp; <b>3</b> ' + esc(r.a3) + ' &nbsp;·&nbsp; <b>1</b> ' + esc(r.a1) + '</div></div>' + sc(r.key) + '</div>';
    }).join('') +
    '<div style="margin-top:17px">' + ta('evidence', '점수 근거 메모 (구체 발언 · 사례)', 108) + '</div></div></section>';

  out += secH('s-flag', '06', '레드 플래그 · 처우', fl.length ? fl.length + '건' : '') + '<div class="grid2">' +
    '<div class="card">' + D.FLAGS.map(function (f, i) {
      if (RO && !st.flags[i]) return '';
      return '<label class="chk bad' + (st.flags[i] ? ' on' : '') + '"><input type="checkbox" ' + (st.flags[i] ? 'checked' : '') + ' onchange="setFlag(\'' + c.id + '\',' + i + ',this.checked)"><span>' + esc(f) + '</span></label>';
    }).join('') + (RO && !fl.length ? '<div class="ro empty">해당 없음</div>' : '') + '</div>' +
    '<div class="card"><p class="lbl2">희망연봉</p>' + inp('pay', '예: 5,500만 (조정 가능)') +
      '<p class="lbl2" style="margin-top:13px">입사 가능일</p>' + inp('start', '예: 10월 초') +
      '<p class="lbl2" style="margin-top:13px">통근 · 출근</p>' + inp('commute', '예: 화곡 30분, 출근 OK') +
      '<p class="lbl2" style="margin-top:13px">기타</p>' + inp('etc', '') + '</div></div></section>';

  out += secH('s-final', '07', '종합 판정') +
    '<div class="gut"><h3>★ 면접관 직감 <span style="font-size:13px;opacity:.75;font-weight:500">20점 · 평가표에 자동 반영</span></h3>' +
    '<p>설명 못 해도 됩니다 — 이 사람과 같이 일하고 싶은가. 5 확신 · 3 비교해 봐야 · 1 아니다</p>' + sc('gut') + '</div>' +
    '<div class="card"><div class="final">' +
    '<div class="bigcard"><div class="n">' + (w.n ? w.t : '–') + '<small> /100</small></div><div class="bar"><i style="width:' + w.t + '%"></i></div>' +
    '<div class="sug">' + (w.n ? (w.n + '/' + D.RUBRIC.length + ' 항목 · 자동 제안 <b>' + v.label + '</b><br>' + esc(v.desc)) : '점수를 매기면 판정이 제안됩니다') + '</div></div>' +
    '<div><p class="lbl2">최종 판정 (면접관 결정)</p><div class="verd">' +
    D.VERDICTS.map(function (x) { return '<button class="' + x.key + (st.verdict === x.key ? ' on' : '') + '" onclick="setVerdict(\'' + c.id + '\',\'' + x.key + '\')">' + x.label + '</button>'; }).join('') +
    (RO && !st.verdict ? '<span class="mut">미판정</span>' : '') + '</div>' +
    '<p class="lbl2" style="margin-top:17px">2차(임원) 면접 추천</p><div class="verd">' +
    ['Y', 'H', 'N'].map(function (k) { return '<button class="' + (k === 'Y' ? 'H' : k === 'H' ? 'LN' : 'NH') + (st.rec === k ? ' on' : '') + '" onclick="setRec(\'' + c.id + '\',\'' + k + '\')">' + recLabel(k) + '</button>'; }).join('') +
    (RO && !st.rec ? '<span class="mut">–</span>' : '') + '</div></div></div>' +
    '<p class="lbl2" style="margin-top:20px">총평 (대표님 보고용 — 강점 / 우려 / 추천 이유 / 확신도)</p>' + ta('final', '', 180) + '</div></section>';

  out += '</div>';
  return out;
}
window.jump = function (id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

/* ───────── 뷰: 비교표 */
function viewCompare() {
  var rs = rows().sort(function (a, b) { return (b.absent ? -1 : b.w.t) - (a.absent ? -1 : a.w.t); });
  var head = '<tr><th>후보</th><th>나이 · 경력</th>' + D.RUBRIC.map(function (r) { return '<th style="text-align:center">' + esc(SHORT[r.key] || r.name) + '<br><span class="sm mut">' + r.w + '</span></th>'; }).join('') +
    '<th style="text-align:center">케이스</th><th style="text-align:center">⚠</th><th style="text-align:center">점수</th><th>판정</th><th>2차</th></tr>';
  var body = rs.map(function (r) {
    if (r.absent) return '<tr class="absent-row"><td><a href="#/c/' + r.c.id + '"><b>' + esc(r.c.name) + '</b></a></td><td class="sm">' + esc(r.c.age) + '<br>' + esc(r.c.total) + '</td><td colspan="' + (D.RUBRIC.length + 5) + '" style="text-align:center;font-weight:800">⊘ 면접 미참여</td></tr>';
    var fl = D.FLAGS.filter(function (f, i) { return r.st.flags[i]; }).length;
    var ck = D.CASE.checks.filter(function (f, i) { return r.st.checks[i]; }).length;
    var vv = r.st.verdict ? vlabel(r.st) : '';
    return '<tr><td><a href="#/c/' + r.c.id + '"><b>' + esc(r.c.name) + '</b></a></td><td class="sm">' + esc(r.c.age) + '<br>' + esc(r.c.total) + '</td>' +
      D.RUBRIC.map(function (x) { return '<td class="num">' + (r.st.scores[x.key] || '–') + '</td>'; }).join('') +
      '<td class="num">' + (r.w.n ? ck : '–') + '</td><td class="num">' + (fl ? '<span class="tag r">' + fl + '</span>' : '–') + '</td>' +
      '<td class="num" style="font-size:17px;color:var(--p)">' + (r.w.n ? r.w.t : '–') + '</td>' +
      '<td>' + (vv ? '<span class="tag ' + (r.st.verdict === 'SH' || r.st.verdict === 'H' ? 'g' : r.st.verdict === 'LN' ? 'y' : 'r') + '">' + esc(vv) + '</span>' : '–') + '</td>' +
      '<td>' + recLabel(r.st.rec) + '</td></tr>';
  }).join('');
  var keyTbl = '<tr><th style="width:92px">후보</th>' + D.KEYQ.map(function (k) { return '<th style="color:' + k.color + '">' + esc(KSHORT[k.key]) + '</th>'; }).join('') + '<th>총평</th></tr>' +
    rs.filter(function (r) { return !r.absent; }).map(function (r) {
      return '<tr><td><b>' + esc(r.c.name) + '</b><br><span class="sm mut">' + (r.w.n ? r.w.t + '점' : '–') + '</span></td>' +
        D.KEYQ.map(function (k) { return '<td class="sm"><span class="tag">' + (r.st.scores[k.rubric] || '–') + '</span> ' + (esc(r.st.memo['key_' + k.key]) || '<span class="mut">–</span>') + '</td>'; }).join('') +
        '<td class="sm">' + (esc(r.st.memo.final) || '<span class="mut">–</span>') + '</td></tr>';
    }).join('');
  var info = '<tr><th>이름</th><th>성별·나이</th><th>연락처</th><th>이메일</th><th>학력</th><th>총 경력 · 상태</th><th>희망연봉</th></tr>' +
    D.CANDIDATES.map(function (c) {
      return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.gender) + ' · ' + esc(c.age) + '</td><td>' + esc(c.phone) + '</td><td>' + esc(c.email) + '</td>' +
        '<td class="sm">' + c.edu.map(esc).join('<br>') + '</td><td class="sm">' + esc(c.total) + '<br>' + esc(c.status) + '</td>' +
        '<td class="sm">' + (esc(cs(c.id).memo.pay) || esc(c.salary)) + '</td></tr>';
    }).join('');
  return '<div class="dash-hero"><h1>' + D.CANDIDATES.length + '명 비교표</h1><p>가중 점수 내림차순 · 미참여는 하단</p></div>' +
    '<section><div class="sec-h"><span class="num">01</span><h2>점수 · 판정</h2></div><div class="card" style="padding:15px"><div style="overflow:auto"><table>' + head + body + '</table></div></div></section>' +
    '<section><div class="sec-h"><span class="num">02</span><h2>★ 중점 4영역 기록 · 총평</h2></div><div class="card" style="padding:15px"><div style="overflow:auto"><table>' + keyTbl + '</table></div></div></section>' +
    '<section><div class="sec-h"><span class="num">03</span><h2>인적사항 요약</h2></div><div class="card" style="padding:15px"><div style="overflow:auto"><table>' + info + '</table></div></div></section>';
}

/* ───────── 뷰: 안내 */
function viewGuide() {
  return '<div class="dash-hero"><h1>평가 기준 · 면접 운영</h1><p>' + esc(D.META.sub) + ' · ' + esc(D.META.owner) + '</p></div>' +
  '<section><div class="sec-h"><span class="num">01</span><h2>면접 진행 순서</h2><span class="hint">60분 기준</span></div><div class="card"><div class="tl">' +
    D.FLOW.map(function (f) { return '<div class="it"><div class="when">' + esc(f[0]) + '</div><div class="what">' + esc(f[1]) + '</div></div>'; }).join('') +
    '</div><h3 style="margin:24px 0 8px;font-size:16.5px">포트폴리오 딥다이브 공통 4문</h3><ul style="margin:0;padding-left:19px;font-size:15px;line-height:1.8">' +
    '<li>이 프로젝트에서 본인 기여 범위는 몇 %인가 — 기획/개발/디자인/운영으로 나누면?</li>' +
    '<li>가장 어려웠던 <b>로직 결정</b>은 무엇이고 왜 그렇게 정했나</li>' +
    '<li>출시 후 지표·운영 이슈는 무엇이었고 어떻게 대응했나</li><li>다시 한다면 무엇을 바꾸겠나</li></ul></div></section>' +
  '<section><div class="sec-h"><span class="num">02</span><h2>' + esc(D.CASE.title) + '</h2><span class="hint">' + esc(D.CASE.time) + '</span></div>' +
    '<div class="card"><div class="quote">“' + esc(D.CASE.prompt) + '”</div><div class="grid2">' +
    '<div><h3 style="margin:0 0 8px;font-size:16.5px">체크포인트 (각 1점)</h3>' + D.CASE.checks.map(function (c) { return '<div class="chk" style="cursor:default">' + esc(c) + '</div>'; }).join('') + '</div>' +
    '<div><h3 style="margin:0 0 8px;font-size:16.5px">좋은 신호</h3><div class="note" style="margin-bottom:13px">' + esc(D.CASE.good) + '</div>' +
    '<h3 style="margin:0 0 8px;font-size:16.5px">나쁜 신호</h3><div class="note" style="background:var(--bad2)">' + esc(D.CASE.bad) + '</div></div></div></div></section>' +
  '<section><div class="sec-h"><span class="num">03</span><h2>★ 대표님 중점 확인 4영역</h2><span class="hint">질문 가이드</span></div>' +
    D.KEYQ.map(function (k) {
      var r = D.RUBRIC.filter(function (x) { return x.key === k.rubric; })[0];
      return '<div class="key"><div class="band" style="background:' + k.color + '"><h3>' + esc(k.title) + '</h3><span class="to">→ 「' + esc(r.name) + '」 ' + r.w + '점</span></div>' +
        '<div class="body"><ul class="guide">' + k.guide.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul><p class="scale" style="margin:0">' + esc(k.scale) + '</p></div></div>';
    }).join('') + '</section>' +
  '<section><div class="sec-h"><span class="num">04</span><h2>채점 기준 · 판정</h2></div><div class="card">' +
    D.RUBRIC.map(function (r) { return '<div class="ev"><div><div class="nm">' + esc(r.name) + '<span>' + r.w + '점</span></div><div class="anc">' + esc(r.desc) + '<br><b>5</b> ' + esc(r.a5) + ' · <b>3</b> ' + esc(r.a3) + ' · <b>1</b> ' + esc(r.a1) + '</div></div></div>'; }).join('') +
    '<div class="note" style="margin-top:17px">가중 점수 = Σ(점수/5 × 가중치), 100점 만점. <b>85+</b> Strong Hire · <b>70–84</b> Hire · <b>55–69</b> Lean No(보류) · <b>55 미만</b> No Hire. Hire 이상이면 2차(임원) 면접 추천.</div></div></section>';
}

/* ───────── 렌더 */
function render() {
  var r = route(), app = $('#app'), nav = $('#nav');
  nav.innerHTML = [['#/', '대시보드'], ['#/compare', '비교표'], ['#/guide', '평가 기준']]
    .map(function (x) { return '<a href="' + x[0] + '" class="' + ((location.hash || '#/') === x[0] ? 'on' : '') + '">' + x[1] + '</a>'; }).join('');
  $('#modeBtn').textContent = RO ? '편집 모드로' : '검토 모드';
  document.body.classList.toggle('review', RO);
  if (r.v === 'cand') {
    var c = cand(r.id);
    if (!c) { location.hash = '#/'; return; }
    app.innerHTML = '<div class="view on">' + viewCand(c) + '</div>';
    document.title = c.name + ' · 판옵티콘 채용';
  } else if (r.v === 'compare') { app.innerHTML = '<div class="view on">' + viewCompare() + '</div>'; document.title = '비교표 · 판옵티콘 채용'; }
  else if (r.v === 'guide') { app.innerHTML = '<div class="view on">' + viewGuide() + '</div>'; document.title = '평가 기준 · 판옵티콘 채용'; }
  else { app.innerHTML = '<div class="view on">' + viewHome() + '</div>'; document.title = '판옵티콘 채용 대시보드 · 프로덕트 기획자'; }
  if (!S._savedAt) setChip('');
}
function rerender() { var y = window.scrollY; render(); window.scrollTo(0, y); }

/* ───────── 액션 */
window.setScore = function (id, k, n) { if (RO) return; var st = cs(id); if (st.scores[k] === n) delete st.scores[k]; else st.scores[k] = n; touch(id); save(); rerender(); };
window.setMemo = function (id, k, v) { if (RO) return; cs(id).memo[k] = v; touch(id); save(); };
window.setCheck = function (id, i, v) { if (RO) return; cs(id).checks[i] = v; touch(id); save(); rerender(); };
window.setFlag = function (id, i, v) { if (RO) return; cs(id).flags[i] = v; touch(id); save(); rerender(); };
window.setVerdict = function (id, k) { if (RO) return; var st = cs(id); st.verdict = st.verdict === k ? '' : k; touch(id); save(); rerender(); };
window.setRec = function (id, k) { if (RO) return; var st = cs(id); st.rec = st.rec === k ? '' : k; touch(id); save(); rerender(); };
window.setAbsent = function (id, v) { if (RO) return; var st = cs(id); if (v) st.absent = true; else delete st.absent; touch(id); save(); render(); };
window.askAbsent = function (id) { var c = cand(id); if (confirm(c.name + ' 후보를 면접 미참여로 처리할까요?')) setAbsent(id, true); };
window.toggleMode = function () { RO = !RO; rerender(); };

/* ───────── 내보내기 */
function download(name, content, type) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: type }));
  a.download = name; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
}
function buildSummary() {
  var today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  var rs = rows(), scored = rs.filter(function (r) { return r.scored; }).sort(function (a, b) { return b.w.t - a.w.t; });
  var absent = rs.filter(function (r) { return r.absent; }), pending = rs.filter(function (r) { return !r.absent && !r.w.n; });
  var L = [];
  L.push('📋 판옵티콘 프로덕트 기획자 1차 면접 요약');
  L.push(today + ' · 면접관 정승재 · 채점 ' + scored.length + '/' + rs.length + '명' + (absent.length ? ' · 미참여 ' + absent.length : ''));
  L.push('');
  L.push('■ 종합 순위');
  scored.forEach(function (r, i) { L.push((i + 1) + '. ' + r.c.name + ' — ' + r.w.t + '점 · ' + (r.st.verdict ? vlabel(r.st) : verdictFor(r.w.t).label + '(자동)') + ' · 2차 ' + recLabel(r.st.rec)); });
  if (absent.length) L.push('⊘ 미참여: ' + absent.map(function (r) { return r.c.name; }).join(', '));
  if (pending.length) L.push('· 면접 예정: ' + pending.map(function (r) { return r.c.name; }).join(', '));
  L.push('');
  L.push('판정 기준: 85+ Strong Hire · 70~84 Hire · 55~69 Lean No · 55↓ No Hire');
  scored.forEach(function (r) {
    var c = r.c, st = r.st, w = r.w, ck = D.CASE.checks.filter(function (x, i) { return st.checks[i]; }).length;
    L.push(''); L.push('━━━━━━━━━━━━━━━━');
    L.push('▶ ' + c.name + ' (' + c.gender + ' · ' + c.age + ' · 경력 ' + c.total + ')');
    L.push('학력: ' + c.edu.join(' / '));
    L.push('현재: ' + c.status + (c.addr && c.addr !== '미기재' ? ' · ' + c.addr : ''));
    L.push('점수: ' + w.t + '/100 → ' + (st.verdict ? vlabel(st) : verdictFor(w.t).label + '(자동)') + ' · 2차 ' + recLabel(st.rec));
    L.push('세부: ' + D.RUBRIC.map(function (x) { return SHORT[x.key] + ' ' + (st.scores[x.key] || '-'); }).join(' · ') + ' · 케이스 ' + ck + '/5');
    D.KEYQ.forEach(function (k) { var m = st.memo['key_' + k.key]; if (m) L.push('[' + KSHORT[k.key] + '] ' + oneLine(m)); });
    if (st.memo.case) L.push('[로직 케이스] ' + oneLine(st.memo.case));
    if (st.memo.evidence) L.push('[근거] ' + oneLine(st.memo.evidence));
    var pay = [st.memo.pay && '희망연봉 ' + st.memo.pay, st.memo.start && '입사 ' + st.memo.start, st.memo.commute && '통근 ' + st.memo.commute, st.memo.etc].filter(Boolean).join(' · ');
    if (pay) L.push('[처우] ' + pay);
    var fl = D.FLAGS.filter(function (f, i) { return st.flags[i]; });
    if (fl.length) L.push('⚠ ' + fl.join(' / '));
    if (st.memo.final) L.push('총평: ' + oneLine(st.memo.final));
  });
  if (absent.length) { L.push(''); L.push('━━━━━━━━━━━━━━━━'); absent.forEach(function (r) { L.push('⊘ ' + r.c.name + ' — 면접 미참여' + (r.st.memo.absentWhy ? ' (' + r.st.memo.absentWhy + ')' : '')); }); }
  return L.join('\n');
}
window.exportSummary = function () {
  var t = buildSummary(), m = $('#sumModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'sumModal'; m.className = 'modal';
    m.innerHTML = '<div class="box"><div class="head"><b>전달용 요약본</b><span class="sm mut">카톡·메일에 그대로 붙여넣기</span><span style="flex:1"></span>' +
      '<button class="btn p" id="sumCopy">복사</button><button class="btn" onclick="document.getElementById(\'sumModal\').remove()">닫기</button></div><textarea id="sumTa" readonly></textarea></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  }
  $('#sumTa').value = t;
  $('#sumCopy').onclick = function () {
    var ta = $('#sumTa'); ta.focus(); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('#sumCopy').textContent = '✓ 복사됨'; }).catch(function () { $('#sumCopy').textContent = ok ? '✓ 복사됨' : 'Ctrl+C로 복사'; });
    else $('#sumCopy').textContent = ok ? '✓ 복사됨' : 'Ctrl+C로 복사';
  };
};
window.exportJSON = function () {
  var out = {}; Object.keys(S).forEach(function (k) { out[k] = S[k]; });
  out._savedAt = new Date().toISOString();
  download('판옵티콘_면접기록_' + stamp() + '.json', JSON.stringify(out, null, 1), 'application/json');
};
window.importJSON = function () {
  var f = $('#fileIn');
  f.onchange = function () {
    var r = new FileReader();
    r.onload = function () {
      try { var j = JSON.parse(r.result); S = mergeState(j.state || j, S); save(); render(); alert('불러왔습니다.'); }
      catch (e) { alert('파일 형식 오류: ' + e.message); }
    };
    r.readAsText(f.files[0]);
  };
  f.click();
};
window.doPrint = function () { window.print(); };

/* 로컬 HTML 파일 저장(선택) — File System Access API */
window.linkFile = function () {
  if (!window.showSaveFilePicker) { alert('이 브라우저는 파일 직접 저장을 지원하지 않습니다. 「기록 내보내기」(JSON)를 쓰세요.'); return; }
  window.showSaveFilePicker({ suggestedName: '판옵티콘_면접기록.json', types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] })
    .then(function (h) { FH = h; return writeHandle(); })
    .then(function () { alert('연결됐습니다. 지금부터 모든 입력이 이 파일에 자동 저장됩니다.'); })
    .catch(function (e) { if (e && e.name !== 'AbortError') alert('저장 실패: ' + e.message); });
};
function writeHandle() {
  if (!FH) return Promise.resolve();
  return FH.createWritable().then(function (w) { return w.write(JSON.stringify(S, null, 1)).then(function () { return w.close(); }); })
    .then(function () { setChip('파일에 저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })); })
    .catch(function () { setChip('⚠ 파일 저장 실패', true); });
}
function scheduleWrite() { if (!FH) return; clearTimeout(WT); WT = setTimeout(writeHandle, 900); }

/* ───────── 더보기 메뉴 */
function buildMore() {
  var m = $('#more');
  m.style.cssText = 'display:none;border-top:1px solid var(--line);background:#fff';
  m.innerHTML = '<div style="max-width:1240px;margin:0 auto;padding:10px 22px;display:flex;gap:7px;flex-wrap:wrap">' +
    '<button class="btn" onclick="importJSON()">기록 불러오기</button>' +
    '<button class="btn" onclick="linkFile()">기록 파일에 자동 저장</button>' +
    '<button class="btn" onclick="doPrint()">인쇄 / PDF</button>' +
    '<button class="btn" onclick="resetLocal()">내 브라우저 기록 초기화</button>' +
    '<span class="sm mut" style="align-self:center">공용 기록(results.json)은 유지됩니다</span></div>';
  var st = document.createElement('style');
  st.textContent = '#more.open{display:block!important}';
  document.head.appendChild(st);
}
window.resetLocal = function () {
  if (!confirm('이 브라우저에 저장된 채점 기록을 지웁니다. 공용 기록은 남습니다. 계속할까요?')) return;
  localStorage.removeItem(KEY); location.reload();
};

/* ───────── 부팅 */
function boot(base) {
  S = mergeState(base, loadLocal());
  buildMore();
  window.addEventListener('hashchange', render);
  window.addEventListener('beforeprint', function () { document.body.classList.add('printing'); });
  render();
  if (S._base) setChip('공용 기록 ' + new Date(S._base).toLocaleDateString('ko-KR') + ' 반영됨');
}
fetch('results.json', { cache: 'no-store' })
  .then(function (r) { return r.ok ? r.json() : {}; })
  .then(function (j) { boot(j || {}); })
  .catch(function () { boot({}); });

})();
