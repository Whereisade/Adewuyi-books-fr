const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) sourceFiles.push(full);
  }
}
walk(root);
let failed = false;
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  for (const diagnostic of source.parseDiagnostics) {
    failed = true;
    const pos = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.error(`${path.relative(root, file)}:${pos.line + 1}:${pos.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}
if (failed) process.exit(1);
console.log(`Syntax validation passed for ${sourceFiles.length} TypeScript source files.`);
console.log('Note: syntax parsing does not replace dependency installation, Next.js compilation, ESLint, or runtime tests.');
