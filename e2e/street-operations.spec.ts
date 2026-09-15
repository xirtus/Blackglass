import { expect, test, type Page } from '@playwright/test'

async function startStreet(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.goto('/')
  await page.getByTestId('pick-spectator').click()
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('map-canvas')).toBeVisible()
  await page.getByTestId('atlas-street').click()
  await expect(page.getByTestId('street-operations')).toBeVisible()
  await expect(page.getByTestId('street-operations')).toHaveAttribute('data-map-ready', 'true', { timeout: 15_000 })
  await expect(page.getByTestId('street-operative')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => page.locator('.person-target').count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(8)
}

async function visibleFramebufferPixels(page: Page) {
  return page.locator('.street-operations canvas').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return 0
    const width = Math.min(canvas.width, 96)
    const height = Math.min(canvas.height, 96)
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(Math.floor((canvas.width - width) / 2), Math.floor((canvas.height - height) / 2), width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let visible = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 45 && pixels[index + 3] > 0) visible++
    }
    return visible
  })
}

test.describe('street operations', () => {
  test('renders a playable animated street and resolves people at desktop and mobile sizes', async ({ page }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await startStreet(page, viewport)
      await expect.poll(() => visibleFramebufferPixels(page), { timeout: 15_000 }).toBeGreaterThan(150)

      await expect(page.getByTestId('street-dossier')).toContainText('DOX // RESOLVED', { timeout: 10_000 })
      await expect(page.getByTestId('street-dossier')).toContainText('WHAT THEY KNOW')
      await expect(page.getByTestId('street-dossier')).toContainText('PRIVATE MESSAGES')
      await expect(page.getByTestId('street-dossier')).toContainText('LINKED NETWORKS')

      const dossier = page.getByTestId('street-dossier')
      const box = await dossier.boundingBox()
      expect(box).not.toBeNull()
      expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1)
      expect((box?.y ?? -1) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height + 1)
      await page.locator('.map-canvas').screenshot({ path: `e2e/screenshots/street-${viewport.width}.png` })
    }
  })

  test('enters street operations directly from a city hotspot and returns to the atlas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.getByTestId('pick-blackglass').click()
    await page.getByTestId('start-game').click()
    await page.getByTestId('atlas-marker-dc-mall').click()
    await expect(page.getByTestId('street-operations')).toContainText('National Mall')
    const person = page.locator('.person-target:visible').first()
    await person.click({ force: true })
    await expect(page.getByTestId('street-dossier')).toContainText('DOX // RESOLVED')
    await page.getByTestId('street-exit').click()
    await expect(page.getByTestId('real-map-stage')).toBeVisible()
    await expect(page.getByTestId('atlas-caption')).toContainText('WASHINGTON DC')
  })
})
