import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample } from '@gltf-transform/functions';

const [baseModelPath, animationLibraryPath, outputPath] = process.argv.slice(2);
if (!baseModelPath || !animationLibraryPath || !outputPath) {
  throw new Error('Usage: node build-character-package.mjs <base.gltf|glb> <animations.glb> <output.glb>');
}

const REQUIRED_ANIMATIONS = [
  'Idle_Loop',
  'Walk_Loop',
  'Jog_Fwd_Loop',
  'Sprint_Loop',
  'Crouch_Idle_Loop',
  'Crouch_Fwd_Loop',
  'Pistol_Aim_Neutral',
  'Pistol_Shoot',
  'Pistol_Reload',
  'Hit_Chest',
  'Hit_Head',
  'Death01',
];

const io = new NodeIO();
const targetDocument = await io.read(baseModelPath);
const animationDocument = await io.read(animationLibraryPath);
const targetRoot = targetDocument.getRoot();
const animationRoot = animationDocument.getRoot();
const targetBuffer = targetRoot.listBuffers()[0] ?? targetDocument.createBuffer('runtime-buffer');
const targetNodes = new Map(targetRoot.listNodes().map((node) => [node.getName(), node]));
const sourceJointNames = new Set(animationRoot.listSkins().flatMap((skin) => skin.listJoints().map((joint) => joint.getName())));
const targetJointNames = new Set(targetRoot.listSkins().flatMap((skin) => skin.listJoints().map((joint) => joint.getName())));
const missingTargetJoints = [...sourceJointNames].filter((name) => !targetJointNames.has(name));
const missingSourceJoints = [...targetJointNames].filter((name) => !sourceJointNames.has(name));
if (missingTargetJoints.length || missingSourceJoints.length) {
  throw new Error(`Skeleton mismatch. Missing in target: ${missingTargetJoints.join(', ')}; missing in animation source: ${missingSourceJoints.join(', ')}`);
}

function copyAccessor(sourceAccessor, suffix) {
  const sourceArray = sourceAccessor.getArray();
  if (!sourceArray) throw new Error(`Animation accessor ${sourceAccessor.getName() || suffix} has no array.`);
  const targetAccessor = targetDocument
    .createAccessor(`${sourceAccessor.getName() || 'animation-accessor'}-${suffix}`)
    .setArray(sourceArray.slice())
    .setType(sourceAccessor.getType())
    .setNormalized(sourceAccessor.getNormalized())
    .setBuffer(targetBuffer);
  return targetAccessor;
}

const sourceAnimations = new Map(animationRoot.listAnimations().map((animation) => [animation.getName(), animation]));
const missingAnimations = REQUIRED_ANIMATIONS.filter((name) => !sourceAnimations.has(name));
if (missingAnimations.length) throw new Error(`Animation library is missing required clips: ${missingAnimations.join(', ')}`);

for (const animationName of REQUIRED_ANIMATIONS) {
  const sourceAnimation = sourceAnimations.get(animationName);
  const targetAnimation = targetDocument.createAnimation(animationName);
  const samplerMap = new Map();
  const accessorMap = new Map();

  for (const [samplerIndex, sourceSampler] of sourceAnimation.listSamplers().entries()) {
    const sourceInput = sourceSampler.getInput();
    const sourceOutput = sourceSampler.getOutput();
    if (!sourceInput || !sourceOutput) throw new Error(`${animationName} contains an incomplete sampler.`);
    const input = accessorMap.get(sourceInput) ?? copyAccessor(sourceInput, `${animationName}-input-${samplerIndex}`);
    const output = accessorMap.get(sourceOutput) ?? copyAccessor(sourceOutput, `${animationName}-output-${samplerIndex}`);
    accessorMap.set(sourceInput, input);
    accessorMap.set(sourceOutput, output);
    const targetSampler = targetDocument
      .createAnimationSampler(`${animationName}-sampler-${samplerIndex}`)
      .setInput(input)
      .setOutput(output)
      .setInterpolation(sourceSampler.getInterpolation());
    targetAnimation.addSampler(targetSampler);
    samplerMap.set(sourceSampler, targetSampler);
  }

  for (const [channelIndex, sourceChannel] of sourceAnimation.listChannels().entries()) {
    const sourceTarget = sourceChannel.getTargetNode();
    const sourceSampler = sourceChannel.getSampler();
    const targetNode = sourceTarget ? targetNodes.get(sourceTarget.getName()) : null;
    const targetSampler = sourceSampler ? samplerMap.get(sourceSampler) : null;
    if (!sourceTarget || !targetNode || !targetSampler) {
      throw new Error(`${animationName} channel ${channelIndex} cannot be mapped to the base skeleton.`);
    }
    targetAnimation.addChannel(
      targetDocument
        .createAnimationChannel(`${animationName}-channel-${channelIndex}`)
        .setSampler(targetSampler)
        .setTargetNode(targetNode)
        .setTargetPath(sourceChannel.getTargetPath()),
    );
  }
}

await targetDocument.transform(resample(), dedup(), prune());
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await io.write(outputPath, targetDocument);

console.log(JSON.stringify({
  outputPath,
  animationCount: targetDocument.getRoot().listAnimations().length,
  animationNames: targetDocument.getRoot().listAnimations().map((animation) => animation.getName()),
  jointCount: targetJointNames.size,
  nodeCount: targetDocument.getRoot().listNodes().length,
}));
