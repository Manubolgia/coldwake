import { expect, test } from '@playwright/test';

// Drives a whole run through the real interface: title, setup, cards, dice,
// actions, rounds, until an ending or a step cap. Fails on any page error.

test('a run can be played from title to ending', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: 'New story' }).click();
  await expect(page.getByRole('heading', { name: 'Who wakes up?' })).toBeVisible();
  await page.locator('summary').click();
  await page.getByLabel('Ship seed').fill('E2E1');
  await page.getByTestId('wake').click();

  await expect(page.locator('.story')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Your dice', { exact: false })).toBeVisible();
  await page.getByText('Skip tips').click();

  await expect(page.locator('.shipmap')).toBeVisible();
  await expect(page.locator('.die')).toHaveCount(3);

  let ended = false;
  const tap = async (l: ReturnType<typeof page.locator>) => {
    // The screen can change under the click (a card opens, the run ends): just go round again.
    await l.click({ timeout: 2000 }).catch(() => undefined);
  };
  for (let i = 0; i < 500; i++) {
    if (await page.locator('.ending').count()) {
      ended = true;
      break;
    }
    if (await page.locator('.story').count()) {
      const choices = page.locator('.story .choice');
      if (await choices.count()) await tap(choices.first());
      else await tap(page.locator('.story').getByRole('button', { name: 'Continue' }));
      continue;
    }
    // Prefer objectives and moves, like a player heading for the exit would.
    const goal = page.locator('.group.goal .action:not([disabled])');
    const move = page.locator('.group.move .action:not([disabled])');
    const any = page.locator('.action:not([disabled])');
    const moves = await move.count();
    if (await goal.count()) await tap(goal.first());
    else if (moves && i % 3 !== 2) await tap(move.nth(i % moves));
    else if (await any.count()) await tap(any.first());
    else await tap(page.getByTestId('end-round'));
  }
  expect(ended, 'the run reached an ending').toBe(true);
  await expect(page.getByTestId('again')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a run in progress survives a reload', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'New story' }).click();
  await page.getByTestId('wake').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Skip tips').click();
  const title = await page.locator('.roompanel h2').innerText();
  await page.reload();
  await page.getByRole('button', { name: 'Continue your story' }).click();
  await expect(page.locator('.roompanel h2')).toHaveText(title);
});
