import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

console.log('====================================================');
console.log('HIDAYAH AUDIO — THEME BEHAVIOR VERIFICATION (PRODUCTION BUILD)');
console.log('====================================================\n');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4173;
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

// 1. Start vite preview server for dist/
const previewProcess = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
  stdio: 'pipe',
});

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

// Wait up to 10s for server to start
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

    // ----------------------------------------------------
    // TEST 1: First-time visitor gets Light Mode
    // ----------------------------------------------------
    console.log('--- Test 1: First-time visitor gets Light Mode by default ---');
    // Ensure localStorage is empty for first-time visitor
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('hidayah_theme'));
    await page.reload({ waitUntil: 'networkidle' });

    const htmlClasses1 = await page.evaluate(() => document.documentElement.className);
    const hasDarkClass1 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const savedTheme1 = await page.evaluate(() => localStorage.getItem('hidayah_theme'));

    assert(!hasDarkClass1, 'First-time visitor: <html> does NOT have "dark" class');
    assert(savedTheme1 === 'light', `First-time visitor: saved theme in localStorage is "light" (got "${savedTheme1}")`);

    // Verify toggle button shows Moon icon (indicates dark mode is available to turn on)
    const toggleButton = page.locator('button[aria-label="থিম পরিবর্তন"]');
    assert(await toggleButton.isVisible(), 'Theme toggle button is present in Header');
    const toggleTitle1 = await toggleButton.getAttribute('title');
    assert(toggleTitle1 === 'ডার্ক মোড চালু করুন', `Toggle button title is "ডার্ক মোড চালু করুন" (got "${toggleTitle1}")`);

    // ----------------------------------------------------
    // TEST 2: Selecting Dark Mode works immediately
    // ----------------------------------------------------
    console.log('\n--- Test 2: Selecting Dark Mode works immediately ---');
    await toggleButton.click();
    await page.waitForTimeout(200);

    const hasDarkClass2 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const savedTheme2 = await page.evaluate(() => localStorage.getItem('hidayah_theme'));
    const toggleTitle2 = await toggleButton.getAttribute('title');

    assert(hasDarkClass2, 'Clicking toggle adds "dark" class to <html> immediately');
    assert(savedTheme2 === 'dark', `localStorage updated to "dark" (got "${savedTheme2}")`);
    assert(toggleTitle2 === 'লাইট মোড চালু করুন', `Toggle button title updated to "লাইট মোড চালু করুন" (got "${toggleTitle2}")`);

    // ----------------------------------------------------
    // TEST 3: Refresh preserves Dark Mode
    // ----------------------------------------------------
    console.log('\n--- Test 3: Refresh preserves Dark Mode ---');
    await page.reload({ waitUntil: 'networkidle' });

    const hasDarkClass3 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const savedTheme3 = await page.evaluate(() => localStorage.getItem('hidayah_theme'));
    const toggleTitle3 = await page.locator('button[aria-label="থিম পরিবর্তন"]').getAttribute('title');

    assert(hasDarkClass3, 'After refresh: <html> retains "dark" class');
    assert(savedTheme3 === 'dark', `After refresh: localStorage retains "dark"`);
    assert(toggleTitle3 === 'লাইট মোড চালু করুন', `After refresh: toggle button retains "লাইট মোড চালু করুন" title`);

    // ----------------------------------------------------
    // TEST 4: Selecting Light Mode works immediately
    // ----------------------------------------------------
    console.log('\n--- Test 4: Selecting Light Mode works immediately ---');
    const toggleButtonAfterRefresh = page.locator('button[aria-label="থিম পরিবর্তন"]');
    await toggleButtonAfterRefresh.click();
    await page.waitForTimeout(200);

    const hasDarkClass4 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const savedTheme4 = await page.evaluate(() => localStorage.getItem('hidayah_theme'));
    const toggleTitle4 = await toggleButtonAfterRefresh.getAttribute('title');

    assert(!hasDarkClass4, 'Clicking toggle removes "dark" class from <html> immediately');
    assert(savedTheme4 === 'light', `localStorage updated to "light" (got "${savedTheme4}")`);
    assert(toggleTitle4 === 'ডার্ক মোড চালু করুন', `Toggle button title updated to "ডার্ক মোড চালু করুন"`);

    // ----------------------------------------------------
    // TEST 5: Refresh preserves Light Mode
    // ----------------------------------------------------
    console.log('\n--- Test 5: Refresh preserves Light Mode ---');
    await page.reload({ waitUntil: 'networkidle' });

    const hasDarkClass5 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const savedTheme5 = await page.evaluate(() => localStorage.getItem('hidayah_theme'));
    const toggleTitle5 = await page.locator('button[aria-label="থিম পরিবর্তন"]').getAttribute('title');

    assert(!hasDarkClass5, 'After refresh: <html> retains light mode (no "dark" class)');
    assert(savedTheme5 === 'light', `After refresh: localStorage retains "light"`);
    assert(toggleTitle5 === 'ডার্ক মোড চালু করুন', `After refresh: toggle button retains "ডার্ক মোড চালু করুন" title`);

    // ----------------------------------------------------
    // TEST 6: OS preference isolation check
    // ----------------------------------------------------
    console.log('\n--- Test 6: OS preference isolation check ---');
    // Emulate dark color scheme at browser level
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => localStorage.removeItem('hidayah_theme'));
    await page.reload({ waitUntil: 'networkidle' });

    const hasDarkClass6 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const savedTheme6 = await page.evaluate(() => localStorage.getItem('hidayah_theme'));
    assert(!hasDarkClass6, 'When OS prefers dark mode, new visitor STILL gets Light Mode');
    assert(savedTheme6 === 'light', 'localStorage still defaults to "light" despite OS dark preference');

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
