/* A2CS Admin Panel — client-side editor for db.json via GitHub Contents API */
'use strict';

// ---------- Utilities ----------
var LS_KEY = 'a2cs_admin_settings';
var uidCounter = 1;

function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
}

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function b64Utf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function slug(title) {
    return String(title).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || ('chapter-' + Date.now());
}

// ---------- State ----------
var state = {
    settings: null,
    db: null,
    selectedChapterId: null,
    openUids: {},
    view: 'chapters'   // 'chapters' | 'flashcards' | 'quiz' | 'pseudocode'
};

function ensureStudyArrays() {
    if (!state.db) return;
    if (!Array.isArray(state.db.flashcards)) state.db.flashcards = [];
    if (!Array.isArray(state.db.quiz)) state.db.quiz = [];
    if (!Array.isArray(state.db.pseudocode)) state.db.pseudocode = [];
}

var BLOCK_TYPES = [
    { type: 'p',        label: 'Paragraph' },
    { type: 'h2',       label: 'Heading 2' },
    { type: 'h3',       label: 'Heading 3' },
    { type: 'note',     label: 'Note / Callout' },
    { type: 'list',     label: 'List' },
    { type: 'card',     label: 'Card' },
    { type: 'details',  label: 'Accordion (Details)' },
    { type: 'table',    label: 'Table' },
    { type: 'bits',     label: 'Bit Row' },
    { type: 'tablePair', label: 'Two Side-by-Side Tables' },
    { type: 'code',     label: 'Code Block' }
];

function defaultBlock(type) {
    switch (type) {
        case 'h2': return { type: 'h2', text: '' };
        case 'h3': return { type: 'h3', text: '' };
        case 'note': return { type: 'note', text: '' };
        case 'code': return { type: 'code', text: '' };
        case 'list': return { type: 'list', style: 'ul', items: [''] };
        case 'card': return { type: 'card', title: '', blocks: [] };
        case 'details': return { type: 'details', summary: 'Details', blocks: [] };
        case 'table': return { type: 'table', headers: ['Column 1'], rows: [['']] };
        case 'bits': return { type: 'bits', cells: ['0', '1'] };
        case 'tablePair':
            return { type: 'tablePair', left: { header: 'Table A', cells: [''] }, right: { header: 'Table B', cells: [''] } };
        default: return { type: 'p', text: '' };
    }
}

function ensureUid(b) {
    if (!b._uid) b._uid = 'b' + (uidCounter++);
    return b._uid;
}

function preview(b) {
    switch (b.type) {
        case 'p': case 'h2': case 'h3': case 'note':
            return (b.text || '').replace(/<[^>]*>/g, '');
        case 'code':
            return 'code · ' + (b.text || '').length + ' chars';
        case 'list':
            return (b.style || 'ul') + ' · ' + (b.items || []).length + ' items';
        case 'card':
            return b.title ? ('card · ' + b.title) : ('card · ' + (b.blocks || []).length + ' blocks');
        case 'details':
            return 'accordion · ' + (b.summary || '');
        case 'table':
            return 'table · ' + (b.rows || []).length + ' rows × ' + (b.headers || []).length + ' cols';
        case 'bits':
            return 'bits · ' + (b.cells || []).join(' ');
        case 'tablePair':
            return 'two side-by-side tables';
        default:
            return '';
    }
}

function parseCells(str) {
    return String(str).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
}

function parseRowCells(line) {
    return String(line).split(',').map(function (c) { return c.trim(); });
}

// ---------- GitHub API ----------
function gitHeaders(token) {
    return {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
    };
}

async function gitFetch(path, token, options) {
    var res = await fetch('https://api.github.com/' + path, Object.assign({ headers: gitHeaders(token) }, options || {}));
    return res;
}

async function safeErrText(res) {
    try { return (await res.json()).message || ''; } catch (e) { return res.statusText; }
}

async function loadRemoteDb(s) {
    var res = await gitFetch('repos/' + s.owner + '/' + s.repo + '/contents/db.json?ref=' + encodeURIComponent(s.branch), s.token);
    if (res.ok) {
        var j = await res.json();
        var txt = decodeURIComponent(escape(atob(j.content)));
        return { exists: true, db: JSON.parse(txt), sha: j.sha };
    }
    if (res.status === 404) {
        return { exists: false, db: null, sha: null };
    }
    throw new Error('GitHub: HTTP ' + res.status + ' — ' + (await safeErrText(res)));
}

// ---------- Screen switching ----------
function showLoginFirstTime() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('btn-logout').classList.add('hidden');
    document.getElementById('btn-connect').textContent = 'Connect';
    document.getElementById('login-status').className = 'status-msg';
    document.getElementById('login-status').textContent = '';
    if (state.settings) {
        document.getElementById('f-owner').value = state.settings.owner;
        document.getElementById('f-repo').value = state.settings.repo;
        document.getElementById('f-branch').value = state.settings.branch;
        document.getElementById('f-token').value = state.settings.token;
        document.getElementById('btn-logout').classList.remove('hidden');
        document.getElementById('btn-connect').textContent = 'Reconnect';
    }
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    renderAll();
}

function setStatus(cls, text) {
    var st = document.getElementById('save-status');
    st.className = 'save-status' + (cls ? ' ' + cls : '');
    st.textContent = text;
}

// ---------- Chapter list ----------
function renderChapterList() {
    var holder = document.getElementById('chapter-list');
    holder.innerHTML = '';
    state.db.chapters.forEach(function (ch, i) {
        var item = el('div', 'chapter-item' + (ch.id === state.selectedChapterId && state.view === 'chapters' ? ' selected' : ''));
        item.appendChild(el('div', 'ci-title', esc(ch.title)));
        item.appendChild(el('div', 'ci-meta', esc(ch.id + (ch.pdf ? ' · ' + ch.pdf : ''))));
        var acts = el('div', 'ci-actions');
        var upBtn = el('button', '', '&uarr;');
        var downBtn = el('button', '', '&darr;');
        var delBtn = el('button', 'danger', '&times;');
        upBtn.title = 'Move up'; upBtn.disabled = i === 0;
        downBtn.title = 'Move down'; downBtn.disabled = i === state.db.chapters.length - 1;
        delBtn.title = 'Delete chapter';
        upBtn.onclick = function (e) { e.stopPropagation(); moveChapter(i, -1); };
        downBtn.onclick = function (e) { e.stopPropagation(); moveChapter(i, 1); };
        delBtn.onclick = function (e) {
            e.stopPropagation();
            if (confirm('Delete chapter "' + ch.title + '"?')) {
                state.db.chapters.splice(i, 1);
                if (state.selectedChapterId === ch.id) state.selectedChapterId = state.db.chapters.length ? state.db.chapters[0].id : null;
                renderAll();
            }
        };
        acts.appendChild(upBtn); acts.appendChild(downBtn); acts.appendChild(delBtn);
        item.appendChild(acts);
        item.onclick = function () {
            state.selectedChapterId = ch.id;
            state.view = 'chapters';
            renderAll();
        };
        holder.appendChild(item);
    });

    // Study content nav (Flashcards / Quiz)
    var fcNav = document.getElementById('study-nav-flashcards');
    var qzNav = document.getElementById('study-nav-quiz');
    var psNav = document.getElementById('study-nav-pseudocode');
    if (fcNav && qzNav) {
        fcNav.classList.toggle('selected', state.view === 'flashcards');
        qzNav.classList.toggle('selected', state.view === 'quiz');
        document.getElementById('study-fc-count').textContent =
            (state.db.flashcards ? state.db.flashcards.length : 0) + ' cards';
        document.getElementById('study-quiz-count').textContent =
            (state.db.quiz ? state.db.quiz.length : 0) + ' questions';
        if (psNav) {
            psNav.classList.toggle('selected', state.view === 'pseudocode');
            document.getElementById('study-ps-count').textContent =
                (state.db.pseudocode ? state.db.pseudocode.length : 0) + ' snippets';
        }
    }
}

