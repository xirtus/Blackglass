import { expect, test, type Page } from '@playwright/test'

async function atlasStats(page: Page) {
  return page.evaluate(() => {
    const map = document.querySelector('.map-canvas') as HTMLElement | null
    const firstTile = document.querySelector('.real-map-tile') as HTMLImageElement | null
    return {
      width: map?.clientWidth ?? 0,
      height: map?.clientHeight ?? 0,
      tileCount: document.querySelectorAll('.real-map-tile').length,
      markerCount: document.querySelectorAll('.atlas-marker').length,
      cctvCount: document.querySelectorAll('.cctv-node').length,
      viewshedCount: document.querySelectorAll('.camera-viewshed').length,
      signalCount: document.querySelectorAll('.signal-marker').length,
      massingCount: document.querySelectorAll('.city-extrusion').length,
      orbitVisible: Boolean(document.querySelector('[data-testid="world-orbit-overlay"]')),
      roomZoneCount: document.querySelectorAll('.room-zone').length,
      firstTileSrc: firstTile?.src ?? '',
      caption: document.querySelector('[data-testid="atlas-caption"]')?.textContent ?? '',
      bearing: document.querySelector('[data-testid="real-map-stage"]')?.getAttribute('data-bearing') ?? '',
      center: document.querySelector('[data-testid="real-map-stage"]')?.getAttribute('data-center') ?? '',
    }
  })
}

async function startSpectator(page: Page) {
  await page.goto('/')
  await page.getByTestId('pick-spectator').click()
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('map-canvas')).toBeVisible()
  await expect(page.locator('.clock')).not.toHaveText('00:00:00', { timeout: 5_000 })
}

