import { anycubic } from "./anycubic";
import { getConfig } from "./config";
import { demoOverview } from "./demo";
import { isActiveProject, shapeJob, shapePrinter, type Overview } from "./shape";

export async function loadOverview(): Promise<Overview> {
  const config = getConfig();
  if (config.demo) return demoOverview();

  const [storeResult, printersResult, projectsResult] = await Promise.allSettled([
    anycubic.getUserStore(),
    anycubic.getPrinters(),
    anycubic.getProjects(1, 30),
  ]);

  if (
    storeResult.status === "rejected" &&
    printersResult.status === "rejected" &&
    projectsResult.status === "rejected"
  ) {
    throw printersResult.reason;
  }

  const warnings: string[] = [];

  const store =
    storeResult.status === "fulfilled" && storeResult.value
      ? {
          usedBytes: Number(storeResult.value.used_bytes) || 0,
          totalBytes: Number(storeResult.value.total_bytes) || 0,
          usedLabel: storeResult.value.used || "",
          totalLabel: storeResult.value.total || "",
        }
      : null;

  if (storeResult.status === "rejected") {
    warnings.push(`Cloud storage: ${messageOf(storeResult.reason)}`);
  }

  const printers =
    printersResult.status === "fulfilled"
      ? printersResult.value.map(shapePrinter)
      : [];

  if (printersResult.status === "rejected") {
    warnings.push(`Printers: ${messageOf(printersResult.reason)}`);
  }

  const jobs =
    projectsResult.status === "fulfilled"
      ? projectsResult.value
          .filter(isActiveProject)
          .map(shapeJob)
          .sort((a, b) => b.id - a.id)
          .slice(0, 8)
      : [];

  if (projectsResult.status === "rejected") {
    warnings.push(`Jobs: ${messageOf(projectsResult.reason)}`);
  }

  return {
    store,
    printers,
    jobs,
    warnings,
    serverTime: new Date().toISOString(),
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
