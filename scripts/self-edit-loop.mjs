#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const DEFAULT_OUT_ROOT = path.join('telemetry', 'self-edit')
const MAX_CHANGED_LINES = 80

const RECIPES = {
  'deeper-box-cover': {
    title: 'Deeper physical box cover',
    reason: 'Empty-box shots or low shot-corridor defenders indicate assignment is firing but bodies are not arriving in the lane.',
    files: ['src/ai/fsmPositioning.ts', 'src/gameEngine.ts'],
    replacements: [
      {
        file: 'src/ai/fsmPositioning.ts',
        from: 'const centralShotThreat = Math.abs(ballPos.z) <= goalMouthHalfWidth * 7.0;',
        to: 'const centralShotThreat = Math.abs(ballPos.z) <= goalMouthHalfWidth * 8.0;',
      },
      {
        file: 'src/ai/fsmPositioning.ts',
        from: 'const boxEdgeThreat = distToOwnGoal <= penaltyDepth + 18;',
        to: 'const boxEdgeThreat = distToOwnGoal <= penaltyDepth + 24;',
      },
      {
        file: 'src/ai/fsmPositioning.ts',
        from: 'const urgentCentralThreat = distToOwnGoal <= penaltyDepth + 11 && Math.abs(ballPos.z) <= goalMouthHalfWidth * 5.0;',
        to: 'const urgentCentralThreat = distToOwnGoal <= penaltyDepth + 15 && Math.abs(ballPos.z) <= goalMouthHalfWidth * 5.8;',
      },
      {
        file: 'src/ai/fsmPositioning.ts',
        from: 'const coverCount = urgentCentralThreat ? 4 : 3;',
        to: 'const coverCount = urgentCentralThreat ? 5 : 4;',
      },
      {
        file: 'src/ai/fsmPositioning.ts',
        from: 'x: ballPos.x + towardGoal * (2.8 + Math.min(idx, 3) * 1.05),',
        to: 'x: ballPos.x + towardGoal * (4.6 + Math.min(idx, 3) * 0.9),',
      },
      {
        file: 'src/gameEngine.ts',
        from: ": (fsmTarget.owner === 'BOX_COVER' ? THREE.MathUtils.clamp(dist / 4.2, 1.85, 2.85) : 1.0);",
        to: ": (fsmTarget.owner === 'BOX_COVER' ? THREE.MathUtils.clamp(dist / 3.6, 2.10, 3.20) : 1.0);",
      },
      {
        file: 'src/gameEngine.ts',
        from: ": fsmTarget.owner === 'BOX_COVER' ? 24.0",
        to: ": fsmTarget.owner === 'BOX_COVER' ? 30.0",
      },
    ],
  },
  'max-width': {
    title: 'Push wide model to upper bound',
    reason: 'Width or center+narrow telemetry has not moved enough, so use a material change instead of incremental nudges.',
    files: ['src/ai/fsmPositioning.ts', 'src/ai/structuredAttack.ts'],
    replacements: [
      {
        file: 'src/ai/fsmPositioning.ts',
        from: '? fieldDepth * 0.56',
        to: '? fieldDepth * 0.60',
      },
      {
        file: 'src/ai/fsmPositioning.ts',
        from: 'z: carrierSide * Math.max(goalMouthHalfWidth * 4.8, fieldDepth * 0.54),',
        to: 'z: carrierSide * Math.max(goalMouthHalfWidth * 5.2, fieldDepth * 0.58),',
      },
      {
        file: 'src/ai/structuredAttack.ts',
        from: 'z = side * Math.max(Math.abs(player.homePos?.z ?? 0), fieldDepth * 0.56);',
        to: 'z = side * Math.max(Math.abs(player.homePos?.z ?? 0), fieldDepth * 0.60);',
      },
      {
        file: 'src/ai/structuredAttack.ts',
        from: 'const targetZ = state.carrierSide * Math.max(homeWide, Math.abs(carrier.pos.z), fieldDepth * 0.54);',
        to: 'const targetZ = state.carrierSide * Math.max(homeWide, Math.abs(carrier.pos.z), fieldDepth * 0.58);',
      },
    ],
  },
  'cross-volume': {
    title: 'Earlier wide delivery',
    reason: 'Wide shape exists but corner/cross production is low, so move the structured carrier delivery gate earlier.',
    files: ['src/ai/structuredAttack.ts'],
    replacements: [
      {
        file: 'src/ai/structuredAttack.ts',
        from: '&& distToGoal < penaltyDepth + 22;',
        to: '&& distToGoal < penaltyDepth + 28;',
      },
      {
        file: 'src/ai/structuredAttack.ts',
        from: 'const deliveryX = goalX - state.attackSign * (penaltyDepth + 17);',
        to: 'const deliveryX = goalX - state.attackSign * (penaltyDepth + 21);',
      },
    ],
  },
}

