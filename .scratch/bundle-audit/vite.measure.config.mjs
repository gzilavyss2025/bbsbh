// Throwaway measuring config for the #2875 bundle audit. Not product code.
// Usage (from the repo root):
//   npx vite build --config .scratch/bundle-audit/vite.measure.config.mjs
// It extends vite.config.js with one plugin that, in generateBundle, writes
// .scratch/bundle-audit/out/graph.json: every chunk (file, isEntry, static and
// dynamic imports, modules with Rollup's renderedLength + a standalone gzip of
// the module's rendered code) and, for every module in the bundle, its static
// importers. analyze.mjs turns that into the report tables.
import { mergeConfig } from 'vite'
import { gzipSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import base from '../../vite.config.js'

const ROOT = new URL('../../', import.meta.url).pathname
const rel = (id) => (id.startsWith(ROOT) ? id.slice(ROOT.length) : id).replace(/\?.*$/, '')

function graphDump() {
  return {
    name: 'bundle-audit-graph',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const chunks = []
      const assets = []
      for (const [file, c] of Object.entries(bundle)) {
        if (c.type === 'asset') {
          assets.push({ file, size: typeof c.source === 'string' ? Buffer.byteLength(c.source) : c.source.length, names: c.names ?? [], originalFileNames: c.originalFileNames ?? [] })
          continue
        }
        chunks.push({
          file,
          name: c.name,
          isEntry: c.isEntry,
          isDynamicEntry: c.isDynamicEntry,
          facade: c.facadeModuleId ? rel(c.facadeModuleId) : null,
          imports: c.imports,
          dynamicImports: c.dynamicImports,
          css: [...(c.viteMetadata?.importedCss ?? [])],
          size: Buffer.byteLength(c.code),
          gzip: gzipSync(c.code).length,
          modules: Object.entries(c.modules).map(([id, m]) => ({
            id: rel(id),
            rendered: m.renderedLength,
            gzip: m.code ? gzipSync(m.code).length : 0,
          })),
        })
      }
      const importers = {}
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id)
        if (!info) continue
        importers[rel(id)] = {
          static: info.importers.map(rel),
          dynamic: info.dynamicImporters.map(rel),
        }
      }
      mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
      writeFileSync(new URL('./out/graph.json', import.meta.url), JSON.stringify({ chunks, assets, importers }))
    },
  }
}

export default mergeConfig(base, { plugins: [graphDump()] })
