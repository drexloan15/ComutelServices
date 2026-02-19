import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const args = process.argv.slice(2);
const getArgValue = (flagName) => {
  const index = args.indexOf(flagName);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
};

const thresholdsArg = getArgValue("--thresholds");
const summaryArg = getArgValue("--summary");

const summaryPath = summaryArg
  ? path.resolve(repoRoot, summaryArg)
  : path.resolve(repoRoot, "backend", "coverage", "coverage-summary.json");
const thresholdsPath = thresholdsArg
  ? path.resolve(repoRoot, thresholdsArg)
  : path.resolve(repoRoot, "backend", "coverage-thresholds.json");

if (!fs.existsSync(summaryPath)) {
  console.error(`No se encontro cobertura en: ${summaryPath}`);
  console.error(
    "Ejecuta primero: npm run test:cov:ci -w backend",
  );
  process.exit(1);
}

if (!fs.existsSync(thresholdsPath)) {
  console.error(`No se encontro archivo de umbrales: ${thresholdsPath}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf8"));

const modules = new Map();

for (const [filePath, metrics] of Object.entries(summary)) {
  if (filePath === "total") {
    continue;
  }
  if (!metrics?.lines) {
    continue;
  }

  const normalized = filePath.replaceAll("\\", "/");
  const marker = "/backend/src/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) {
    continue;
  }

  const relative = normalized.slice(markerIndex + marker.length);
  const [firstSegment] = relative.split("/");
  const moduleName = firstSegment.endsWith(".ts") ? "core" : firstSegment;

  if (!modules.has(moduleName)) {
    modules.set(moduleName, { total: 0, covered: 0 });
  }

  const current = modules.get(moduleName);
  current.total += Number(metrics.lines.total ?? 0);
  current.covered += Number(metrics.lines.covered ?? 0);
}

const failures = [];

const globalThreshold = Number(thresholds?.global?.lines ?? 0);
const globalLines = Number(summary?.total?.lines?.pct ?? 0);
if (globalLines < globalThreshold) {
  failures.push(
    `Global lines ${globalLines.toFixed(2)}% < ${globalThreshold.toFixed(2)}%`,
  );
}

console.log("Cobertura por modulo (lineas):");

for (const [moduleName, threshold] of Object.entries(thresholds.modules ?? {})) {
  const bucket = modules.get(moduleName) ?? { total: 0, covered: 0 };
  const pct = bucket.total > 0 ? (bucket.covered / bucket.total) * 100 : 0;
  const marker = pct >= threshold ? "OK" : "FAIL";
  console.log(
    `${marker}\t${moduleName}\t${pct.toFixed(2)}%\t(min ${Number(threshold).toFixed(2)}%)`,
  );

  if (pct < threshold) {
    failures.push(
      `Modulo ${moduleName}: ${pct.toFixed(2)}% < ${Number(threshold).toFixed(2)}%`,
    );
  }
}

if (failures.length > 0) {
  console.error("\nQuality gate de cobertura no cumplido:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `\nOK cobertura global ${globalLines.toFixed(2)}% (min ${globalThreshold.toFixed(2)}%)`,
);
