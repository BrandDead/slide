# Production Art Sources — Portable Package V1

**Author:** Manus AI
**Date:** 2026-08-29

This milestone uses only primary-source assets that can be incorporated into a commercial cross-engine pipeline without an additional purchase. The assets remain visually provisional; their purpose is to exercise the real rig, animation, GLB, PBR, provenance, and optimization path that final commissioned assets must follow.

| Source | Selected content | License and portability | Acquisition evidence |
|---|---|---|---|
| Quaternius Universal Base Characters | Free standard package; selected `Superhero_Male_FullBody` humanoid base; glTF/FBX and textures | CC0; commercial use allowed; humanoid rig intended for retargeting in Babylon/web, Unreal, Unity, and Godot [1] | Official itch product ID `3822259`; free upload ID `15861669`; archive 128,968,391 bytes; SHA-256 `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40` |
| Quaternius Universal Animation Library | Free standard package; 43 animation groups including idle, walk, jog, sprint, pistol aim/fire/reload, hit, crouch, driving, and death | CC0; commercial use allowed; current library documents compatibility with the Universal Base Characters rig and Unreal/Godot/Unity exports [2] | Free upload ID `17958403`; archive 15,904,933 bytes; SHA-256 `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724` |
| ambientCG | `Asphalt033`, `Concrete034`, and `Bricks097` 1K JPG PBR packages | CC0; downloadable maps may be modified, distributed, and included in a commercial game [3] | Official API archives; SHA-256: Asphalt `c71801b342dbea594dbdd0bd2ddc0a6d13f813c923fca408b9f5b9ee5e58aba2`; Concrete `5839d284d94ffb8d2a56df742ec522b13dd311c52dbd42b8fd33f0409ceedb81`; Bricks `97b5df360161e48bcfed609aef361e8115b680ddc0aea4ad9321d4b00e222ad0`. Runtime-map checksums ship in `pbr-sources.json`. |
| Kenney City Kit Roads | Modular road, sidewalk, signs, traffic lights, utility poles, wires, construction props, and dumpster GLB/FBX models | CC0; personal and commercial use; no attribution required [4] [5] | Official archive SHA-256 `22058af3d68173a7cf9bda9f0e243a8cef6bd68168c302ebc76327063849674e`; evaluated but not imported in V1 because the PBR procedural block retained the existing semantic anchors. |

The Quaternius base character and Universal Animation Library contain matching 65-joint skeleton name sets. The selected base model has 69 total nodes and no embedded animations. The animation GLB has 67 nodes and 43 animation groups. This exact-name compatibility permits deterministic transfer or runtime retargeting rather than manual per-clip remapping.

The emitted runtime character GLB has SHA-256 `f800a143bec5241cf21090c0921eedaaf6f2bc9c73261462b197668b2037f06b`.

The Quaternius source glTF references `T_Hair_1_Normal_png.png` and `T_Eye_Normal_png.png`, while the standard archive contains `T_Hair_1_Normal.png` and `T_Eye_Normal.png`. The packaging step must normalize those two URIs or provide deterministic aliases. This source mismatch must remain documented rather than silently repaired by hand.

The free character is a **real rigged asset but not the target hero design**. It is suitable for proving animation, possession, hit-zone, LOD, and cross-engine import contracts. It must not be presented as the final recognizable member. The no-purchase road kit is similarly useful for semantic props and modular validation but is not a substitute for the commissioned high-fidelity 1208 block.

## References

[1]: https://quaternius.com/packs/universalbasecharacters.html "Quaternius — Universal Base Characters"
[2]: https://quaternius.itch.io/universal-animation-library "Quaternius — Universal Animation Library"
[3]: https://docs.ambientcg.com/license/ "ambientCG License"
[4]: https://kenney.nl/assets/city-kit-roads "Kenney — City Kit Roads"
[5]: https://kenney.nl/support "Kenney Support — Commercial Use and Attribution"
