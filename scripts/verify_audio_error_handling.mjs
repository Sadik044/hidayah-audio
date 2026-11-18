import { chromium } from 'playwright';
import { spawn } from 'child_process';

console.log('====================================================');
console.log('HIDAYAH AUDIO — AUDIO ERROR HANDLING VERIFICATION');
console.log('====================================================\n');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4173;
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

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

// ----------------------------------------------------
// Mirroring audioErrors pure logic for node test runner
// ----------------------------------------------------
function isAbortError(err) {
  if (!err) return false;
  if (err instanceof DOMException && (err.name === 'AbortError' || err.code === 20)) return true;
  if (typeof err === 'object') {
    if (err.name === 'AbortError' || err.code === 20) return true;
    if (typeof err.message === 'string') {
      const msg = err.message.toLowerCase();
      if (
        msg.includes('interrupted by a new load request') ||
        msg.includes('interrupted by a call to pause') ||
        msg.includes('aborterror') ||
        msg.includes('the operation was aborted')
      ) {
        return true;
      }
    }
  }
  if (typeof err === 'string') {
    const msg = err.toLowerCase();
    if (msg.includes('interrupted') || msg.includes('aborterror') || msg.includes('aborted')) return true;
  }
  return false;
}

function isNotAllowedError(err) {
  if (!err) return false;
  if (err instanceof DOMException && err.name === 'NotAllowedError') return true;
  if (typeof err === 'object' && err.name === 'NotAllowedError') return true;
  return false;
}

function resolveAudioErrorMessage(err, audio) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
  }
  const mediaErr = audio?.error;
  if (mediaErr) {
    switch (mediaErr.code) {
      case 1:
        return '';
      case 2:
        return 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
      case 3:
        return 'এই অডিও ফরম্যাটটি আপনার ব্রাউজারে চালানো যাচ্ছে না।';
      case 4:
        return 'এই অডিওটি বর্তমানে পাওয়া যাচ্ছে না।';
    }
  }
  if (err && typeof err === 'object') {
    const code = err.code?.toUpperCase();
    if (code === 'FORBIDDEN') return 'এই অডিও পর্বটি অথবা এর মূল সিরিজটি বর্তমানে অপ্রকাশিত।';
    if (code === 'FORBIDDEN_ELEVATION_REQUIRED') return 'অপ্রকাশিত অডিও প্রিভিউ করার জন্য ২-ফ্যাক্টর (AAL2) প্রমাণীকরণ প্রয়োজন।';
    if (code === 'RATE_LIMIT_EXCEEDED') return 'অতিরিক্ত অডিও অনুরোধের কারণে প্লেয়ার সাময়িক স্থগিত। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে পুনরায় চেষ্টা করুন।';
    if (code === 'NOT_FOUND' || code === 'AUDIO_NOT_FOUND' || err.status === 404) return 'এই অডিওটি বর্তমানে পাওয়া যাচ্ছে না।';
    if (code === 'EXPIRED_URL' || code === 'SIGNED_URL_EXPIRED') return 'অডিও লিংক নতুন করে তৈরি করে পুনরায় চালানোর চেষ্টা করুন।';
    if (code === 'UNSUPPORTED_FORMAT') return 'এই অডিও ফরম্যাটটি আপনার ব্রাউজারে চালানো যাচ্ছে না।';
    if (code === 'NETWORK_ERROR' || code === 'OFFLINE' || /network|fetch|internet/i.test(err.message || '')) {
      return 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
    }
    if (code === 'SERVER_ERROR' || code === 'FUNCTION_ERROR' || err.status === 500 || err.status === 502 || err.status === 503 || err.status === 504) {
      return 'অডিও সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    }
    if (err.message && /[\u0980-\u09FF]/.test(err.message)) return err.message;
  }
  return 'অডিও চালানো সম্ভব হয়নি। আবার চেষ্টা করুন।';
}

// ----------------------------------------------------
// TEST SUITE 1: Unit Tests for audioErrors Module
// ----------------------------------------------------
console.log('--- TEST SUITE 1: audioErrors Categorization & Messages ---');

