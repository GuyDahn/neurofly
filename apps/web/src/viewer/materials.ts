import {
  ClampToEdgeWrapping,
  DataTexture,
  LineBasicMaterial,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  UnsignedByteType,
  type Texture,
} from "three";

export function createFlashTexture(
  bytes: Uint8Array,
  neuronCount: number,
): DataTexture {
  const texture = new DataTexture(
    bytes as BufferSource,
    Math.max(neuronCount, 1),
    1,
    RedFormat,
    UnsignedByteType,
  );
  texture.colorSpace = NoColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Neurons outside the focus keep this share of their linear color, about a
 * fifth of their brightness on screen. A spike still shows through.
 */
export const DIM_LEVEL = 0.04;

export function createNeuronMaterial(
  texture: Texture,
  focus: Texture,
  neuronCount: number,
): LineBasicMaterial {
  const material = new LineBasicMaterial({
    color: "#ffffff",
    vertexColors: true,
  });
  material.customProgramCacheKey = () => "neurofly-line-focus-v1";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.flashMap = { value: texture };
    shader.uniforms.focusMap = { value: focus };
    shader.uniforms.neuronCount = { value: neuronCount };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float neuronIndex;\nvarying float vNeuronIndex;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvNeuronIndex = neuronIndex;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D flashMap;\nuniform sampler2D focusMap;\nuniform float neuronCount;\nvarying float vNeuronIndex;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\nfloat neuroflyFocus = texture2D(focusMap, vec2((vNeuronIndex + 0.5) / max(neuronCount, 1.0), 0.5)).r;\ndiffuseColor.rgb *= mix(${DIM_LEVEL.toFixed(3)}, 1.0, neuroflyFocus);\nfloat neuroflyFlash = texture2D(flashMap, vec2((vNeuronIndex + 0.5) / max(neuronCount, 1.0), 0.5)).r;\ndiffuseColor.rgb += diffuseColor.rgb * neuroflyFlash * 2.5;\n// Dimmed neurons sit just in front of the far plane, so the focus draws over them.\ngl_FragDepth = mix(gl_FragCoord.z, 0.99995 + gl_FragCoord.z * 0.00004, 1.0 - neuroflyFocus);`,
      );
  };
  return material;
}