function parseArgs(argv) {
  const options = {
    findings: '',
    outDir: '',
    intervention: 'auto',
    apply: false,
    validate: false,
    maxChangedLines: MAX_CHANGED_LINES,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--findings') options.findings = argv[++i] || ''
    else if (arg === '--out-dir') options.outDir = argv[++i] || ''
    else if (arg === '--intervention') options.intervention = (argv[++i] || '').trim()
    else if (arg === '--apply') options.apply = true
    else if (arg === '--validate') options.validate = true
    else if (arg === '--max-changed-lines') options.maxChangedLines = Number(argv[++i])
    else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isFinite(options.maxChangedLines) || options.maxChangedLines <= 0) {
    throw new Error('--max-changed-lines must be > 0')
  }
  if (options.intervention !== 'auto' && options.intervention !== 'none' && !RECIPES[options.intervention]) {
    throw new Error(`Unknown intervention: ${options.intervention}`)
  }
  return options
}

function printHelp() {
  console.log(`Self-edit tuning controller

Usage:
  npm run self-edit:loop -- --findings telemetry/overnight/.../overnight-findings.json
  npm run self-edit:loop -- --findings telemetry/overnight/.../overnight-findings.json --apply --validate

Options:
  --findings <path>          Overnight findings JSON. Defaults to newest overnight-findings.json under telemetry.
  --intervention <name>      auto, none, deeper-box-cover, max-width, cross-volume.
  --apply                   Apply the allowlisted code patch. Omit for proposal-only mode.
  --validate                After apply, run npm test, npm run lint, and npm run build.
  --max-changed-lines <n>    Revert if the patch exceeds this line budget (default: ${MAX_CHANGED_LINES}).
  --out-dir <path>           Output directory for proposal, patch log, and validation log.

Safety:
  - No match simulations are started by this script.
  - Proposal-only is the default.
  - Apply mode can only use named, allowlisted replacement recipes.
  - Source files are backed up before writes and restored if a guard fails.
`)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function findNewestFindings() {
  const root = path.resolve(process.cwd(), 'telemetry')
  const candidates = []
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.isFile() && entry.name === 'overnight-findings.json') {
        candidates.push({ path: p, mtimeMs: fs.statSync(p).mtimeMs })
      }
    }
  }
  walk(root)
  const usable = candidates.filter((candidate) => {
    try {
      const findings = readJson(candidate.path)
      return Number(findings.analyzedCycles ?? 0) > 0
    } catch {
      return false
    }
  })
  usable.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return usable[0]?.path || ''
}

