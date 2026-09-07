// Neon Keep — Loophole Guardian game flow.
(function () {
  'use strict';

  var LEVELS = window.NK_LEVELS || [];
  var logic = window.NK.guardianLogic;
  var store = window.NK.store;
  var audio = window.NK.audio;
  var juice = window.NK.juice;

  var els = {
    gargoyle: document.getElementById('gargoyle'),
    snark: document.getElementById('snark'),
    budgetFill: document.getElementById('budget-fill'),
    budgetCount: document.getElementById('budget-count'),
    logList: document.getElementById('log-list'),
    letterInput: document.getElementById('letter-input'),
    btnLetter: document.getElementById('btn-letter'),
    btnRhyme: document.getElementById('btn-rhyme'),
    btnLength: document.getElementById('btn-length'),
    btnTaunt: document.getElementById('btn-taunt'),
    btnTheme: document.getElementById('btn-theme'),
    guessForm: document.getElementById('guess-form'),
    guessInput: document.getElementById('guess-input'),
    btnRetry: document.getElementById('btn-retry'),
    muteBtn: document.getElementById('nk-mute-toggle'),
  };

  var MOOD_EMOJI = {
    smug: '\u{1F60F}', // 😏
    nervous: '\u{1F62C}', // 😬
    desperate: '\u{1F631}', // 😱
    defeated: '\u{1F480}', // 💀
  };

  var state = {
    levelIndex: 0,
    budgetLeft: 0,
    askedLog: [],
    over: false,
  };

  function currentLevel() {
    return LEVELS[state.levelIndex];
  }

  function moodForRatio(ratio) {
    if (ratio <= 0) return 'defeated';
    if (ratio <= 0.34) return 'desperate';
    if (ratio <= 0.67) return 'nervous';
    return 'smug';
  }

  function updateMood() {
    var level = currentLevel();
    var ratio = level ? state.budgetLeft / level.budget : 0;
    var mood = moodForRatio(ratio);
    if (els.gargoyle) {
      els.gargoyle.dataset.mood = mood;
      els.gargoyle.textContent = MOOD_EMOJI[mood];
    }
  }

  function updateBudgetUI() {
    var level = currentLevel();
    var pct = level ? Math.max(0, Math.min(100, (state.budgetLeft / level.budget) * 100)) : 0;
    if (els.budgetFill) els.budgetFill.style.width = pct + '%';
    if (els.budgetCount) els.budgetCount.textContent = state.budgetLeft + ' / ' + (level ? level.budget : 0);
  }

  function setQuestionControlsEnabled(enabled) {
    [els.btnLetter, els.btnRhyme, els.btnLength, els.btnTaunt, els.btnTheme, els.letterInput].forEach(function (el) {
      if (el) el.disabled = !enabled;
    });
  }

  function setGuessControlsEnabled(enabled) {
    if (els.guessInput) els.guessInput.disabled = !enabled;
    var submitBtn = els.guessForm ? els.guessForm.querySelector('button[type="submit"]') : null;
    if (submitBtn) submitBtn.disabled = !enabled;
  }

  function setControlsEnabled(enabled) {
    setQuestionControlsEnabled(enabled);
    setGuessControlsEnabled(enabled);
  }

  function say(text) {
    if (juice && typeof juice.typewriter === 'function' && els.snark) {
      juice.typewriter(els.snark, text, 20);
    } else if (els.snark) {
      els.snark.textContent = text;
    }
  }

  function logEntry(text) {
    state.askedLog.push(text);
    if (els.logList) {
      var li = document.createElement('li');
      li.textContent = text;
      els.logList.appendChild(li);
      els.logList.scrollTop = els.logList.scrollHeight;
    }
  }

  function loadLevel(index) {
    state.levelIndex = index;
    var level = currentLevel();
    state.budgetLeft = level ? level.budget : 0;
    state.askedLog = [];
    state.over = false;
    if (els.logList) els.logList.textContent = '';
    if (els.btnRetry) els.btnRetry.hidden = true;
    if (els.gargoyle) els.gargoyle.classList.remove('is-open');
    setControlsEnabled(true);
    updateBudgetUI();
    updateMood();
    say(level ? 'A ' + level.theme + ' word guards the vault. Ask wisely.' : 'The Keep is quiet.');
  }

  function askQuestion(answerText) {
    if (state.over || state.budgetLeft <= 0) return;
    if (audio && typeof audio.init === 'function') audio.init();
    state.budgetLeft -= 1;
    logEntry(answerText);
    updateBudgetUI();
    updateMood();
    if (audio && typeof audio.play === 'function') audio.play('click');
    var message = answerText;
    if (state.budgetLeft <= 0) {
      setQuestionControlsEnabled(false);
      message += ' No questions left — submit your guess!';
    }
    say(message);
  }

  function onAskLetter() {
    if (state.over) return;
    var raw = els.letterInput ? els.letterInput.value : '';
    var letter = String(raw).trim().charAt(0);
    if (!letter) return;
    var level = currentLevel();
    var has = logic.containsLetter(level.word, letter);
    askQuestion(has ? 'Yes, "' + letter.toUpperCase() + '" lurks in the word.' : 'No "' + letter.toUpperCase() + '" here.');
    if (els.letterInput) els.letterInput.value = '';
  }

  function onAskRhyme() {
    var level = currentLevel();
    askQuestion('It rhymes with: ' + logic.rhymeHint(level.word));
  }

  function onAskLength() {
    var level = currentLevel();
    askQuestion('The word has ' + logic.length(level.word) + ' letters.');
  }

  function onAskTaunt() {
    var level = currentLevel();
    askQuestion(level.taunt);
  }

  function onAskTheme() {
    var level = currentLevel();
    askQuestion('Theme: ' + level.theme);
  }

  function winLevel() {
    var level = currentLevel();
    var questionsUsed = state.askedLog.length;
    state.over = true;
    setControlsEnabled(false);
    if (audio && typeof audio.play === 'function') audio.play('win');
    if (juice && typeof juice.flash === 'function') juice.flash('#00f0ff');
    if (els.gargoyle) els.gargoyle.classList.add('is-open');

    var cleared = store ? store.get('guardian.levelsCleared', 0) : 0;
    if (store) store.set('guardian.levelsCleared', cleared + 1);
    var best = store ? store.get('guardian.bestQuestions', null) : null;
    if (store && (best === null || questionsUsed < best)) {
      store.set('guardian.bestQuestions', questionsUsed);
    }

    var nextIndex = state.levelIndex + 1;
    if (nextIndex < LEVELS.length) {
      say('The vault clicks open. "' + level.word.toUpperCase() + '" was the word. Onward...');
      if (juice && typeof juice.hitStop === 'function') {
        juice.hitStop(1000).then(function () { loadLevel(nextIndex); });
      } else {
        loadLevel(nextIndex);
      }
    } else {
      say('The vault clicks open. "' + level.word.toUpperCase() + '" was the last word. You have escaped the Keep!');
    }
  }

  function loseLevel() {
    state.over = true;
    setControlsEnabled(false);
    if (audio && typeof audio.play === 'function') audio.play('lose');
    if (juice && typeof juice.shake === 'function') juice.shake(document.body);
    var level = currentLevel();
    say('Budget spent. The guardian keeps its secret: "' + level.word.toUpperCase() + '".');
    if (els.btnRetry) els.btnRetry.hidden = false;
  }

  function onSubmitGuess(evt) {
    evt.preventDefault();
    if (state.over) return;
    if (audio && typeof audio.init === 'function') audio.init();
    var level = currentLevel();
    var value = els.guessInput ? els.guessInput.value : '';
    state.budgetLeft = Math.max(0, state.budgetLeft - 1);
    updateBudgetUI();
    updateMood();
    if (logic.checkGuess(value, level.word)) {
      winLevel();
    } else if (state.budgetLeft <= 0) {
      loseLevel();
    } else {
      say('Wrong. The guardian sneers.');
    }
    if (els.guessInput) els.guessInput.value = '';
  }

  function onRetry() {
    loadLevel(state.levelIndex);
  }

  if (els.btnLetter) els.btnLetter.addEventListener('click', onAskLetter);
  if (els.btnRhyme) els.btnRhyme.addEventListener('click', onAskRhyme);
  if (els.btnLength) els.btnLength.addEventListener('click', onAskLength);
  if (els.btnTaunt) els.btnTaunt.addEventListener('click', onAskTaunt);
  if (els.btnTheme) els.btnTheme.addEventListener('click', onAskTheme);
  if (els.guessForm) els.guessForm.addEventListener('submit', onSubmitGuess);
  if (els.btnRetry) els.btnRetry.addEventListener('click', onRetry);

  // NK.audio.bindMuteButton renders the label from the persisted isMuted()
  // state and calls setMuted() on click; see shared/audio.js.
  if (audio && typeof audio.bindMuteButton === 'function') audio.bindMuteButton(els.muteBtn);

  if (audio && typeof audio.init === 'function') {
    document.addEventListener('click', function initAudioOnce() {
      audio.init();
      document.removeEventListener('click', initAudioOnce);
    }, { once: true });
  }

  loadLevel(0);
})();
