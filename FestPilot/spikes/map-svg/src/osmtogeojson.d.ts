declare module "osmtogeojson" {
  const osmtogeojson: (data: unknown, options?: unknown) => {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: Record<string, string> | null;
      geometry: unknown;
    }>;
  };
  export default osmtogeojson;
}
