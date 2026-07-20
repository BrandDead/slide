// Compatibility entrypoint for the upgraded Las Olas combat renderer.
// Existing imports keep working while the implementation lives in V3.
export {
  CanvasStreetRenderer,
  default,
  type CanvasStreetRendererProps,
} from './CanvasStreetRendererV3';
