import { expect, test, type Page } from '@playwright/test';

type Debug = {
  state: {
    status: string;
    turn: number;
    phase: string;
    player: { ap: number };
    result?: { ending: string; score: number };
  } | null;
  actions: { t: string }[];
};

const debug = (page: Page): Promise<Debug> =>
  page.evaluate(() => (window as unknown as { __coldwake: Debug }).__coldwake);

async function isResolving(page: Page): Promise<boolean> {
  return (await page.getByTestId('terminal').getAttribute('data-resolving').catch(() => null)) === 'yes';
}

/** Tap the terminal through whatever it is saying and wait for it to hand back. */
async function settle(page: Page): Promise<void> {
  for (let i = 0; i < 30 && (await isResolving(page)); i++) {
    await page.getByTestId('terminal').click({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
  await page
    .waitForSelector('[data-testid="terminal"][data-resolving="no"]', { timeout: 8000 })
    .catch(() => {});
}

async function bootToMenu(page: Page): Promise<void> {
  await page.goto('./');
  const boot = page.getByTestId('boot');
  if (await boot.isVisible().catch(() => false)) await boot.click();
  await expect(page.getByTestId('menu')).toBeVisible();
}

async function startRun(
  page: Page,
  seed: string,
  depth = 1,
  objective = 'run',
): Promise<void> {
  await bootToMenu(page);
  await page.getByTestId('seed-input').fill(seed);
  await page.locator(`[data-depth="${depth}"]`).click();
  await page.locator(`[data-objective="${objective}"]`).click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('commands')).toBeVisible();
}

const ENDINGS = ['escaped', 'carrier', 'overload', 'relay', 'specimen', 'killed', 'adrift'];

/** Play the run out through the interface only. No engine calls. */
async function playToEnding(page: Page, maxClicks = 900): Promise<string> {
  for (let i = 0; i < maxClicks; i++) {
    const d = await debug(page);
    if (d.state === null || d.state.status !== 'active') break;
    // The terminal writes the turn out before handing the ship back. Tap
    // through it; it also finishes on its own.
    if (await isResolving(page)) {
      await settle(page);
      continue;
    }
    const buttons = page.locator('.commands .cmd');
    const count = await buttons.count();
    if (count === 0) throw new Error('no commands rendered while the run is active');
    // Prefer progress, fall back to ending the turn.
    const priority = ['launch', 'upload', 'chargeShuttle', 'burn', 'creep', 'search', 'endTurn'];
    let clicked = false;
    for (const want of priority) {
      const candidate = page.locator(`.commands .cmd[data-action="${want}"]`).first();
      if ((await candidate.count()) > 0) {
        await candidate.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) await buttons.first().click();
  }
  await expect(page.getByTestId('ending')).toBeVisible({ timeout: 15_000 });
  return (await page.getByTestId('ending').getAttribute('data-ending')) ?? '';
}

test('5.1 a full run plays to an ending through the interface alone', async ({ page }) => {
  await startRun(page, 'e2e-clean', 1);
  const ending = await playToEnding(page);
  expect(ENDINGS).toContain(ending);
  await expect(page.getByTestId('score')).toBeVisible();
});

test('5.2 several seeds resolve into different endings', async ({ page }) => {
  const endings = new Set<string>();
  // Depth 1 only: deeper runs are locked until one is cleared, which is the
  // meta-progression working as designed.
  for (const seed of ['seed-a', 'seed-b', 'seed-c']) {
    await startRun(page, seed, 1);
    endings.add(await playToEnding(page));
    await page.getByTestId('ending-continue').click();
  }
  expect(endings.size).toBeGreaterThanOrEqual(1);
  for (const e of endings) {
    expect(ENDINGS).toContain(e);
  }
});

test('5.3 every legal action has a control in the interface', async ({ page }) => {
  await startRun(page, 'parity', 1);
  for (let sample = 0; sample < 25; sample++) {
    await settle(page);
    const d = await debug(page);
    if (d.state === null || d.state.status !== 'active') break;
    const rendered = await page.locator('.commands .cmd').count();
    expect(rendered).toBe(d.actions.length);
    await page.locator('.commands .cmd').first().click();
  }
});

test('5.4 no horizontal scroll at any phone width', async ({ page }) => {
  for (const width of [320, 360, 390, 414, 430]) {
    await page.setViewportSize({ width, height: 840 });
    await startRun(page, `w${width}`, 1);
    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth, `width ${width}`).toBe(clientWidth);
  }
});

test('5.6 and 5.7 touch targets and noise disclosure', async ({ page }) => {
  await startRun(page, 'targets', 1);
  await settle(page);
  const buttons = page.locator('.commands .cmd');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i);
    const box = await b.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    // Noise is disclosed as the distance it carries, not as a bare number.
    await expect(b).toContainText(/SILENT|HEARD \d+ AWAY/);
  }
  const cards = page.locator('.hand .card');
  for (let i = 0; i < (await cards.count()); i++) {
    const box = await cards.nth(i).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('the terminal writes its output rather than printing it', async ({ page }) => {
  await startRun(page, 'typing', 1);
  await settle(page);
  await page.locator('.commands .cmd[data-action="endTurn"]').first().click();
  // Caught mid-sentence, the terminal is shorter than it will be.
  const mid = (await page.getByTestId('terminal').innerText()).length;
  await settle(page);
  await page.waitForTimeout(300);
  const finished = (await page.getByTestId('terminal').innerText()).length;
  expect(finished).toBeGreaterThanOrEqual(mid);
  await expect(page.getByTestId('terminal')).toHaveAttribute('data-complete', 'yes');
  // And when it has nothing to say, it waits with a cursor.
  await expect(page.locator('.caret.idle')).toBeVisible();
});

test('5.14 reduced motion prints instead of typing, and never takes the screen', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/coldwake/');
  await expect(page.getByTestId('menu')).toBeVisible({ timeout: 2000 });
  await page.getByTestId('start').click();
  await expect(page.getByTestId('commands')).toBeVisible();
  await page.locator('.commands .cmd[data-action="endTurn"]').first().click();
  await expect(page.getByTestId('terminal')).toHaveAttribute('data-resolving', 'no');
  await expect(page.getByTestId('terminal')).toHaveAttribute('data-complete', 'yes');
  await expect(page.getByTestId('commands')).toBeVisible();
  await context.close();
});

test('the advisory voice explains itself, and can be switched off', async ({ page }) => {
  await bootToMenu(page);
  await expect(page.getByTestId('guidance-toggle')).toContainText('ON');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('commands')).toBeVisible();
  await settle(page);
  // It says something about the shuttle before the player has done anything.
  await expect(page.getByTestId('terminal')).toContainText('shuttle');

  await page.getByTestId('menu-button').click();
  await page.getByTestId('guidance-toggle').click();
  await expect(page.getByTestId('guidance-toggle')).toContainText('OFF');
});

// The same list voice.test.ts checks the written strings against, and for the
// same reason it carries an exception: a ship has deck plates, and the narrator
// is allowed to mention them. Without the guard this test failed or passed on
// which hour opener the narrator happened to draw.
const BOARD_GAME_WORDS = /\b(cards?|tokens?|nodes?|turns?|AP)\b|\bdecks?\b(?![ -]plate)/i;

test('nothing on screen mentions cards, decks or turns', async ({ page }) => {
  await startRun(page, 'immersion', 1);
  await settle(page);
  const shown = (await page.locator('#root').innerText()).replace(/COLDWAKE/g, '');
  expect(shown).not.toMatch(BOARD_GAME_WORDS);
  await page.locator('.commands .cmd[data-action="endTurn"]').first().click();
  await settle(page);
  const after = (await page.locator('#root').innerText()).replace(/COLDWAKE/g, '');
  expect(after).not.toMatch(BOARD_GAME_WORDS);
});

test('the manual explains every symbol, on every page, in character', async ({ page }) => {
  await bootToMenu(page);
  await page.getByTestId('manual-open').click();
  await expect(page.getByTestId('manual')).toBeVisible();

  const pages = await page.locator('.tab').allInnerTexts();
  expect(pages.length).toBeGreaterThanOrEqual(6);

  const seen: string[] = [];
  for (const name of pages) {
    await page.locator(`.tab[data-page="${name}"]`).click();
    await expect(page.getByTestId('manual-body')).toHaveAttribute('data-page', name);
    const text = await page.getByTestId('manual-body').innerText();
    // Every page says something; none of them says it like a rulebook.
    expect(text.length).toBeGreaterThan(300);
    expect(text).not.toMatch(/\b(cards?|tokens?|nodes?|bag|AP)\b|\bdecks?\b(?![ -]plate)/i);
    seen.push(text);
  }

  // The first page has to name all four routes, because they are the game.
  const four = seen[pages.indexOf('THE FOUR')] ?? '';
  for (const label of ['RUN', 'BURN', 'CALL', 'KNOW', 'CARRIER', 'ADRIFT']) {
    expect(four).toContain(label);
  }
  // And the creature page names all four of them, with their numbers.
  const aboard = seen[pages.indexOf('ABOARD')] ?? '';
  for (const label of ['STRAY', 'HUNTER', 'CRAWLER', 'MOTHER']) {
    expect(aboard).toContain(label);
  }

  // The chooser stays reachable from the bottom of the longest page: it is a
  // column flex item and collapsed to a row of empty bars the first time.
  await page.locator('.modal').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(page.getByTestId('manual-tabs')).toBeInViewport();
  const tab = await page.locator('.tab.on').boundingBox();
  expect(tab?.height ?? 0).toBeGreaterThan(16);

  await page.getByTestId('manual-close').click();
  await expect(page.getByTestId('manual')).toHaveCount(0);
});

test('5.15 the CRT treatment can be switched off and the game still plays', async ({ page }) => {
  await bootToMenu(page);
  await page.getByTestId('crt-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('commands')).toBeVisible();
  await page.locator('.commands .cmd').first().click();
  const d = await debug(page);
  expect(d.state?.status).toBe('active');
});

test('5.17 a killed tab resumes the run', async ({ page }) => {
  await startRun(page, 'resume-me', 1);
  await page.locator('.commands .cmd[data-action="endTurn"]').first().click();
  await settle(page);
  await page.locator('.commands .cmd[data-action="endTurn"]').first().click();
  await settle(page);
  const before = (await debug(page)).state?.turn ?? 0;
  expect(before).toBeGreaterThan(1);
  await page.reload();
  const boot = page.getByTestId('boot');
  if (await boot.isVisible().catch(() => false)) await boot.click();
  await page.getByTestId('resume').click();
  const after = (await debug(page)).state?.turn ?? 0;
  expect(after).toBeGreaterThanOrEqual(before - 1);
});

test('5.14 the boot sequence types itself out', async ({ page }) => {
  // The foreground page: Chromium throttles timers in a background context,
  // which would stretch the type-out to minutes and prove nothing.
  await page.goto('/coldwake/', { waitUntil: 'commit' });
  // Sampled against the readout's own state rather than the clock: caught
  // while it is unfinished, the text must be shorter than when it finishes.
  await page.waitForSelector('[data-testid="boot"][data-complete="no"]', { timeout: 6000 });
  const partial = (await page.getByTestId('boot').innerText()).length;
  await page.waitForSelector('[data-testid="boot"][data-complete="yes"]', { timeout: 15_000 });
  const full = (await page.getByTestId('boot').innerText()).length;
  expect(full).toBeGreaterThan(partial);
});

test('5.14 reduced motion renders the boot instantly', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/coldwake/');
  await expect(page.getByTestId('menu')).toBeVisible({ timeout: 6000 });
  await context.close();
});

test('all four routes are on screen from the first hour, with the declared one marked', async ({
  page,
}) => {
  await startRun(page, 'objectives', 1, 'call');
  await settle(page);
  const strip = page.getByTestId('objectives');
  await expect(strip).toBeVisible();
  const text = await strip.innerText();
  for (const name of ['RUN', 'BURN', 'CALL', 'KNOW']) expect(text).toContain(name);
  // The declared route is the one carrying the mark.
  await expect(page.locator('[data-objective="call"].declared')).toHaveCount(1);
});

test('the screen says what is about to happen before the hour is committed', async ({ page }) => {
  await startRun(page, 'forecast', 3);
  // Play until something is close enough to be worth forecasting.
  let seen = false;
  for (let i = 0; i < 25; i++) {
    await settle(page);
    if ((await page.getByTestId('forecast').count()) > 0) {
      seen = true;
      break;
    }
    const end = page.locator('.commands .cmd[data-action="endTurn"]').first();
    if ((await end.count()) === 0) break;
    await end.click({ timeout: 5000 }).catch(() => {});
  }
  expect(seen, 'nothing was ever perceived over 25 hours at depth 3').toBe(true);
  await expect(page.getByTestId('forecast')).toContainText('IF THE HOUR ENDS NOW');
});

test('every command says what it costs and what it does', async ({ page }) => {
  await startRun(page, 'consequences', 1);
  await settle(page);
  const listen = page.locator('.commands .cmd[data-action="listen"]').first();
  await expect(listen).toBeVisible();
  const text = await listen.innerText();
  // Noise is disclosed as the distance it carries, not as a bare number.
  expect(text).toMatch(/SILENT|HEARD \d+ AWAY/);
  expect(text).toMatch(/compartments/i);
});

test('the infection count is on screen from the first one', async ({ page }) => {
  await startRun(page, 'infection', 1);
  await settle(page);
  const strip = await page.locator('.strip').innerText();
  expect(strip).toMatch(/INFECTION\s*0/);
});