function setView(view) {
    state.view = view;
    state.openUids = {};
    renderAll();
}

function moveChapter(i, dir) {
    var arr = state.db.chapters;
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    renderAll();
}

// ---------- Chapter editor ----------
function currentChapter() {
    if (!state.db) return null;
    for (var i = 0; i < state.db.chapters.length; i++) {
        if (state.db.chapters[i].id === state.selectedChapterId) return state.db.chapters[i];
    }
    return null;
}

function bindInput(input, fn) {
    input.addEventListener('input', fn);
    input.addEventListener('change', fn);
}

function renderChapterEditor() {
    var holder = document.getElementById('chapter-editor');
    holder.innerHTML = '';
    var ch = currentChapter();
    if (!ch) {
        var empty = el('div', 'editor-card');
        empty.appendChild(el('h2', '', 'No chapter selected'));
        empty.appendChild(el('div', 'empty-chapter', state.db.chapters.length
            ? 'Select a chapter on the left, or create a new one.'
            : 'Create your first chapter to get started.'));
        holder.appendChild(empty);
        return;
    }

    var card = el('div', 'editor-card');

    var titleH = el('h2', '', 'Chapter settings');
    card.appendChild(titleH);

    var row1 = el('div', 'field-row');
    var tWrap = el('div');
    var tL = el('label', '', 'Title');
    var tIn = el('input', '');
    tIn.type = 'text'; tIn.value = ch.title;
    bindInput(tIn, function () { ch.title = tIn.value; });
    tWrap.appendChild(tL); tWrap.appendChild(tIn);

    var sWrap = el('div');
    var sL = el('label', '', 'Subtitle');
    var sIn = el('input', '');
    sIn.type = 'text'; sIn.value = ch.subtitle || '';
    bindInput(sIn, function () { ch.subtitle = sIn.value; });
    sWrap.appendChild(sL); sWrap.appendChild(sIn);
    row1.appendChild(tWrap); row1.appendChild(sWrap);
    card.appendChild(row1);

    var row2 = el('div', 'field-row');
    var pWrap = el('div');
    var pL = el('label', '', 'PDF download file (upload it to this repo)');
    var pIn = el('input', '');
    pIn.type = 'text'; pIn.value = ch.pdf || '';
    pIn.placeholder = 'A2Cs Chapter.pdf';
    bindInput(pIn, function () { ch.pdf = pIn.value; });
    pWrap.appendChild(pL); pWrap.appendChild(pIn);

    var idWrap = el('div');
    var idL = el('label', '', 'ID (url anchor, auto-slugs on save)');
    var idIn = el('input', '');
    idIn.type = 'text'; idIn.value = ch.id;
    idIn.addEventListener('change', function () {
        ch.id = slug(idIn.value) || ch.id;
        idIn.value = ch.id;
    });
    idWrap.appendChild(idL); idWrap.appendChild(idIn);
    row2.appendChild(pWrap); row2.appendChild(idWrap);
    card.appendChild(row2);

    card.appendChild(el('h2', '', 'Content blocks'));
    renderBlocksEditor(ch.blocks || (ch.blocks = []), card);

    holder.appendChild(card);
}

// ---------- Block editor ----------
function renderBlocksEditor(blocks, holder) {
    if (!blocks) return;

    var list = el('div', 'blist');
    blocks.forEach(function (b, i) {
        list.appendChild(renderBlockRow(blocks, b, i));
    });
    holder.appendChild(list);

    var adder = el('div', 'badder');
    var aRow = el('div', 'badder-row');
    var sel = el('select', '');
    BLOCK_TYPES.forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t.type;
        opt.textContent = t.label;
        sel.appendChild(opt);
    });
    var addBtn = el('button', '', '+ Add block');
    addBtn.onclick = function () {
        var nb = defaultBlock(sel.value);
        ensureUid(nb);
        state.openUids[nb._uid] = true;
        blocks.push(nb);
        renderChapterEditor();
    };
    aRow.appendChild(sel);
    aRow.appendChild(addBtn);
    var hint = el('div', 'inline-note',
        'Click Edit (or preview text) to open a block, then change text character-by-character. ' +
        '&lt;strong&gt; and &lt;code&gt; are allowed inside Paragraphs/Headings/Notes. ' +
        'Table rows: comma-separated cells, one row per line.');
    adder.appendChild(aRow);
    adder.appendChild(hint);
    holder.appendChild(adder);
}

function renderBlockRow(blocks, b, i) {
    ensureUid(b);
    var uid = b._uid;
    var isOpen = !!state.openUids[uid];

    var row = el('div', 'brow');

    var head = el('div', 'brow-head');
    var badge = el('span', 'badge', esc(b.type));
    var previewEl = el('span', 'brow-preview', esc(preview(b)));

    var toggle = function () {
        if (state.openUids[uid]) delete state.openUids[uid];
        else state.openUids[uid] = true;
        renderChapterEditor();
    };
    [badge, previewEl].forEach(function (n) {
        n.style.cursor = 'pointer';
        n.title = isOpen ? 'Collapse editor' : 'Open editor';
        n.onclick = toggle;
    });
    head.appendChild(badge);
    head.appendChild(previewEl);

    var up = el('button', '', '&uarr;'); up.title = 'Move up'; up.disabled = i === 0;
    var down = el('button', '', '&darr;'); down.title = 'Move down'; down.disabled = i === blocks.length - 1;
    var edit = el('button', isOpen ? 'primary' : '', isOpen ? 'Done' : 'Edit'); edit.title = isOpen ? 'Collapse editor' : 'Edit this block';
    var del = el('button', 'danger', '&times;'); del.title = 'Delete block';

    up.onclick = function (e) { e.stopPropagation(); swap(blocks, i, i - 1); };
    down.onclick = function (e) { e.stopPropagation(); swap(blocks, i, i + 1); };
    edit.onclick = function (e) { e.stopPropagation(); toggle(); };
    del.onclick = function (e) {
        e.stopPropagation();
        blocks.splice(i, 1);
        delete state.openUids[uid];
        renderChapterEditor();
    };

    head.appendChild(up); head.appendChild(down); head.appendChild(edit); head.appendChild(del);
    row.appendChild(head);

    if (isOpen) {
        row.appendChild(blockForm(b));
    }

    return row;
}

