/**
 * Interactive product demo in the hero.
 *
 * Port of the `DCLogic` component from "Swim2Garmin Landing.dc.html": the
 * design canvas drove the phone mock with `sc-if` blocks over a small state
 * machine, which this reimplements against plain DOM.
 *
 * Workout data is read from the `data-*` attributes on the `.wk-item`
 * buttons, so the markup stays the single source of truth.
 */
(function () {
  'use strict';

  var root = document.getElementById('demo');
  if (!root) return;

  var SCREEN_TITLES = {
    editor: 'Novo treino',
    list: 'TrainingPeaks',
    sent: 'Pronto'
  };

  var items = Array.prototype.slice.call(root.querySelectorAll('.wk-item'));
  if (!items.length) return;

  var workouts = items.map(function (el) {
    return {
      title: el.dataset.title,
      day: el.dataset.day,
      dist: el.dataset.dist,
      text: el.dataset.text
    };
  });

  var el = {
    title: root.querySelector('[data-demo="title"]'),
    back: root.querySelector('[data-demo="back"]'),
    text: root.querySelector('[data-demo="text"]'),
    toggle: root.querySelector('[data-demo="toggle-cal"]'),
    dayRow: root.querySelector('[data-demo="day-row"]'),
    day: root.querySelector('[data-demo="day"]'),
    savedName: root.querySelector('[data-demo="saved-name"]'),
    sentDetail: root.querySelector('[data-demo="sent-detail"]')
  };

  var screens = {};
  root.querySelectorAll('[data-screen]').forEach(function (node) {
    screens[node.dataset.screen] = node;
  });

  var state = { screen: 'editor', calendar: true, pick: 0 };

  function setState(patch) {
    Object.assign(state, patch);
    render();
  }

  function render() {
    var w = workouts[state.pick];

    el.title.textContent = SCREEN_TITLES[state.screen];
    el.back.hidden = state.screen !== 'list';

    Object.keys(screens).forEach(function (name) {
      screens[name].hidden = name !== state.screen;
    });

    el.text.textContent = w.text;

    el.toggle.setAttribute('aria-checked', String(state.calendar));
    el.dayRow.hidden = !state.calendar;
    el.day.textContent = w.day;

    el.savedName.textContent = 'Swim2Garmin ' + w.dist;
    el.sentDetail.textContent = state.calendar
      ? 'Agendado para ' + w.day + ' no calendário do Garmin Connect.'
      : 'Salvo na sua biblioteca de treinos do Garmin Connect.';
  }

  root.querySelector('[data-demo="go-list"]').addEventListener('click', function () {
    setState({ screen: 'list' });
  });

  el.back.addEventListener('click', function () {
    setState({ screen: 'editor' });
  });

  root.querySelector('[data-demo="send"]').addEventListener('click', function () {
    setState({ screen: 'sent' });
  });

  root.querySelector('[data-demo="reset"]').addEventListener('click', function () {
    setState({ screen: 'editor' });
  });

  el.toggle.addEventListener('click', function () {
    setState({ calendar: !state.calendar });
  });

  items.forEach(function (node, i) {
    node.addEventListener('click', function () {
      setState({ pick: i, screen: 'editor' });
    });
  });

  render();
})();
