import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("out/desschorre-base.svg", "utf8");
const resvg = new Resvg(svg, {
  background: "#08070a",
  fitTo: { mode: "width", value: 1000 },
});
writeFileSync("out/preview.png", resvg.render().asPng());
console.log("wrote out/preview.png");
