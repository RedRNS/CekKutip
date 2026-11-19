import { readFileSync } from 'node:fs'
import { readZip } from '../../../scripts/package-extension'
import { siteConfig } from '../src/site.config'
import { expect, test } from './helpers'

test.describe('the Extension page', () => {
  test('offers a download, and the file is the real extension built for this site', async ({
    page,
  }) => {
    await page.goto('/extension')
    const link = page.getByRole('link', { name: 'Download the extension (.zip)' })
    await expect(link).toHaveAttribute('href', '/downloads/cekkutip-extension.zip')

    const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
    expect(download.suggestedFilename()).toBe('cekkutip-extension.zip')
    const saved = await download.path()
    const entries = readZip(readFileSync(saved)) // throws if it is not a zip or is damaged
    const names = entries.map((e) => e.name)
    for (const must of ['manifest.json', 'panel.html', 'panel.js', 'background.js', 'bridge.js'])
      expect(names).toContain(must)
    expect(names.some((n) => n.startsWith('icons/'))).toBe(true)

    const manifest = JSON.parse(
      entries.find((e) => e.name === 'manifest.json')!.data.toString(),
    ) as {
      manifest_version: number
      name: string
      permissions: string[]
      host_permissions: string[]
      side_panel?: { default_path: string }
      action?: { default_popup?: string }
    }
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.name).toBe('CekKutip')
    // It asks for this one site and nothing broader.
    expect(manifest.host_permissions).toEqual([`${new URL(siteConfig.demoUrl).origin}/*`])
    expect(manifest.permissions.sort()).toEqual(['contextMenus', 'sidePanel', 'storage'])
    // A side panel, not a popup: a popup closes when the person clicks outside it.
    expect(manifest.side_panel?.default_path).toBe('panel.html')
    expect(manifest.action?.default_popup).toBeUndefined()
    expect(names).toContain(manifest.side_panel!.default_path)
  })

  test('gives the installation steps in order, with addresses in monospace and no stray markers', async ({
    page,
  }) => {
    await page.goto('/extension')
    const steps = page.getByRole('heading', { level: 3 })
    await expect(steps).toHaveText([
      /01\s+Download and unzip/,
      /02\s+Open the extensions page/,
      /03\s+Turn on Developer mode/,
      /04\s+Load the folder/,
      /05\s+Pin it to the toolbar/,
    ])
    await expect(page.locator('.mono', { hasText: 'chrome://extensions' })).toBeVisible()
    await expect(page.locator('.mono', { hasText: 'manifest.json' }).first()).toBeVisible()
    expect(await page.getByRole('main').innerText()).not.toContain('`')
  })

  test('names the menu item the extension really adds, and where requests go', async ({ page }) => {
    await page.goto('/extension')
    await expect(page.getByRole('main')).toContainText('choose "Check selection with CekKutip"')
    await expect(page.getByRole('main')).toContainText(new URL(siteConfig.demoUrl).host)
  })

  test('is reachable from the menu and from the Check page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Get the browser extension' }).click()
    await expect(page).toHaveURL(/\/extension$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Browser extension')

    await page.goto('/about')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await nav.getByRole('link', { name: 'Extension' }).click()
    await expect(nav.getByRole('link', { name: 'Extension' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('is available in Bahasa Indonesia, with the Indonesian menu name', async ({ page }) => {
    await page.goto('/extension')
    await page.getByRole('button', { name: 'Switch to Bahasa Indonesia' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ekstensi browser')
    await expect(page).toHaveTitle('Ekstensi browser · CekKutip')
    await expect(page.getByRole('link', { name: 'Unduh ekstensi (.zip)' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText(
      'pilih "Periksa teks terpilih dengan CekKutip"',
    )
  })

  test('a download that is not there answers 404, not the web page', async ({ request }) => {
    const res = await request.get('/downloads/not-here.zip')
    expect(res.status()).toBe(404)
    expect(res.headers()['content-type']).not.toContain('text/html')
  })
})
