/* ============================================
   MasterMind – Micro-Learning Rendering Engine
   ============================================
   Diese Datei ist das "Gehirn" der App.
   Sie lädt Lerninhalte aus einer JSON-Datei und
   zeigt sie dynamisch an. Sie weiß NICHTS über
   den konkreten Inhalt (NLP, Mathe, etc.) –
   sie versteht nur das JSON-Schema.
   ============================================ */

(function () {
  'use strict';

  // ===========================================
  // 1. ZUSTAND (State) – Das Gedächtnis der App
  // ===========================================
  // Hier speichert die App alles, was sie sich
  // "merken" muss: Wo bist du gerade? Was hast
  // du schon geantwortet?

  const AppState = {
    moduleData: null,       // Die geladenen JSON-Daten
    screens: [],            // Alle Screens als flache Liste
    unitMap: [],            // Welcher Screen gehört zu welcher Unit?
    currentIndex: 0,        // Aktueller Screen (Position)
    answers: {},            // Gespeicherte Antworten: { "screenId": { "questionId": ["wert"] } }
    submitted: {}           // Welche Quizze wurden schon ausgewertet?
  };

  // Referenzen auf die HTML-Elemente (damit wir sie nicht
  // jedes Mal neu suchen müssen)
  const DOM = {
    content: document.getElementById('screen-content'),
    progressFill: document.getElementById('progress-fill'),
    btnBack: document.getElementById('btn-back'),
    btnNext: document.getElementById('btn-next'),
    counter: document.getElementById('screen-counter')
  };

  // ===========================================
  // 2. INITIALISIERUNG – App starten
  // ===========================================

  async function init() {
    try {
      // JSON-Datei laden (der gesamte Lerninhalt)
      const response = await fetch('data/module1.json');
      if (!response.ok) throw new Error('Modul konnte nicht geladen werden.');
      AppState.moduleData = await response.json();

      // Alle Screens aus allen Units in eine flache Liste packen.
      // Das macht die Navigation einfacher: Screen 0, 1, 2, 3, ...
      flattenScreens();

      // Ersten Screen anzeigen
      renderScreen(0);
    } catch (error) {
      DOM.content.innerHTML =
        '<div class="card"><h2>Fehler beim Laden</h2>' +
        '<p>' + error.message + '</p></div>';
    }
  }

  // Nimmt die verschachtelte Struktur (Module > Units > Screens)
  // und macht daraus eine einfache, nummerierte Liste.
  // Fügt zwischen den Units automatisch einen Übergangs-Screen ein,
  // damit sich jede Unit wie ein abgeschlossener Teil anfühlt.
  function flattenScreens() {
    AppState.screens = [];
    AppState.unitMap = [];

    const units = AppState.moduleData.units || [];
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const screens = unit.screens || [];
      for (let j = 0; j < screens.length; j++) {
        AppState.screens.push(screens[j]);
        AppState.unitMap.push({
          unitTitle: unit.unitTitle || '',
          unitId: unit.unitId || '',
          screenInUnit: j + 1,
          totalInUnit: screens.length
        });
      }

      // Nach jeder Unit (außer der letzten) einen Übergangs-Screen einfügen
      var isLastUnit = (i === units.length - 1);
      var nextUnit = !isLastUnit ? units[i + 1] : null;

      AppState.screens.push({
        id: 'unit-summary-' + unit.unitId,
        type: 'unit_summary',
        unitTitle: unit.unitTitle || '',
        unitId: unit.unitId || '',
        isLastUnit: isLastUnit,
        nextUnitTitle: nextUnit ? (nextUnit.unitTitle || '') : '',
        // Zähle Quiz-Screens in dieser Unit für die Zusammenfassung
        quizCount: screens.filter(function (s) { return s.type === 'quiz'; }).length,
        quizScreens: screens.filter(function (s) { return s.type === 'quiz'; }),
        screenCount: screens.length
      });
      AppState.unitMap.push({
        unitTitle: unit.unitTitle || '',
        unitId: unit.unitId || '',
        screenInUnit: screens.length + 1,
        totalInUnit: screens.length + 1,
        isSummary: true
      });
    }
  }

  // ===========================================
  // 3. RENDERING – Screens anzeigen
  // ===========================================

  function renderScreen(index) {
    // Sicherheitscheck: Index darf nicht außerhalb liegen
    if (index < 0 || index >= AppState.screens.length) return;

    AppState.currentIndex = index;
    const screen = AppState.screens[index];
    const unitInfo = AppState.unitMap[index];

    // Bevor wir den neuen Screen zeigen, alten Inhalt leeren
    DOM.content.innerHTML = '';

    // Animation neu starten (kurz entfernen, dann wieder setzen)
    DOM.content.style.animation = 'none';
    // Dieser "Trick" zwingt den Browser, die Animation neu zu starten
    void DOM.content.offsetHeight;
    DOM.content.style.animation = '';

    // Unit-Titel über dem Screen anzeigen (z.B. "Micro-Unit 1.1")
    if (unitInfo && unitInfo.unitTitle) {
      var unitLabel = document.createElement('div');
      unitLabel.className = 'unit-title';
      unitLabel.textContent = unitInfo.unitTitle;
      DOM.content.appendChild(unitLabel);
    }

    // Je nach Typ den passenden Renderer aufrufen
    switch (screen.type) {
      case 'info':
        renderInfoScreen(screen);
        break;
      case 'quiz':
        renderQuizScreen(screen);
        break;
      case 'unit_summary':
        renderUnitSummary(screen);
        break;
      default:
        // Unbekannter Typ? Nicht abstürzen, sondern Hinweis zeigen
        var fallback = document.createElement('div');
        fallback.className = 'card';
        fallback.innerHTML = '<p>Unbekannter Screen-Typ: ' + (screen.type || 'keiner') + '</p>';
        DOM.content.appendChild(fallback);
    }

    // Fortschrittsbalken, Zähler und Buttons aktualisieren
    updateProgress();
    updateNavButtons();

    // Nach oben scrollen
    window.scrollTo(0, 0);
  }

  // --- Info-Screen: Nur Text und optional ein Bild ---
  function renderInfoScreen(screen) {
    var card = document.createElement('div');
    card.className = 'card';

    // Titel (falls vorhanden)
    if (screen.title) {
      var h2 = document.createElement('h2');
      h2.textContent = screen.title;
      card.appendChild(h2);
    }

    // Textinhalt (als HTML, damit Formatierung möglich ist)
    if (screen.content) {
      var contentDiv = document.createElement('div');
      contentDiv.innerHTML = screen.content;
      card.appendChild(contentDiv);
    }

    // Bild (falls im JSON definiert)
    if (screen.image && screen.image.src) {
      var img = document.createElement('img');
      img.src = screen.image.src;
      img.alt = screen.image.alt || '';
      img.style.maxWidth = '100%';
      img.style.borderRadius = 'var(--radius)';
      img.style.marginTop = '16px';
      // Wenn das Bild nicht geladen werden kann: leise verstecken
      img.onerror = function () { img.style.display = 'none'; };
      card.appendChild(img);
    }

    DOM.content.appendChild(card);
  }

  // --- Unit-Übergangs-Screen: Abschluss einer Lerneinheit ---
  function renderUnitSummary(screen) {
    // Unit-Titel oben entfernen (der Summary-Screen hat sein eigenes Layout)
    var existingLabel = DOM.content.querySelector('.unit-title');
    if (existingLabel) existingLabel.remove();

    var wrapper = document.createElement('div');
    wrapper.className = 'unit-summary-screen';

    // Abschluss-Häkchen
    var checkmark = document.createElement('div');
    checkmark.className = 'unit-summary-checkmark';
    checkmark.innerHTML = '&#10003;';
    wrapper.appendChild(checkmark);

    // Titel
    var h2 = document.createElement('h2');
    h2.textContent = 'Lerneinheit abgeschlossen!';
    wrapper.appendChild(h2);

    // Welche Unit wurde abgeschlossen
    var unitName = document.createElement('p');
    unitName.className = 'unit-summary-name';
    unitName.textContent = screen.unitTitle;
    wrapper.appendChild(unitName);

    // Quiz-Performance berechnen: Wie viele Fragen richtig beantwortet?
    var totalQuestions = 0;
    var correctQuestions = 0;
    var quizScreens = screen.quizScreens || [];
    for (var qs = 0; qs < quizScreens.length; qs++) {
      var quizScreen = quizScreens[qs];
      var questions = quizScreen.questions || [];
      var savedAnswers = AppState.answers[quizScreen.id] || {};
      for (var qq = 0; qq < questions.length; qq++) {
        totalQuestions++;
        var userAnswer = savedAnswers[questions[qq].questionId] || [];
        if (checkAnswer(questions[qq], userAnswer)) {
          correctQuestions++;
        }
      }
    }

    // Statistik
    var stats = document.createElement('div');
    stats.className = 'unit-summary-stats';

    var quizResultClass = '';
    if (totalQuestions > 0) {
      quizResultClass = (correctQuestions === totalQuestions) ? ' stat-perfect' : (correctQuestions >= totalQuestions / 2) ? '' : ' stat-weak';
    }

    stats.innerHTML =
      '<div class="stat-item"><span class="stat-value">' + screen.screenCount + '</span><span class="stat-label">Abschnitte</span></div>' +
      '<div class="stat-item' + quizResultClass + '"><span class="stat-value">' + correctQuestions + ' / ' + totalQuestions + '</span><span class="stat-label">Quizfragen richtig</span></div>';
    wrapper.appendChild(stats);

    // Trennlinie
    var divider = document.createElement('div');
    divider.className = 'unit-summary-divider';
    wrapper.appendChild(divider);

    // Was kommt als Nächstes?
    if (!screen.isLastUnit && screen.nextUnitTitle) {
      var nextHint = document.createElement('div');
      nextHint.className = 'unit-summary-next';
      nextHint.innerHTML =
        '<span class="next-label">Weiter geht\u2019s mit:</span>' +
        '<span class="next-title">' + screen.nextUnitTitle + '</span>';
      wrapper.appendChild(nextHint);
    } else {
      var finalHint = document.createElement('div');
      finalHint.className = 'unit-summary-next';
      finalHint.innerHTML =
        '<span class="next-label">Das war die letzte Einheit dieses Moduls.</span>' +
        '<span class="next-title">Klicke auf \u201eAbschlie\u00dfen\u201c, um das Modul zu beenden!</span>';
      wrapper.appendChild(finalHint);
    }

    DOM.content.appendChild(wrapper);
  }

  // --- Quiz-Screen: Fragen mit verschiedenen Typen ---
  function renderQuizScreen(screen) {
    var card = document.createElement('div');
    card.className = 'card';

    if (screen.title) {
      var h2 = document.createElement('h2');
      h2.textContent = screen.title;
      card.appendChild(h2);
    }

    // Einleitungstext (falls vorhanden)
    if (screen.content) {
      var intro = document.createElement('div');
      intro.className = 'quiz-intro';
      intro.innerHTML = screen.content;
      intro.style.marginBottom = '20px';
      card.appendChild(intro);
    }

    var questions = screen.questions || [];
    var isSubmitted = AppState.submitted[screen.id] === true;
    var savedAnswers = AppState.answers[screen.id] || {};

    for (var qi = 0; qi < questions.length; qi++) {
      var q = questions[qi];
      var block = document.createElement('div');
      block.className = 'question-block';
      block.setAttribute('data-question-id', q.questionId);

      // Fragetext
      if (q.questionText) {
        var qText = document.createElement('p');
        qText.className = 'question-text';
        qText.textContent = q.questionText;
        block.appendChild(qText);
      }

      var savedAnswer = savedAnswers[q.questionId] || [];

      // Je nach Fragetyp das richtige Eingabe-Element rendern
      switch (q.questionType) {
        case 'single_choice':
          renderChoiceOptions(block, q, 'radio', savedAnswer, isSubmitted);
          break;
        case 'multiple_choice':
          renderChoiceOptions(block, q, 'checkbox', savedAnswer, isSubmitted);
          break;
        case 'free_text':
          renderFreeText(block, q, savedAnswer, isSubmitted);
          break;
        default:
          var unknown = document.createElement('p');
          unknown.textContent = 'Unbekannter Fragetyp.';
          unknown.style.color = 'var(--text-muted)';
          block.appendChild(unknown);
      }

      // Wenn schon ausgewertet: Ergebnis anzeigen
      if (isSubmitted) {
        showQuestionResult(block, q, savedAnswer);
      }

      card.appendChild(block);
    }

    // Auswertungs-Button (nur wenn noch nicht ausgewertet)
    if (!isSubmitted && questions.length > 0) {
      var submitBtn = document.createElement('button');
      submitBtn.className = 'btn-submit';
      submitBtn.textContent = 'Antworten prüfen';
      submitBtn.setAttribute('data-action', 'submit-quiz');
      card.appendChild(submitBtn);
    }

    // Ergebnis-Banner (falls schon ausgewertet)
    if (isSubmitted && questions.length > 0) {
      var banner = createResultBanner(screen);
      // Banner vor der Card einfügen
      DOM.content.appendChild(banner);
    }

    DOM.content.appendChild(card);
  }

  // Rendert Radio-Buttons oder Checkboxen für Choice-Fragen
  function renderChoiceOptions(block, question, inputType, savedAnswer, isSubmitted) {
    var options = question.options || [];

    for (var i = 0; i < options.length; i++) {
      var opt = options[i];

      var label = document.createElement('label');
      label.className = 'option-label';
      if (savedAnswer.indexOf(opt.id) !== -1) {
        label.classList.add('selected');
      }

      var input = document.createElement('input');
      input.type = inputType;
      input.name = question.questionId;
      input.value = opt.id;

      // Gespeicherte Antwort wiederherstellen
      if (savedAnswer.indexOf(opt.id) !== -1) {
        input.checked = true;
      }

      // Nach Auswertung: Inputs deaktivieren
      if (isSubmitted) {
        input.disabled = true;
      }

      var indicator = document.createElement('span');
      indicator.className = 'option-indicator';

      var text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = opt.text;

      label.appendChild(input);
      label.appendChild(indicator);
      label.appendChild(text);

      // Richtige Antwort markieren (nach Auswertung)
      if (isSubmitted && question.correctMatch) {
        if (question.correctMatch.indexOf(opt.id) !== -1) {
          label.classList.add('correct-answer');
        }
      }

      block.appendChild(label);
    }
  }

  // Rendert ein Freitext-Eingabefeld
  function renderFreeText(block, question, savedAnswer, isSubmitted) {
    var textarea = document.createElement('textarea');
    textarea.className = 'free-text-input';
    textarea.name = question.questionId;
    textarea.placeholder = 'Deine Antwort eingeben...';
    textarea.rows = 3;

    // Gespeicherte Antwort wiederherstellen
    if (savedAnswer.length > 0) {
      textarea.value = savedAnswer[0];
    }

    if (isSubmitted) {
      textarea.disabled = true;
    }

    block.appendChild(textarea);
  }

  // ===========================================
  // 4. ANTWORTEN SAMMELN UND AUSWERTEN
  // ===========================================

  // Liest alle Eingaben des aktuellen Quiz-Screens aus
  // und speichert sie im AppState
  function collectAnswers() {
    var screen = AppState.screens[AppState.currentIndex];
    if (screen.type !== 'quiz') return;

    var questions = screen.questions || [];
    if (questions.length === 0) return;

    var screenAnswers = {};

    for (var qi = 0; qi < questions.length; qi++) {
      var q = questions[qi];

      switch (q.questionType) {
        case 'single_choice':
        case 'multiple_choice':
          // Alle ausgewählten Optionen finden
          var checked = DOM.content.querySelectorAll(
            'input[name="' + q.questionId + '"]:checked'
          );
          var values = [];
          for (var ci = 0; ci < checked.length; ci++) {
            values.push(checked[ci].value);
          }
          screenAnswers[q.questionId] = values;
          break;

        case 'free_text':
          var textarea = DOM.content.querySelector(
            'textarea[name="' + q.questionId + '"]'
          );
          if (textarea) {
            screenAnswers[q.questionId] = [textarea.value];
          }
          break;
      }
    }

    AppState.answers[screen.id] = screenAnswers;
  }

  // Wertet das Quiz aus: Vergleicht Antworten mit correctMatch
  function evaluateQuiz() {
    var screen = AppState.screens[AppState.currentIndex];
    if (screen.type !== 'quiz') return;

    // Erst alle Antworten einsammeln
    collectAnswers();

    var questions = screen.questions || [];
    var savedAnswers = AppState.answers[screen.id] || {};

    // Jede Frage einzeln auswerten
    var blocks = DOM.content.querySelectorAll('.question-block');

    for (var qi = 0; qi < questions.length; qi++) {
      var q = questions[qi];
      var block = blocks[qi];
      if (!block) continue;

      var userAnswer = savedAnswers[q.questionId] || [];
      var isCorrect = checkAnswer(q, userAnswer);

      // CSS-Klasse setzen (grüner oder roter Rahmen)
      block.classList.add(isCorrect ? 'correct' : 'incorrect');

      // Erklärung einblenden
      showQuestionResult(block, q, userAnswer);

      // Inputs deaktivieren
      var inputs = block.querySelectorAll('input, textarea');
      for (var ii = 0; ii < inputs.length; ii++) {
        inputs[ii].disabled = true;
      }

      // Richtige Antworten markieren
      if (q.correctMatch && q.options) {
        var labels = block.querySelectorAll('.option-label');
        for (var li = 0; li < labels.length; li++) {
          var input = labels[li].querySelector('input');
          if (input && q.correctMatch.indexOf(input.value) !== -1) {
            labels[li].classList.add('correct-answer');
          }
        }
      }
    }

    // Als ausgewertet markieren
    AppState.submitted[screen.id] = true;

    // Submit-Button entfernen
    var submitBtn = DOM.content.querySelector('[data-action="submit-quiz"]');
    if (submitBtn) submitBtn.remove();

    // Ergebnis-Banner einfügen
    var banner = createResultBanner(screen);
    DOM.content.insertBefore(banner, DOM.content.querySelector('.card'));

    // "Weiter"-Button aktivieren
    updateNavButtons();
  }

  // Prüft ob eine einzelne Antwort korrekt ist
  function checkAnswer(question, userAnswer) {
    // Freitext: Nur prüfen, ob etwas eingegeben wurde
    if (question.correctMatch === null || question.correctMatch === undefined) {
      return userAnswer.length > 0 && userAnswer[0].trim().length > 0;
    }

    // Choice: Exakter Abgleich der ausgewählten IDs
    var correct = question.correctMatch.slice().sort();
    var user = userAnswer.slice().sort();

    if (correct.length !== user.length) return false;
    for (var i = 0; i < correct.length; i++) {
      if (correct[i] !== user[i]) return false;
    }
    return true;
  }

  // Zeigt die Erklärung unter einer Frage an
  function showQuestionResult(block, question, userAnswer) {
    // Nur einmal anzeigen
    if (block.querySelector('.explanation')) return;

    var isCorrect = checkAnswer(question, userAnswer);
    block.classList.add(isCorrect ? 'correct' : 'incorrect');

    if (question.explanation) {
      var expl = document.createElement('div');
      expl.className = 'explanation';
      expl.innerHTML = (isCorrect ? '&#10003; ' : '&#10007; ') + question.explanation;
      block.appendChild(expl);
    }
  }

  // Erstellt ein Banner, das das Gesamtergebnis eines Quizzes zeigt
  function createResultBanner(screen) {
    var questions = screen.questions || [];
    var savedAnswers = AppState.answers[screen.id] || {};
    var correctCount = 0;

    for (var qi = 0; qi < questions.length; qi++) {
      var userAnswer = savedAnswers[questions[qi].questionId] || [];
      if (checkAnswer(questions[qi], userAnswer)) correctCount++;
    }

    var banner = document.createElement('div');
    banner.className = 'result-banner';

    if (correctCount === questions.length) {
      banner.classList.add('all-correct');
      banner.textContent = 'Perfekt! Alle ' + correctCount + ' Frage(n) richtig!';
    } else {
      banner.classList.add('has-errors');
      banner.textContent = correctCount + ' von ' + questions.length + ' richtig. Schau dir die Erklärungen an!';
    }

    return banner;
  }

  // ===========================================
  // 5. NAVIGATION – Vor und Zurück
  // ===========================================

  function goBack() {
    // Antworten des aktuellen Screens sichern (ohne auszuwerten)
    collectAnswers();
    renderScreen(AppState.currentIndex - 1);
  }

  function goNext() {
    var screen = AppState.screens[AppState.currentIndex];

    // Bei Quiz-Screens: Erst auswerten lassen, bevor weiternavigiert wird
    if (screen.type === 'quiz' && !AppState.submitted[screen.id]) {
      // Noch nicht ausgewertet → Nutzer muss erst "Antworten prüfen" klicken
      return;
    }

    // Antworten sichern
    collectAnswers();

    // Letzter Screen? Abschluss zeigen
    if (AppState.currentIndex >= AppState.screens.length - 1) {
      showCompletionScreen();
      return;
    }

    renderScreen(AppState.currentIndex + 1);
  }

  function showCompletionScreen() {
    DOM.content.innerHTML = '';
    DOM.content.style.animation = 'none';
    void DOM.content.offsetHeight;
    DOM.content.style.animation = '';

    var card = document.createElement('div');
    card.className = 'card completion-screen';
    card.innerHTML =
      '<h2>Modul abgeschlossen!</h2>' +
      '<p>Du hast alle Lerneinheiten dieses Moduls durchgearbeitet.</p>' +
      '<p style="margin-top: 16px; color: var(--accent);">' +
      (AppState.moduleData.title || 'Dieses Modul') +
      ' ist geschafft!</p>';
    DOM.content.appendChild(card);

    // Progress auf 100%
    DOM.progressFill.style.width = '100%';
    DOM.counter.textContent = '';
    DOM.btnNext.disabled = true;
    DOM.btnBack.disabled = false;
  }

  // ===========================================
  // 6. UI-UPDATES – Fortschritt und Buttons
  // ===========================================

  function updateProgress() {
    var total = AppState.screens.length;
    var current = AppState.currentIndex + 1;
    var percent = (current / total) * 100;

    DOM.progressFill.style.width = percent + '%';

    // Zeige Unit-Kontext im Zähler (z.B. "Unit 1.2 · 3/6")
    var unitInfo = AppState.unitMap[AppState.currentIndex];
    if (unitInfo && unitInfo.unitId && !unitInfo.isSummary) {
      DOM.counter.textContent = 'Unit ' + unitInfo.unitId + ' \u00b7 ' + unitInfo.screenInUnit + '/' + unitInfo.totalInUnit;
    } else if (unitInfo && unitInfo.isSummary) {
      DOM.counter.textContent = 'Unit ' + unitInfo.unitId + ' \u2013 Abschluss';
    } else {
      DOM.counter.textContent = current + ' / ' + total;
    }
  }

  function updateNavButtons() {
    var screen = AppState.screens[AppState.currentIndex];

    // Zurück-Button: Nur auf Screen 0 deaktiviert
    DOM.btnBack.disabled = (AppState.currentIndex === 0);

    // Weiter-Button: Bei Quiz-Screens erst nach Auswertung klickbar
    if (screen.type === 'quiz' && !AppState.submitted[screen.id]) {
      DOM.btnNext.disabled = true;
    } else {
      DOM.btnNext.disabled = false;
    }

    // Text des Weiter-Buttons anpassen
    if (AppState.currentIndex >= AppState.screens.length - 1) {
      DOM.btnNext.textContent = 'Abschließen';
    } else if (screen.type === 'unit_summary' && !screen.isLastUnit) {
      DOM.btnNext.textContent = 'Nächste Einheit starten';
    } else {
      DOM.btnNext.textContent = 'Weiter';
    }
  }

  // ===========================================
  // 7. EVENT-HANDLING – Klicks verarbeiten
  // ===========================================
  // "Event Delegation": Wir lauschen auf Klicks im
  // gesamten Inhaltsbereich, statt an jeden einzelnen
  // Button einen Listener zu hängen. Das ist effizienter.

  DOM.content.addEventListener('click', function (e) {
    var target = e.target;

    // "Antworten prüfen" geklickt?
    if (target.getAttribute('data-action') === 'submit-quiz') {
      evaluateQuiz();
      return;
    }

    // Option angeklickt? (Label oder ein Kind-Element davon)
    var label = target.closest('.option-label');
    if (label) {
      var input = label.querySelector('input');
      if (input && !input.disabled) {
        // Bei Radio: Nur eine Option auswählen
        if (input.type === 'radio') {
          // Alle Labels dieser Frage zurücksetzen
          var block = label.closest('.question-block');
          var allLabels = block.querySelectorAll('.option-label');
          for (var i = 0; i < allLabels.length; i++) {
            allLabels[i].classList.remove('selected');
            allLabels[i].querySelector('input').checked = false;
          }
          input.checked = true;
          label.classList.add('selected');
        } else {
          // Bei Checkbox: Umschalten
          input.checked = !input.checked;
          label.classList.toggle('selected', input.checked);
        }
      }
    }
  });

  // Navigation: Zurück und Weiter
  DOM.btnBack.addEventListener('click', goBack);
  DOM.btnNext.addEventListener('click', goNext);

  // ===========================================
  // 8. APP STARTEN
  // ===========================================

  // Wenn das HTML-Dokument fertig geladen ist, App starten
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
