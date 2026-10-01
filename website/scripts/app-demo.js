/**
 * Interactive demo of the app in the hero.
 *
 * Mirrors the state the real screen keeps in
 * mobile/src/app/(home)/index.tsx — text, tpWorkouts, scheduling,
 * scheduleDate, message — and the transitions between them:
 *
 *   fetchWeek()    shows the TrainingPeaks list
 *   pickWorkout()  fills the text, hides the list, and turns scheduling
 *                  on for a workout that is not in the past
 *   send()         is disabled until there is a workout to parse
 *
 * Workout data lives in the `data-*` attributes on the .tp-item
 * buttons, so the markup stays the single source of truth.
 */
(function () {
  'use strict';

  var root = document.getElementById('demo');
  if (!root) return;

  var items = Array.prototype.slice.call(root.querySelectorAll('.tp-item'));
  if (!items.length) return;

  var el = {
    list: root.querySelector('.tp-list'),
    fetch: root.querySelector('.tp-button'),
    placeholder: root.querySelector('[data-demo="placeholder"]'),
    text: root.querySelector('[data-demo="text"]'),
    toggle: root.querySelector('[data-demo="toggle-cal"]'),
    date: root.querySelector('[data-demo="date"]'),
    send: root.querySelector('[data-demo="send"]'),
    message: root.querySelector('[data-demo="message"]'),
    link: root.querySelector('[data-demo="link"]')
  };

  var state = {
    text: '',
    listVisible: true,
    scheduling: false,
    scheduleDate: '',
    message: ''
  };

  function setState(patch) {
    Object.assign(state, patch);
    render();
  }

  function render() {
    var hasWorkout = state.text !== '';

    el.list.hidden = !state.listVisible;

    el.placeholder.hidden = hasWorkout;
    el.text.hidden = !hasWorkout;
    el.text.textContent = state.text;

    el.toggle.setAttribute('aria-checked', String(state.scheduling));
    el.date.hidden = !state.scheduling;
    el.date.textContent = state.scheduleDate;

    el.send.disabled = !hasWorkout;
    el.send.classList.toggle('is-disabled', !hasWorkout);

    el.message.hidden = state.message === '';
    el.message.textContent = state.message;
    el.link.hidden = state.message === '';
  }

  el.fetch.addEventListener('click', function () {
    setState({ listVisible: true, message: '' });
  });

  items.forEach(function (node) {
    node.addEventListener('click', function () {
      setState({
        text: node.dataset.text,
        listVisible: false,
        scheduling: true,
        scheduleDate: node.dataset.day,
        message: ''
      });
    });
  });

  el.toggle.addEventListener('click', function () {
    setState({ scheduling: !state.scheduling });
  });

  el.send.addEventListener('click', function () {
    if (state.text === '') return;
    setState({
      message: state.scheduling
        ? 'Treino criado e agendado para ' + state.scheduleDate + ' ✓'
        : 'Treino criado no Garmin Connect ✓'
    });
  });

  render();
})();
