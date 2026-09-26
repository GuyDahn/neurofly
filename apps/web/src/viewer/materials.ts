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

export function createNeuronMaterial(
  texture: Texture,
  neuronCount: number,
): LineBasicMaterial {
  const material = new LineBasicMaterial({
    color: "#ffffff",
    vertexColors: true,
  });
  material.customProgramCacheKey = () => "neurofly-line-flash-v1";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.flashMap = { value: texture };
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
        "#include <common>\nuniform sampler2D flashMap;\nuniform float neuronCount;\nvarying float vNeuronIndex;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nfloat neuroflyFlash = texture2D(flashMap, vec2((vNeuronIndex + 0.5) / max(neuronCount, 1.0), 0.5)).r;\ndiffuseColor.rgb += diffuseColor.rgb * neuroflyFlash * 2.5;",
      );
  };
  return material;
}
