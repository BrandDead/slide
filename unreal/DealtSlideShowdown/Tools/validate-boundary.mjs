import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolRoot, '..');
const repositoryRoot = path.resolve(projectRoot, '../..');

const pairs = [
  ['contracts/examples/encounter.v1.json', 'unreal/DealtSlideShowdown/Content/Contracts/encounter.1208.v1.json'],
  ['contracts/examples/result.v1.json', 'unreal/DealtSlideShowdown/Content/Contracts/result.1208.v1.json'],
];

for (const [canonical, sidecar] of pairs) {
  const canonicalText = fs.readFileSync(path.join(repositoryRoot, canonical), 'utf8');
  const sidecarText = fs.readFileSync(path.join(repositoryRoot, sidecar), 'utf8');
  assert.equal(sidecarText, canonicalText, `${sidecar} drifted from ${canonical}`);
  JSON.parse(sidecarText);
}

const project = JSON.parse(fs.readFileSync(path.join(projectRoot, 'DealtSlideShowdown.uproject'), 'utf8'));
assert.equal(project.EngineAssociation, '5.4');
assert.ok(project.Modules.some((module) => module.Name === 'DealtSlideShowdown' && module.Type === 'Runtime'));

const contracts = fs.readFileSync(path.join(projectRoot, 'Source/DealtSlideShowdown/Public/DealtEncounterContracts.h'), 'utf8');
[
  'FDealtEncounterPackage',
  'FDealtEncounterResult',
  'FDealtAimRay',
  'FDealtImpactCandidate',
  'EDealtCameraMode',
  'EDealtControlMode',
].forEach((token) => assert.ok(contracts.includes(token), `Missing Unreal contract token ${token}`));

const codecHeader = fs.readFileSync(path.join(projectRoot, 'Source/DealtSlideShowdown/Public/DealtContractCodec.h'), 'utf8');
['ParseEncounterJson', 'ParseResultJson', 'SerializeResultJson'].forEach((token) => {
  assert.ok(codecHeader.includes(token), `Missing Unreal codec function ${token}`);
});

console.log('Unreal boundary validation passed: 2 canonical fixtures, 6 DTO groups, 3 codec operations.');
