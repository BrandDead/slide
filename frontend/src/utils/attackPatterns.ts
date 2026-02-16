import { MacroCoord, inBoundsMacro } from "./dualGrid";

export type MacroPattern = "single" | "burst3x3" | "line3";

export function patternTargets(center: MacroCoord, pattern: MacroPattern): MacroCoord[] {
  if (pattern === "single") return [center];

  if (pattern === "burst3x3") {
    const out: MacroCoord[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = { x: center.x + dx, y: center.y + dy };
        if (inBoundsMacro(t)) out.push(t);
      }
    }
    return out;
  }

  // pattern === "line3" (horizontal line centered)
  const line = [
    { x: center.x - 1, y: center.y },
    center,
    { x: center.x + 1, y: center.y },
  ];
  return line.filter(inBoundsMacro);
}