function swap(arr, a, b) {
    if (a < 0 || b < 0 || a >= arr.length || b >= arr.length) return;
    var tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
    renderChapterEditor();
}

function labeledText(label, value) {
    var wrap = el('div');
    wrap.appendChild(el('label', '', label));
    var ta = el('textarea', '');
    ta.value = value;
    wrap.appendChild(ta);
    return { wrap: wrap, ta: ta };
}

function blockForm(b) {
    var form = el('div', 'brow-form');
    var f;

    switch (b.type) {
        case 'h2':
        case 'h3':
        case 'p':
        case 'note':
            f = labeledText('Text (supports &lt;strong&gt; &amp; &lt;code&gt;)', b.text || '');
            bindInput(f.ta, function () { b.text = f.ta.value; });
            form.appendChild(f.wrap);
            break;

        case 'code':
            f = labeledText('Code content', b.text || '');
            f.ta.style.fontFamily = "'Consolas', monospace";
            f.ta.rows = 8;
            bindInput(f.ta, function () { b.text = f.ta.value; });
            form.appendChild(f.wrap);
            break;

        case 'list': {
            var styleWrap = el('div');
            styleWrap.appendChild(el('label', '', 'List style'));
            var sel = el('select', '');
            var ulOpt = document.createElement('option'); ulOpt.value = 'ul'; ulOpt.textContent = 'Bullet (ul)';
            var olOpt = document.createElement('option'); olOpt.value = 'ol'; olOpt.textContent = 'Numbered (ol)';
            sel.appendChild(ulOpt); sel.appendChild(olOpt);
            sel.value = b.style || 'ul';
            sel.addEventListener('change', function () { b.style = sel.value; });
            styleWrap.appendChild(sel);
            form.appendChild(styleWrap);

            f = labeledText('Items (one per line)', (b.items || []).join('\n'));
            bindInput(f.ta, function () { b.items = parseCells(f.ta.value); });
            form.appendChild(f.wrap);
            break;
        }

        case 'card':
        case 'details': {
            var titleWrap = el('div');
            titleWrap.appendChild(el('label', '', b.type === 'card' ? 'Card title' : 'Summary (clickable label)'));
            var tIn = el('input', '');
            tIn.type = 'text';
            tIn.value = b.title !== undefined ? b.title : (b.summary || '');
            bindInput(tIn, function () {
                if (b.type === 'card') b.title = tIn.value;
                else b.summary = tIn.value;
            });
            titleWrap.appendChild(tIn);
            form.appendChild(titleWrap);

            var sub = el('div', 'subblocks');
            sub.appendChild(el('label', '', b.type === 'card' ? 'Blocks inside this card' : 'Blocks inside this accordion'));
            renderBlocksEditor(b.blocks || (b.blocks = []), sub);
            form.appendChild(sub);
            break;
        }

        case 'table': {
            f = labeledText('Column headers (comma-separated)', (b.headers || []).join(', '));
            bindInput(f.ta, function () { b.headers = parseRowCells(f.ta.value).filter(Boolean); });
            form.appendChild(f.wrap);

            f = labeledText('Rows (comma-separated cells, one row per line)', (b.rows || []).map(function (r) { return r.join(', '); }).join('\n'));
            bindInput(f.ta, function () {
                b.rows = parseCells(f.ta.value).map(parseRowCells);
            });
            form.appendChild(f.wrap);
            break;
        }

        case 'bits':
            f = labeledText('Bit cells (comma-separated)', (b.cells || []).join(', '));
            bindInput(f.ta, function () { b.cells = parseRowCells(f.ta.value).filter(Boolean); });
            form.appendChild(f.wrap);
            break;

        case 'tablePair': {
            var lWrap = el('div', 'field-row');
            ['left', 'right'].forEach(function (side) {
                var col = el('div', '');
                col.appendChild(el('label', '', side === 'left' ? 'Left table header' : 'Right table header'));
                var hIn = el('input', '');
                hIn.type = 'text';
                hIn.value = b[side].header || '';
                bindInput(hIn, function () { b[side].header = hIn.value; });
                col.appendChild(hIn);
                col.appendChild(el('label', '', side === 'left' ? 'Left cells (one per line)' : 'Right cells (one per line)'));
                var cTa = el('textarea', '');
                cTa.value = (b[side].cells || []).join('\n');
                bindInput(cTa, function () { b[side].cells = parseCells(cTa.value); });
                col.appendChild(cTa);
                lWrap.appendChild(col);
            });
            form.appendChild(lWrap);
            break;
        }
    }
    return form;
}

// ---------- Study editors (Flashcards + Quiz) ----------
// Flashcards have to stay memorisable: one short answer line plus a few bullets.
// Anything longer belongs on another card (same rule Quizlet decks follow).
var FC_DEF_MAX = 110;
var FC_POINT_MAX = 70;
var FC_POINTS_MAX = 3;
var FC_ANSWER_MAX = 60;

function flashcardWarnings(card) {
    var w = [];
    var def = card.definition || '';
    if (def.length > FC_DEF_MAX) w.push('Definition is ' + def.length + ' characters — split it into two cards');
    var pts = Array.isArray(card.points) ? card.points : [];
    if (pts.length > FC_POINTS_MAX) w.push(pts.length + ' bullets — keep it to 3 or fewer');
    if (pts.some(function (p) { return String(p).length > FC_POINT_MAX; })) w.push('A bullet is too long — shorten it');
    if (card.details) w.push('Uses the old "details" field — move it into bullets');
    (card.questions || []).forEach(function (qa, i) {
        if ((qa.a || '').length > FC_ANSWER_MAX) w.push('Answer ' + (i + 1) + ' is long — trim it');
    });
    return w;
}

function chapterSelect(chapters, value, onChange) {
    var sel = el('select', '');
    var optAny = document.createElement('option');
    optAny.value = '';
    optAny.textContent = '— no chapter —';
    sel.appendChild(optAny);
    chapters.forEach(function (ch) {
        var opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = ch.title;
        sel.appendChild(opt);
    });
    sel.value = value || '';
    sel.addEventListener('change', function () { onChange(sel.value); });
    return sel;
}

