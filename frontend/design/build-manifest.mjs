// Extracts the design truth out of src/ into design/figma-manifest.json.
//
// Why a manifest instead of driving Figma straight from the code: the Figma bridge writes one
// node per call, so rebuilding ~42 screens live would be thousands of round trips with nothing
// to diff afterwards. Reading the codebase once into JSON makes the build repeatable, reviewable
// and cheap to re-run when a screen changes.
//
// Everything here leans on the house pattern that `.claude/skills/scr-screen/SKILL.md` enforces
// (admin-page__title, admin-field__label, data-table, EmptyState, Breadcrumb). That consistency is
// what makes plain regex enough — there is no TSX parser and no new dependency.
//
//   node design/build-manifest.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const read = (p) => readFileSync(p, 'utf8')
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/')

/**
 * Collapse a JSX text run into a single line, keeping `{expr}` visible as a `{…}` slot.
 * The brace scan has to be depth-aware: template literals nest braces (`` `${a} ${b}` ``) and a
 * regex alternative would leave the inner half of the expression behind as fake copy.
 */
function text(raw) {
  let out = ''
  let depth = 0
  for (const ch of raw) {
    if (ch === '{') {
      if (depth === 0) out += '{…}'
      depth++
    } else if (ch === '}') {
      if (depth > 0) depth--
    } else if (depth === 0) {
      out += ch
    }
  }
  return out
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** `text()` plus nested elements removed — for copy that wraps an <Icon /> or a <StatusBadge>. */
function plain(raw) {
  return text(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pull the caption out of every `className="btn…"` element.
 *
 * Attribute values contain `>` (from arrow functions in `onClick`), so the opening tag cannot be
 * found with `[^>]*>` — this walks forward and only accepts a `>` at brace depth 0. Assumes a
 * button never nests another element of the same tag name, which holds across this codebase.
 */
function extractButtons(source) {
  const out = []
  for (const match of source.matchAll(/className="(btn[^"]*)"/g)) {
    const open = source.lastIndexOf('<', match.index)
    const tag = open < 0 ? null : source.slice(open + 1).match(/^[A-Za-z][\w.]*/)?.[0]
    if (!tag) continue

    let depth = 0
    let end = -1
    for (let i = match.index; i < source.length; i++) {
      const ch = source[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) {
        end = source[i - 1] === '/' ? -1 : i
        break
      }
    }
    if (end < 0) continue

    const close = source.indexOf(`</${tag}>`, end)
    if (close < 0) continue

    const label = plain(source.slice(end + 1, close))
    if (label && !out.some((b) => b.label === label && b.variant === match[1])) {
      out.push({ label, variant: match[1] })
    }
  }
  return out
}

/**
 * A Breadcrumb `label:` value is usually a plain string but can be a ternary that picks between a
 * formatted code and a fallback caption, e.g.
 *   `label: existing ? formatPRCode(existing.prId) : 'สร้างใบขอสั่งซื้อ'`
 * Keep every literal it can render, joined with ` | `, and fall back to `«expr»` when there is no
 * literal at all — a bare `{…}` would lose which screen the crumb belongs to.
 */
function crumbLabel(raw) {
  const expr = raw.replace(/\s*\}\s*$/, '').trim()
  const literals = [...expr.matchAll(/'([^']*)'/g)].map((m) => m[1])
  if (literals.length) return literals.join(' | ')
  return `«${text(expr)}»`
}

/** User-facing copy must be Thai (project rule); flag any Latin-script run so it is visible. */
function latinRuns(strings) {
  return [
    ...new Set(
      strings.filter((s) => /[A-Za-z]{3,}/.test(s.replace(/\{…\}|«[^»]*»/g, ''))),
    ),
  ]
}

/** Walk every .ts/.tsx file under a directory. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

// ---------------------------------------------------------------- design tokens

// The `/* … */` comments inside :root already group the tokens the way the Figma style folders
// should be named, so they become the group key rather than guessing from the token name.
function extractTokens() {
  const css = read(join(SRC, 'index.css'))
  const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')))

  const groups = {}
  let group = 'Other'
  for (const line of root.split('\n')) {
    const comment = line.match(/\/\*\s*(.+?)\s*\*\//)
    if (comment) {
      group = comment[1]
      continue
    }
    const token = line.match(/^\s*--([\w-]+):\s*(.+?);\s*$/)
    if (!token) continue
    ;(groups[group] ??= {})[token[1]] = token[2].trim()
  }
  return groups
}

// ---------------------------------------------------------------- permissions

function extractPermissions() {
  const file = read(join(SRC, 'admin/permissions.ts'))
  const body = file.slice(file.indexOf('export const can = {'))
  const out = {}
  // Each rule is `name: (role: Role) => <expr>,` and may wrap onto the next line.
  const re = /(\w+):\s*\(role: Role\)\s*=>\s*([\s\S]*?),\n/g
  for (const [, name, expr] of body.matchAll(re)) {
    const roles = [...expr.matchAll(/role === '(\w+)'/g)].map((m) => m[1])
    out[name] = expr.includes('() => true') || /^\s*true\s*$/.test(expr) ? ['*'] : roles
  }
  return out
}

function extractRoles() {
  const file = read(join(SRC, 'auth/roles.ts'))
  const labels = {}
  const block = file.match(/ROLE_LABELS[^=]*=\s*\{([\s\S]*?)\n\}/)
  if (block) {
    for (const [, key, label] of block[1].matchAll(/'?([\w-]+)'?:\s*'([^']*)'/g)) labels[key] = label
  }
  return labels
}

// ---------------------------------------------------------------- enum label + tone maps

function extractMaps(files, suffix) {
  const out = {}
  for (const file of files) {
    const source = read(file)
    const re = new RegExp(`export const (\\w+${suffix})[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}`, 'g')
    for (const [, name, body] of source.matchAll(re)) {
      const entries = {}
      // Keys are SCREAMING_SNAKE enum members almost everywhere, but ROLE_LABELS is keyed by the
      // lowercase Role union — accept both so no map is silently dropped.
      for (const [, key, value] of body.matchAll(/'?([A-Za-z][\w-]*)'?:\s*'([^']*)'/g)) {
        entries[key] = value
      }
      if (Object.keys(entries).length) out[name] = { source: rel(file), values: entries }
    }
  }
  return out
}

// ---------------------------------------------------------------- icons

function extractIcons() {
  const file = read(join(SRC, 'components/Icon.tsx'))
  const union = file.slice(file.indexOf('export type IconName ='), file.indexOf('const PATHS'))
  return [...union.matchAll(/'([\w-]+)'/g)].map((m) => m[1])
}

// ---------------------------------------------------------------- routes

function extractRoutes() {
  const file = read(join(SRC, 'App.tsx'))

  // `const X = lazy(() => import('./admin/pages/X'))` and the eager top-level imports both
  // resolve a JSX element name back to the file that draws it.
  const componentFiles = {}
  for (const [, name, path] of file.matchAll(/const (\w+) = lazy\(\(\) => import\('([^']+)'\)\)/g)) {
    componentFiles[name] = path
  }
  for (const [, name, path] of file.matchAll(/^import (\w+) from '(\.[^']+)'/gm)) {
    componentFiles[name] = path
  }

  const routes = []
  let layout = null
  let base = ''
  for (const line of file.split('\n')) {
    const layoutOpen = line.match(/<Route (?:path="(\w+)" )?element=\{<(\w+Layout) \/>\}>/)
    if (layoutOpen) {
      layout = layoutOpen[2]
      base = layoutOpen[1] ? `/${layoutOpen[1]}` : ''
      continue
    }
    if (/^\s*<\/Route>/.test(line)) {
      layout = null
      base = ''
      continue
    }
    const index = line.match(/<Route index element=\{<(\w+) \/>\}/)
    if (index) {
      routes.push({ path: base || '/', component: index[1], file: componentFiles[index[1]], layout })
      continue
    }
    const route = line.match(/<Route path="([^"]+)" element=\{<(\w+)[^>]*\/>\}/)
    if (route && route[2] !== 'Navigate') {
      routes.push({
        path: `${base}/${route[1]}`.replace('//', '/'),
        component: route[2],
        file: componentFiles[route[2]],
        layout,
      })
    }
  }
  return routes
}

// ---------------------------------------------------------------- sidebar

function extractNav() {
  const file = read(join(SRC, 'admin/components/AdminSidebar.tsx'))
  const menu = file.slice(file.indexOf('const MENU'), file.indexOf('\n]', file.indexOf('const MENU')))
  const groups = []
  for (const chunk of menu.split(/heading: /).slice(1)) {
    const heading = chunk.match(/'([^']*)'/)?.[1]
    const items = []
    for (const [, item] of chunk.matchAll(/\{([\s\S]*?)\n\s{6}\}/g)) {
      const label = item.match(/label: '([^']*)'/)?.[1]
      if (!label) continue
      items.push({
        label,
        to: item.match(/to: '([^']*)'/)?.[1],
        icon: item.match(/icon: '([^']*)'/)?.[1],
        allowed: item.match(/allowed: (?:can\.(\w+)|\(\) => true)/)?.[1] ?? '*',
        dot: item.match(/dot: '([^']*)'/)?.[1],
      })
    }
    groups.push({ heading, items })
  }
  return groups
}

// ---------------------------------------------------------------- components

function extractComponents() {
  const dirs = [join(SRC, 'components'), join(SRC, 'admin/components')]
  const out = []
  for (const dir of dirs) {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
      const source = read(join(dir, name))
      const component = basename(name, '.tsx')
      // A `tone`/`variant`/`size` prop union is exactly the variant axis a Figma component needs.
      const variants = {}
      for (const [, prop, union] of source.matchAll(
        /(?:export )?type \w*(Tone|Variant|Size|Kind)\w* =\s*([^\n]*(?:\n\s*\|[^\n]*)*)/gi,
      )) {
        const values = [...union.matchAll(/'([\w-]+)'/g)].map((m) => m[1])
        if (values.length > 1) variants[prop.toLowerCase()] = values
      }
      out.push({
        name: component,
        file: rel(join(dir, name)),
        hasCss: existsSync(join(dir, `${component}.css`)),
        variants: Object.keys(variants).length ? variants : undefined,
      })
    }
  }
  return out
}

// ---------------------------------------------------------------- screens

function extractScreen(file, routes) {
  const source = read(file)
  const component = basename(file, '.tsx')

  // Breadcrumb trails: a page can render more than one (loading / not-found / loaded), so keep
  // each distinct trail rather than only the first.
  const trails = []
  for (const [, items] of source.matchAll(/<Breadcrumb\s+items=\{\[([\s\S]*?)\]\}/g)) {
    const trail = [...items.matchAll(/label: ([^,\n]+)/g)].map((m) => crumbLabel(m[1]))
    const key = trail.join(' / ')
    if (trail.length && !trails.some((t) => t.join(' / ') === key)) trails.push(trail)
  }

  // Back-office pages carry admin-page__title; modals put the heading on the Modal `title` prop;
  // storefront pages just use a plain <h1>. Try each in turn so no screen comes back nameless.
  const titles = [
    ...[...source.matchAll(/className="admin-page__title">([\s\S]*?)<\/h1>/g)].map((m) => plain(m[1])),
    ...[...source.matchAll(/<Modal\s[\s\S]*?title=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) =>
      text(m[1] ?? m[2]),
    ),
    ...[...source.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => plain(m[1])),
    // Last resort: the final crumb names the screen. Needed by the Review screens, which do not
    // follow the house `admin-page__title` pattern and render their own header markup instead.
    ...trails.map((t) => t[t.length - 1]),
  ]
    // Drop headings that are pure interpolation (`{…} {…}`): they carry no copy, and the
    // breadcrumb fallback above already supplies the real screen name.
    .filter((t) => t && t.replace(/\{…\}/g, '').trim())
    .filter((t, i, all) => all.indexOf(t) === i)

  const subtitles = [
    ...source.matchAll(/className="admin-page__subtitle">([\s\S]*?)<\/p>/g),
  ].map((m) => plain(m[1]))

  // Table headings, in source order — the spec grades column order, so order matters here.
  // `<th(?=[\s>])` so the opening <thead> is not mistaken for a heading cell.
  const columns = [...source.matchAll(/<th(?=[\s>])[^>]*>([\s\S]*?)<\/th>/g)]
    .map((m) => plain(m[1]))
    .filter(Boolean)

  // A required field marks itself with a nested `<em>*</em>`; lift that to a flag instead of
  // letting the asterisk markup end up as part of the label text in Figma.
  const fields = [...source.matchAll(/className="admin-field__label"[^>]*>([\s\S]*?)<\/span>/g)]
    .map((m) => {
      const raw = text(m[1])
      return {
        label: raw.replace(/<em>\s*\*\s*<\/em>/g, '').replace(/<[^>]*>/g, '').trim(),
        required: /<em>\s*\*\s*<\/em>/.test(raw),
      }
    })
    .filter((f) => f.label)

  const empty = [...source.matchAll(/<EmptyState([\s\S]*?)\/>/g)].map((m) => ({
    title: m[1].match(/title="([^"]*)"/)?.[1],
    description: m[1].match(/description="([^"]*)"/)?.[1],
  }))

  const buttons = extractButtons(source)

  const filters = {
    search: [...source.matchAll(/type="search"[\s\S]*?placeholder="([^"]*)"/g)].map((m) => m[1]),
    selects: [...source.matchAll(/filter-bar__select">\s*<span>([^<]*)<\/span>/g)].map((m) => m[1]),
  }

  return {
    component,
    file: rel(file),
    routes: routes.filter((r) => r.component === component).map((r) => r.path),
    kind: /ListPage$/.test(component)
      ? 'list'
      : /FormPage$/.test(component)
        ? 'form'
        : /DetailPage$/.test(component)
          ? 'detail'
          : /Modal|Drawer$/.test(component)
            ? 'overlay'
            : 'other',
    titles,
    subtitles,
    breadcrumbs: trails,
    columns,
    fields,
    buttons,
    filters,
    emptyStates: empty,
    permissions: [...new Set([...source.matchAll(/can\.(\w+)\(/g)].map((m) => m[1]))],
    statusMaps: [...new Set([...source.matchAll(/(\w+_LABELS)\b/g)].map((m) => m[1]))],
    // Shared table/list components render their own columns, so a page with an empty `columns`
    // list is not necessarily table-less — look here for where the columns actually live.
    usesComponents: [
      ...new Set(
        [...source.matchAll(/<([A-Z]\w+)[\s/>]/g)].map((m) => m[1]).filter((n) => n !== 'Icon'),
      ),
    ].sort(),
    usesPagination: source.includes('<Pagination'),
    usesToast: source.includes('useToast'),
    // Copy that would carry English into Figma, against the project's Thai-UI rule.
    latinText: latinRuns([
      ...titles,
      ...subtitles,
      ...columns,
      ...fields.map((f) => f.label),
      ...buttons.map((b) => b.label),
      ...empty.flatMap((e) => [e.title, e.description].filter(Boolean)),
      ...filters.search,
      ...filters.selects,
    ]),
  }
}

// ---------------------------------------------------------------- assemble

const routes = extractRoutes()
const allFiles = walk(SRC)
const pageFiles = allFiles.filter((f) => /[\\/](admin[\\/])?pages[\\/]/.test(f) && f.endsWith('.tsx'))

const manifest = {
  generatedAt: new Date().toISOString(),
  generator: 'design/build-manifest.mjs',
  note: 'Generated from frontend/src. Do not hand-edit — re-run the script instead.',
  tokens: extractTokens(),
  roles: extractRoles(),
  permissions: extractPermissions(),
  icons: extractIcons(),
  nav: extractNav(),
  components: extractComponents(),
  statusLabels: extractMaps(allFiles, '_LABELS'),
  statusTones: extractMaps(allFiles, '_TONES'),
  routes,
  screens: pageFiles.map((f) => extractScreen(f, routes)).sort((a, b) => a.component.localeCompare(b.component)),
}

const outPath = join(ROOT, 'design/figma-manifest.json')
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const tokenCount = Object.values(manifest.tokens).reduce((n, g) => n + Object.keys(g).length, 0)
console.log(`wrote ${rel(outPath)}`)
console.log(
  [
    `  ${tokenCount} tokens in ${Object.keys(manifest.tokens).length} groups`,
    `  ${Object.keys(manifest.permissions).length} permission rules · ${Object.keys(manifest.roles).length} roles`,
    `  ${manifest.icons.length} icons · ${manifest.components.length} components`,
    `  ${Object.keys(manifest.statusLabels).length} label maps · ${Object.keys(manifest.statusTones).length} tone maps`,
    `  ${manifest.routes.length} routes · ${manifest.screens.length} screens`,
  ].join('\n'),
)