function chooseIntervention(findings) {
  const kpis = findings?.averages?.kpis || {}
  const structure = findings?.averages?.structure || {}
  const efficiency = findings?.averages?.efficiency || {}
  const drift = findings?.baselineComparison || {}

  const emptyBox = Number(structure.emptyBoxShotPct ?? 0)
  const corridor = Number(structure.shotCorridorDefenders ?? 0)
  const dangerMarked = Number(structure.dangerMarkedPct ?? 100)
  if (emptyBox > 35 || corridor < 1.2 || dangerMarked < 78) {
    return { key: 'deeper-box-cover', confidence: 'high' }
  }

  const widthA = Number(structure.widthA ?? 0)
  const widthB = Number(structure.widthB ?? 0)
  const centerWorst = Number(structure.centerAndNarrowWorst ?? 0)
  if (Math.min(widthA, widthB) < 20 || centerWorst > 35) {
    return { key: 'max-width', confidence: 'medium' }
  }

  const realCrosses = Number(structure.realCrosses ?? 0)
  const cornerDrift = Number(drift.corners?.drift ?? 0)
  if (realCrosses < 5 || cornerDrift < -3) {
    return { key: 'cross-volume', confidence: 'medium' }
  }

  if (Number(kpis.tuningEfficiency ?? 100) < 72 || Number(efficiency.directBlockerPasses ?? 0) > 3) {
    return { key: 'none', confidence: 'low', reason: 'Efficiency guardrail is weak; fix decision quality manually before changing spatial model.' }
  }

  return { key: 'none', confidence: 'low', reason: 'No intervention crossed a material-change threshold.' }
}

function buildProposal(options, findingsPath, findings) {
  if (Number(findings?.analyzedCycles ?? 0) <= 0) {
    throw new Error(`Findings contain no analyzed cycles: ${findingsPath}`)
  }
  const selected = options.intervention === 'auto'
    ? chooseIntervention(findings)
    : { key: options.intervention, confidence: 'manual' }
  const recipe = RECIPES[selected.key] || null
  return {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'proposal-only',
    findingsPath,
    selected,
    recipe: recipe ? {
      key: selected.key,
      title: recipe.title,
      reason: recipe.reason,
      files: recipe.files,
      replacementCount: recipe.replacements.length,
    } : null,
    guardrails: {
      maxChangedLines: options.maxChangedLines,
      noMatchSimulations: true,
      applyRequiresFlag: true,
      validation: options.validate ? ['npm test', 'npm run lint', 'npm run build'] : [],
    },
    kpis: findings?.averages?.kpis || {},
    structure: findings?.averages?.structure || {},
    efficiency: findings?.averages?.efficiency || {},
    baselineComparison: findings?.baselineComparison || {},
  }
}

function applyRecipe(recipe, outDir, maxChangedLines) {
  const backups = new Map()
  const changes = []
  try {
    for (const replacement of recipe.replacements) {
      const filePath = path.resolve(process.cwd(), replacement.file)
      const before = fs.readFileSync(filePath, 'utf8')
      if (!backups.has(filePath)) {
        backups.set(filePath, {
          relativePath: replacement.file,
          before,
          hash: hashText(before),
        })
      }
      const matches = before.split(replacement.from).length - 1
      if (matches !== 1) {
        throw new Error(`${replacement.file}: expected exactly one match for replacement, found ${matches}`)
      }
      const after = before.replace(replacement.from, replacement.to)
      fs.writeFileSync(filePath, after)
      changes.push({ file: replacement.file, from: replacement.from, to: replacement.to })
    }

    const changedLines = estimateChangedLines([...backups.entries()])
    if (changedLines > maxChangedLines) {
      throw new Error(`Patch changed ${changedLines} lines, above budget ${maxChangedLines}`)
    }

    const backupDir = path.join(outDir, 'backups')
    for (const backup of backups.values()) {
      const backupPath = path.join(backupDir, `${backup.relativePath}.bak`)
      fs.mkdirSync(path.dirname(backupPath), { recursive: true })
      fs.writeFileSync(backupPath, backup.before)
    }
    return {
      applied: true,
      changedLines,
      changes,
      backups: [...backups.values()].map(({ relativePath, hash }) => ({ relativePath, hash })),
    }
  } catch (error) {
    for (const [filePath, backup] of backups.entries()) {
      fs.writeFileSync(filePath, backup.before)
    }
    return {
      applied: false,
      error: error instanceof Error ? error.message : String(error),
      restoredFiles: [...backups.values()].map((backup) => backup.relativePath),
      changes,
    }
  }
}

