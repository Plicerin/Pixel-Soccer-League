#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

function printHelp() {
  console.log(`Open a visible Chrome/Edge session with remote debugging enabled for sim:browser.

Usage:
  npm run browser:open -- --url "http://127.0.0.1:3001/"

Options:
  --url <url>     Initial page to open (default: http://127.0.0.1:3001/)
  --port <n>      Remote debugging port (default: 9222)
  --profile <p>   Custom user-data-dir (default: %TEMP%/psl-edge-debug)
  --help          Show this help`)
}

function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:3001/',
    port: 9222,
    profile: path.join(os.tmpdir(), 'psl-edge-debug'),
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--url') {
      options.url = argv[++i] || ''
    } else if (arg === '--port') {
      options.port = Number(argv[++i])
    } else if (arg === '--profile') {
      options.profile = argv[++i] || ''
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.help && (!Number.isFinite(options.port) || options.port <= 0)) {
    throw new Error('--port must be > 0')
  }

  return options
}

function findBrowserExecutable() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ].filter(Boolean)

  return candidates.find((entry) => fs.existsSync(entry)) || ''
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const executable = findBrowserExecutable()
  if (!executable) {
    throw new Error('Could not find Edge or Chrome on this machine')
  }

  fs.mkdirSync(options.profile, { recursive: true })

  const args = [
    `--remote-debugging-port=${Math.floor(options.port)}`,
    `--user-data-dir=${options.profile}`,
    options.url,
  ]

  const child = spawn(executable, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.unref()

  console.log(`Opened debug browser:`)
  console.log(`  exe: ${executable}`)
  console.log(`  cdp: http://127.0.0.1:${Math.floor(options.port)}`)
  console.log(`  url: ${options.url}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
