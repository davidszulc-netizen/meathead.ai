const Ads = (() => {
  let _onDone     = null;
  let _timerHandle = null;
  let _admobReady  = false;

  // ── Platform detection ────────────────────────────────────────────────────
  function _isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  }

  function _getAdMob() {
    return window.Capacitor?.Plugins?.AdMob;
  }

  // ── AdMob initialisation (called once on app start, native only) ──────────
  async function _initAdMob() {
    const AdMob = _getAdMob();
    if (!AdMob) return;
    try {
      await AdMob.initialize({ requestTrackingAuthorization: true });
      _admobReady = true;
    } catch (e) {
      console.warn('AdMob init failed:', e);
    }
  }

  // ── Native: AdMob interstitial ────────────────────────────────────────────
  async function _showNative(onDone) {
    _onDone = onDone;
    const AdMob = _getAdMob();
    if (!AdMob || !_admobReady) { _showWeb(onDone); return; }

    try {
      // Remove any lingering listeners first
      await AdMob.removeAllListeners();

      AdMob.addListener('interstitialAdDismissed', () => {
        if (_onDone) { _onDone(); _onDone = null; }
      });

      AdMob.addListener('interstitialAdFailedToLoad', (err) => {
        console.warn('AdMob failed to load, falling back:', err);
        _showWeb(onDone);
      });

      await AdMob.prepareInterstitial({
        adId: 'ca-app-pub-9350592744116375/8438894928',
        isTesting: true,   // ← set false only after AdMob account is approved & app is live
      });

      await AdMob.showInterstitial();
    } catch (e) {
      console.warn('AdMob interstitial error, falling back:', e);
      _showWeb(onDone);
    }
  }

  // ── Web / Electron: HTML overlay ──────────────────────────────────────────
  function _showWeb(onDone, nextLabel) {
    _onDone = onDone;
    document.getElementById('adOverlay').classList.remove('hidden');
    const btn = document.getElementById('adCloseBtn');
    if (nextLabel) {
      btn.textContent = nextLabel;
      btn.className   = 'ad-next-btn';
    } else {
      btn.textContent = '\u2715 Close';
      btn.className   = 'ad-close';
    }
    btn.disabled = true;
    if (_timerHandle) clearTimeout(_timerHandle);
    _timerHandle = setTimeout(() => { btn.disabled = false; }, 5000);
  }

  function _close() {
    document.getElementById('adOverlay').classList.add('hidden');
    if (_onDone) {
      const cb = _onDone;
      _onDone = null;
      // Delay callback so the closing tap/click doesn't fall through to the canvas
      setTimeout(cb, 350);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function show(onDone, nextLabel) {
    if (_isNative()) {
      _showNative(onDone);
    } else {
      _showWeb(onDone, nextLabel);
    }
  }

  function hide() {
    document.getElementById('adOverlay').classList.add('hidden');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adCloseBtn').addEventListener('click', _close);
    // Initialise AdMob as early as possible on native
    if (_isNative()) _initAdMob();
  });

  return { show, hide };
})();