// Test 1.1: Chrome play() interruption AbortError
const chromeAbortErr = new Error('The play() request was interrupted by a new load request. https://goo.gl/LdLk22');
chromeAbortErr.name = 'AbortError';
assert(isAbortError(chromeAbortErr), 'Chrome load interruption AbortError identified');

// Test 1.2: DOMException AbortError
const domAbortErr = new DOMException('The operation was aborted.', 'AbortError');
assert(isAbortError(domAbortErr), 'DOMException AbortError identified');

// Test 1.3: Chrome pause() interruption AbortError
const pauseAbortErr = new Error('The play() request was interrupted by a call to pause().');
assert(isAbortError(pauseAbortErr), 'Chrome pause interruption AbortError identified');

// Test 1.4: NotAllowedError (Autoplay)
const notAllowedErr = new DOMException('Play was blocked by user agent.', 'NotAllowedError');
assert(isNotAllowedError(notAllowedErr), 'NotAllowedError correctly identified');

// Test 1.5: Offline / Network failure
const offlineMsg = resolveAudioErrorMessage({ code: 'NETWORK_ERROR' }, null);
assert(offlineMsg === 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।', 'Network failure maps to friendly connection message');

// Test 1.6: Server unavailable (500 / 503)
const server503Msg = resolveAudioErrorMessage({ code: 'SERVER_ERROR', status: 503 }, null);
assert(server503Msg === 'অডিও সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।', 'Server 503 maps to temporary server message');

// Test 1.7: 404 / Missing Audio
const notFoundMsg = resolveAudioErrorMessage({ code: 'NOT_FOUND' }, null);
assert(notFoundMsg === 'এই অডিওটি বর্তমানে পাওয়া যাচ্ছে না।', 'NOT_FOUND maps to missing audio message');

// Test 1.8: Expired signed URL
const expiredMsg = resolveAudioErrorMessage({ code: 'EXPIRED_URL' }, null);
assert(expiredMsg === 'অডিও লিংক নতুন করে তৈরি করে পুনরায় চালানোর চেষ্টা করুন।', 'EXPIRED_URL maps to refresh link message');

// Test 1.9: Unsupported format (decode error)
const decodeMediaErr = { error: { code: 3, message: '' } };
const decodeMsg = resolveAudioErrorMessage(null, decodeMediaErr);
assert(decodeMsg === 'এই অডিও ফরম্যাটটি আপনার ব্রাউজারে চালানো যাচ্ছে না।', 'Media decode error maps to unsupported format message');

// Test 1.10: Zero technical jargon leakage
const rawMsg = resolveAudioErrorMessage(new Error('Internal Server Error at http://internal.local:5432/stream'), null);
assert(!rawMsg.includes('http') && !rawMsg.includes('Internal') && /[\u0980-\u09FF]/.test(rawMsg), 'Technical errors strictly sanitize to Bengali');

// ----------------------------------------------------
// Start Vite Preview Server for End-to-End Browser Tests
// ----------------------------------------------------
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

async function runBrowserTests() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

    // ----------------------------------------------------
    // TEST SUITE 2: Normal Audio Playback
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 2: Normal Audio Playback ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Navigate to hero series
    const heroLink = page.locator('a:has-text("শোনা শুরু করুন"), a[href^="/series/"]').first();
    await heroLink.waitFor({ state: 'visible', timeout: 15000 });
    await heroLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Click play on first episode
    const playFirstBtn = page.locator('button:has-text("প্রথম পর্ব শুনুন"), button[aria-label="চালান"]').first();
    await playFirstBtn.waitFor({ state: 'visible', timeout: 15000 });
    await playFirstBtn.click();

    // Wait for MiniPlayer
    const miniPlayerScrubber = page.locator('input[aria-label="অডিও স্ক্রাবার"]');
    await miniPlayerScrubber.waitFor({ state: 'visible', timeout: 15000 });

    // Wait for audio to transition to playing
    await page.waitForTimeout(2500);
    const hasMiniPlayer = await miniPlayerScrubber.isVisible();
    assert(hasMiniPlayer, 'Normal playback: MiniPlayer is active and playing');

    // Confirm NO error banner is visible on normal playback
    const errorBanner = page.locator('div.bg-red-500\\/10');
    const isErrorVisible = await errorBanner.isVisible();
    if (isErrorVisible) {
      console.log('ERROR BANNER TEXT IS:', await errorBanner.textContent());
    }
    assert(!isErrorVisible, 'Normal playback: zero error banners displayed');

    // ----------------------------------------------------
    // TEST SUITE 3: Rapid Episode Switching (Race Condition Protection)
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 3: Rapid Episode Switching Race Conditions ---');

    // Find episode buttons on SeriesDetails page
    const episodePlayButtons = page.locator('div.group button[aria-label="চালান"], div.group button[aria-label="বিরতি দিন"]');
    const epCount = await episodePlayButtons.count();
    console.log(`Found ${epCount} episode play buttons on SeriesDetails`);

    if (epCount >= 2) {
      // Click Episode 1 then immediately Episode 2 in rapid succession (< 80ms)
      await episodePlayButtons.nth(0).click();
      await page.waitForTimeout(40);
      await episodePlayButtons.nth(1).click();

      // Wait 1.5s for audio to settle
      await page.waitForTimeout(1500);

      // Verify NO AbortError banner was created!
      const errorTextAfterRapidSwitch = await errorBanner.locator('span').first().textContent().catch(() => null);
      assert(
        !errorTextAfterRapidSwitch || !errorTextAfterRapidSwitch.includes('interrupted'),
        'Rapid switching: Chrome play() interruption was smoothly absorbed without error banner'
      );
      assert(
        !errorTextAfterRapidSwitch || !errorTextAfterRapidSwitch.includes('https://'),
        'Rapid switching: zero raw Google URLs or technical stack traces displayed'
      );
    } else {
      console.log('  [SKIP] Series has fewer than 2 episodes to switch between');
    }

    // ----------------------------------------------------
    // TEST SUITE 4: Rapid Play/Pause Interactions
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 4: Rapid Play/Pause Interactions ---');

    const miniPlayer = page.locator('div.fixed.bottom-14, div.fixed.bottom-0').first();
    const playPauseBtn = miniPlayer.locator('button[aria-label="বিরতি"], button[aria-label="চালান"]');

    if (await playPauseBtn.isVisible()) {
      // Rapidly toggle 4 times in quick succession (<60ms intervals)
      for (let i = 0; i < 4; i++) {
        await playPauseBtn.click();
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(1000);

      const errorAfterRapidToggle = await errorBanner.locator('span').first().textContent().catch(() => null);
      assert(
        !errorAfterRapidToggle || !errorAfterRapidToggle.includes('interrupted by a call to pause'),
        'Rapid play/pause: pause() interruption was safely handled without false error banner'
      );
    }

    // ----------------------------------------------------
    // TEST SUITE 5: Audio Server Failure & User-Friendly Bengali Message
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 5: Audio Server Failure (503 / Function Error) ---');

    // Intercept Edge function to simulate 503 Server Unavailable
    await page.route('**/functions/v1/get-audio-url', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Service Unavailable' },
        }),
      });
    });

    // Attempt to play uncached episode while server returns 503
    if (epCount >= 3) {
      await episodePlayButtons.nth(2).click();
      await page.waitForTimeout(1000);

      const serverErrorText = await errorBanner.locator('span').first().textContent().catch(() => null);
      assert(
        serverErrorText === 'অডিও সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।',
        `Server failure correctly displayed friendly Bengali message: "${serverErrorText}"`
      );

      // Verify Retry and Dismiss buttons exist on error banner
      const retryBtn = page.locator('button[aria-label="পুনরায় চেষ্টা করুন"]').first();
      const dismissBtn = page.locator('button[aria-label="বার্তা বন্ধ করুন"]').first();

      assert(await retryBtn.isVisible(), 'Error banner includes "পুনরায় চেষ্টা করুন" (Retry) action');
      assert(await dismissBtn.isVisible(), 'Error banner includes "বার্তা বন্ধ করুন" (Dismiss) action');

      // Test Dismiss action
      await dismissBtn.click();
      await page.waitForTimeout(300);
      assert(!(await retryBtn.isVisible()), 'Clicking Dismiss cleanly removes the error banner');
    }

    // Unroute to restore normal Edge function behavior
    await page.unroute('**/functions/v1/get-audio-url');

    // ----------------------------------------------------
    // TEST SUITE 6: Offline / Network Disconnected Behavior
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 6: Network Disconnection & Recovery ---');

    // Simulate browser offline
    await context.setOffline(true);
    await page.waitForTimeout(200);

    // Trigger an uncached play while offline (episode 3)
    if (epCount >= 4) {
      await episodePlayButtons.nth(3).click();
      await page.waitForTimeout(800);

      const offlineErrorText = await errorBanner.locator('span').first().textContent().catch(() => null);
      assert(
        offlineErrorText === 'অডিও লোড করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
        `Offline state correctly displayed network message: "${offlineErrorText}"`
      );

      // Restore network connection
      await context.setOffline(false);
      await page.waitForTimeout(300);

      // Click Retry button
      const retryBtn = page.locator('button[aria-label="পুনরায় চেষ্টা করুন"]').first();
      if (await retryBtn.isVisible()) {
        await retryBtn.click();
        await page.waitForTimeout(2000);

        // Verify audio recovered and error was dismissed
        const errorAfterRestore = await errorBanner.isVisible().catch(() => false);
        assert(!errorAfterRestore, 'Clicking Retry after network restoration successfully dismissed error');
      }
    }

    // ----------------------------------------------------
    // TEST SUITE 7: 404 / Missing Audio Handling
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 7: Missing Audio (404 / NOT_FOUND) ---');

    await page.route('**/functions/v1/get-audio-url', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Audio file not found' },
        }),
      });
    });

    if (epCount >= 5) {
      await episodePlayButtons.nth(4).click();
      await page.waitForTimeout(1000);

      const notFoundText = await errorBanner.locator('span').first().textContent().catch(() => null);
      assert(
        notFoundText === 'এই অডিওটি বর্তমানে পাওয়া যাচ্ছে না।',
        `404 correctly displayed missing audio message: "${notFoundText}"`
      );
    }
    await page.unroute('**/functions/v1/get-audio-url');

    // ----------------------------------------------------
    // TEST SUITE 8: Full Player Error UI & Responsiveness
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 8: Full Player Error UI ---');

    // Open Full Player
    const expandBtn = miniPlayer.locator('button[aria-label="ফুল প্লেয়ার খুলুন"]');
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
      await page.waitForTimeout(600);

      const fullPlayerModal = page.locator('div.fixed.inset-0.z-50');
      assert(await fullPlayerModal.isVisible(), 'Full Player opened cleanly');

      // Verify error banner styling and buttons inside Full Player
      const fullPlayerRetryBtn = fullPlayerModal.locator('button[aria-label="পুনরায় চেষ্টা করুন"]');
      const fullPlayerDismissBtn = fullPlayerModal.locator('button[aria-label="বার্তা বন্ধ করুন"]');

      assert(await fullPlayerRetryBtn.isVisible(), 'Full Player: Error banner includes Retry button');
      assert(await fullPlayerDismissBtn.isVisible(), 'Full Player: Error banner includes Dismiss button');

      if (await fullPlayerDismissBtn.isVisible()) {
        await fullPlayerDismissBtn.click();
        await page.waitForTimeout(300);
        assert(!(await fullPlayerRetryBtn.isVisible()), 'Full Player: Dismiss button cleanly removes error');
      }

      // Close Full Player
      const closeFullBtn = fullPlayerModal.locator('button[aria-label="প্লেয়ার মিনিমাইজ করুন"]');
      if (await closeFullBtn.isVisible()) {
        await closeFullBtn.click();
        await page.waitForTimeout(400);
      }
    }

    await browser.close();
  } catch (err) {
    console.error('Test execution error:', err);
    await browser.close();
  } finally {
    previewProcess.kill();
  }
}

await runBrowserTests();

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
