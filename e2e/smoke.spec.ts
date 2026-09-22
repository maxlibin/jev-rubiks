import { expect, test } from '@playwright/test';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

test('the page loads a solved cube with no move buttons', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('facelets')).toHaveText(SOLVED);
  await expect(page.getByTestId('history-count')).toHaveText('0');
  await expect(page.locator('[data-testid^="move-"]')).toHaveCount(0);
});

test('dragging across a sticker applies exactly one move', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('#scene canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canvas not laid out');
  // Drag across F2 (the front face's top-centre sticker) so the top layer turns.
  const point = await page.evaluate(() => (window as unknown as { jevRubik: { projectFacelet(f: number): { x: number; y: number } } }).jevRubik.projectFacelet(19));
  const cx = box.x + point.x;
  const cy = box.y + point.y;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy, { steps: 4 });
  await page.mouse.move(cx + 80, cy, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId('history-count')).toHaveText('1');
  await expect(page.getByTestId('facelets')).not.toHaveText(SOLVED);
});

test('solve fast animates a scrambled cube back to solved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByTestId('scramble').click();
  await expect(page.getByTestId('history-count')).toHaveText('25');
  await page.waitForTimeout(2000);
  await page.getByTestId('solve-fast').click();
  await expect(page.getByTestId('facelets')).toHaveText(SOLVED, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('teach mode steps through a solution', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByTestId('scramble').click();
  await expect(page.getByTestId('history-count')).toHaveText('25');
  await page.waitForTimeout(2000);
  await page.getByTestId('solve-teach').click();
  await expect(page.getByTestId('step-info')).toContainText('Step 1 of');
  await page.getByTestId('step-play-all').click();
  await expect(page.getByTestId('facelets')).toHaveText(SOLVED, { timeout: 90_000 });
});
