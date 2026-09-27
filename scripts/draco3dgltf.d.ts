// The part of Google's draco3dgltf Emscripten decoder that the cascade bake uses.
declare module "draco3dgltf" {
  export type DracoStatus = { ok(): boolean; error_msg(): string };
  export type DracoMesh = { ptr: number; num_points(): number };
  export type DracoAttribute = { ptr: number; num_components(): number };
  export type DracoDecoder = {
    DecodeArrayToMesh(
      data: Int8Array,
      byteLength: number,
      mesh: DracoMesh,
    ): DracoStatus;
    GetAttributeByUniqueId(mesh: DracoMesh, id: number): DracoAttribute;
    GetAttributeDataArrayForAllPoints(
      mesh: DracoMesh,
      attribute: DracoAttribute,
      dataType: number,
      byteLength: number,
      ptr: number,
    ): boolean;
  };
  export type DecoderModule = {
    Decoder: new () => DracoDecoder;
    Mesh: new () => DracoMesh;
    DT_FLOAT32: number;
    HEAPF32: Float32Array;
    _malloc(bytes: number): number;
    _free(ptr: number): void;
    destroy(object: unknown): void;
  };
  const draco3d: {
    createDecoderModule(options?: object): Promise<DecoderModule>;
  };
  export default draco3d;
}
