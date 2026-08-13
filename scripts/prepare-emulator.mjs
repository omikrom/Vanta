import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packages = path.join(root, "node_modules", "@emulatorjs");
const frontend = path.join(packages, "emulatorjs", "data");
const target = path.join(root, "public", "emulatorjs");
const cores = [
  "fceumm", "snes9x", "gambatte", "mgba", "mupen64plus_next", "melonds",
  "genesis_plus_gx", "smsplus", "picodrive", "pcsx_rearmed", "stella2014",
  "a5200", "prosystem", "handy", "gearcoleco", "vice_x64sc", "puae",
  "fbneo", "mame2003", "opera", "dosbox_pure",
];

await access(frontend).catch(() => {
  throw new Error("EmulatorJS is not installed. Run npm install before preparing Arcade.");
});
await rm(target, { recursive: true, force: true });
await cp(frontend, target, { recursive: true });
await rm(path.join(target, "cores"), { recursive: true, force: true });
await mkdir(path.join(target, "cores", "reports"), { recursive: true });

for (const core of cores) {
  const source = path.join(packages, `core-${core}`);
  const variants = core === "dosbox_pure"
    ? [`${core}-thread-wasm.data`, `${core}-thread-legacy-wasm.data`]
    : [`${core}-wasm.data`, `${core}-legacy-wasm.data`];
  for (const variant of variants) {
    await cp(path.join(source, variant), path.join(target, "cores", variant));
  }
  await cp(path.join(source, "reports", `${core}.json`), path.join(target, "cores", "reports", `${core}.json`));
}

await cp(
  path.join(packages, "emulatorjs", "LICENSE"),
  path.join(target, "EMULATORJS-LICENSE.txt"),
);

console.log(`Prepared EmulatorJS with ${cores.length} self-hosted cores in public/emulatorjs.`);
