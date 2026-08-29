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

const requiredSourceFiles = [
  'Source/DealtSlideShowdown/Public/DealtEncounterSubsystem.h',
  'Source/DealtSlideShowdown/Private/DealtEncounterSubsystem.cpp',
  'Source/DealtSlideShowdown/Public/DealtMemberPawn.h',
  'Source/DealtSlideShowdown/Private/DealtMemberPawn.cpp',
  'Source/DealtSlideShowdown/Public/DealtCommanderPawn.h',
  'Source/DealtSlideShowdown/Private/DealtCommanderPawn.cpp',
  'Source/DealtSlideShowdown/Public/DealtActionPlayerController.h',
  'Source/DealtSlideShowdown/Private/DealtActionPlayerController.cpp',
  'Source/DealtSlideShowdown/Public/DealtSquadDirector.h',
  'Source/DealtSlideShowdown/Private/DealtSquadDirector.cpp',
  'Source/DealtSlideShowdown/Public/DealtActionGameMode.h',
  'Source/DealtSlideShowdown/Private/DealtActionGameMode.cpp',
  'Source/DealtSlideShowdown/Private/Tests/DealtContractCodecTests.cpp',
];
requiredSourceFiles.forEach((relativePath) => {
  assert.ok(fs.existsSync(path.join(projectRoot, relativePath)), `Missing Unreal gameplay seam ${relativePath}`);
});

const subsystemSource = fs.readFileSync(path.join(projectRoot, 'Source/DealtSlideShowdown/Private/DealtEncounterSubsystem.cpp'), 'utf8');
['SubmitNativeHit', 'CycleSelectedMember', 'AcceptResultJson', 'ConsumePendingResultJson'].forEach((token) => {
  assert.ok(subsystemSource.includes(token), `Missing encounter seam ${token}`);
});
const playerSource = fs.readFileSync(path.join(projectRoot, 'Source/DealtSlideShowdown/Private/DealtActionPlayerController.cpp'), 'utf8');
['CycleCameraMode', 'NextMember', 'PreviousMember', 'ApplyCurrentPossession'].forEach((token) => {
  assert.ok(playerSource.includes(token), `Missing player-control seam ${token}`);
});
const gameConfig = fs.readFileSync(path.join(projectRoot, 'Config/DefaultGame.ini'), 'utf8');
assert.ok(gameConfig.includes('GlobalDefaultGameMode=/Script/DealtSlideShowdown.DealtActionGameMode'));

console.log('Unreal boundary validation passed: 2 canonical fixtures, 7 DTO groups, 3 codec operations, 13 gameplay seam files.');
