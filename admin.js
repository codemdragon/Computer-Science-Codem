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
    openUids: {}
};

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
    renderChapterList();
    renderChapterEditor();
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
        var item = el('div', 'chapter-item' + (ch.id === state.selectedChapterId ? ' selected' : ''));
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
            renderAll();
        };
        holder.appendChild(item);
    });
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
    var idL = el('label', '', 'ID (url anchor)');
    var idIn = el('input', '');
    idIn.type = 'text'; idIn.value = ch.id;
    bindInput(idIn, function () { ch.id = slug(idIn.value || ch.title) || ch.id; idIn.value = ch.id; });
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
        'Tip: inside Paragraphs/Headings/Notes you can use &lt;strong&gt; and &lt;code&gt;. Rows in Tables: comma-separated cells, one row per line.');
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
    head.appendChild(el('span', 'badge', esc(b.type)));
    head.appendChild(el('span', 'brow-preview', esc(preview(b))));

    var up = el('button', '', '&uarr;'); up.title = 'Move up'; up.disabled = i === 0;
    var down = el('button', '', '&darr;'); down.title = 'Move down'; down.disabled = i === blocks.length - 1;
    var tog = el('button', '', isOpen ? '&minus;' : '&plus;'); tog.title = isOpen ? 'Collapse' : 'Edit';
    var del = el('button', 'danger', '&times;'); del.title = 'Delete block';

    up.onclick = function () { swap(blocks, i, i - 1); };
    down.onclick = function () { swap(blocks, i, i + 1); };
    del.onclick = function () {
        blocks.splice(i, 1);
        delete state.openUids[uid];
        renderChapterEditor();
    };
    tog.onclick = function () {
        if (state.openUids[uid]) delete state.openUids[uid];
        else state.openUids[uid] = true;
        renderChapterEditor();
    };

    head.appendChild(up); head.appendChild(down); head.appendChild(tog); head.appendChild(del);
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
    renderChapterList();
    renderChapterEditor();
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
        state.settings = s;
        localStorage.setItem(LS_KEY, JSON.stringify(s));
        state.selectedChapterId = state.db.chapters.length ? state.db.chapters[0].id : null;
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
                state.selectedChapterId = state.db.chapters.length ? state.db.chapters[0].id : null;
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