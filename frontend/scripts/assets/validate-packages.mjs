import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '../..');
const repositoryRoot = path.resolve(frontendRoot, '..');
const contractsRoot = path.join(repositoryRoot, 'contracts');
const publicRoot = path.join(frontendRoot, 'public');

const schemaFiles = {
  encounter: 'encounter-package.schema.json',
  result: 'encounter-result.schema.json',
  character: 'character-package.schema.json',
  block: 'block-package.schema.json',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJsonFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
  });
}

function formatErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const schemas = Object.fromEntries(Object.entries(schemaFiles).map(([key, fileName]) => {
  const schema = readJson(path.join(contractsRoot, fileName));
  ajv.addSchema(schema);
  return [key, schema];
}));

const targets = [
  ...collectJsonFiles(path.join(contractsRoot, 'examples')).map((filePath) => ({
    filePath,
    kind: path.basename(filePath).split('.')[0],
    runtime: false,
  })),
  ...collectJsonFiles(path.join(publicRoot, 'assets/packages/characters')).map((filePath) => ({ filePath, kind: 'character', runtime: true })),
  ...collectJsonFiles(path.join(publicRoot, 'assets/packages/blocks')).map((filePath) => ({ filePath, kind: 'block', runtime: true })),
];

const failures = [];
let validated = 0;
for (const target of targets) {
  const schema = schemas[target.kind];
  if (!schema) {
    failures.push(`${path.relative(repositoryRoot, target.filePath)}: cannot infer schema kind "${target.kind}"`);
    continue;
  }
  const value = readJson(target.filePath);
  const validate = ajv.getSchema(schema.$id);
  if (!validate?.(value)) {
    failures.push(`${path.relative(repositoryRoot, target.filePath)}: ${formatErrors(validate?.errors)}`);
    continue;
  }
  validated += 1;

  if (!target.runtime) continue;
  const referencedAsset = value.runtime?.babylonGlb;
  if (typeof referencedAsset !== 'string' || !referencedAsset.startsWith('/assets/')) {
    failures.push(`${path.relative(repositoryRoot, target.filePath)}: runtime.babylonGlb must be a public /assets/ path`);
    continue;
  }
  const resolvedAsset = path.join(publicRoot, referencedAsset.slice(1));
  if (!fs.existsSync(resolvedAsset)) {
    failures.push(`${path.relative(repositoryRoot, target.filePath)}: missing referenced asset ${referencedAsset}`);
  }
}

if (targets.length === 0) failures.push('No contract examples or runtime asset packages were found.');

if (failures.length > 0) {
  console.error('Asset package validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Asset package validation passed: ${validated} package(s), 4 schema(s).`);