function fcQuestionRows(card, holder) {
    (card.questions || (card.questions = [])).forEach(function (qa, i) {
        ensureUid(qa);
        var row = el('div', 'qa-row');
        row.appendChild(el('div', 'qa-num', String(i + 1)));

        var fields = el('div', 'qa-fields');
        fields.appendChild(el('label', '', 'Question ' + (i + 1)));
        var qTa = el('textarea', '');
        qTa.rows = 2;
        qTa.value = qa.q || '';
        bindInput(qTa, function () { qa.q = qTa.value; });
        fields.appendChild(qTa);

        fields.appendChild(el('label', '', 'Answer ' + (i + 1)));
        var aTa = el('textarea', '');
        aTa.rows = 2;
        aTa.value = qa.a || '';
        bindInput(aTa, function () { qa.a = aTa.value; });
        fields.appendChild(aTa);

        var delBtn = el('button', 'danger', 'Remove question');
        delBtn.style.marginTop = '6px';
        delBtn.onclick = function () {
            card.questions.splice(i, 1);
            renderAll();
        };
        fields.appendChild(delBtn);
        row.appendChild(fields);
        holder.appendChild(row);
    });

    var addBtn = el('button', '', '+ Add question');
    addBtn.onclick = function () {
        card.questions.push({ q: '', a: '' });
        renderAll();
    };
    holder.appendChild(addBtn);
}

function renderFlashcardsEditor() {
    var holder = document.getElementById('chapter-editor');
    holder.innerHTML = '';
    ensureStudyArrays();

    var wrap = el('div', 'editor-card');
    wrap.appendChild(el('h2', '', 'Flashcards'));
    wrap.appendChild(el('div', 'inline-note',
        'These power the <strong>Flashcards</strong> page on the site (Terms mode = term &rarr; definition; ' +
        'Questions mode = the Q/A pairs below). Cards must stay short: <strong>one answer line</strong> plus ' +
        'at most <strong>3 bullets</strong> — split anything longer into a second card. ' +
        'Definition, bullets and example support &lt;strong&gt; / &lt;code&gt; / &lt;em&gt;.'));

    var addBtn = el('button', 'primary', '+ New flashcard');
    addBtn.onclick = function () {
        var card = {
            id: slug('fc-' + Date.now()),
            term: 'New term',
            definition: '',
            points: [],
            chapter: state.db.chapters.length ? state.db.chapters[0].id : '',
            questions: []
        };
        ensureUid(card);
        state.db.flashcards.push(card);
        state.openUids[card._uid] = true;
        renderAll();
    };
    wrap.appendChild(addBtn);
    wrap.appendChild(el('div', '', ''));

    if (!state.db.flashcards.length) {
        wrap.appendChild(el('div', 'empty-chapter', 'No flashcards yet — create the first one.'));
    }

    var list = el('div', 'blist');
    state.db.flashcards.forEach(function (card, i) {
        list.appendChild(renderFlashcardRow(state.db.flashcards, card, i));
    });
    wrap.appendChild(list);
    holder.appendChild(wrap);
}

function renderFlashcardRow(cards, card, i) {
    ensureUid(card);
    var uid = card._uid;
    var isOpen = !!state.openUids[uid];

    var row = el('div', 'brow');
    var head = el('div', 'brow-head');
    var badge = el('span', 'badge', esc(card.chapter || '—'));
    var previewEl = el('span', 'brow-preview',
        esc(card.term || '(untitled)') + ' · ' +
        ((card.points || []).length) + ' bullets · ' +
        ((card.questions || []).length) + ' q');
    var toggle = function () {
        if (state.openUids[uid]) delete state.openUids[uid];
        else state.openUids[uid] = true;
        renderAll();
    };
    [badge, previewEl].forEach(function (n) {
        n.style.cursor = 'pointer';
        n.title = isOpen ? 'Collapse editor' : 'Open editor';
        n.onclick = toggle;
    });
    head.appendChild(badge);

    var warns = flashcardWarnings(card);
    if (warns.length) {
        var warnBadge = el('span', 'badge warn', 'Split this card');
        warnBadge.title = warns.join('\n');
        warnBadge.style.cursor = 'pointer';
        warnBadge.onclick = toggle;
        head.appendChild(warnBadge);
    }
    head.appendChild(previewEl);

    var up = el('button', '', '&uarr;'); up.title = 'Move up'; up.disabled = i === 0;
    var down = el('button', '', '&darr;'); down.title = 'Move down'; down.disabled = i === cards.length - 1;
    var edit = el('button', isOpen ? 'primary' : '', isOpen ? 'Done' : 'Edit');
    var del = el('button', 'danger', '&times;'); del.title = 'Delete flashcard';
    up.onclick = function (e) { e.stopPropagation(); swap(cards, i, i - 1); };
    down.onclick = function (e) { e.stopPropagation(); swap(cards, i, i + 1); };
    edit.onclick = function (e) { e.stopPropagation(); toggle(); };
    del.onclick = function (e) {
        e.stopPropagation();
        if (confirm('Delete flashcard "' + (card.term || 'untitled') + '"?')) {
            cards.splice(i, 1);
            delete state.openUids[uid];
            renderAll();
        }
    };
    head.appendChild(up); head.appendChild(down); head.appendChild(edit); head.appendChild(del);
    row.appendChild(head);

    if (isOpen) {
        var form = el('div', 'brow-form');

        var row1 = el('div', 'field-row');
        var termWrap = el('div');
        termWrap.appendChild(el('label', '', 'Term (front of card)'));
        var termIn = el('input', '');
        termIn.type = 'text';
        termIn.value = card.term || '';
        bindInput(termIn, function () { card.term = termIn.value; });
        termWrap.appendChild(termIn);

        var idWrap = el('div');
        idWrap.appendChild(el('label', '', 'ID (unique, auto-slugs on save)'));
        var idIn = el('input', '');
        idIn.type = 'text';
        idIn.value = card.id || '';
        idIn.addEventListener('change', function () {
            card.id = slug(idIn.value);
            idIn.value = card.id;
        });
        idWrap.appendChild(idIn);
        row1.appendChild(termWrap); row1.appendChild(idWrap);
        form.appendChild(row1);

        form.appendChild(el('label', '', 'Chapter (filter on the site)'));
        form.appendChild(chapterSelect(state.db.chapters, card.chapter, function (v) { card.chapter = v; }));

        form.appendChild(el('label', '', 'Definition (back of card — one short line, required)'));
        var defTa = el('textarea', '');
        defTa.rows = 2;
        defTa.value = card.definition || '';
        bindInput(defTa, function () { card.definition = defTa.value; });
        form.appendChild(defTa);
        form.appendChild(el('div', 'inline-note', 'Keep it to about 100 characters — one idea per card.'));

        form.appendChild(el('label', '', 'Bullets (optional — one short bullet per line, 3 max)'));
        var ptsTa = el('textarea', '');
        ptsTa.rows = 3;
        ptsTa.style.fontFamily = "var(--code-font)";
        ptsTa.value = (Array.isArray(card.points) ? card.points : []).join('\n');
        bindInput(ptsTa, function () {
            card.points = ptsTa.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        });
        form.appendChild(ptsTa);

        form.appendChild(el('label', '', 'Example (optional — one line on the back)'));
        var exTa = el('textarea', '');
        exTa.rows = 2;
        exTa.style.fontFamily = "var(--code-font)";
        exTa.value = card.example || '';
        bindInput(exTa, function () { card.example = exTa.value; });
        form.appendChild(exTa);

        if (card.details) {
            form.appendChild(el('label', '', 'Old "details" text (move it into bullets)'));
            var detTa = el('textarea', '');
            detTa.rows = 2;
            detTa.value = card.details || '';
            bindInput(detTa, function () { card.details = detTa.value; });
            form.appendChild(detTa);
            var mergeBtn = el('button', '', 'Move into bullets');
            mergeBtn.style.marginTop = '6px';
            mergeBtn.onclick = function () {
                var add = String(card.details || '').split(/\s*(?:\n|\u2022)\s*/)
                    .map(function (s) { return s.trim(); }).filter(Boolean);
                card.points = (Array.isArray(card.points) ? card.points : []).concat(add).slice(0, FC_POINTS_MAX);
                delete card.details;
                renderAll();
            };
            form.appendChild(mergeBtn);
        }

        var sub = el('div', 'subblocks');
        sub.appendChild(el('label', '', 'Questions (flashcard Q/A practice + question mode)'));
        fcQuestionRows(card, sub);
        form.appendChild(sub);

        row.appendChild(form);
    }
    return row;
}

