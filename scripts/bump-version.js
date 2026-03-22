/**
 * scripts/bump-version.js
 * Automatically increments the PATCH version in package.json before each
 * production build (build:win / build:mac).
 *
 * Versioning scheme:  MAJOR.MINOR.PATCH
 *   - PATCH bumps automatically on every production build
 *   - MINOR / MAJOR: bump manually when needed
 *
 * Run: node scripts/bump-version.js
 */

const fs   = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

const [major, minor, patch] = pkg.version.split('.').map(Number)
const newVersion = `${major}.${minor}.${patch + 1}`

pkg.version = newVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(`\n  📦  Version bumped: ${major}.${minor}.${patch}  →  ${newVersion}\n`)
