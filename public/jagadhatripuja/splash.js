/*
 * First-paint splash for Jagadhatri Puja. Loaded as an external script because the CSP blocks inline scripts.
 * React hands over with window.pdSplash.hide() once the first screen's data has arrived or failed.
 * The splash stays at least 2 s on the first open of the day and 0.8 s after that.
 */
(function () {
  var el = document.getElementById('pd-splash');
  if (!el) return;
  var FIRST_MS = 2000,
    REPEAT_MS = 800,
    SLOW_MS = 8000,
    FAIL_MS = 15000,
    ROTATE_MS = 3560,
    SLOW_ROTATE_MS = 4000,
    FADE_MS = 350,
    STILL_T = 1.19;
  var WAIT = [
    'Lighting up the lanes of Chandannagar...',
    'Warming up the dhak...',
    'Counting the lights, one by one...',
    'Finding the best pandals for you...',
    'Ma is almost ready to meet you...',
    'Ektu wait, the lights are coming on...',
    'Asking the committees for directions...',
  ];
  var SLOW = [
    'Slow network today. Still fetching, hang on.',
    'Big bhiir on the network. Still on the way.',
    'Taking longer than usual. Almost there.',
  ];
  var FAIL = ["Couldn't reach the pandals. Check your connection and try again.", "Looks like you're offline. Reconnect and try again."];

  var lineEl = document.getElementById('pd-splash-line');
  var retry = document.getElementById('pd-splash-retry');
  var svg = el.querySelector('svg');
  var root = document.getElementById('root');
  var start = performance.now();
  var stage = 'wait';
  var i = 0;
  var done = false;
  var rot;
  var timers = [];

  // Once a day the splash lingers (the first open); the day is India time, like the welcome card.
  var KEY = 'pd_jg_splash_day';
  var day = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  var minMs = FIRST_MS;
  try {
    if (JSON.parse(localStorage.getItem(KEY) || 'null') === day) minMs = REPEAT_MS;
    else localStorage.setItem(KEY, JSON.stringify(day));
  } catch {
    minMs = REPEAT_MS; // storage blocked: never make the same person wait the long version every time
  }

  // The app underneath is not reachable by keyboard or screen reader while the splash covers it.
  if (root) root.setAttribute('inert', '');

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches && svg && svg.pauseAnimations) {
    svg.pauseAnimations();
    svg.setCurrentTime(STILL_T); // the finished eye
  }

  function list() {
    return stage === 'wait' ? WAIT : SLOW;
  }
  function show(t, fade) {
    if (!lineEl) return;
    if (!fade) {
      lineEl.textContent = t;
      return;
    }
    lineEl.classList.add('f');
    setTimeout(function () {
      lineEl.textContent = t;
      lineEl.classList.remove('f');
    }, FADE_MS);
  }
  function startRot() {
    clearInterval(rot);
    rot = setInterval(
      function () {
        i = (i + 1) % list().length;
        show(list()[i], true);
      },
      stage === 'slow' ? SLOW_ROTATE_MS : ROTATE_MS,
    );
  }
  show(WAIT[0], false);
  startRot();
  timers.push(
    setTimeout(function () {
      stage = 'slow';
      i = 0;
      show(SLOW[0], true);
      startRot();
    }, SLOW_MS),
  );
  timers.push(
    setTimeout(function () {
      stage = 'fail';
      clearInterval(rot);
      show(navigator.onLine === false ? FAIL[1] : FAIL[0], true);
      if (retry) retry.hidden = false;
    }, FAIL_MS),
  );
  if (retry)
    retry.onclick = function () {
      location.reload();
    };

  function remove() {
    if (el.parentNode) el.parentNode.removeChild(el);
    if (root) root.removeAttribute('inert');
    window.dispatchEvent(new Event('pd-splash-gone'));
  }

  window.pdSplash = {
    hide: function () {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      clearInterval(rot);
      var wait = Math.max(0, minMs - (performance.now() - start));
      setTimeout(function () {
        el.classList.add('pd-splash-out');
        setTimeout(remove, FADE_MS);
      }, wait);
    },
  };
})();