function renderQuizEditor() {
    var holder = document.getElementById('chapter-editor');
    holder.innerHTML = '';
    ensureStudyArrays();

    var wrap = el('div', 'editor-card');
    wrap.appendChild(el('h2', '', 'Quiz Questions'));
    wrap.appendChild(el('div', 'inline-note',
        'These power the <strong>Quiz</strong> page (multiple choice + explanations, and the Speed Round). ' +
        'Mark the correct option with the radio button. Keep explanations to one short line — ' +
        'they sit under the question, not on a flashcard.'));

    var addBtn = el('button', 'primary', '+ New question');
    addBtn.onclick = function () {
        var q = {
            q: 'New question?',
            opts: ['', '', '', ''],
            ans: 0,
            exp: '',
            chapter: state.db.chapters.length ? state.db.chapters[0].id : ''
        };
        ensureUid(q);
        state.db.quiz.push(q);
        state.openUids[q._uid] = true;
        renderAll();
    };
    wrap.appendChild(addBtn);
    wrap.appendChild(el('div', '', ''));

    if (!state.db.quiz.length) {
        wrap.appendChild(el('div', 'empty-chapter', 'No quiz questions yet — create the first one.'));
    }

    var list = el('div', 'blist');
    state.db.quiz.forEach(function (q, i) {
        list.appendChild(renderQuizRow(state.db.quiz, q, i));
    });
    wrap.appendChild(list);
    holder.appendChild(wrap);
}

function renderQuizRow(questions, q, i) {
    ensureUid(q);
    var uid = q._uid;
    var isOpen = !!state.openUids[uid];

    var row = el('div', 'brow');
    var head = el('div', 'brow-head');
    var badge = el('span', 'badge', esc(q.chapter || '—'));
    var previewEl = el('span', 'brow-preview', esc(q.q || '(no question)'));
    var toggle = function () {
        if (state.openUids[uid]) delete state.openUids[uid];
        else state.openUids[uid] = true;
        renderAll();
    };
    [badge, previewEl].forEach(function (n) {
        n.style.cursor = 'pointer';
        n.title = isOpen ? 'Collapse editor' : 'Open editor';
        n.onclick = toggle;
    });
    head.appendChild(badge);
    head.appendChild(previewEl);

    var up = el('button', '', '&uarr;'); up.title = 'Move up'; up.disabled = i === 0;
    var down = el('button', '', '&darr;'); down.title = 'Move down'; down.disabled = i === questions.length - 1;
    var edit = el('button', isOpen ? 'primary' : '', isOpen ? 'Done' : 'Edit');
    var del = el('button', 'danger', '&times;'); del.title = 'Delete question';
    up.onclick = function (e) { e.stopPropagation(); swap(questions, i, i - 1); };
    down.onclick = function (e) { e.stopPropagation(); swap(questions, i, i + 1); };
    edit.onclick = function (e) { e.stopPropagation(); toggle(); };
    del.onclick = function (e) {
        e.stopPropagation();
        if (confirm('Delete this quiz question?')) {
            questions.splice(i, 1);
            delete state.openUids[uid];
            renderAll();
        }
    };
    head.appendChild(up); head.appendChild(down); head.appendChild(edit); head.appendChild(del);
    row.appendChild(head);

    if (isOpen) {
        var form = el('div', 'brow-form');

        form.appendChild(el('label', '', 'Question'));
        var qTa = el('textarea', '');
        qTa.rows = 2;
        qTa.value = q.q || '';
        bindInput(qTa, function () { q.q = qTa.value; });
        form.appendChild(qTa);

        form.appendChild(el('label', '', 'Chapter (filter on the site)'));
        form.appendChild(chapterSelect(state.db.chapters, q.chapter, function (v) { q.chapter = v; }));

        form.appendChild(el('span', 'mini-label', 'Options — select the radio button of the correct one'));
        (q.opts || (q.opts = [''])).forEach(function (opt, oi) {
            var optRow = el('div', 'opt-row');
            var radio = el('input', '');
            radio.type = 'radio';
            radio.name = 'ans-' + uid;
            radio.checked = q.ans === oi;
            radio.title = 'Mark as correct answer';
            radio.addEventListener('change', function () { q.ans = oi; renderAll(); });
            optRow.appendChild(radio);

            var optIn = el('input', '');
            optIn.type = 'text';
            optIn.value = opt;
            optIn.placeholder = 'Option ' + (oi + 1);
            bindInput(optIn, function () { q.opts[oi] = optIn.value; });
            optRow.appendChild(optIn);

            if (q.opts.length > 2) {
                var rm = el('button', 'danger', '&times;');
                rm.title = 'Remove option';
                rm.onclick = function () {
                    q.opts.splice(oi, 1);
                    if (q.ans >= q.opts.length) q.ans = q.opts.length - 1;
                    renderAll();
                };
                optRow.appendChild(rm);
            }
            form.appendChild(optRow);
        });

        var addOpt = el('button', '', '+ Add option');
        addOpt.style.marginTop = '4px';
        addOpt.onclick = function () {
            q.opts.push('');
            renderAll();
        };
        form.appendChild(addOpt);

        form.appendChild(el('label', '', 'Explanation (shown after answering)'));
        var expTa = el('textarea', '');
        expTa.rows = 2;
        expTa.value = q.exp || '';
        bindInput(expTa, function () { q.exp = expTa.value; });
        form.appendChild(expTa);

        row.appendChild(form);
    }
    return row;
}

