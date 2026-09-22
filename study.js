/* A2CS Study — Flashcards (mechanics ported from codem_studyset) and
   Quiz engine (mechanics ported from CSP1's Games quiz/speed round).
   All content comes from db.json: `flashcards` and `quiz` arrays,
   both editable in the Admin Panel. */
window.Study = (function () {
    'use strict';

    var db = null;
    var chapters = [];

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
                              '<div class="fc-extra"><span class="fc-label">From</span>' + safeHtml(c.term) + '</div>',
                        chapter: c.chapter
                    });
                });
            });
        } else {
            list.forEach(function (c) {
                var back = '<div class="fc-def">' + safeHtml(c.definition || '') + '</div>';
                if (c.details) {
                    back += '<div class="fc-extra"><span class="fc-label">Details</span>' + safeHtml(c.details) + '</div>';
                }
                if (c.example) {
                    back += '<div class="fc-extra"><span class="fc-label">Example</span>' + safeHtml(c.example) + '</div>';
                }
                deck.push({ key: c.id, front: safeHtml(c.term), back: back, chapter: c.chapter });
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
        stats.textContent = 'Known: ' + knownCount + '/' + fc.deck.length +
                            ' | To Review: ' + fc.unknown.length +
                            (fc.completed ? ' — session complete! 🎉' : '');
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
                '<button type="button" class="btn-know" id="fc-know">✓ I know this</button>' +
                '<button type="button" class="btn-dont" id="fc-dont">✗ I don\u2019t know</button>' +
            '</div>' +
            '<div class="study-nav">' +
                '<button type="button" class="study-btn" id="fc-prev">← Previous</button>' +
                '<button type="button" class="study-btn" id="fc-next">Next →</button>' +
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
                    '<button type="button" data-mode="practice"' + (qz.mode === 'practice' ? ' class="active"' : '') + '>📝 Practice</button>' +
                    '<button type="button" data-mode="speed"' + (qz.mode === 'speed' ? ' class="active"' : '') + '>⚡ Speed Round</button>' +
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
                '<span class="score-badge green">✓ ' + r.score + '</span>' +
                '<span class="score-badge red">✗ ' + (r.idx - r.score) + '</span>' +
                '<span class="score-badge blue">' + (r.idx + 1) + '/' + r.questions.length + '</span>' +
                '<span class="game-timer' + (r.mode === 'speed' && r.timeLeft <= 10 ? ' danger' : '') + '">⏱ <span id="qz-timer">' +
                    (r.mode === 'speed' ? r.timeLeft : r.seconds) + 's</span></span>' +
                '<button type="button" class="qz-quit" id="qz-quit" title="Quit this round">✕ Quit</button>' +
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
                        '<div class="explanation">💡 ' + (q.exp ? safeHtml(q.exp) : 'Correct answer: ' + safeHtml(q.opts[q.ans])) + '</div>' +
                        '<div class="quiz-actions"><button type="button" class="study-btn primary" id="qz-next">Next →</button></div>';
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
        var emoji = pct >= 80 ? '🔥' : (pct >= 50 ? '👍' : '💪');
        var time = r.mode === 'speed' ? (60 - Math.max(r.timeLeft, 0)) + 's' : r.seconds + 's';

        var wrongList = '';
        if (r.mode === 'practice' && r.wrong.length) {
            wrongList = '<div class="qz-wrong"><div class="qz-wrong-title">Review these (' + r.wrong.length + '):</div>' +
                r.wrong.map(function (q) {
                    return '<div class="qz-wrong-item"><strong>' + safeHtml(q.q) + '</strong><br>' +
                        '✓ ' + safeHtml(q.opts[q.ans]) +
                        (q.exp ? ' — <em>' + safeHtml(q.exp) + '</em>' : '') + '</div>';
                }).join('') + '</div>';
        }

        root.innerHTML =
            '<div class="quiz-setup qz-results">' +
                '<div class="qz-emoji">' + emoji + '</div>' +
                '<h3>' + r.score + '/' + total + ' correct (' + pct + '%)</h3>' +
                '<p class="quiz-setup-hint">Time: ' + time +
                    (r.mode === 'speed' ? ' · Speed Round' : '') + '</p>' +
                wrongList +
                '<div class="quiz-actions">' +
                    '<button type="button" class="study-btn primary" id="qz-retry">🔄 Retry</button>' +
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

        fcBuildDeck();
        fcRenderFilters();
        fcRender();
        qzRenderSetup();
    }

    return { init: init };
})();
