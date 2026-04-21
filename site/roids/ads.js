'use strict';

// ── AdMob config — CWE-522: ID comes from GAME_CONFIG (config.js), not hardcoded ──
const ADMOB_INTERSTITIAL_ID =
  (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.admobInterstitialId) || '';

// ── Native AdMob interstitial (Capacitor) ────────────────────────────────────
function getAdMob() {
  return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
}

let adMobInitialized = false;

async function ensureAdMobReady() {
  const AdMob = getAdMob();
  if (!AdMob || adMobInitialized) return !!AdMob;
  try {
    await AdMob.initialize({ testingDevices: [], initializeForTesting: false }); // M-2: production mode
    adMobInitialized = true;
    return true;
  } catch (e) {
    return false;
  }
}

async function showNativeAd(onComplete) {
  const AdMob = getAdMob();
  const ready = await ensureAdMobReady();
  if (!ready) { showFallbackAd(onComplete); return; }

  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  // M-3: initialise both handles as null so try/finally cleanup is always safe
  let dismissHandle = null, appStateHandle = null, adWasClicked = false;

  try {
    if (App) {
      appStateHandle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) adWasClicked = true;
      });
    }
    // M-3 (corrected): listeners removed inside the dismiss callback, NOT in finally.
    // showInterstitial() resolves when the ad is displayed, not when dismissed.
    // Moving removal to finally would destroy dismissHandle before the user closes the ad,
    // causing onComplete() to never be called and permanently freezing game state.
    dismissHandle = await AdMob.addListener('interstitialAdDismissed', () => {
      if (appStateHandle) appStateHandle.remove();
      dismissHandle.remove();
      onComplete(adWasClicked);
    });
    await AdMob.prepareInterstitial({ adId: ADMOB_INTERSTITIAL_ID });
    await AdMob.showInterstitial();
  } catch (e) {
    if (appStateHandle) appStateHandle.remove();
    if (dismissHandle)  dismissHandle.remove();
    onComplete(false);
  }
}

// ── HTML fallback (desktop / browser testing) ─────────────────────────────────
function showFallbackAd(onComplete) {
  const overlay = document.getElementById('adOverlay');
  overlay.innerHTML = '';
  overlay.classList.remove('hidden');

  const label = document.createElement('div');
  label.className = 'ad-label';
  label.textContent = 'Advertisement';

  let adClicked = false;

  const adBox = document.createElement('div');
  adBox.className = 'ad-box';
  adBox.textContent = 'Ad — click to simulate sponsor visit';
  adBox.style.cursor = 'pointer';
  adBox.addEventListener('click', () => { adClicked = true; });

  const countdown = document.createElement('div');
  countdown.className = 'ad-countdown';

  const btn = document.createElement('button');
  btn.className = 'ad-continue-btn';
  btn.textContent = 'CONTINUE';
  btn.style.display = 'none';
  btn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
    onComplete(adClicked);
  });

  overlay.appendChild(label);
  overlay.appendChild(adBox);
  overlay.appendChild(countdown);
  overlay.appendChild(btn);

  let seconds = 5;
  countdown.textContent = `Ad \u2014 resuming in ${seconds}\u2026`;

  const tick = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      countdown.textContent = `Ad \u2014 resuming in ${seconds}\u2026`;
    } else {
      clearInterval(tick);
      countdown.textContent = '';
      btn.style.display = 'block';
    }
  }, 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────
// onComplete(wasClicked: boolean)
function showAd(onComplete) {
  if (getAdMob()) {
    showNativeAd(onComplete);
  } else {
    showFallbackAd(onComplete);
  }
}