// ---------- Pseudocode Builder editor ----------
// One entry per line of pseudocode: the code, the English task, and which
// tokens are blanked in the keyword stages.
var PS_PUNCT = ['(', ')', '[', ']', '{', '}', '.', ',', ':', '^'];

function pseudoTokenize(line) {
    var t = String(line == null ? '' : line).trim();
    PS_PUNCT.forEach(function (ch) { t = t.split(ch).join(' ' + ch + ' '); });
    return t.split(/\s+/).filter(function (x) { return x !== ''; });
}

function pseudoWarnings(snippet) {
    var w = [];
    var lines = Array.isArray(snippet.lines) ? snippet.lines : [];
    if (!snippet.task) w.push('Add the task — it is where the names are given to the student');
    if (lines.length < 2) w.push('A snippet needs at least 2 lines');
    var drilled = 0;
    lines.forEach(function (ln, i) {
        var toks = pseudoTokenize(ln.code);
        if (!toks.length) { w.push('Line ' + (i + 1) + ' is empty'); return; }
        if (!ln.q) w.push('Line ' + (i + 1) + ' has no prompt');
        (ln.drill || []).forEach(function (d) {
            drilled++;
            if (d >= toks.length) w.push('Line ' + (i + 1) + ' blanks token ' + d + ' which does not exist');
            else if (/^(string|integer|real|boolean|char)$/i.test(toks[d])) {
                w.push('Line ' + (i + 1) + ': do not blank the datatype name "' + toks[d] + '"');
            }
        });
    });
    if (drilled < 4) w.push('Only ' + drilled + ' keyword blank(s) — blank a few more syntax tokens');
    if ((snippet.distractors || []).length < 6) {
        w.push('Add at least 6 decoy tokens (e.g. VAR, END, =, :=) for the multiple choice options');
    }
    return w;
}

function pseudoPlan(snippet) {
    var lines = Array.isArray(snippet.lines) ? snippet.lines : [];
    var drilled = lines.reduce(function (n, ln) { return n + (ln.drill || []).length; }, 0);
    return 'Stages: keywords (' + drilled + ' questions) \u2192 whole snippet (same tokens) \u2192 token bank (' +
        lines.length + ' lines) \u2192 type lines (' + lines.length + ') \u2192 write it from memory';
}

function renderPseudoEditor() {
    var holder = document.getElementById('chapter-editor');
    holder.innerHTML = '';
    ensureStudyArrays();

    var wrap = el('div', 'editor-card');
    wrap.appendChild(el('h2', '', 'Pseudocode Builder (UDD)'));
    wrap.appendChild(el('div', 'inline-note',
        'Powers the <strong>Pseudocode Builder</strong> game. Give each line the <strong>code</strong> and an ' +
        '<strong>English task</strong> — the task is where the student gets the names (MyDay, MyPtr\u2026), ' +
        'so the syntax has to come from them. Tick which tokens are <strong>blanked</strong> in the keyword ' +
        'stages (keywords and punctuation only, never the datatype name). The game then runs: keywords \u2192 ' +
        'whole snippet \u2192 token bank (with decoys) \u2192 type each line \u2192 write it from memory.'));

    var addBtn = el('button', 'primary', '+ New snippet');
    addBtn.onclick = function () {
        var s = {
            id: slug('ps-' + Date.now()),
            title: 'New snippet',
            intro: '',
            chapter: state.db.chapters.length ? state.db.chapters[0].id : '',
            task: 'Describe what has to be written, including every name.',
            distractors: ['VAR', 'DEFINE', 'STRUCT', '=', '<-', ':='],
            lines: [{ code: 'TYPE MyType = (A,B,C)', q: 'Declare an enumerated type MyType with the values A, B and C.', drill: [0] }]
        };
        ensureUid(s);
        state.db.pseudocode.push(s);
        state.openUids[s._uid] = true;
        renderAll();
    };
    wrap.appendChild(addBtn);
    wrap.appendChild(el('div', '', ''));

    if (!state.db.pseudocode.length) {
        wrap.appendChild(el('div', 'empty-chapter', 'No pseudocode snippets yet — create the first one.'));
    }

    var list = el('div', 'blist');
    state.db.pseudocode.forEach(function (s, i) {
        list.appendChild(renderPseudoRow(state.db.pseudocode, s, i));
    });
    wrap.appendChild(list);
    holder.appendChild(wrap);
}

