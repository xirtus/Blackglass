import { expect, test } from '@playwright/test'

test.describe('BLACKGLASS // HYDRA smoke suite', () => {
  test('launches to the title screen with both perspectives', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('title-screen')).toBeVisible()
    await expect(page.getByTestId('pick-blackglass')).toBeVisible()
    await expect(page.getByTestId('pick-hydra')).toBeVisible()
    await expect(page.getByTestId('pick-spectator')).toBeVisible()
  })

  test('BLACKGLASS run: workspace, panels, clock, intervention, save/load', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('pick-blackglass').click()
    await page.getByTestId('start-game').click()

    // Workspace mounts with the core panels.
    await expect(page.getByTestId('workspace')).toBeVisible()
    await expect(page.getByTestId('panel-brief')).toBeVisible()
    await expect(page.getByTestId('panel-watchIndex')).toBeVisible()
    await expect(page.getByTestId('panel-dossier')).toBeVisible()
    await expect(page.getByTestId('bottom-dock')).toBeVisible()
    await expect(page.getByTestId('panel-interventions')).toBeVisible()
    await expect(page.getByTestId('map-canvas')).toBeVisible()

    // Alert strip shows the scenario's opening alert.
    await expect(page.getByTestId('alert-strip')).toBeVisible()

    // Pause + speed via keyboard workflow.
    await page.keyboard.press(' ')
    await page.keyboard.press('2')

    // Watch Index: set a circle's coverage via its slider.
    const sliders = page.locator('.watch-ctls input[type="range"]')
    await sliders.first().fill('60')

    // Open the command palette and select a person.
    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
    await page.getByTestId('command-palette').locator('.palette-input').fill('Maya')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('command-palette')).toBeHidden()

    // Authorize an affordable intervention against the selected target.
    const authorize = page.locator('.intervention-card button').first()
    await expect(authorize).toBeEnabled({ timeout: 15_000 })
    await authorize.click()

    // Save, reload, resume.
    await page.keyboard.press('Meta+k')
    await page.getByTestId('command-palette').locator('.palette-input').fill('Save game')
    await page.keyboard.press('Enter')
    await expect(page.locator('.title-screen')).toBeHidden()

    // Screenshot regression for the workstation layout.
    await page.screenshot({ path: 'e2e/screenshots/workspace-blackglass.png', fullPage: true })
  })

  test('HYDRA run: trusted network visible, Watch Index absent (perspective isolation)', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('pick-hydra').click()
    await page.getByTestId('start-game').click()

    await expect(page.getByTestId('workspace')).toBeVisible()
    await expect(page.getByTestId('panel-trustedNetwork')).toBeVisible()

    // Strict isolation: the HYDRA workspace must not contain the Watch
    // Index, sensor observations or BLACKGLASS resources.
    await expect(page.getByTestId('panel-watchIndex')).toHaveCount(0)
    await expect(page.getByTestId('panel-resources')).toHaveCount(0)
    await expect(page.getByTestId('panel-hypotheses')).toHaveCount(0)
    await expect(page.locator('.watch-ctls input[type="range"]')).toHaveCount(0)

    // HYDRA action drawer exists with disclosure commands.
    await expect(page.getByTestId('panel-interventions')).toContainText('DISCLOSURE ACTIONS')
    await expect(page.locator('.hydra-actions button').first()).toBeVisible()

    await page.screenshot({ path: 'e2e/screenshots/workspace-hydra.png', fullPage: true })
  })

  test('end-to-end HYDRA disclosure loop: duplicate → authenticate → release', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('pick-hydra').click()
    await page.getByTestId('start-game').click()

    // Duplicate as excerpt (local), authenticate, release limited.
    await page.locator('.hydra-actions button', { hasText: 'DUPLICATE AS EXCERPT' }).first().click()
    await page.locator('.hydra-actions button', { hasText: 'CORROBORATE' }).first().click()
    await page.locator('.hydra-actions button', { hasText: 'LIMITED RELEASE' }).first().click()

    // A release event must appear in the shared event timeline.
    await page.getByTestId('dock-timeline').click()
    await expect(page.getByTestId('panel-timeline')).toContainText('RELEASE', { timeout: 10_000 })

    await page.screenshot({ path: 'e2e/screenshots/hydra-released.png', fullPage: true })
  })

  test('AI vs AI watch: launches, swaps workstations, and advances itself', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('pick-spectator').click()
    await page.getByTestId('start-game').click()

    await expect(page.getByTestId('workspace')).toBeVisible()
    await expect(page.getByTestId('spectator-switch')).toBeVisible()
    await expect(page.getByTestId('topbar')).toContainText('AI WATCH')
    await expect(page.getByTestId('panel-watchIndex')).toBeVisible()
    await expect(page.getByTestId('panel-osint')).toBeVisible()
    await expect(page.locator('.clock')).not.toHaveText('00:00:00', { timeout: 5_000 })

    await page.getByRole('button', { name: 'HYDRA VIEW' }).click()
    await expect(page.getByTestId('panel-trustedNetwork')).toBeVisible()
    await expect(page.getByTestId('panel-watchIndex')).toHaveCount(0)

    await page.getByRole('button', { name: 'BLACKGLASS VIEW' }).click()
    await page.getByTestId('dock-timeline').click()
    await expect(page.getByTestId('panel-timeline')).toContainText(/COPY|OBSERVATION|PUBLIC|SIM_INFO/, { timeout: 15_000 })

    await page.screenshot({ path: 'e2e/screenshots/ai-watch.png', fullPage: true })
  })
})