function estimateChangedLines(backupEntries) {
  let changed = 0
  for (const [filePath, backup] of backupEntries) {
    const before = backup.before.split(/\r?\n/u)
    const after = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)
    const max = Math.max(before.length, after.length)
    for (let i = 0; i < max; i++) {
      if (before[i] !== after[i]) changed += 1
    }
  }
  return changed
}

function runCommand(command, args, logPath) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      output += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      output += text
      process.stderr.write(text)
    })
    child.on('close', (code) => {
      fs.appendFileSync(logPath, `\n$ ${command} ${args.join(' ')}\nexit ${code}\n${output}\n`)
      resolve({ command, args, code })
    })
  })
}

async function validate(outDir) {
  const logPath = path.join(outDir, 'validation.log')
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const commands = [
    [npmCommand, ['test']],
    [npmCommand, ['run', 'lint']],
    [npmCommand, ['run', 'build']],
  ]
  const results = []
  for (const [command, args] of commands) {
    results.push(await runCommand(command, args, logPath))
    if (results[results.length - 1].code !== 0) break
  }
  return {
    logPath,
    passed: results.every((result) => result.code === 0),
    results,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.resolve(process.cwd(), options.outDir || path.join(DEFAULT_OUT_ROOT, stamp))
  fs.mkdirSync(outDir, { recursive: true })

  const findingsPath = path.resolve(process.cwd(), options.findings || findNewestFindings())
  if (!findingsPath || !fs.existsSync(findingsPath)) {
    throw new Error('No findings JSON found. Run the overnight evaluator first or pass --findings <path>.')
  }
  const findings = readJson(findingsPath)
  const proposal = buildProposal(options, findingsPath, findings)
  writeJson(path.join(outDir, 'proposal.json'), proposal)

  const md = [
    '# Self-Edit Proposal',
    '',
    `Generated: ${proposal.generatedAt}`,
    `Mode: ${proposal.mode}`,
    `Findings: ${proposal.findingsPath}`,
    '',
    `Selected: ${proposal.selected.key}`,
    `Confidence: ${proposal.selected.confidence}`,
    proposal.recipe ? `Recipe: ${proposal.recipe.title}` : 'Recipe: none',
    proposal.recipe ? `Reason: ${proposal.recipe.reason}` : `Reason: ${proposal.selected.reason || 'No recipe selected.'}`,
    '',
    '## KPI Snapshot',
    '',
    `- Overall: ${proposal.kpis.overall ?? 'n/a'}`,
    `- Baseline fit: ${proposal.kpis.baselineFit ?? 'n/a'}`,
    `- Soccer structure: ${proposal.kpis.soccerStructure ?? 'n/a'}`,
    `- Tuning efficiency: ${proposal.kpis.tuningEfficiency ?? 'n/a'}`,
    '',
    '## Guardrails',
    '',
    `- Max changed lines: ${proposal.guardrails.maxChangedLines}`,
    '- No match simulations are started by this script.',
    '- Code edits require --apply.',
    options.validate ? '- Validation enabled: npm test, npm run lint, npm run build.' : '- Validation not requested.',
    '',
  ]
  fs.writeFileSync(path.join(outDir, 'proposal.md'), md.join('\n'))

  if (!options.apply || !proposal.recipe) {
    console.log(`Proposal written: ${path.join(outDir, 'proposal.md')}`)
    return
  }

  const applyResult = applyRecipe(RECIPES[proposal.selected.key], outDir, options.maxChangedLines)
  writeJson(path.join(outDir, 'apply-result.json'), applyResult)
  if (!applyResult.applied) {
    throw new Error(`Self-edit apply failed and was restored: ${applyResult.error}`)
  }

  if (options.validate) {
    const validation = await validate(outDir)
    writeJson(path.join(outDir, 'validation-result.json'), validation)
    if (!validation.passed) {
      throw new Error(`Validation failed. See ${validation.logPath}`)
    }
  }

  console.log(`Self-edit applied: ${path.join(outDir, 'apply-result.json')}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
