import { chromium } from 'playwright';
import { spawn } from 'child_process';

console.log('====================================================');
console.log('HIDAYAH AUDIO — MEDIA SESSION & BACKGROUND AUDIO TEST');
console.log('====================================================\n');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4173;
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

// 1. Start vite preview server for dist/
const previewProcess = spawn(
  process.execPath,
  ['./node_modules/vite/bin/vite.js', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
  { stdio: 'pipe' }
);

let serverStarted = false;

previewProcess.stdout.on('data', (data) => {
  const str = data.toString();
  if (str.includes(String(PREVIEW_PORT)) || str.includes('Local:') || str.includes('http')) {
    serverStarted = true;
  }
});

previewProcess.stderr.on('data', (data) => {
  console.error('Vite preview stderr:', data.toString());
});

for (let i = 0; i < 20; i++) {
  if (serverStarted) break;
  await new Promise((r) => setTimeout(r, 500));
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

async function runTests() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Setup instrumentation to capture MediaSession action registrations, execution, and audio instances
    await page.addInitScript(() => {
      window.__mediaSessionLog = {
        actionHandlers: {},
        handlersMap: {},
        positionStates: [],
      };

      // Helper to execute registered MediaSession action
      window.triggerMediaSessionAction = (action, details = {}) => {
        const handler = window.__mediaSessionLog.handlersMap[action];
        if (typeof handler === 'function') {
          return handler(details);
        }
        throw new Error(`Action handler for "${action}" is not registered or not a function`);
      };

      if ('mediaSession' in navigator) {
        const originalSetActionHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
        navigator.mediaSession.setActionHandler = (action, handler) => {
          window.__mediaSessionLog.actionHandlers[action] = !!handler;
          window.__mediaSessionLog.handlersMap[action] = handler;
          return originalSetActionHandler(action, handler);
        };

        if ('setPositionState' in navigator.mediaSession) {
          const originalSetPositionState = navigator.mediaSession.setPositionState.bind(navigator.mediaSession);
          navigator.mediaSession.setPositionState = (state) => {
            window.__mediaSessionLog.positionStates.push(state);
            return originalSetPositionState(state);
          };
        }
      }

      // Track HTMLAudioElement instantiations to verify singleton lifecycle
      window.__audioInstances = [];
      let instanceCounter = 0;
      const OriginalAudio = window.Audio;
      window.Audio = function (...args) {
        const inst = new OriginalAudio(...args);
        inst.__instanceId = ++instanceCounter;
        window.__audioInstances.push(inst);
        window.__currentAudio = inst;
        return inst;
      };
    });

    // ----------------------------------------------------
    // TEST SUITE 1: Browser Media Session Support
    // ----------------------------------------------------
    console.log('--- TEST SUITE 1: Media Session API Availability ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const hasMediaSession = await page.evaluate(() => 'mediaSession' in navigator);
    assert(hasMediaSession, 'navigator.mediaSession is supported in browser');

    const hasMediaMetadata = await page.evaluate(() => typeof MediaMetadata !== 'undefined');
    assert(hasMediaMetadata, 'MediaMetadata constructor is available');

    // ----------------------------------------------------
    // TEST SUITE 2: Audio Playback & MediaMetadata Generation
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 2: Audio Playback & MediaMetadata ---');

    // Navigate to hero series
    const heroLink = page.locator('a:has-text("শোনা শুরু করুন"), a[href^="/series/"]').first();
    await heroLink.waitFor({ state: 'visible', timeout: 15000 });
    await heroLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Click play first episode
    const playBtn = page.locator('button:has-text("প্রথম পর্ব শুনুন"), button[aria-label="চালান"]').first();
    await playBtn.waitFor({ state: 'visible', timeout: 15000 });
    await playBtn.click();

    // Wait for MiniPlayer to show
    const miniPlayerScrubber = page.locator('input[aria-label="অডিও স্ক্রাবার"]');
    await miniPlayerScrubber.waitFor({ state: 'visible', timeout: 15000 });
    assert(await miniPlayerScrubber.isVisible(), 'MiniPlayer is active and playing');

    // Wait up to 5s for playback and metadata to fully establish
    for (let i = 0; i < 10; i++) {
      const state = await page.evaluate(() => navigator.mediaSession.playbackState);
      if (state === 'playing') break;
      await page.waitForTimeout(500);
    }

    // Verify metadata
    const currentMeta = await page.evaluate(() => {
      const meta = navigator.mediaSession.metadata;
      if (!meta) return null;
      return {
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        artwork: meta.artwork ? Array.from(meta.artwork).map((a) => ({ src: a.src, sizes: a.sizes })) : [],
      };
    });

    assert(!!currentMeta, 'navigator.mediaSession.metadata is populated');
    assert(typeof currentMeta.title === 'string' && currentMeta.title.length > 0, `Metadata title is present: "${currentMeta?.title}"`);
    assert(typeof currentMeta.album === 'string' && currentMeta.album.length > 0, `Metadata album (series) is present: "${currentMeta?.album}"`);
    assert(typeof currentMeta.artist === 'string' && currentMeta.artist.length > 0, `Metadata artist is present: "${currentMeta?.artist}"`);
    assert(Array.isArray(currentMeta.artwork) && currentMeta.artwork.length >= 4, `Artwork contains multiple sizes (got ${currentMeta?.artwork?.length})`);
    assert(
      currentMeta.artwork.every((a) => a.src.startsWith('http://') || a.src.startsWith('https://')),
      'All artwork items use fully-qualified absolute HTTPS/HTTP URLs'
    );

    // ----------------------------------------------------
    // TEST SUITE 3: Playback State Synchronization
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 3: Playback State Synchronization ---');
    const playbackState = await page.evaluate(() => navigator.mediaSession.playbackState);
    assert(playbackState === 'playing', `playbackState is synchronized to "playing" (got "${playbackState}")`);

    // ----------------------------------------------------
    // TEST SUITE 4: Action Handlers Registration (All 7 Handlers)
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 4: All Seven Action Handlers Registration ---');
    const handlers = await page.evaluate(() => window.__mediaSessionLog.actionHandlers);

    assert(handlers['play'] === true, 'Action handler for "play" is registered');
    assert(handlers['pause'] === true, 'Action handler for "pause" is registered');
    assert(handlers['previoustrack'] === true, 'Action handler for "previoustrack" is registered');
    assert(handlers['nexttrack'] === true, 'Action handler for "nexttrack" is registered');
    assert(handlers['seekbackward'] === true, 'Action handler for "seekbackward" is registered');
    assert(handlers['seekforward'] === true, 'Action handler for "seekforward" is registered');
    assert(handlers['seekto'] === true, 'Action handler for "seekto" is registered');

    // ----------------------------------------------------
    // TEST SUITE 5: Position State (setPositionState) Verification
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 5: Position State (setPositionState) ---');
    const positionStates = await page.evaluate(() => window.__mediaSessionLog.positionStates);
    assert(positionStates.length > 0, `setPositionState was called at least once (total calls: ${positionStates.length})`);
    const lastPosState = positionStates[positionStates.length - 1];
    assert(
      lastPosState && lastPosState.duration > 0 && Number.isFinite(lastPosState.duration),
      `setPositionState received valid duration (${lastPosState?.duration}s)`
    );
    assert(
      lastPosState && lastPosState.position >= 0 && Number.isFinite(lastPosState.position),
      `setPositionState received valid position (${lastPosState?.position}s)`
    );

    // ----------------------------------------------------
    // TEST SUITE 6: Action Execution — Explicit Test of ALL Seven Handlers
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 6: Explicit Execution of All Seven Handlers ---');

    // 1. Execute 'pause' action
    await page.evaluate(() => window.triggerMediaSessionAction('pause'));
    await page.waitForTimeout(600);
    const isPaused = await page.evaluate(() => window.__currentAudio?.paused);
    const stateAfterPause = await page.evaluate(() => navigator.mediaSession.playbackState);
    assert(isPaused === true, 'MediaSession "pause" handler successfully paused HTMLAudioElement');
    assert(stateAfterPause === 'paused', `MediaSession "pause" handler set playbackState to "paused" (got "${stateAfterPause}")`);

    // 2. Execute 'play' action
    await page.evaluate(() => window.triggerMediaSessionAction('play'));
    await page.waitForTimeout(600);
    const isPlayingAudio = await page.evaluate(() => !window.__currentAudio?.paused);
    const stateAfterPlay = await page.evaluate(() => navigator.mediaSession.playbackState);
    assert(isPlayingAudio === true, 'MediaSession "play" handler successfully resumed HTMLAudioElement');
    assert(stateAfterPlay === 'playing', `MediaSession "play" handler set playbackState to "playing" (got "${stateAfterPlay}")`);

    // 3. Execute 'seekto' action
    await page.evaluate(() => window.triggerMediaSessionAction('seekto', { seekTime: 35 }));
    await page.waitForTimeout(600);
    const timeAfterSeekTo = await page.evaluate(() => window.__currentAudio?.currentTime);
    assert(Math.abs(timeAfterSeekTo - 35) < 3, `MediaSession "seekto" handler sought to ~35s (got ${timeAfterSeekTo.toFixed(1)}s)`);

    // 4. Execute 'seekforward' action (+15s)
    const timeBeforeSeekFwd = await page.evaluate(() => window.__currentAudio?.currentTime);
    await page.evaluate(() => window.triggerMediaSessionAction('seekforward', { seekOffset: 15 }));
    await page.waitForTimeout(600);
    const timeAfterSeekFwd = await page.evaluate(() => window.__currentAudio?.currentTime);
    assert(timeAfterSeekFwd > timeBeforeSeekFwd + 5, `MediaSession "seekforward" handler advanced position (was ${timeBeforeSeekFwd.toFixed(1)}s, now ${timeAfterSeekFwd.toFixed(1)}s)`);

    // 5. Execute 'seekbackward' action (-10s)
    const timeBeforeSeekBwd = await page.evaluate(() => window.__currentAudio?.currentTime);
    await page.evaluate(() => window.triggerMediaSessionAction('seekbackward', { seekOffset: 10 }));
    await page.waitForTimeout(600);
    const timeAfterSeekBwd = await page.evaluate(() => window.__currentAudio?.currentTime);
    assert(timeAfterSeekBwd < timeBeforeSeekBwd, `MediaSession "seekbackward" handler rewound position (was ${timeBeforeSeekBwd.toFixed(1)}s, now ${timeAfterSeekBwd.toFixed(1)}s)`);

    // 6. Execute 'nexttrack' action
    const ep1Title = await page.evaluate(() => navigator.mediaSession.metadata?.title);
    await page.evaluate(() => window.triggerMediaSessionAction('nexttrack'));
    // Wait for next track to load and update metadata
    let ep2Title = '';
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(500);
      ep2Title = await page.evaluate(() => navigator.mediaSession.metadata?.title || '');
      if (ep2Title && ep2Title !== ep1Title) break;
    }
    assert(ep2Title.length > 0 && ep2Title !== ep1Title, `MediaSession "nexttrack" handler switched track (new: "${ep2Title}")`);

    // 7. Execute 'previoustrack' action
    // A) If track has played > 3s, first 'previoustrack' rewinds to start of current track (standard media player UX)
    const timeBeforePrev = await page.evaluate(() => window.__currentAudio?.currentTime);
    if (timeBeforePrev > 3) {
      await page.evaluate(() => window.triggerMediaSessionAction('previoustrack'));
      await page.waitForTimeout(600);
      const timeAfterFirstPrev = await page.evaluate(() => window.__currentAudio?.currentTime);
      assert(timeAfterFirstPrev < 2, `When track >3s, "previoustrack" rewinds to 0:00 (was ${timeBeforePrev.toFixed(1)}s, now ${timeAfterFirstPrev.toFixed(1)}s)`);
    }

    // B) With track at start (<3s), 'previoustrack' switches to previous track in queue
    await page.evaluate(() => window.triggerMediaSessionAction('previoustrack'));
    // Wait for previous track to reload
    let backToEp1Title = '';
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(500);
      backToEp1Title = await page.evaluate(() => navigator.mediaSession.metadata?.title || '');
      if (backToEp1Title === ep1Title) break;
    }
    assert(backToEp1Title === ep1Title, `When at start (<3s), "previoustrack" handler returns to previous episode in queue ("${backToEp1Title}")`);

    // ----------------------------------------------------
    // TEST SUITE 7: Single HTMLAudioElement & Background Route Continuity
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 7: HTMLAudioElement Lifecycle & Route Continuity ---');

    const initialInstanceId = await page.evaluate(() => window.__currentAudio?.__instanceId);
    const initialInstanceCount = await page.evaluate(() => window.__audioInstances?.length);
    assert(initialInstanceCount === 1, `Single HTMLAudioElement instance exists (count: ${initialInstanceCount})`);

    // Navigate to /browse
    await page.click('a[href="/browse"]');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const isAudioPlayingOnBrowse = await page.evaluate(() => navigator.mediaSession.playbackState);
    assert(isAudioPlayingOnBrowse === 'playing', 'Audio continues playing after navigating to /browse');
    assert(await miniPlayerScrubber.isVisible(), 'MiniPlayer remains persistent on /browse route');

    // Navigate to /favorites
    await page.click('a[href="/favorites"]');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const isAudioPlayingOnFavorites = await page.evaluate(() => navigator.mediaSession.playbackState);
    assert(isAudioPlayingOnFavorites === 'playing', 'Audio continues playing after navigating to /favorites');

    // Navigate back to home
    await page.click('a[href="/"]');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const isAudioPlayingOnHome = await page.evaluate(() => navigator.mediaSession.playbackState);
    assert(isAudioPlayingOnHome === 'playing', 'Audio continues playing after returning to /');

    // Verify HTMLAudioElement was never unmounted, destroyed, or recreated
    const postNavInstanceId = await page.evaluate(() => window.__currentAudio?.__instanceId);
    const postNavInstanceCount = await page.evaluate(() => window.__audioInstances?.length);
    assert(postNavInstanceCount === 1, `HTMLAudioElement was NOT recreated during client routes (count: ${postNavInstanceCount})`);
    assert(postNavInstanceId === initialInstanceId, `Same persistent HTMLAudioElement instance was preserved (instanceId: ${postNavInstanceId})`);

    // ----------------------------------------------------
    // TEST SUITE 8: Close Player & Stale Metadata Reset
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 8: Close Player & Cleanup ---');
    const miniPlayer = page.locator('div.fixed.bottom-14, div.fixed.bottom-0').first();
    const closePlayerBtn = miniPlayer.locator('button[aria-label="প্লেয়ার বন্ধ করুন"]');
    await closePlayerBtn.click();
    await page.waitForTimeout(600);

    const finalPlaybackState = await page.evaluate(() => navigator.mediaSession.playbackState);
    const finalMetadata = await page.evaluate(() => navigator.mediaSession.metadata);
    const isPausedAfterClose = await page.evaluate(() => window.__currentAudio?.paused);

    assert(finalPlaybackState === 'none', `On player close, playbackState resets to "none" (got "${finalPlaybackState}")`);
    assert(finalMetadata === null, 'On player close, metadata resets to null (no stale metadata)');
    assert(isPausedAfterClose === true, 'On player close, audio playback is stopped');

    await browser.close();
  } catch (err) {
    console.error('Test execution error:', err);
    await browser.close();
  } finally {
    previewProcess.kill();
  }
}

await runTests();

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
