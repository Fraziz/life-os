import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Never intercept dependencies inside node_modules (both ESM and CJS)
    if (context.parentURL && context.parentURL.includes('/node_modules/')) {
      return nextResolve(specifier, context);
    }

    let target = specifier;
    if (target.startsWith('@/')) {
      target = pathToFileURL(path.join(rootDir, 'src', target.slice(2))).href;
    }

    if (target.startsWith('./') || target.startsWith('../') || target.startsWith('file://')) {
      const parentDir = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : rootDir;
      const fsPath = target.startsWith('file://') ? fileURLToPath(target) : path.resolve(parentDir, target);
      if (!existsSync(fsPath)) {
        for (const ext of ['.ts', '.tsx']) {
          if (existsSync(fsPath + ext)) {
            return nextResolve(pathToFileURL(fsPath + ext).href, context);
          }
        }
      }
    }

    return nextResolve(target, context);
  },
});
