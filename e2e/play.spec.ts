import { expect, test, type Page } from '@playwright/test';

// Drives a whole run through the real interface: title, setup, the narrator,
// story cards, dice, action drawers, rounds, until an ending or a step cap.
// Fails on any page error.

async function fresh(page: Page, textSpeed: 'fast' | 'normal' = 'fast') {
  await page.goto('./');
  await page.evaluate((speed) => {
    localStorage.clear();
    localStorage.setItem('coldwake.profile.v3', JSON.stringify({ settings: { textSpeed: speed } }));
  }, textSpeed);
  await page.reload();
}

/** Let the narrator finish, tapping it along, and deal with any card it tells. Returns false if there was nothing to do. */
async function settle(page: Page): Promise<boolean> {
  const tap = async (l: ReturnType<Page['locator']>) => l.click({ timeout: 2000 }).catch(() => undefined);
  if (await page.locator('.narrator.speaking').count()) {
    await tap(page.locator('.narrator.speaking'));
    return true;
  }
  if (await page.locator('.narrator.card-mode').count()) {
    const choices = page.locator('.narrator .choice');
    const cont = page.getByTestId('continue');
    if (await choices.count()) await tap(choices.first());
    else if (await cont.count()) await tap(cont);
    else await tap(page.locator('.card-view'));
    return true;
  }
  return false;
}

test('a run can be played from title to ending', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fresh(page);

  await page.getByRole('button', { name: 'New story' }).click();
  await expect(page.getByRole('heading', { name: 'Who wakes up?' })).toBeVisible();
  await page.locator('summary').click();
  await page.getByLabel('Ship seed').fill('E2E1');
  await page.getByTestId('wake').click();

  // The narrator sets the scene, then the opening card.
  await expect(page.getByTestId('narrator')).toBeVisible();
  await expect(page.getByTestId('continue')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('continue').click();
  await expect(page.getByText('Skip tips')).toBeVisible({ timeout: 20_000 });
  await page.getByText('Skip tips').click();

  await expect(page.locator('.minimap .shipmap')).toBeVisible();
  await expect(page.locator('.deck .die')).toHaveCount(3);

  let ended = false;
  const tap = async (l: ReturnType<typeof page.locator>) => {
    // The screen can change under the click (a card opens, the run ends): just go round again.
    await l.click({ timeout: 2000 }).catch(() => undefined);
  };
  for (let i = 0; i < 700; i++) {
    if (await page.locator('.ending').count()) {
      ended = true;
      break;
    }
    if (await settle(page)) continue;
    if (await page.locator('.deck.locked').count()) {
      await page.waitForTimeout(100);
      continue;
    }
    // Prefer objectives and moves, like a player heading for the exit would.
    let acted = false;
    for (const g of ['goal', 'danger', 'move', 'room', 'kit']) {
      if (g === 'room' && i % 3) continue;
      const tab = page.locator(`.tab[data-group=${g}]`);
      if (!(await tab.count())) continue;
      if (!(await page.locator(`.drawer.g-${g}`).count())) await tap(tab);
      const actions = page.locator(`.drawer.g-${g} .action:not([disabled])`);
      const n = await actions.count();
      if (!n) continue;
      await tap(actions.nth(i % n));
      acted = true;
      break;
    }
    if (!acted) await tap(page.getByTestId('end-round'));
  }
  expect(ended, 'the run reached an ending').toBe(true);
  // The epilogue is told; tap through it.
  await tap(page.locator('.epilogue.speaking'));
  await expect(page.getByTestId('again')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('the narrator writes at reading pace, and a tap says it all at once', async ({ page }) => {
  await fresh(page, 'normal');
  await page.getByRole('button', { name: 'New story' }).click();
  await page.getByTestId('wake').click();
  const line = page.locator('.narrator .line').first();
  await expect(line).toBeVisible();
  // Mid-sentence: some of it is still unwritten.
  await expect(page.locator('.narrator .unwritten').first()).not.toBeEmpty();
  await page.getByTestId('narrator').click();
  // The rest is said at once, so the opening card comes straight up.
  await expect(page.locator('.narrator.card-mode')).toBeVisible({ timeout: 2000 });
});

test('a run in progress survives a reload', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'New story' }).click();
  await page.getByTestId('wake').click();
  await expect(page.getByTestId('continue')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('continue').click();
  await page.getByText('Skip tips').click();
  const title = await page.getByTestId('room-name').innerText();
  await page.reload();
  await page.getByRole('button', { name: 'Continue your story' }).click();
  await expect(page.getByTestId('room-name')).toHaveText(title);
});