function renderPseudoRow(snippets, snippet, i) {
    ensureUid(snippet);
    var uid = snippet._uid;
    var isOpen = !!state.openUids[uid];
    var lines = Array.isArray(snippet.lines) ? snippet.lines : [];
    var drilled = lines.reduce(function (n, ln) { return n + (ln.drill || []).length; }, 0);

    var row = el('div', 'brow');
    var head = el('div', 'brow-head');
    var badge = el('span', 'badge', esc(snippet.chapter || '\u2014'));
    var previewEl = el('span', 'brow-preview',
        esc(snippet.title || '(untitled)') + ' \u00b7 ' + lines.length + ' lines \u00b7 ' + drilled + ' keyword blanks');
    var toggle = function () {
        if (state.openUids[uid]) delete state.openUids[uid];
        else state.openUids[uid] = true;
        renderAll();
    };
    [badge, previewEl].forEach(function (n) {
        n.style.cursor = 'pointer';
        n.title = isOpen ? 'Collapse editor' : 'Open editor';
        n.onclick = toggle;
    });
    head.appendChild(badge);

    var warns = pseudoWarnings(snippet);
    if (warns.length) {
        var warnBadge = el('span', 'badge warn', 'Check content');
        warnBadge.title = warns.join('\n');
        warnBadge.style.cursor = 'pointer';
        warnBadge.onclick = toggle;
        head.appendChild(warnBadge);
    }
    head.appendChild(previewEl);

    var up = el('button', '', '&uarr;'); up.title = 'Move up'; up.disabled = i === 0;
    var down = el('button', '', '&darr;'); down.title = 'Move down'; down.disabled = i === snippets.length - 1;
    var edit = el('button', isOpen ? 'primary' : '', isOpen ? 'Done' : 'Edit');
    var del = el('button', 'danger', '&times;'); del.title = 'Delete snippet';
    up.onclick = function (e) { e.stopPropagation(); swap(snippets, i, i - 1); };
    down.onclick = function (e) { e.stopPropagation(); swap(snippets, i, i + 1); };
    edit.onclick = function (e) { e.stopPropagation(); toggle(); };
    del.onclick = function (e) {
        e.stopPropagation();
        if (confirm('Delete snippet "' + (snippet.title || 'untitled') + '"?')) {
            snippets.splice(i, 1);
            delete state.openUids[uid];
            renderAll();
        }
    };
    head.appendChild(up); head.appendChild(down); head.appendChild(edit); head.appendChild(del);
    row.appendChild(head);

    if (!isOpen) return row;

    var form = el('div', 'brow-form');

    var row1 = el('div', 'field-row');
    var titleWrap = el('div');
    titleWrap.appendChild(el('label', '', 'Title (the chip in the game)'));
    var titleIn = el('input', '');
    titleIn.type = 'text';
    titleIn.value = snippet.title || '';
    bindInput(titleIn, function () { snippet.title = titleIn.value; });
    titleWrap.appendChild(titleIn);

    var idWrap = el('div');
    idWrap.appendChild(el('label', '', 'ID (unique, auto-slugs on save)'));
    var idIn = el('input', '');
    idIn.type = 'text';
    idIn.value = snippet.id || '';
    idIn.addEventListener('change', function () {
        snippet.id = slug(idIn.value);
        idIn.value = snippet.id;
    });
    idWrap.appendChild(idIn);
    row1.appendChild(titleWrap); row1.appendChild(idWrap);
    form.appendChild(row1);

    form.appendChild(el('label', '', 'Chapter (usually data-types)'));
    form.appendChild(chapterSelect(state.db.chapters, snippet.chapter, function (v) { snippet.chapter = v; }));

    form.appendChild(el('label', '', 'Intro (one line above the game)'));
    var introTa = el('textarea', '');
    introTa.rows = 2;
    introTa.value = snippet.intro || '';
    bindInput(introTa, function () { snippet.intro = introTa.value; });
    form.appendChild(introTa);

    form.appendChild(el('label', '', 'Task — every name the student needs, but no syntax'));
    var taskTa = el('textarea', '');
    taskTa.rows = 2;
    taskTa.value = snippet.task || '';
    bindInput(taskTa, function () { snippet.task = taskTa.value; });
    form.appendChild(taskTa);

    form.appendChild(el('label', '', 'Decoy tokens (comma separated) — the wrong options and bank decoys'));
    var disTa = el('input', '');
    disTa.type = 'text';
    disTa.style.fontFamily = 'var(--code-font)';
    disTa.value = (snippet.distractors || []).join(', ');
    bindInput(disTa, function () {
        snippet.distractors = disTa.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    });
    form.appendChild(disTa);

    var sub = el('div', 'subblocks');
    sub.appendChild(el('div', 'mini-label', 'Lines — code, task line and which tokens get blanked'));
    snippet.lines = lines;

    lines.forEach(function (ln, li) {
        var block = el('div', 'ps-blank-editor');
        var toks = pseudoTokenize(ln.code);

        var head3 = el('div', 'ps-blank-head');
        head3.appendChild(el('span', 'mini-label', 'Line ' + (li + 1) + ' \u2014 ' + toks.length + ' tokens'));
        var acts = el('div', '');
        var upL = el('button', '', '&uarr;'); upL.disabled = li === 0; upL.title = 'Move line up';
        var downL = el('button', '', '&darr;'); downL.disabled = li === lines.length - 1; downL.title = 'Move line down';
        var rm = el('button', 'danger', 'Remove');
        upL.onclick = function () { var t = lines[li - 1]; lines[li - 1] = lines[li]; lines[li] = t; renderAll(); };
        downL.onclick = function () { var t = lines[li + 1]; lines[li + 1] = lines[li]; lines[li] = t; renderAll(); };
        rm.onclick = function () { lines.splice(li, 1); renderAll(); };
        acts.appendChild(upL); acts.appendChild(downL); acts.appendChild(rm);
        head3.appendChild(acts);
        block.appendChild(head3);

        block.appendChild(el('label', '', 'Code (indentation is kept)'));
        var codeIn = el('input', '');
        codeIn.type = 'text';
        codeIn.style.fontFamily = 'var(--code-font)';
        codeIn.value = ln.code || '';
        codeIn.addEventListener('input', function () { ln.code = codeIn.value; });
        codeIn.addEventListener('change', function () {
            ln.code = codeIn.value;
            ln.drill = (ln.drill || []).filter(function (d) { return d < pseudoTokenize(ln.code).length; });
            renderAll();   // token chips changed
        });
        block.appendChild(codeIn);

        block.appendChild(el('label', '', 'Task for this line (what it has to do, with the names)'));
        var qIn = el('input', '');
        qIn.type = 'text';
        qIn.value = ln.q || '';
        bindInput(qIn, function () { ln.q = qIn.value; });
        block.appendChild(qIn);

        block.appendChild(el('label', '', 'Blank these tokens in the keyword stages'));
        var chipRow = el('div', 'ps-token-chips');
        toks.forEach(function (tk, ti) {
            var on = (ln.drill || []).indexOf(ti) !== -1;
            var chip = el('button', on ? 'primary' : '', esc(tk));
            chip.type = 'button';
            chip.style.fontFamily = 'var(--code-font)';
            chip.style.fontSize = '.75rem';
            chip.style.padding = '2px 8px';
            chip.title = on ? 'Blanked in the keyword stages' : 'Shown to the student';
            chip.onclick = function () {
                ln.drill = ln.drill || [];
                var at = ln.drill.indexOf(ti);
                if (at === -1) ln.drill.push(ti);
                else ln.drill.splice(at, 1);
                ln.drill.sort(function (a, b) { return a - b; });
                renderAll();
            };
            chipRow.appendChild(chip);
        });
        block.appendChild(chipRow);

        sub.appendChild(block);
    });

    var addLine = el('button', '', '+ Add line');
    addLine.onclick = function () {
        lines.push({ code: '', q: '', drill: [] });
        renderAll();
    };
    sub.appendChild(addLine);
    form.appendChild(sub);

    form.appendChild(el('div', 'inline-note', pseudoPlan(snippet)));

    row.appendChild(form);
    return row;
}

