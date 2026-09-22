/* A2CS Study — Flashcards (mechanics ported from codem_studyset) and
   Quiz engine (mechanics ported from CSP1's Games quiz/speed round).
   All content comes from db.json: `flashcards` and `quiz` arrays,
   both editable in the Admin Panel. */
window.Study = (function () {
    'use strict';

    var db = null;
    var chapters = [];

    // ---------- Icons (inline SVG — no emoji anywhere in the games) ----------
    // All icons are 24x24, inherit the surrounding text colour and size (1em).
    var ICONS = {
        check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        cross: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        arrowLeft: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>',
        arrowRight: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
        pencil: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z"></path><line x1="14.5" y1="5.5" x2="17.5" y2="8.5"></line></svg>',
        bolt: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
        clock: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14.5"></polyline></svg>',
        bulb: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"></path><line x1="9.5" y1="19" x2="14.5" y2="19"></line><line x1="10.5" y1="21.5" x2="13.5" y2="21.5"></line></svg>',
        trophy: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4h10v5a5 5 0 0 1-10 0z"></path><path d="M7 5H4.5v1.5A3.5 3.5 0 0 0 8 10"></path><path d="M17 5h2.5v1.5A3.5 3.5 0 0 1 16 10"></path><line x1="12" y1="14" x2="12" y2="18"></line><line x1="8" y1="21" x2="16" y2="21"></line><line x1="9.5" y1="18" x2="14.5" y2="18"></line></svg>',
        thumbsUp: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3z"></path><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>',
        book: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
        retry: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="2 4 2 10 8 10"></polyline><path d="M4.5 15a9 9 0 1 0 2.1-9.4L2 10"></path></svg>',
        sparkle: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 3l1.7 4.6L17.3 9l-4.6 1.7L11 15.3 9.3 10.7 4.7 9l4.6-1.4z"></path><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"></path></svg>',
        cards: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="6" width="15" height="15" rx="2"></rect><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3H19a3 3 0 0 1 3 3v10.5a1.5 1.5 0 0 1-1.5 1.5H17"></path></svg>',
        clipboard: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5"></path><path d="M15 4.5h2.5A1.5 1.5 0 0 1 19 6v13.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V6a1.5 1.5 0 0 1 1.5-1.5H9"></path><polyline points="9 13 11.2 15.2 15.5 10.5"></polyline></svg>',
        code: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>'
    };

    // ---------- Utilities ----------
    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Same small safe-markup rules as the notes renderer
    function safeHtml(s) {
        return esc(s).replace(/&lt;(\/?(?:strong|code|em))&gt;/g, '<$1>');
    }

    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function chapterTitle(id) {
        for (var i = 0; i < chapters.length; i++) {
            if (chapters[i].id === id) return chapters[i].title;
        }
        return id;
    }

    function allCards() { return Array.isArray(db.flashcards) ? db.flashcards : []; }
    function allQuiz() { return Array.isArray(db.quiz) ? db.quiz : []; }

    // =================================================================
    // FLASHCARDS  (from codem_studyset — flip, know / don't know,
    // review loop for unknown cards, progress bar, chapter filters)
    // =================================================================
    var fc = {
        filter: 'all',
        mode: 'terms',        // 'terms' | 'questions'
        deck: [],             // [{key, front, back, chapter}]
        byId: {},
        known: {},            // key -> true
        unknown: [],          // keys still to review
        pos: 0,
        reviewing: false,
        reviewPos: 0,
        completed: false
    };

    function fcFilterCards() {
        return allCards().filter(function (c) {
            return fc.filter === 'all' || c.chapter === fc.filter;
        });
    }

    // Card backs stay memorisable: one short answer line plus at most 3 bullets.
    var MAX_POINTS = 3;

    function cardPoints(card) {
        var pts = Array.isArray(card.points) ? card.points.slice() : [];
        if (!pts.length && card.details) {
            // legacy field — split on line / bullet breaks so old cards still read as bullets
            pts = String(card.details).split(/\s*(?:\n|\u2022)\s*/);
        }
        pts = pts.map(function (p) { return String(p).trim(); }).filter(Boolean);
        return pts.slice(0, MAX_POINTS);
    }

    function cardBackHtml(card) {
        var back = '<div class="fc-def">' + safeHtml(card.definition || '') + '</div>';
        var pts = cardPoints(card);
        if (pts.length) {
            back += '<ul class="fc-points">' + pts.map(function (p) {
                return '<li>' + safeHtml(p) + '</li>';
            }).join('') + '</ul>';
        }
        if (card.example) {
            back += '<div class="fc-example"><span class="fc-label">Example</span>' + safeHtml(card.example) + '</div>';
        }
        return back;
    }

    // Build the deck for the current filter + mode
    function fcBuildDeck() {
        var list = fcFilterCards();
        var deck = [];

        if (fc.mode === 'questions') {
            // One card per question: Q on the front, A on the back
            list.forEach(function (c) {
                (c.questions || []).forEach(function (qa, i) {
                    deck.push({
                        key: c.id + '::' + i,
                        front: safeHtml(qa.q),
                        back: '<div class="fc-def">' + safeHtml(qa.a) + '</div>' +
                              '<div class="fc-from"><span class="fc-label">From</span>' + safeHtml(c.term) + '</div>',
                        chapter: c.chapter
                    });
                });
            });
        } else {
            list.forEach(function (c) {
                deck.push({ key: c.id, front: safeHtml(c.term), back: cardBackHtml(c), chapter: c.chapter });
            });
        }

        fc.deck = deck;
        fc.byId = {};
        deck.forEach(function (item) { fc.byId[item.key] = item; });
        fc.known = {};
        fc.unknown = [];
        fc.pos = 0;
        fc.reviewing = false;
        fc.reviewPos = 0;
        fc.completed = false;
    }

    function fcCurrent() {
        if (fc.reviewing) return fc.byId[fc.unknown[fc.reviewPos]];
        return fc.deck[fc.pos];
    }

    function fcAdvance() {
        if (fc.reviewing) {
            fc.reviewPos = (fc.reviewPos + 1) % fc.unknown.length;
            return;
        }
        fc.pos++;
        if (fc.pos >= fc.deck.length) {
            // Finished the whole deck — review the unknown ones
            if (fc.unknown.length > 0) {
                fc.reviewing = true;
                fc.reviewPos = 0;
            } else {
                fc.pos = 0;
                fc.completed = true;
            }
        }
    }

    function fcUnflip() {
        var card = document.getElementById('fc-card');
        if (card) card.classList.remove('flipped');
    }

    function fcKnow() {
        var cur = fcCurrent();
        if (!cur) return;
        fc.known[cur.key] = true;

        if (fc.reviewing) {
            var i = fc.unknown.indexOf(cur.key);
            if (i !== -1) fc.unknown.splice(i, 1);
            if (fc.unknown.length === 0) {
                fc.reviewing = false;
                fc.pos = 0;
                fc.completed = true;
            } else if (fc.reviewPos >= fc.unknown.length) {
                fc.reviewPos = 0;
            }
        } else {
            var u = fc.unknown.indexOf(cur.key);
            if (u !== -1) fc.unknown.splice(u, 1);
            fcAdvance();
        }
        fcUnflip();
        fcRender();
    }

    function fcDontKnow() {
        var cur = fcCurrent();
        if (!cur) return;

        if (fc.reviewing) {
            fc.reviewPos = (fc.reviewPos + 1) % fc.unknown.length;
        } else {
            delete fc.known[cur.key];
            if (fc.unknown.indexOf(cur.key) === -1) fc.unknown.push(cur.key);
            fc.completed = false;
            fcAdvance();
        }
        fcUnflip();
        fcRender();
    }

    function fcMove(dir) {
        if (fc.reviewing) {
            if (!fc.unknown.length) return;
            fc.reviewPos = (fc.reviewPos + dir + fc.unknown.length) % fc.unknown.length;
        } else if (fc.deck.length) {
            fc.pos = (fc.pos + dir + fc.deck.length) % fc.deck.length;
        }
        fcUnflip();
        fcRender();
    }

    function fcCountFor(chapterId) {
        var list = allCards().filter(function (c) {
            return chapterId === 'all' || c.chapter === chapterId;
        });
        if (fc.mode === 'questions') {
            return list.reduce(function (n, c) { return n + (c.questions ? c.questions.length : 0); }, 0);
        }
        return list.length;
    }

    function fcRenderFilters() {
        var holder = document.getElementById('fc-filters');
        if (!holder) return;
        holder.innerHTML = '';

        var ids = ['all'].concat(chapters.map(function (c) { return c.id; }));
        ids.forEach(function (id) {
            var n = fcCountFor(id);
            var chip = document.createElement('button');
            chip.className = 'filter-chip' + (fc.filter === id ? ' active' : '');
            chip.setAttribute('data-filter', id);
            chip.textContent = (id === 'all' ? 'All' : chapterTitle(id)) + ' (' + n + ')';
            if (n === 0) chip.disabled = true;
            holder.appendChild(chip);
        });
    }

    function fcRender() {
        var front = document.getElementById('fc-front');
        var back = document.getElementById('fc-back');
        var counter = document.getElementById('fc-counter');
        var progress = document.getElementById('fc-progress');
        var stats = document.getElementById('fc-stats');
        var controls = document.getElementById('fc-controls');
        if (!front) return;

        if (!fc.deck.length) {
            front.innerHTML = '<div class="fc-term">No cards here</div><div class="fc-hint">Try another chapter or mode</div>';
            back.innerHTML = '';
            counter.textContent = 'Card 0 of 0';
            progress.style.width = '0%';
            stats.textContent = 'Add flashcards in the Admin Panel to get started.';
            controls.style.display = 'none';
            return;
        }
        controls.style.display = '';

        var cur = fcCurrent();
        front.innerHTML = cur.front + '<div class="fc-hint">Click to flip</div>';
        back.innerHTML = '<div class="fc-chapter">' + esc(chapterTitle(cur.chapter)) + '</div>' + cur.back;

        if (fc.reviewing) {
            counter.textContent = 'Review card ' + (fc.reviewPos + 1) + ' of ' + fc.unknown.length + ' — ones you didn\u2019t know';
        } else {
            counter.textContent = 'Card ' + (fc.pos + 1) + ' of ' + fc.deck.length;
        }

        var knownCount = Object.keys(fc.known).length;
        progress.style.width = (knownCount / fc.deck.length * 100) + '%';
        stats.innerHTML = 'Known: ' + knownCount + '/' + fc.deck.length +
                            ' &middot; To Review: ' + fc.unknown.length +
                            (fc.completed ? '<span class="fc-done">' + ICONS.sparkle + ' Session complete</span>' : '');
    }

    function fcSetFilter(id) {
        if (fcCountFor(id) === 0) return;
        fc.filter = id;
        fcBuildDeck();
        fcRenderFilters();
        fcRender();
    }

    function fcSetMode(mode) {
        fc.mode = mode;
        document.querySelectorAll('#fc-mode button').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-mode') === mode);
        });
        fcBuildDeck();
        fcRenderFilters();
        fcRender();
    }

    function buildFlashcardsSection(main) {
        var sec = document.createElement('section');
        sec.id = 'study-flashcards';

        var h1 = document.createElement('h1');
        h1.textContent = 'Flashcards';
        sec.appendChild(h1);

        var meta = document.createElement('div');
        meta.className = 'chapter-meta';
        var sub = document.createElement('p');
        sub.className = 'chapter-subtitle';
        sub.textContent = 'Flip a card, mark whether you knew it, and anything you miss comes back for review at the end.';
        meta.appendChild(sub);
        sec.appendChild(meta);

        var toolbar = document.createElement('div');
        toolbar.className = 'study-toolbar';
        toolbar.innerHTML =
            '<div class="filter-chips" id="fc-filters"></div>' +
            '<div class="mode-toggle" id="fc-mode">' +
                '<button type="button" data-mode="terms" class="active">Terms</button>' +
                '<button type="button" data-mode="questions">Questions</button>' +
            '</div>';
        sec.appendChild(toolbar);

        var counter = document.createElement('div');
        counter.className = 'progress-info';
        counter.id = 'fc-counter';
        sec.appendChild(counter);

        var track = document.createElement('div');
        track.className = 'progress-track';
        track.innerHTML = '<div class="progress-fill" id="fc-progress"></div>';
        sec.appendChild(track);

        var card = document.createElement('div');
        card.className = 'flashcard';
        card.id = 'fc-card';
        card.title = 'Click to flip';
        card.innerHTML =
            '<div class="flashcard-inner">' +
                '<div class="flashcard-front" id="fc-front"></div>' +
                '<div class="flashcard-back" id="fc-back"></div>' +
            '</div>';
        card.addEventListener('click', function () { card.classList.toggle('flipped'); });
        sec.appendChild(card);

        var controls = document.createElement('div');
        controls.id = 'fc-controls';
        controls.innerHTML =
            '<div class="knowledge-buttons">' +
                '<button type="button" class="btn-know" id="fc-know">' + ICONS.check + ' I know this</button>' +
                '<button type="button" class="btn-dont" id="fc-dont">' + ICONS.cross + ' I don\u2019t know</button>' +
            '</div>' +
            '<div class="study-nav">' +
                '<button type="button" class="study-btn" id="fc-prev">' + ICONS.arrowLeft + ' Previous</button>' +
                '<button type="button" class="study-btn" id="fc-next">Next ' + ICONS.arrowRight + '</button>' +
            '</div>' +
            '<div class="session-stats" id="fc-stats"></div>';
        sec.appendChild(controls);

        // Wiring
        toolbar.addEventListener('click', function (e) {
            var chip = e.target.closest ? e.target.closest('.filter-chip') : null;
            if (chip && chip.getAttribute('data-filter')) {
                fcSetFilter(chip.getAttribute('data-filter'));
                return;
            }
            var mbtn = e.target.closest ? e.target.closest('#fc-mode button') : null;
            if (mbtn && mbtn.getAttribute('data-mode')) {
                fcSetMode(mbtn.getAttribute('data-mode'));
            }
        });
        document.addEventListener('keydown', function (e) {
            // Only when the flashcards section is visible
            if (!sec.classList.contains('active')) return;
            if (e.key === 'ArrowRight') fcMove(1);
            else if (e.key === 'ArrowLeft') fcMove(-1);
            else if (e.key === ' ' || e.key === 'Enter') {
                var target = e.target;
                if (target && /INPUT|TEXTAREA|SELECT|BUTTON/.test(target.tagName)) return;
                e.preventDefault();
                card.classList.toggle('flipped');
            }
        });
        controls.addEventListener('click', function (e) {
            if (e.target.id === 'fc-know') fcKnow();
            else if (e.target.id === 'fc-dont') fcDontKnow();
            else if (e.target.id === 'fc-prev') fcMove(-1);
            else if (e.target.id === 'fc-next') fcMove(1);
        });

        main.appendChild(sec);
    }

    // =================================================================
    // PSEUDOCODE BUILDER (UDD) — the point is to WRITE the syntax.
    //
    // Identifiers (MyDay, MyPtr, Student…) are always supplied in the English
    // prompt; the syntax is never given away. Scaffolding fades stage by stage
    // (faded Parsons problems + faded worked examples):
    //   1. Keywords      one line at a time, its keyword missing (multiple choice)
    //   2. Whole snippet every keyword missing at once (multiple choice)
    //   3. Token bank    rebuild each line by tapping its tokens in order (+decoys)
    //   4. Type lines    type each line from its prompt, token-level feedback
    //   5. Write it      type the whole snippet from memory, reference hidden
    //   6. Review        retype only the lines that were wrong
    // Every stage can be skipped ahead (more scaffolding is not always better).
    // Content lives in db.json -> `pseudocode`.
    // =================================================================
    var ps = { idx: 0, run: null };

    var PS_STAGES = ['Keywords', 'Whole snippet', 'Token bank', 'Type lines', 'Write it', 'Review'];
    var PS_PUNCT = ['(', ')', '[', ']', '{', '}', '.', ',', ':', '^'];

    function allPseudo() { return Array.isArray(db.pseudocode) ? db.pseudocode : []; }
    function psLines(snippet) { return Array.isArray(snippet.lines) ? snippet.lines : []; }

    // ---- tokens ----
    function psTokenize(line) {
        var t = String(line == null ? '' : line).trim();
        PS_PUNCT.forEach(function (ch) { t = t.split(ch).join(' ' + ch + ' '); });
        return t.split(/\s+/).filter(function (x) { return x !== ''; });
    }

    function psIndent(code) {
        var m = /^\s*/.exec(String(code || ''));
        return m ? m[0] : '';
    }

    function psTokensEqual(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) {
            if (String(a[i]).toLowerCase() !== String(b[i]).toLowerCase()) return false;
        }
        return true;
    }

    // ---- token level diff (LCS) ----
    function psDiff(expected, got) {
        var a = expected.map(function (t) { return t.toLowerCase(); });
        var b = got.map(function (t) { return t.toLowerCase(); });
        var n = a.length, m = b.length, i, j;
        var dp = [];
        for (i = 0; i <= n; i++) {
            dp[i] = [];
            for (j = 0; j <= m; j++) dp[i][j] = 0;
        }
        for (i = n - 1; i >= 0; i--) {
            for (j = m - 1; j >= 0; j--) {
                dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
        var rows = [];
        var x = 0, y = 0;
        while (x < n && y < m) {
            if (a[x] === b[y]) { rows.push({ t: 'ok', exp: expected[x], got: got[y] }); x++; y++; }
            else if (dp[x + 1][y] >= dp[x][y + 1]) { rows.push({ t: 'missing', exp: expected[x] }); x++; }
            else { rows.push({ t: 'extra', got: got[y] }); y++; }
        }
        while (x < n) { rows.push({ t: 'missing', exp: expected[x] }); x++; }
        while (y < m) { rows.push({ t: 'extra', got: got[y] }); y++; }
        var missing = rows.filter(function (r) { return r.t === 'missing'; }).length;
        var extra = rows.filter(function (r) { return r.t === 'extra'; }).length;
        return { rows: rows, missing: missing, extra: extra, ok: missing === 0 && extra === 0 };
    }

    // Coaching feedback aimed at the syntax, not the answer
    var PS_HINTS = [
        { tok: 'declare', msg: 'every variable or field declaration opens with the keyword DECLARE.' },
        { tok: 'type',    msg: 'a user defined type is introduced with the keyword TYPE.' },
        { tok: 'endtype', msg: 'a record definition is closed with ENDTYPE.' },
        { tok: ':',       msg: 'a declaration separates the name from its type with a colon — Name : Type.' },
        { tok: '<--',     msg: 'assignment in pseudocode is written with <-- , not = .' },
        { tok: 'set',     msg: 'a set type is written SET OF <type>.' },
        { tok: 'of',      msg: 'a set type is written SET OF <type>.' },
        { tok: 'define',  msg: 'set values are given with DEFINE Name (1, 2, 3) : Type.' },
        { tok: '^',       msg: 'pointers use ^ — ^Name is the address, Name^ is the value.' },
        { tok: '(',       msg: 'the listed values go inside brackets, e.g. (Mon,Tue,Wed).' },
        { tok: '.',       msg: 'a record field is reached with a dot — MyStudent.Surname.' },
        { tok: 'output',  msg: 'output in pseudocode is written OUTPUT .' }
    ];

    function psHintFor(expected, got) {
        var missing = expected.filter(function (t) {
            return got.map(function (g) { return g.toLowerCase(); }).indexOf(t.toLowerCase()) === -1;
        });
        for (var i = 0; i < PS_HINTS.length; i++) {
            if (missing.map(function (t) { return t.toLowerCase(); }).indexOf(PS_HINTS[i].tok) !== -1) {
                return 'Hint: ' + PS_HINTS[i].msg;
            }
        }
        if (missing.length) return 'Hint: ' + missing.length + ' token' + (missing.length === 1 ? ' is' : 's are') + ' missing or out of order.';
        return 'Hint: the tokens are right but something extra or mis-ordered slipped in.';
    }

    // ---- multiple-choice options for one token ----
    function psTokenOptions(snippet, tokens, idx) {
        var correct = tokens[idx];
        var pool = (snippet.distractors || []).filter(function (d) { return d !== correct; });
        var isSym = /^[^A-Za-z0-9]/.test(correct);
        var same = pool.filter(function (d) { return /^[^A-Za-z0-9]/.test(d) === isSym; });
        var rest = pool.filter(function (d) { return same.indexOf(d) === -1; });
        return [correct].concat(same.concat(rest).slice(0, 3));
    }

    // ---- which lines / tokens get drilled ----
    function psDrillLines(snippet) {
        var idxs = [];
        psLines(snippet).forEach(function (ln, i) { if ((ln.drill || []).length) idxs.push(i); });
        if (idxs.length) return idxs;
        return psLines(snippet).map(function (_, i) { return i; });
    }

    function psDrillQueue(snippet) {
        var q = [];
        psLines(snippet).forEach(function (ln, i) {
            (ln.drill || []).forEach(function (t) { q.push({ line: i, token: t }); });
        });
        if (q.length) return q;
        return psLines(snippet).map(function (_, i) { return { line: i, token: 0 }; });
    }

    // ---- code rendering ----
    function psCodeHtml(snippet, opts) {
        opts = opts || {};
        var gaps = opts.gaps || {};
        var filled = opts.filled || {};
        var out = [];
        psLines(snippet).forEach(function (ln, li) {
            if (opts.upto !== undefined && li > opts.upto) return;
            var indent = esc(psIndent(ln.code));
            var toks = psTokenize(ln.code);
            var body;
            if (opts.trayLine === li) {
                body = (opts.tray || []).map(function (t, ti) {
                    return '<button type="button" class="ps-tray-tok" data-tray="' + ti + '">' + esc(t) + '</button>';
                }).join(' ') + '<span class="ps-caret"></span>';
            } else {
                body = toks.map(function (tk, ti) {
                    if ((filled[li] || {})[ti]) return '<span class="ps-tok ps-tok-ok">' + esc(tk) + '</span>';
                    if ((gaps[li] || []).indexOf(ti) !== -1) return '<span class="ps-gap"></span>';
                    return '<span class="ps-tok">' + esc(tk) + '</span>';
                }).join(' ');
            }
            out.push('<span class="ps-line">' + indent + body + '</span>');
        });
        return '<pre class="ps-code">' + out.join('') + '</pre>';
    }

    function psDiffHtml(expected, got) {
        var d = psDiff(expected, got);
        var expectRow = d.rows.filter(function (r) { return r.t !== 'extra'; }).map(function (r) {
            return r.t === 'ok'
                ? '<span class="ps-diff-ok">' + esc(r.exp) + '</span>'
                : '<span class="ps-diff-missing">' + esc(r.exp) + '</span>';
        }).join(' ');
        var gotRow = d.rows.filter(function (r) { return r.t !== 'missing'; }).map(function (r) {
            return r.t === 'ok'
                ? '<span class="ps-diff-ok">' + esc(r.got) + '</span>'
                : '<span class="ps-diff-extra">' + esc(r.got) + '</span>';
        }).join(' ');
        return {
            ok: d.ok,
            html: '<div class="ps-diff">' +
                '<div class="ps-diff-row"><span class="ps-diff-label">You wrote</span><code>' + (gotRow || '&nbsp;') + '</code></div>' +
                '<div class="ps-diff-row"><span class="ps-diff-label">Should be</span><code>' + expectRow + '</code></div>' +
                '</div>' + '<div class="ps-hint">' + esc(psHintFor(expected, got)) + '</div>'
        };
    }

    // ---- state ----
    function psStartSnippet() {
        var s = allPseudo()[ps.idx];
        if (!s) { ps.run = null; return; }
        ps.run = {
            snippetId: s.id,
            stage: 0,
            lineIdx: 0,          // cursor for stages 0, 2, 3
            qIdx: 0,             // cursor for stage 1
            picked: null,
            lastOk: false,
            gaps: {},            // stage 2/3: {lineIdx: [tokIdx]}
            filled: {},          // {lineIdx: {tokIdx: token}}
            typedLines: {},      // stage 2/4: {lineIdx: [tokens]} completed
            bank: [],            // stage 2 bank [{text, used}]
            tray: [],
            values: {},          // typed text per line (stage 3/4/5)
            results: {},         // per line: true / false (last check)
            wrong: [],           // line indices to review
            revealed: {},        // line index -> true
            bankChecked: null,
            attempts: 0,
            hints: 0,
            peeks: 0,
            peekUntil: 0,
            done: false
        };
    }

    function psStageCount(r) {
        return PS_STAGES.length - 1;   // Review is conditional
    }

    function psStageBar(s, r) {
        var label = PS_STAGES[r.stage];
        var total = psStageCount(r);
        var dots = '';
        for (var i = 1; i <= total; i++) {
            dots += '<span class="ps-dot' + (i < r.stage + 1 ? ' done' : (i === r.stage + 1 ? ' on' : '')) + '"></span>';
        }
        var extra;
        if (r.stage === 0) extra = 'Line ' + (r.lineIdx + 1) + ' of ' + psDrillLines(s).length;
        else if (r.stage === 1) extra = 'Question ' + (r.qIdx + 1) + ' of ' + psDrillQueue(s).length;
        else if (r.stage === 2 || r.stage === 3) extra = 'Line ' + (r.lineIdx + 1) + ' of ' + psLines(s).length;
        else if (r.stage === 5) extra = r.wrong.length + ' line' + (r.wrong.length === 1 ? '' : 's');
        else extra = psLines(s).length + ' lines';
        return '<div class="ps-stagebar"><span class="ps-phase">' + esc(label) + '</span>' +
            '<span class="ps-dots">' + dots + '</span><span class="ps-count">' + esc(extra) + '</span></div>';
    }

    function psTaskHtml(s) {
        return '<div class="ps-task"><strong>Task:</strong> ' + safeHtml(s.task || '') + '</div>';
    }

    function psStageActions(r, extraButtons) {
        var html = '<div class="quiz-actions">' + (extraButtons || '');
        if (r.stage < psStageCount(r) - 1) {
            html += '<button type="button" class="study-btn" id="ps-skip" title="Jump to the next stage">Skip ahead ' + ICONS.arrowRight + '</button>';
        }
        html += '<button type="button" class="study-btn" id="ps-restart">' + ICONS.retry + ' Start over</button>';
        html += '<button type="button" class="study-btn" id="ps-next-snippet">Next snippet ' + ICONS.arrowRight + '</button>';
        html += '</div>';
        return html;
    }

    // ---- stage 0 / 1: multiple choice on the syntax tokens ----
    function psRenderMcq(s, r) {
        var allToks = psLines(s).map(function (ln) { return psTokenize(ln.code); });
        var gaps = {};
        var filled = r.filled;
        var current;   // {line, token}

        if (r.stage === 0) {
            var lines0 = psDrillLines(s);
            var li0 = lines0[Math.min(r.lineIdx, lines0.length - 1)];
            var t0 = (psLines(s)[li0].drill || [0])[0];
            gaps[li0] = [t0];
            current = { line: li0, token: t0 };
        } else {
            psDrillQueue(s).forEach(function (q) {
                gaps[q.line] = (gaps[q.line] || []).concat([q.token]);
            });
            current = psDrillQueue(s)[Math.min(r.qIdx, psDrillQueue(s).length - 1)];
        }

        var line = psLines(s)[current.line];
        var correct = allToks[current.line][current.token];
        var asked = r.picked !== null;
        var panel;

        if (!asked) {
            var opts = r.optOrder || (r.optOrder = shuffle(psTokenOptions(s, allToks[current.line], current.token)));
            panel = '<div class="ps-qline"><strong>Line ' + (current.line + 1) + ': </strong>' +
                    safeHtml(line.q || '') + '</div>' +
                '<div class="ps-options">' + opts.map(function (o) {
                    return '<button type="button" class="ps-opt" data-opt="' + esc(o) + '">' + esc(o) + '</button>';
                }).join('') + '</div>';
        } else {
            var wholeLine = allToks[current.line].join(' ');
            var nextLabel = r.stage === 0
                ? (r.lineIdx + 1 >= psDrillLines(s).length ? 'Next stage ' : 'Next line ')
                : (r.qIdx + 1 >= psDrillQueue(s).length ? 'Next stage ' : 'Next blank ');
            panel = '<div class="ps-feedback ' + (r.lastOk ? 'ok' : 'bad') + '">' +
                (r.lastOk
                    ? ICONS.check + ' Correct — <code>' + esc(wholeLine) + '</code>'
                    : ICONS.cross + ' Not quite — <code>' + esc(wholeLine) + '</code>') +
                '</div>' +
                (r.lastOk ? '' : '<div class="ps-hint">' + esc('Hint: the missing token is ' + correct + '.') + '</div>') +
                psStageActions(r, '<button type="button" class="study-btn primary" id="ps-next">' +
                    nextLabel + ICONS.arrowRight + '</button>');
            return psStageBar(s, r) + psTaskHtml(s) + psCodeHtml(s, { gaps: gaps, filled: filled }) + panel;
        }

        return psStageBar(s, r) + psTaskHtml(s) + psCodeHtml(s, { gaps: gaps, filled: filled }) + panel +
            psStageActions(r, '');
    }

    // ---- stage 2: token bank (faded Parsons) ----
    function psBuildBank(s, r) {
        var toks = psTokenize(psLines(s)[r.lineIdx].code);
        var extra = (s.distractors || []).filter(function (d) {
            return toks.map(function (t) { return t.toLowerCase(); }).indexOf(d.toLowerCase()) === -1;
        }).slice(0, 3);
        r.bank = shuffle(toks.concat(extra)).map(function (t) { return { text: t, used: false }; });
        r.tray = [];
    }

    function psRenderBank(s, r) {
        var line = psLines(s)[r.lineIdx];
        var expected = psTokenize(line.code);
        if (!r.bank.length) psBuildBank(s, r);

        var bankHtml = r.bank.map(function (tk, i) {
            return '<button type="button" class="ps-bank-tok' + (tk.used ? ' used' : '') + '" data-bank="' + i + '"' +
                (tk.used ? ' disabled' : '') + '>' + esc(tk.text) + '</button>';
        }).join('');

        var feedback = '';
        if (r.bankChecked) {
            var diff = psDiffHtml(expected, r.tray);
            feedback = diff.ok
                ? '<div class="ps-feedback ok">' + ICONS.check + ' Line ' + (r.lineIdx + 1) + ' built correctly.</div>'
                : '<div class="ps-feedback bad">' + ICONS.cross + ' Not the right order yet.</div>' + diff.html;
        }

        var actions = r.tray.length
            ? '<button type="button" class="study-btn primary" id="ps-check-line">' + ICONS.check + ' Check line</button>'
            : '';
        actions += '<button type="button" class="study-btn" id="ps-clear">Clear</button>';
        if (r.bankChecked) actions += '<button type="button" class="study-btn" id="ps-show-line">' + ICONS.bulb + ' Show line</button>';

        return psStageBar(s, r) + psTaskHtml(s) +
            psCodeHtml(s, { upto: r.lineIdx, trayLine: r.lineIdx, tray: r.tray, filled: r.filled }) +
            '<div class="ps-qline"><strong>Line ' + (r.lineIdx + 1) + ' of ' + psLines(s).length + ': </strong>' +
                safeHtml(line.q || '') + '</div>' +
            '<div class="ps-bank">' + bankHtml + '</div>' +
            '<div class="ps-bank-note">Tap the tokens in order (decoys are mixed in). Tap a placed token to take it back.</div>' +
            feedback +
            psStageActions(r, actions);
    }

    // ---- stages 3, 4, 5: typing ----
    function psTypeTargets(s, r) {
        if (r.stage === 3) return [r.lineIdx];
        if (r.stage === 4) return psLines(s).map(function (_, i) { return i; });
        return r.wrong.slice();
    }

    function psRenderTyper(s, r) {
        var targets = psTypeTargets(s, r);
        var allAtOnce = r.stage !== 3;
        var expected, i;

        // lines the learner has already produced are shown back as their own code
        // In the line-by-line stage the learner only sees the lines they have
        // already written themselves — never the line being asked for.
        var showCode = (!allAtOnce && r.lineIdx > 0) ? psCodeHtml(s, { upto: r.lineIdx - 1 }) : '';

        var inputs = '';
        if (allAtOnce) {
            inputs = '<div class="ps-prompts">' + targets.map(function (li, n) {
                var state = r.results[li];
                var cls = 'ps-input' + (state === false ? ' ps-bad' : (state === true ? ' ps-good' : ''));
                return '<div class="ps-prompt-row">' +
                    '<span class="ps-input-num">' + (n + 1) + '</span>' +
                    '<div class="ps-input-main">' +
                        '<span class="ps-input-q">' + safeHtml(psLines(s)[li].q || '') + '</span>' +
                        '<input type="text" class="' + cls + '" data-line="' + li + '" value="' +
                            esc(r.values[li] || '') + '" spellcheck="false" autocomplete="off" autocapitalize="off" ' +
                            'aria-label="' + esc(psLines(s)[li].q || '') + '">' +
                        (r.revealed[li] ? '<span class="ps-revealed">' + ICONS.bulb + ' answer shown</span>' : '') +
                    '</div>' +
                    (state === false ? '<span class="ps-mark bad">' + ICONS.cross + '</span>' : '') +
                    (state === true ? '<span class="ps-mark good">' + ICONS.check + '</span>' : '') +
                '</div>';
            }).join('') + '</div>';
        } else {
            var li = targets[0];
            var state = r.results[li];
            inputs = '<div class="ps-prompts">' +
                '<div class="ps-prompt-row">' +
                    '<span class="ps-input-num">' + (li + 1) + '</span>' +
                    '<div class="ps-input-main">' +
                        '<span class="ps-input-q">' + safeHtml(psLines(s)[li].q || '') + '</span>' +
                        '<input type="text" class="ps-input' + (state === false ? ' ps-bad' : (state === true ? ' ps-good' : '')) +
                            '" data-line="' + li + '" value="' + esc(r.values[li] || '') +
                            '" spellcheck="false" autocomplete="off" autocapitalize="off" ' +
                            'aria-label="' + esc(psLines(s)[li].q || '') + '">' +
                        (r.revealed[li] ? '<span class="ps-revealed">' + ICONS.bulb + ' answer shown</span>' : '') +
                    '</div>' +
                    (state === false ? '<span class="ps-mark bad">' + ICONS.cross + '</span>' : '') +
                    (state === true ? '<span class="ps-mark good">' + ICONS.check + '</span>' : '') +
                '</div>' +
                (r.hintShown ? '<div class="ps-hint">Hint: this line starts with <code>' +
                    esc(psTokenize(psLines(s)[li].code)[0]) + '</code> and has ' +
                    psTokenize(psLines(s)[li].code).length + ' tokens.</div>' : '') +
            '</div>';
        }

        var feedback = '';
        if (r.typeFeedback) feedback = r.typeFeedback;

        var actions = '<button type="button" class="study-btn primary" id="ps-check">' + ICONS.check +
            (allAtOnce ? ' Check all' : ' Check line') + '</button>';
        if (!allAtOnce || r.stage === 5) {
            actions += '<button type="button" class="study-btn" id="ps-hint">' + ICONS.bulb + ' Hint</button>';
        }
        if (allAtOnce) {
            actions += '<button type="button" class="study-btn" id="ps-peek">' + ICONS.book + ' Peek at the reference</button>';
        }
        var allRight = targets.length > 0 && targets.every(function (li2) { return r.results[li2] === true; });
        var anyWrong = targets.some(function (li2) { return r.results[li2] === false; });
        if (allRight) {
            actions += '<button type="button" class="study-btn primary" id="ps-finish">' + ICONS.check + ' Finish</button>';
        } else if (anyWrong) {
            actions += '<button type="button" class="study-btn primary" id="ps-finish">' + ICONS.retry +
                ' Practise the ' + targets.filter(function (li2) { return r.results[li2] === false; }).length +
                ' wrong line' + (targets.filter(function (li2) { return r.results[li2] === false; }).length === 1 ? '' : 's') +
                '</button>';
        }
        if (targets.some(function (li3) { return r.results[li3] === false; })) {
            actions += '<button type="button" class="study-btn" id="ps-show-line">' + ICONS.bulb + ' Show answers</button>';
        }

        var peek = r.peeking ? '<div class="ps-peek">' + ICONS.book + ' Reference (hidden again in a moment):' +
            psCodeHtml(s, {}) + '</div>' : '';

        var prompt = r.stage === 3
            ? 'Type line ' + (r.lineIdx + 1) + ' from the task — the syntax has to come from you.'
            : (r.stage === 4
                ? 'Write the whole snippet from memory. The task is all you get — no reference.'
                : 'Type these ' + r.wrong.length + ' line' + (r.wrong.length === 1 ? '' : 's') + ' again to finish.');

        return psStageBar(s, r) + psTaskHtml(s) +
            '<p class="ps-prompt">' + ICONS.pencil + ' ' + prompt + '</p>' +
            peek + showCode + inputs + feedback + psStageActions(r, actions);
    }

    // ---- done ----
    function psRenderDone(s, r) {
        return '<div class="ps-done">' +
            '<div class="qz-result-icon">' + ICONS.sparkle + '</div>' +
            '<h3>Written from memory</h3>' +
            '<p class="quiz-setup-hint">' + safeHtml(s.title || '') + ' — ' + psLines(s).length + ' lines, ' +
                r.attempts + ' check' + (r.attempts === 1 ? '' : 's') + ', ' +
                r.hints + ' hint' + (r.hints === 1 ? '' : 's') +
                (r.peeks ? ', reference peeked ' + r.peeks + 'x' : '') + '.</p>' +
            psCodeHtml(s, {}) +
            '<div class="quiz-actions">' +
                '<button type="button" class="study-btn primary" id="ps-again-all">' + ICONS.retry + ' Write it again</button>' +
                '<button type="button" class="study-btn" id="ps-next-snippet">Next snippet ' + ICONS.arrowRight + '</button>' +
            '</div></div>';
    }

    // ---- dispatch ----
    function psRenderStage() {
        var holder = document.getElementById('ps-stage');
        if (!holder || !ps.run) return;
        var s = allPseudo()[ps.idx];
        if (!s) return;
        var r = ps.run;

        if (r.done) {
            holder.innerHTML = psRenderDone(s, r);
            holder.onkeydown = null;
            var again = document.getElementById('ps-again-all');
            if (again) again.addEventListener('click', function () { ps.run = null; psRender(); });
            var nx = document.getElementById('ps-next-snippet');
            if (nx) nx.addEventListener('click', function () { ps.idx = (ps.idx + 1) % allPseudo().length; ps.run = null; psRender(); });
            return;
        }

        if (r.stage === 0 || r.stage === 1) holder.innerHTML = psRenderMcq(s, r);
        else if (r.stage === 2) holder.innerHTML = psRenderBank(s, r);
        else holder.innerHTML = psRenderTyper(s, r);

        psWire(s, r);
    }

    function psWire(s, r) {
        var holder = document.getElementById('ps-stage');
        if (!holder) return;
        var on = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

        // MCQ
        Array.prototype.forEach.call(holder.querySelectorAll('.ps-opt'), function (btn) {
            btn.addEventListener('click', function () { psAnswerMcq(s, r, btn.getAttribute('data-opt')); });
        });
        on('ps-next', function () { psNextQuestion(s, r); });

        // token bank
        Array.prototype.forEach.call(holder.querySelectorAll('.ps-bank-tok'), function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-bank'), 10);
                if (r.bank[i].used) return;
                r.bank[i].used = true;
                r.tray.push(r.bank[i].text);
                r.bankChecked = null;
                psRenderStage();
            });
        });
        Array.prototype.forEach.call(holder.querySelectorAll('.ps-tray-tok'), function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-tray'), 10);
                var txt = r.tray.splice(i, 1)[0];
                r.bank.forEach(function (tk) { if (tk.used && tk.text === txt) { tk.used = false; txt = null; } });
                r.bankChecked = null;
                psRenderStage();
            });
        });
        on('ps-clear', function () {
            r.bank.forEach(function (tk) { tk.used = false; });
            r.tray = [];
            r.bankChecked = null;
            psRenderStage();
        });
        on('ps-check-line', function () {
            var expected = psTokenize(psLines(s)[r.lineIdx].code);
            r.bankChecked = true;
            r.attempts++;
            if (psTokensEqual(expected, r.tray)) {
                r.typedLines[r.lineIdx] = psTokenize(psLines(s)[r.lineIdx].code);
                r.filled[r.lineIdx] = r.tray.reduce(function (acc, t, i) { acc[i] = t; return acc; }, {});
            }
            psRenderStage();
            if (psTokensEqual(expected, r.tray)) {
                setTimeout(function () { psNextBankLine(s, r); }, 450);
            }
        });
        on('ps-show-line', function () { psShowAnswer(s, r); });

        // typing
        on('ps-check', function () { psCheckTyping(s, r); });
        on('ps-hint', function () { r.hints++; r.hintShown = true; psRenderStage(); });
        on('ps-peek', function () {
            r.peeks++;
            r.peeking = true;
            psRenderStage();
            clearTimeout(r.peekTimer);
            r.peekTimer = setTimeout(function () { r.peeking = false; psRenderStage(); }, 6000);
        });
        on('ps-finish', function () {
            var bad = psTypeTargets(s, r).filter(function (li) { return r.results[li] !== true; });
            if (bad.length) { r.wrong = bad; r.stage = 5; psRenderStage(); }
            else { r.done = true; psRenderStage(); }
        });

        // shared
        on('ps-restart', function () { ps.run = null; psRender(); });
        on('ps-next-snippet', function () {
            ps.idx = (ps.idx + 1) % allPseudo().length;
            ps.run = null;
            psRender();
        });
        on('ps-skip', function () { psAdvanceStage(s, r); });

        holder.onkeydown = function (e) {
            if (e.key !== 'Enter') return;
            var t = e.target;
            if (!t.classList || !t.classList.contains('ps-input')) return;
            e.preventDefault();
            r.values[parseInt(t.getAttribute('data-line'), 10)] = t.value;
            psCheckTyping(s, r);
        };
    }

    // ---- interactions ----
    function psAnswerMcq(s, r, picked) {
        var allToks = psLines(s).map(function (ln) { return psTokenize(ln.code); });
        var current = r.stage === 0
            ? { line: psDrillLines(s)[r.lineIdx], token: (psLines(s)[psDrillLines(s)[r.lineIdx]].drill || [0])[0] }
            : psDrillQueue(s)[r.qIdx];
        var correct = allToks[current.line][current.token];
        r.picked = picked;
        r.lastOk = String(picked).toLowerCase() === String(correct).toLowerCase();
        if (r.lastOk) {
            r.filled[current.line] = r.filled[current.line] || {};
            r.filled[current.line][current.token] = correct;
        } else {
            r.filled[current.line] = r.filled[current.line] || {};
            r.filled[current.line][current.token] = correct;   // complete the snippet anyway
            r.revealed[current.line] = true;
        }
        r.attempts++;
        psRenderStage();
    }

    function psNextQuestion(s, r) {
        r.picked = null;
        r.optOrder = null;
        if (r.stage === 0) {
            if (r.lineIdx + 1 >= psDrillLines(s).length) { r.stage = 1; r.lineIdx = 0; r.qIdx = 0; r.filled = {}; }
            else r.lineIdx++;
        } else {
            if (r.qIdx + 1 >= psDrillQueue(s).length) { r.stage = 2; r.lineIdx = 0; r.bank = []; r.tray = []; }
            else r.qIdx++;
        }
        psRenderStage();
    }

    function psNextBankLine(s, r) {
        if (r.lineIdx + 1 >= psLines(s).length) {
            r.stage = 3;
            r.lineIdx = 0;
            r.values = {};
            r.results = {};
            r.typedLines = {};
            r.filled = {};
        } else {
            r.lineIdx++;
            r.bank = [];
            r.tray = [];
            r.bankChecked = null;
        }
        psRenderStage();
    }

    function psCheckTyping(s, r) {
        var holder = document.getElementById('ps-stage');
        if (!holder) return;
        var inputs = holder.querySelectorAll('.ps-input');
        Array.prototype.forEach.call(inputs, function (inp) {
            r.values[parseInt(inp.getAttribute('data-line'), 10)] = inp.value;
        });
        var targets = psTypeTargets(s, r);
        var feedbackParts = [];
        var allOk = true;
        r.attempts++;
        targets.forEach(function (li) {
            var expected = psTokenize(psLines(s)[li].code);
            var got = psTokenize(r.values[li] || '');
            var diff = psDiffHtml(expected, got);
            var ok = diff.ok;      // having peeked at an answer never counts as typing it
            r.results[li] = ok;
            if (ok) {
                r.typedLines[li] = expected;
                if (r.stage !== 3) {
                    feedbackParts.unshift('<div class="ps-feedback-line ok">' + ICONS.check + ' Line ' + (li + 1) +
                        ': <code>' + esc(expected.join(' ')) + '</code></div>');
                }
            } else {
                allOk = false;
                // a line whose answer was shown does not go back into the review queue
                if (!r.revealed[li] && r.wrong.indexOf(li) === -1) r.wrong.push(li);
                feedbackParts.push('<div class="ps-feedback-line bad">' + ICONS.cross + ' Line ' + (li + 1) + '</div>' + diff.html);
            }
        });
        r.typeFeedback = (allOk && r.stage === 3 ? '<div class="ps-feedback ok">' + ICONS.check + ' Line written correctly.</div>' : '') +
            feedbackParts.join('');
        if (allOk && r.stage === 3) {
            r.lineIdx++;
            r.hintShown = false;
            if (r.lineIdx >= psLines(s).length) {
                r.stage = 4;
                r.lineIdx = 0;
                r.values = {};
                r.results = {};
                r.typeFeedback = '';
            }
        }
        psRenderStage();
    }

    function psShowAnswer(s, r) {
        var targets = psTypeTargets(s, r);
        targets.forEach(function (li) {
            r.values[li] = psTokenize(psLines(s)[li].code).join(' ');
            r.revealed[li] = true;
            r.results[li] = true;
            r.typedLines[li] = psTokenize(psLines(s)[li].code);
        });
        if (r.stage === 2) {
            var expected = psTokenize(psLines(s)[r.lineIdx].code);
            r.tray = expected.slice();
            r.bank.forEach(function (tk) { tk.used = true; });
            r.typedLines[r.lineIdx] = expected;
        }
        r.typeFeedback = '<div class="ps-hint">' + esc('Answers shown — type it again from memory when you are ready.') + '</div>';
        psRenderStage();
    }

    function psAdvanceStage(s, r) {
        if (r.stage < psStageCount(r) - 1) {
            r.stage++;
            r.picked = null;
            r.optOrder = null;
            r.bankChecked = null;
            r.typeFeedback = '';
            r.hintShown = false;
            if (r.stage === 2) { r.lineIdx = 0; r.bank = []; r.tray = []; }
            if (r.stage >= 3) { r.lineIdx = 0; r.values = {}; r.results = {}; }
            if (r.stage === 4) { r.values = {}; r.results = {}; r.typeFeedback = ''; }
        }
        psRenderStage();
    }

    // ---- section ----
    function buildPseudoSection(main) {
        var sec = document.createElement('section');
        sec.id = 'study-pseudocode';

        var h1 = document.createElement('h1');
        h1.textContent = 'Pseudocode Builder';
        sec.appendChild(h1);

        var meta = document.createElement('div');
        meta.className = 'chapter-meta';
        var sub = document.createElement('p');
        sub.className = 'chapter-subtitle';
        sub.textContent = 'User defined data types. The task always tells you the names — you write the syntax. ' +
            'Pick the keywords, rebuild each line from tokens, then type it, and finally write the whole snippet from memory.';
        meta.appendChild(sub);
        sec.appendChild(meta);

        var root = document.createElement('div');
        root.id = 'ps-root';
        sec.appendChild(root);

        main.appendChild(sec);
    }

    function psRender() {
        var root = document.getElementById('ps-root');
        if (!root) return;
        var list = allPseudo();
        if (!list.length) {
            root.innerHTML = '<div class="quiz-setup"><p>No pseudocode snippets yet. Add them in the ' +
                'Admin Panel (Study Content &rarr; Pseudocode) to get started.</p></div>';
            return;
        }
        ps.idx = Math.max(0, Math.min(ps.idx, list.length - 1));
        var s = list[ps.idx];

        var chips = list.map(function (item, i) {
            return '<button type="button" class="filter-chip' + (i === ps.idx ? ' active' : '') +
                '" data-snippet="' + i + '">' + esc(item.title || ('Snippet ' + (i + 1))) +
                ' (' + psLines(item).length + ')</button>';
        }).join('');

        root.innerHTML =
            '<div class="filter-chips ps-snippets" id="ps-snippets">' + chips + '</div>' +
            (s.intro ? '<p class="quiz-setup-hint">' + safeHtml(s.intro) + '</p>' : '') +
            '<div class="flashcard ps-card">' +
                '<div class="flashcard-inner"><div class="ps-face" id="ps-stage"></div></div>' +
            '</div>';

        document.getElementById('ps-snippets').onclick = function (e) {
            var chip = e.target.closest ? e.target.closest('.filter-chip') : null;
            if (!chip) return;
            ps.idx = parseInt(chip.getAttribute('data-snippet'), 10);
            ps.run = null;
            psRender();
        };

        if (!ps.run || ps.run.snippetId !== s.id) psStartSnippet();
        psRenderStage();
    }

    // =================================================================
    // QUIZ  (engine ported from CSP1's Games: shuffled questions,
    // instant feedback + explanation, score badges, timer, progress
    // bar, results screen, retry — plus the 60s Speed Round)
    // =================================================================
    var qz = {
        filter: 'all',
        count: 10,
        mode: 'practice',     // 'practice' | 'speed'
        run: null,
        token: 0
    };

    function qzPool() {
        return allQuiz().filter(function (q) {
            return qz.filter === 'all' || q.chapter === qz.filter;
        });
    }

    function qzStopTimers() {
        qzClearAdvance();
        if (qz.run && qz.run.interval) {
            clearInterval(qz.run.interval);
            qz.run.interval = null;
        }
    }

    // Clear only the auto-advance timeout (keeps the stopwatch running)
    function qzClearAdvance() {
        if (qz.run && qz.run.advanceTimeout) {
            clearTimeout(qz.run.advanceTimeout);
            qz.run.advanceTimeout = null;
        }
    }

    function qzRenderSetup() {
        var root = document.getElementById('quiz-root');
        if (!root) return;
        qzStopTimers();
        qz.run = null;

        if (!allQuiz().length) {
            root.innerHTML = '<div class="quiz-setup"><p>No quiz questions yet. ' +
                'Add them in the Admin Panel (Study Content → Quiz Questions) to get started.</p></div>';
            return;
        }

        var pool = qzPool();
        var chips = ['all'].concat(chapters.map(function (c) { return c.id; })).map(function (id) {
            var n = allQuiz().filter(function (q) { return id === 'all' || q.chapter === id; }).length;
            var active = qz.filter === id ? ' active' : '';
            var dis = n === 0 ? ' disabled' : '';
            return '<button type="button" class="filter-chip' + active + '" data-filter="' + esc(id) + '"' + dis + '>' +
                (id === 'all' ? 'All' : esc(chapterTitle(id))) + ' (' + n + ')</button>';
        }).join('');

        root.innerHTML =
            '<div class="quiz-setup">' +
                '<div class="mode-toggle" id="qz-mode">' +
                    '<button type="button" data-mode="practice"' + (qz.mode === 'practice' ? ' class="active"' : '') + '>' + ICONS.pencil + ' Practice</button>' +
                    '<button type="button" data-mode="speed"' + (qz.mode === 'speed' ? ' class="active"' : '') + '>' + ICONS.bolt + ' Speed Round</button>' +
                '</div>' +
                '<p class="quiz-setup-hint">' +
                    (qz.mode === 'practice'
                        ? 'Answer at your own pace — every question explains the answer. Wrong answers come back at the end for another look.'
                        : '15 random questions from ALL chapters. 60 seconds. No explanations — GO!') +
                '</p>' +
                (qz.mode === 'practice'
                    ? '<div class="filter-chips" id="qz-filters">' + chips + '</div>' +
                      '<div class="quiz-count-row">' +
                          '<label for="qz-count">Questions per round</label>' +
                          '<select id="qz-count">' +
                              '<option value="5"' + (qz.count === 5 ? ' selected' : '') + '>5</option>' +
                              '<option value="10"' + (qz.count === 10 ? ' selected' : '') + '>10</option>' +
                              '<option value="all">All (' + pool.length + ')</option>' +
                          '</select>' +
                      '</div>'
                    : '') +
                '<div class="quiz-actions">' +
                    '<button type="button" class="study-btn primary" id="qz-start"' + (pool.length ? '' : ' disabled') + '>Start Quiz</button>' +
                '</div>' +
                (pool.length ? '' : '<p class="quiz-setup-hint">No questions match this filter — pick another chapter.</p>') +
            '</div>';

        var modeHolder = document.getElementById('qz-mode');
        if (modeHolder) {
            modeHolder.addEventListener('click', function (e) {
                var btn = e.target.closest ? e.target.closest('button') : null;
                if (!btn) return;
                qz.mode = btn.getAttribute('data-mode');
                qzRenderSetup();
            });
        }
        var filters = document.getElementById('qz-filters');
        if (filters) {
            filters.addEventListener('click', function (e) {
                var chip = e.target.closest ? e.target.closest('.filter-chip') : null;
                if (!chip) return;
                qz.filter = chip.getAttribute('data-filter');
                qzRenderSetup();
            });
        }
        var countSel = document.getElementById('qz-count');
        if (countSel) {
            countSel.addEventListener('change', function () {
                qz.count = countSel.value === 'all' ? Infinity : parseInt(countSel.value, 10);
            });
        }
        var start = document.getElementById('qz-start');
        if (start) start.addEventListener('click', qzStart);
    }

    function qzStart() {
        qzStopTimers();
        var pool = qz.mode === 'speed' ? shuffle(allQuiz()) : shuffle(qzPool());
        if (!pool.length) return qzRenderSetup();

        var n = qz.mode === 'speed' ? Math.min(15, pool.length) : Math.min(qz.count, pool.length);
        qz.run = {
            questions: pool.slice(0, n),
            idx: 0,
            score: 0,
            seconds: 0,
            timeLeft: qz.mode === 'speed' ? 60 : null,
            mode: qz.mode,
            answered: false,
            token: ++qz.token,
            interval: null,
            advanceTimeout: null,
            wrong: []      // question texts answered incorrectly (practice mode)
        };

        if (qz.mode === 'speed') {
            qz.run.interval = setInterval(function () {
                if (!qz.run || qz.run.token !== qz.token) return clearInterval(qz.run.interval);
                qz.run.timeLeft--;
                var el = document.getElementById('qz-timer');
                if (el) {
                    el.textContent = qz.run.timeLeft + 's';
                    if (qz.run.timeLeft <= 10) el.parentElement.classList.add('danger');
                }
                if (qz.run.timeLeft <= 0) {
                    qzStopTimers();
                    qz.run.idx = qz.run.questions.length;
                    qzRenderQuestion();
                }
            }, 1000);
        } else {
            qz.run.interval = setInterval(function () {
                if (!qz.run || qz.run.token !== qz.token) return clearInterval(qz.run.interval);
                qz.run.seconds++;
                var el = document.getElementById('qz-timer');
                if (el) el.textContent = qz.run.seconds + 's';
            }, 1000);
        }
        qzRenderQuestion();
    }

    function qzRenderQuestion() {
        var root = document.getElementById('quiz-root');
        if (!root || !qz.run) return;
        var r = qz.run;

        if (r.idx >= r.questions.length) return qzFinish();

        var q = r.questions[r.idx];
        var opts = (q.opts || []).map(function (o, i) {
            return '<div class="quiz-opt" data-i="' + i + '">' + safeHtml(o) + '</div>';
        }).join('');

        root.innerHTML =
            '<div class="score-bar">' +
                '<span class="score-badge green">' + ICONS.check + ' ' + r.score + '</span>' +
                '<span class="score-badge red">' + ICONS.cross + ' ' + (r.idx - r.score) + '</span>' +
                '<span class="score-badge blue">' + (r.idx + 1) + '/' + r.questions.length + '</span>' +
                '<span class="game-timer' + (r.mode === 'speed' && r.timeLeft <= 10 ? ' danger' : '') + '">' + ICONS.clock + ' <span id="qz-timer">' +
                    (r.mode === 'speed' ? r.timeLeft : r.seconds) + 's</span></span>' +
                '<button type="button" class="qz-quit" id="qz-quit" title="Quit this round">' + ICONS.cross + ' Quit</button>' +
            '</div>' +
            '<div class="progress-track"><div class="progress-fill" style="width:' + (r.idx / r.questions.length * 100) + '%"></div></div>' +
            '<p class="quiz-question">' + (r.idx + 1) + '. ' + safeHtml(q.q) + '</p>' +
            '<div class="quiz-options">' + opts + '</div>' +
            '<div id="qz-feedback"></div>';

        var quitBtn = document.getElementById('qz-quit');
        if (quitBtn) quitBtn.addEventListener('click', qzRenderSetup);

        root.querySelectorAll('.quiz-opt').forEach(function (el) {
            el.addEventListener('click', function () {
                if (r.answered) return;
                var picked = parseInt(el.getAttribute('data-i'), 10);
                var correct = picked === q.ans;
                r.answered = true;

                if (r.mode === 'speed') {
                    if (correct) r.score++;
                    r.idx++;
                    r.answered = false;
                    qzRenderQuestion();
                    return;
                }

                // Practice: lock options, highlight, explain
                root.querySelectorAll('.quiz-opt').forEach(function (o) {
                    o.classList.add('disabled');
                    if (parseInt(o.getAttribute('data-i'), 10) === q.ans) o.classList.add('correct');
                });
                if (correct) r.score++;
                else {
                    el.classList.add('wrong');
                    r.wrong.push(q);
                }

                var fb = document.getElementById('qz-feedback');
                if (fb) {
                    fb.innerHTML =
                        '<div class="explanation">' + ICONS.bulb + ' ' + (q.exp ? safeHtml(q.exp) : 'Correct answer: ' + safeHtml(q.opts[q.ans])) + '</div>' +
                        '<div class="quiz-actions"><button type="button" class="study-btn primary" id="qz-next">Next ' + ICONS.arrowRight + '</button></div>';
                    var nextBtn = document.getElementById('qz-next');
                    nextBtn.addEventListener('click', qzNext);
                }
                r.advanceTimeout = setTimeout(qzNext, 2600);
            });
        });
    }

    function qzNext() {
        if (!qz.run) return;
        qzClearAdvance();      // stop the auto-advance (stopwatch keeps running)
        qz.run.answered = false;
        qz.run.idx++;
        qzRenderQuestion();
    }

    function qzFinish() {
        qzStopTimers();
        var root = document.getElementById('quiz-root');
        if (!root || !qz.run) return;
        var r = qz.run;
        var total = r.questions.length;
        var pct = total ? Math.round(r.score / total * 100) : 0;
        var resultIcon = pct >= 80 ? ICONS.trophy : (pct >= 50 ? ICONS.thumbsUp : ICONS.book);
        var time = r.mode === 'speed' ? (60 - Math.max(r.timeLeft, 0)) + 's' : r.seconds + 's';

        var wrongList = '';
        if (r.mode === 'practice' && r.wrong.length) {
            wrongList = '<div class="qz-wrong"><div class="qz-wrong-title">Review these (' + r.wrong.length + '):</div>' +
                r.wrong.map(function (q) {
                    return '<div class="qz-wrong-item"><strong>' + safeHtml(q.q) + '</strong><br>' +
                        ICONS.check + ' ' + safeHtml(q.opts[q.ans]) +
                        (q.exp ? ' &mdash; <em>' + safeHtml(q.exp) + '</em>' : '') + '</div>';
                }).join('') + '</div>';
        }

        root.innerHTML =
            '<div class="quiz-setup qz-results">' +
                '<div class="qz-result-icon">' + resultIcon + '</div>' +
                '<h3>' + r.score + '/' + total + ' correct (' + pct + '%)</h3>' +
                '<p class="quiz-setup-hint">' + ICONS.clock + ' Time: ' + time +
                    (r.mode === 'speed' ? ' &middot; Speed Round' : '') + '</p>' +
                wrongList +
                '<div class="quiz-actions">' +
                    '<button type="button" class="study-btn primary" id="qz-retry">' + ICONS.retry + ' Retry</button>' +
                    '<button type="button" class="study-btn" id="qz-setup">Change settings</button>' +
                '</div>' +
            '</div>';

        document.getElementById('qz-retry').addEventListener('click', qzStart);
        document.getElementById('qz-setup').addEventListener('click', qzRenderSetup);
    }

    function buildQuizSection(main) {
        var sec = document.createElement('section');
        sec.id = 'study-quiz';

        var h1 = document.createElement('h1');
        h1.textContent = 'Quiz';
        sec.appendChild(h1);

        var meta = document.createElement('div');
        meta.className = 'chapter-meta';
        var sub = document.createElement('p');
        sub.className = 'chapter-subtitle';
        sub.textContent = 'Multiple choice with instant feedback, explanations and a timer — or race the clock in Speed Round.';
        meta.appendChild(sub);
        sec.appendChild(meta);

        var root = document.createElement('div');
        root.id = 'quiz-root';
        sec.appendChild(root);

        main.appendChild(sec);
    }

    // =================================================================
    // INIT
    // =================================================================
    function init(data) {
        db = data;
        chapters = Array.isArray(data.chapters) ? data.chapters : [];
        var main = document.getElementById('main');
        if (!main) return;

        buildFlashcardsSection(main);
        buildQuizSection(main);
        buildPseudoSection(main);

        fcBuildDeck();
        fcRenderFilters();
        fcRender();
        qzRenderSetup();
        psRender();
    }

    return { init: init, icons: ICONS };
})();
