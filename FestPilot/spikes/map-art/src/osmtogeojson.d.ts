declare module "osmtogeojson" {
  interface FeatureCollection {
    type: "FeatureCollection";
    features: Array<{ type: string; properties: Record<string, string> | null; geometry: unknown }>;
  }
  function osmtogeojson(data: unknown): FeatureCollection;
  export default osmtogeojson;
}
