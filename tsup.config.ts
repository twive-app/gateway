import {defineConfig} from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    outDir: "out",
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    minify: false,
});
