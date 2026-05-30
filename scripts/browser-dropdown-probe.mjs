import { chromium } from 'playwright-core';

const endpoint = process.env.PSL_CDP_ENDPOINT || 'http://127.0.0.1:9222';
const appUrl = process.env.PSL_APP_URL || 'http://127.0.0.1:3001/';

function withProbeParam(url) {
  const parsed = new URL(url);
  parsed.searchParams.set('dropdownProbe', String(Date.now()));
  return parsed.toString();
}

async function findExistingAppPage(browser) {
  const pages = browser.contexts().flatMap((context) => context.pages());
  return pages.find((page) => /https?:\/\/(127\.0\.0\.1|localhost):3001\b/.test(page.url())) ?? null;
}

async function dismissSplash(page) {
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(300);
  await page.mouse.click(24, 24).catch(() => {});
}

async function main() {
  const browser = await chromium.connectOverCDP(endpoint);
  try {
    const page = await findExistingAppPage(browser);
    if (!page) {
      throw new Error(`No existing PSL page found on port 3001 through ${endpoint}. I did not open a new browser tab.`);
    }

    console.log('[dropdown-probe] using existing page', page.url());
    await page.bringToFront();
    await page.goto(withProbeParam(appUrl), { waitUntil: 'domcontentloaded' });
    console.log('[dropdown-probe] app loaded');
    await dismissSplash(page);
    await page.waitForSelector('[data-psl-main-menu="world-cup"]', { timeout: 15000 });
    console.log('[dropdown-probe] main menu visible');

    const mainAway = page.locator('[data-psl-menu-team-select="away"]');
    await mainAway.waitFor({ timeout: 5000 });
    const currentAway = (await mainAway.textContent())?.replace(/[▲▼]/g, '').trim() ?? '';
    await mainAway.click({ timeout: 5000 });
    const mainAwayMenu = page.locator('[data-psl-menu-team-menu="away"]');
    await mainAwayMenu.waitFor({ timeout: 5000 });
    const awayValues = await page.locator('[data-psl-menu-team-option="away"]').evaluateAll((options) =>
      options.map((option) => option.textContent?.trim() || '').filter(Boolean),
    );
    const targetMainAway = awayValues.find((option) => option !== currentAway) ?? awayValues[0];
    if (!targetMainAway) throw new Error('Main-menu away team dropdown has no options.');
    await page.locator('[data-psl-menu-team-option="away"]').filter({ hasText: targetMainAway }).first().click({ timeout: 5000 });
    const changedMainAway = (await mainAway.textContent())?.replace(/[▲▼]/g, '').trim() ?? '';
    if (changedMainAway !== targetMainAway) {
      throw new Error(`Main-menu away dropdown did not update: expected ${targetMainAway}, got ${changedMainAway}`);
    }
    console.log('[dropdown-probe] main away changed', changedMainAway);

    const cpuButton = page.getByRole('button', { name: /cpu\s+vs\s+cpu/i });
    await cpuButton.click({ timeout: 5000 });
    console.log('[dropdown-probe] cpu setup opened');
    const preAwayButton = page.locator('[data-psl-select="prematch-team-B"]');
    await preAwayButton.waitFor({ timeout: 10000 });
    const beforePreAway = (await preAwayButton.textContent())?.replace(/[▲▼]/g, '').trim() ?? '';
    await preAwayButton.click({ timeout: 5000 });
    const preAwayMenu = page.locator('[data-psl-custom-dropdown-menu="prematch-team-B"]');
    await preAwayMenu.waitFor({ timeout: 5000 });
    const optionTexts = await page.locator('[data-psl-custom-dropdown-option="prematch-team-B"]').evaluateAll((options) =>
      options.map((option) => option.textContent?.trim() || '').filter(Boolean),
    );
    const targetPreAway = optionTexts.find((option) => option !== beforePreAway) ?? optionTexts[0];
    if (!targetPreAway) throw new Error('Pre-match away dropdown has no options.');
    await page.locator('[data-psl-custom-dropdown-option="prematch-team-B"]').filter({ hasText: targetPreAway }).first().click({ timeout: 5000 });
    const afterPreAway = (await preAwayButton.textContent())?.replace(/[▲▼]/g, '').trim() ?? '';
    if (afterPreAway !== targetPreAway) {
      throw new Error(`Pre-match away dropdown did not update: expected ${targetPreAway}, got ${afterPreAway}`);
    }
    console.log('[dropdown-probe] prematch away changed', afterPreAway);

    const homeButton = page.locator('[data-psl-select="prematch-team-A"]');
    const homeText = (await homeButton.textContent())?.replace(/[▲▼]/g, '').trim() ?? '';
    console.log(JSON.stringify({
      ok: true,
      mainAway: changedMainAway,
      preMatchHome: homeText,
      preMatchAway: afterPreAway,
      existingPageUrl: page.url(),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
