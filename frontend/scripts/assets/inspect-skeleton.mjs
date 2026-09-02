import { NodeIO } from '@gltf-transform/core';

const input = process.argv[2];
if (!input) throw new Error('Usage: node inspect-skeleton.mjs <gltf-or-glb>');
const io = new NodeIO();
const document = await io.read(input);
const root = document.getRoot();
const nodes = root.listNodes().map((node) => node.getName()).filter(Boolean);
const skins = root.listSkins().map((skin) => ({
  name: skin.getName(),
  joints: skin.listJoints().map((joint) => joint.getName()),
}));
const animations = root.listAnimations().map((animation) => ({
  name: animation.getName(),
  targets: [...new Set(animation.listChannels().map((channel) => channel.getTargetNode()?.getName()).filter(Boolean))],
  paths: [...new Set(animation.listChannels().map((channel) => channel.getTargetPath()))],
}));
console.log(JSON.stringify({ input, nodes, skins, animations }, null, 2));
