#!/usr/bin/env bun

import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { homedir } from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const LAUNCHER_NAMES = ['claude-code-codex', 'claude-code-v666', 'ccb666'] as const
const LEGACY_LAUNCHER_NAMES = ['claude-code-v999', 'ccb999'] as const

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const cliPath = path.join(repoRoot, 'dist', 'cli.js')

if (!existsSync(cliPath)) {
  throw new Error('dist/cli.js not found. Run `bun run build` first, then rerun `bun run install:launcher`.')
}

const bunPath = findBunPath()
if (!bunPath) {
  throw new Error('Bun executable not found. Install Bun first, then rerun this script.')
}

const targetDir = getTargetDir(bunPath)
mkdirSync(targetDir, { recursive: true })

removeLegacyLaunchers(targetDir)

if (process.platform === 'win32') {
  installWindowsLaunchers(targetDir, bunPath, cliPath)
} else {
  installPosixLaunchers(targetDir, bunPath, cliPath)
}

console.log(`Installed launchers to ${targetDir}:`)
for (const name of LAUNCHER_NAMES) {
  console.log(`  ${name}`)
}

if (!pathIncludes(targetDir)) {
  console.warn(
    `Warning: ${targetDir} is not currently on PATH. Add \`export PATH="${targetDir}:$PATH"\` to your shell profile.`,
  )
}

function findBunPath(): string | null {
  const bunBinary = process.platform === 'win32' ? 'bun.exe' : 'bun'
  const candidates = new Set<string>()

  if (typeof Bun !== 'undefined' && typeof Bun.which === 'function') {
    const resolved = Bun.which('bun')
    if (resolved) {
      candidates.add(resolved)
    }
  }

  for (const dir of getPathEntries()) {
    if (isProjectLocalBin(dir)) continue
    candidates.add(path.join(dir, bunBinary))
  }

  if (path.basename(process.execPath).toLowerCase().startsWith('bun')) {
    candidates.add(process.execPath)
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      candidates.add(
        path.join(
          localAppData,
          'Microsoft',
          'WinGet',
          'Packages',
          'Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe',
          'bun-windows-x64',
          'bun.exe',
        ),
      )
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    if (!existsSync(candidate)) continue

    try {
      return realpathSync(candidate)
    } catch {
      return candidate
    }
  }

  return null
}

function getTargetDir(bunPath: string): string {
  const overrideDir = process.env.CLAUDE_CODE_LAUNCHER_DIR?.trim()
  if (overrideDir) {
    return path.resolve(overrideDir)
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA
    if (!appData) {
      throw new Error('APPDATA is not set, so the Windows launcher directory cannot be determined.')
    }
    return path.join(appData, 'npm')
  }

  const home = homedir()
  const preferredDirs = [
    path.dirname(bunPath),
    path.join(home, '.bun', 'bin'),
    path.join(home, '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    ...getPathEntries(),
  ]

  for (const dir of new Set(preferredDirs.filter(Boolean))) {
    if (isProjectLocalBin(dir)) continue
    if (isInstallableDir(dir, home)) {
      return dir
    }
  }

  throw new Error(
    'Could not find a writable launcher directory. Set CLAUDE_CODE_LAUNCHER_DIR to a writable directory on your PATH and rerun the script.',
  )
}

function getPathEntries(): string[] {
  const rawPath = process.env.PATH ?? ''
  return rawPath
    .split(path.delimiter)
    .map(entry => entry.trim())
    .filter(Boolean)
}

function isInstallableDir(dir: string, home: string): boolean {
  try {
    if (existsSync(dir)) {
      accessSync(dir, constants.W_OK)
      return true
    }

    if (dir === home || dir.startsWith(`${home}${path.sep}`)) {
      mkdirSync(dir, { recursive: true })
      accessSync(dir, constants.W_OK)
      return true
    }
  } catch {
    return false
  }

  return false
}

function removeLegacyLaunchers(targetDir: string) {
  for (const name of LEGACY_LAUNCHER_NAMES) {
    if (process.platform === 'win32') {
      rmSync(path.join(targetDir, `${name}.cmd`), { force: true })
      rmSync(path.join(targetDir, `${name}.ps1`), { force: true })
      continue
    }

    rmSync(path.join(targetDir, name), { force: true })
  }
}

function installWindowsLaunchers(targetDir: string, bunPath: string, cliPath: string) {
  for (const name of LAUNCHER_NAMES) {
    const cmdPath = path.join(targetDir, `${name}.cmd`)
    const ps1Path = path.join(targetDir, `${name}.ps1`)
    const cmdContent = `@echo off
setlocal
set "BUN_PATH=${bunPath}"
set "CLI_PATH=${cliPath}"
if exist "%BUN_PATH%" (
  "%BUN_PATH%" "%CLI_PATH%" %*
) else (
  bun "%CLI_PATH%" %*
)
`

    writeFileSync(cmdPath, cmdContent, 'ascii')
    rmSync(ps1Path, { force: true })
  }
}

function installPosixLaunchers(targetDir: string, bunPath: string, cliPath: string) {
  const quotedBunPath = shellQuote(bunPath)
  const quotedCliPath = shellQuote(cliPath)

  for (const name of LAUNCHER_NAMES) {
    const launcherPath = path.join(targetDir, name)
    const launcherContent = `#!/bin/sh
BUN_PATH=${quotedBunPath}
CLI_PATH=${quotedCliPath}

if [ -x "$BUN_PATH" ]; then
  exec "$BUN_PATH" "$CLI_PATH" "$@"
fi

exec bun "$CLI_PATH" "$@"
`

    writeFileSync(launcherPath, launcherContent, 'utf8')
    chmodSync(launcherPath, 0o755)
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function pathIncludes(dir: string): boolean {
  const normalizedTarget = normalizePathForComparison(dir)
  return getPathEntries().some(entry => normalizePathForComparison(entry) === normalizedTarget)
}

function normalizePathForComparison(dir: string): string {
  const resolved = path.resolve(dir)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isProjectLocalBin(dir: string): boolean {
  const normalized = normalizePathForComparison(dir)
  const nodeModulesBin = `${path.sep}node_modules${path.sep}.bin`
  return normalized.includes(nodeModulesBin)
}
