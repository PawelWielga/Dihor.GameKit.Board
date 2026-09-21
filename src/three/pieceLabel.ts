import {
  CanvasTexture,
  Object3D,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";
import type { PieceAppearance } from "../presentation/index.js";

const OWNED_LABEL_TEXTURE_KEY = "__dihorBoardOwnedLabelTexture";

export function createPieceLabelSprite(
  appearance: PieceAppearance | undefined,
  width: number,
): Sprite | undefined {
  const label = appearance?.label;
  const text = label?.text ?? appearance?.icon;

  if (label?.visible === false || !text || typeof document === "undefined") {
    return undefined;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  if (!context) {
    return undefined;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "700 72px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(0, 0, 0, 0.68)";
  context.fillStyle = label?.color ?? "#ffffff";
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: label?.opacity ?? 1,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new Sprite(material);
  sprite.scale.set(width, width * 0.5, 1);
  sprite.renderOrder = 1000;
  sprite.userData[OWNED_LABEL_TEXTURE_KEY] = texture;
  return sprite;
}

export function disposeRendererOwnedLabelTexture(object: Object3D): void {
  const candidate = object.userData[OWNED_LABEL_TEXTURE_KEY];
  if (candidate instanceof CanvasTexture) {
    candidate.dispose();
    delete object.userData[OWNED_LABEL_TEXTURE_KEY];
  }
}