// ---------- Save ----------
async function saveToGitHub() {
    if (!state.settings || !state.db) return;
    var status = document.getElementById('save-status');
    setStatus('', 'Saving…');
    document.getElementById('btn-save').disabled = true;

    try {
        var payloadJson = JSON.stringify(state.db, function (k, v) {
            if (k.charAt(0) === '_') return undefined;
            return v;
        }, 2);

        var current = await loadRemoteDb(state.settings);
        var putBody = {
            message: 'Update A2CS notes database (admin)',
            content: b64Utf8(payloadJson),
            branch: state.settings.branch
        };
        if (current.exists && current.sha) putBody.sha = current.sha;

        var put = await gitFetch('repos/' + state.settings.owner + '/' + state.settings.repo + '/contents/db.json', state.settings.token, {
            method: 'PUT',
            body: JSON.stringify(putBody)
        });

        if (put.ok) {
            setStatus('ok', 'Saved to GitHub. Vercel will redeploy automatically in ~1 minute.');
        } else {
            var msg = (await safeErrText(put)) + ' (HTTP ' + put.status + ')';
            if (put.status === 409) msg = 'Conflicting edit detected — refresh/reconnect and try again.';
            if (put.status === 403) msg = 'Permission denied. Your token needs "Contents: Read and write" on this repo.';
            if (put.status === 401) msg = 'Invalid token or it has expired.';
            setStatus('err', 'Save failed: ' + msg);
        }
    } catch (err) {
        setStatus('err', 'Save failed: ' + err.message);
    } finally {
        document.getElementById('btn-save').disabled = false;
    }
}

// ---------- Render everything ----------
function renderAll() {
    if (!state.db) return;
    ensureStudyArrays();
    renderChapterList();
    if (state.view === 'flashcards') {
        renderFlashcardsEditor();
    } else if (state.view === 'quiz') {
        renderQuizEditor();
    } else if (state.view === 'pseudocode') {
        renderPseudoEditor();
    } else {
        renderChapterEditor();
    }
}

// ---------- Wiring ----------
function bindUI() {
    document.getElementById('btn-connect').onclick = connect;
    document.getElementById('btn-logout').onclick = function () {
        localStorage.removeItem(LS_KEY);
        state.settings = null;
        showLoginFirstTime();
    };
    document.getElementById('btn-save').onclick = saveToGitHub;

    document.getElementById('study-nav-flashcards').onclick = function () { setView('flashcards'); };
    document.getElementById('study-nav-quiz').onclick = function () { setView('quiz'); };
    document.getElementById('study-nav-pseudocode').onclick = function () { setView('pseudocode'); };

    document.getElementById('btn-settings').onclick = function () {
        var ls = document.getElementById('login-screen');
        var app = document.getElementById('app-screen');
        app.classList.add('hidden');
        ls.classList.remove('hidden');
        document.getElementById('btn-logout').classList.remove('hidden');
        document.getElementById('btn-connect').textContent = 'Reconnect';
        document.getElementById('login-status').className = 'status-msg';
        document.getElementById('login-status').textContent = '';
    };

    document.getElementById('btn-new-chap').onclick = function () {
        document.getElementById('new-chap-form').classList.remove('hidden');
        document.getElementById('nc-title').focus();
    };
    document.getElementById('btn-cancel-chap').onclick = function () {
        document.getElementById('new-chap-form').classList.add('hidden');
        document.getElementById('nc-title').value = '';
        document.getElementById('nc-pdf').value = '';
    };
    document.getElementById('btn-create-chap').onclick = function () {
        var title = document.getElementById('nc-title').value.trim();
        var pdf = document.getElementById('nc-pdf').value.trim();
        if (!title) { document.getElementById('nc-title').focus(); return; }
        var ch = { id: slug(title), title: title, subtitle: '', pdf: pdf, blocks: [] };
        state.db.chapters.push(ch);
        state.selectedChapterId = ch.id;
        state.view = 'chapters';
        document.getElementById('new-chap-form').classList.add('hidden');
        document.getElementById('nc-title').value = '';
        document.getElementById('nc-pdf').value = '';
        renderAll();
    };

    document.getElementById('f-owner').addEventListener('keydown', function (e) { if (e.key === 'Enter') connect(); });
    document.getElementById('f-repo').addEventListener('keydown', function (e) { if (e.key === 'Enter') connect(); });
    document.getElementById('f-branch').addEventListener('keydown', function (e) { if (e.key === 'Enter') connect(); });
    document.getElementById('f-token').addEventListener('keydown', function (e) { if (e.key === 'Enter') connect(); });
}

async function connect() {
    var owner = document.getElementById('f-owner').value.trim();
    var repo = document.getElementById('f-repo').value.trim();
    var branch = document.getElementById('f-branch').value.trim() || 'main';
    var token = document.getElementById('f-token').value.trim();
    var status = document.getElementById('login-status');
    var btn = document.getElementById('btn-connect');

    status.className = 'status-msg';
    status.textContent = '';

    if (!owner || !repo || !token) {
        status.className = 'status-msg err';
        status.textContent = 'Please fill in owner, repository and token.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Connecting…';
    try {
        var s = { owner: owner, repo: repo, branch: branch, token: token };
        var current = await loadRemoteDb(s);
        if (current.exists) {
            state.db = current.db;
            if (!Array.isArray(state.db.chapters)) state.db.chapters = [];
        } else {
            var ok = confirm('db.json was not found in this repo.\n\nCreate it with an empty A2CS database now? It will be written to GitHub on your first "Save to GitHub".');
            if (!ok) {
                status.className = 'status-msg err';
                status.textContent = 'Cancelled. Add db.json to the repo first or retry.';
                btn.disabled = false;
                btn.textContent = 'Connect';
                return;
            }
            state.db = { version: 1, site: { title: 'A2CS', subtitle: 'Exam Prep' }, chapters: [] };
        }
        ensureStudyArrays();
        state.settings = s;
        localStorage.setItem(LS_KEY, JSON.stringify(s));
        state.selectedChapterId = state.db.chapters.length ? state.db.chapters[0].id : null;
        state.view = 'chapters';
        state.openUids = {};
        showApp();
    } catch (err) {
        status.className = 'status-msg err';
        status.textContent = 'Could not connect: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = state.settings ? 'Reconnect' : 'Connect';
    }
}

// ---------- Bootstrap ----------
function init() {
    bindUI();
    try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) state.settings = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    if (state.settings) {
        // Auto-connect silently; if it fails, drop back to the login screen.
        (async function () {
            var current = await loadRemoteDb(state.settings);
            state.db = current.exists ? current.db : null;
            if (state.db && Array.isArray(state.db.chapters)) {
                ensureStudyArrays();
                state.selectedChapterId = state.db.chapters.length ? state.db.chapters[0].id : null;
                state.view = 'chapters';
                showApp();
            } else {
                state.settings = null;
                localStorage.removeItem(LS_KEY);
                showLoginFirstTime();
            }
        })().catch(function () {
            state.settings = null;
            localStorage.removeItem(LS_KEY);
            showLoginFirstTime();
        });
    } else {
        showLoginFirstTime();
    }
}

document.addEventListener('DOMContentLoaded', init);