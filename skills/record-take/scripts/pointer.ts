import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

export interface Pointer {
  send(command: Record<string, unknown>): Promise<string>;
  close(): void;
}

const SOURCE = join(import.meta.dirname, "pointer.swift");
const BINARY = join(homedir(), "Library/Caches/record-take/pointer");

const run = promisify(execFile);

export async function openPointer(): Promise<Pointer> {
  await compile();

  const helper = spawn(BINARY, [], { stdio: ["pipe", "pipe", "inherit"] });
  const waiting: ((line: string) => void)[] = [];
  createInterface({ input: helper.stdout }).on("line", (line) => waiting.shift()?.(line));

  return {
    send(command) {
      helper.stdin.write(`${JSON.stringify(command)}\n`);
      return new Promise((resolve, reject) => {
        waiting.push((line) => {
          if (line.startsWith("ok ")) resolve(line.slice(3));
          else reject(new Error(`The pointer helper failed: ${line}`));
        });
      });
    },
    close() {
      helper.stdin.end();
    },
  };
}

async function compile(): Promise<void> {
  if (existsSync(BINARY) && statSync(BINARY).mtimeMs > statSync(SOURCE).mtimeMs) return;
  console.log("Compiling the pointer helper...");
  mkdirSync(dirname(BINARY), { recursive: true });
  await run("swiftc", ["-O", "-o", BINARY, SOURCE]);
}
