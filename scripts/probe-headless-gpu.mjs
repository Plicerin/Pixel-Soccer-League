#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright-core'

const DEFAULT_PROBE_URL = 'http://127.0.0.1:3001/'

function parseArgs(argv) {
  const options = { url: DEFAULT_PROBE_URL }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--url') {
      options.url = argv[++i] || ''
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

async function isUrlReachable(url) {
  try {
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(2500) })
    return response.ok
  } catch {
    return false
  }
}

function findBrowserExecutable() {
  const override = process.env.HEADLESS_SIM_BROWSER
  const candidates = [
    override,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate)) || ''
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const executablePath = findBrowserExecutable()
  if (!executablePath) {
    throw new Error('No Chrome/Edge executable found. Set HEADLESS_SIM_BROWSER to probe a specific browser.')
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--use-angle=d3d11',
      '--enable-unsafe-webgpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,BackForwardCache',
    ],
  })

  try {
    const page = await browser.newPage()
    let probeUrl = 'about:blank'
    if (options.url && await isUrlReachable(options.url)) {
      probeUrl = options.url
      await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 10000 })
    }
    const result = await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      const debug = gl?.getExtension?.('WEBGL_debug_renderer_info')
      let webgpuAdapter = false
      if (navigator.gpu?.requestAdapter) {
        try {
          webgpuAdapter = Boolean(await navigator.gpu.requestAdapter())
        } catch {
          webgpuAdapter = false
        }
      }
      return {
        href: location.href,
        isSecureContext,
        userAgent: navigator.userAgent,
        webgl: Boolean(gl),
        webglVendor: gl && debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        webglRenderer: gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        webgpu: Boolean(navigator.gpu),
        webgpuAdapter,
      }
    })
    console.log(JSON.stringify({
      ok: true,
      executablePath,
      probeUrl,
      gpuHeadless: true,
      ...result,
    }, null, 2))
  } finally {
    await browser.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: {
      message: error.message || String(error),
    },
  }, null, 2))
  process.exit(1)
})
