import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

export function runValidation(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join("\n");

      if (error) {
        // `error.code` is a number when the command actually ran and exited
        // non-zero (that's the process's real exit code). If the command
        // could not be executed at all — e.g. spawn failure, ENOENT — Node
        // sets `error.code` to a string errno instead, and there's no real
        // exit code to report. Only the latter is a genuine crash.
        if (typeof error.code === "number") {
          resolve({ command, status: "failed", exitCode: error.code, output });
          return;
        }
        reject(error);
        return;
      }

      resolve({ command, status: "passed", exitCode: 0, output });
    });
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}