test.describe('authentic atlas map experience', () => {
  test('renders real city, room, and world atlas surfaces', async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900, name: 'desktop' },
      { width: 390, height: 844, name: 'mobile' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await startSpectator(page)

      await page.getByTestId('atlas-city').click()
      await expect(page.getByTestId('atlas-caption')).toContainText('WASHINGTON DC')
      await expect(page.getByTestId('atlas-city-dc')).toHaveClass(/active/)
      await page.locator('.map-canvas').screenshot({ path: `e2e/screenshots/map-${viewport.name}-city.png` })
      const cityStats = await atlasStats(page)
      expect(cityStats.width).toBeGreaterThan(100)
      expect(cityStats.height).toBeGreaterThan(100)
      expect(cityStats.tileCount).toBeGreaterThan(12)
      expect(cityStats.markerCount).toBeGreaterThanOrEqual(4)
      expect(cityStats.cctvCount).toBeGreaterThanOrEqual(3)
      expect(cityStats.viewshedCount).toBeGreaterThanOrEqual(3)
      expect(cityStats.massingCount).toBeGreaterThanOrEqual(4)
      expect(cityStats.firstTileSrc).toContain('tiles.stadiamaps.com')
      await page.getByTestId('layer-stack-toggle').click()
      await expect(page.getByTestId('atlas-layer-stack')).toContainText('CCTV')
      await page.getByTestId('sensor-thermal').click()
      await expect(page.locator('.real-map-shell')).toHaveClass(/sensor-thermal/)

      await page.getByTestId('atlas-room').click()
      await expect(page.getByTestId('atlas-caption')).toContainText('INTERNAL RECORDS-ROOM SCHEMATIC')
      await expect(page.getByTestId('room-blueprint')).toBeVisible()
      await page.locator('.map-canvas').screenshot({ path: `e2e/screenshots/map-${viewport.name}-room.png` })
      const roomStats = await atlasStats(page)
      expect(roomStats.roomZoneCount).toBeGreaterThanOrEqual(6)

      await page.getByTestId('atlas-world').click()
      await expect(page.getByTestId('atlas-caption')).toContainText('WORLD OSINT ATLAS')
      await page.locator('.map-canvas').screenshot({ path: `e2e/screenshots/map-${viewport.name}-world.png` })
      const worldStats = await atlasStats(page)
      expect(worldStats.tileCount).toBeGreaterThan(8)
      expect(worldStats.markerCount).toBeGreaterThanOrEqual(7)
      expect(worldStats.cctvCount).toBeGreaterThanOrEqual(10)
      expect(worldStats.orbitVisible).toBe(true)
      expect(worldStats.firstTileSrc).toContain('tiles.stadiamaps.com')
      await expect(page.getByTestId('camera-access-panel')).toContainText('CCTV ACCESS')
    }
  })

  test('CCTV and viewshed layers can be toggled like an OSINT dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await startSpectator(page)
    await expect(page.getByTestId('camera-access-panel')).toContainText('CCTV ACCESS')
    await expect(page.getByTestId('camera-source-row')).toContainText('DCGIS')
    await expect(page.getByTestId('camera-source-link')).toHaveAttribute('href', /data\.gov|dc\.gov|opencctv\.org/)
    await page.getByTestId('layer-stack-toggle').click()
    await expect.poll(async () => page.locator('.cctv-node').count()).toBeGreaterThanOrEqual(3)
    await expect.poll(async () => page.locator('.camera-viewshed').count()).toBeGreaterThanOrEqual(3)
    const firstCameraLabel = await page.locator('.camera-feed').first().locator('span').textContent()
    const clickableCameraId = await page.evaluate(() => {
      const cameras = [...document.querySelectorAll<HTMLElement>('.cctv-node')]
      for (const camera of cameras) {
        const rect = camera.getBoundingClientRect()
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        if (target === camera || camera.contains(target)) return camera.dataset.testid ?? ''
      }
      return ''
    })
    expect(clickableCameraId).not.toBe('')
    const clickableLabel = await page.locator(`[data-testid="${clickableCameraId}"]`).getAttribute('aria-label')
    const cameraName = clickableLabel?.replace(/^Open /, '').replace(/ camera feed$/, '') ?? ''
    await page.locator(`[data-testid="${clickableCameraId}"]`).click()
    await expect(page.getByTestId('camera-current-row')).toContainText(cameraName)
    expect(await page.getByTestId('camera-current-row').textContent()).not.toBe(firstCameraLabel)
    const listCameraLabel = await page.locator('.camera-feed').last().locator('span').textContent()
    await page.locator('.camera-feed').last().click()
    await expect(page.getByTestId('camera-current-row')).toContainText(listCameraLabel ?? '')
    await page.getByTestId('layer-viewshed').click()
    await expect(page.locator('.camera-viewshed')).toHaveCount(0)
    await page.getByTestId('layer-cctv').click()
    await expect(page.locator('.cctv-node')).toHaveCount(0)
  })

  test('public camera feeds render real media when the source exposes it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await startSpectator(page)

    await page.getByTestId('atlas-city-london').click()
    await expect(page.getByTestId('camera-access-panel')).toContainText('CCTV ACCESS')
    await expect(page.locator('[data-testid="camera-real-video"], [data-testid="camera-real-image"]')).toBeVisible()
    await expect(page.getByTestId('camera-feed-view')).not.toContainText('NO PUBLIC MEDIA URL')
    await expect(page.getByTestId('camera-current-row')).toBeVisible()

    await page.getByTestId('atlas-city-telaviv').click()
    await page.getByTestId('camera-feed-cam-tlv-yarkon').click()
    await expect(page.getByTestId('camera-real-hls')).toBeVisible()
    await expect(page.getByTestId('camera-current-row')).toContainText('REAL HLS')
  })

  test('world, city, and records-room drill-downs are direct clicks', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await startSpectator(page)
    await page.getByTestId('atlas-world').click()
    await page.getByTestId('atlas-marker-london').click()
    await expect(page.getByTestId('atlas-caption')).toContainText('LONDON')
    await page.getByTestId('atlas-marker-lon-records').click()
    await expect(page.getByTestId('atlas-caption')).toContainText('THAMES STACK')
    await expect(page.getByTestId('room-node-records')).toBeVisible()
  })

  test('city map exposes direct cursor rotation and pan affordances', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await startSpectator(page)
    const stage = page.getByTestId('real-map-stage')
    await expect(stage).toHaveCSS('cursor', 'alias')
    const beforeBearing = await stage.getAttribute('data-bearing')
    const box = await stage.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move((box?.x ?? 0) + 360, (box?.y ?? 0) + 360)
    await page.mouse.down()
    await page.mouse.move((box?.x ?? 0) + 760, (box?.y ?? 0) + 420)
    await page.mouse.up()
    await expect(stage).not.toHaveAttribute('data-bearing', beforeBearing ?? '')

    await page.getByTestId('map-mode-pan').click()
    await expect(stage).toHaveCSS('cursor', 'grab')
    const beforeCenter = await stage.getAttribute('data-center')
    await page.mouse.move((box?.x ?? 0) + 440, (box?.y ?? 0) + 430)
    await page.mouse.down()
    await page.mouse.move((box?.x ?? 0) + 340, (box?.y ?? 0) + 480)
    await page.mouse.up()
    await expect(stage).not.toHaveAttribute('data-center', beforeCenter ?? '')
  })
})
