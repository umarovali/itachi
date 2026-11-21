// Запуск сервера, сайта и админки одной командой: npm run dev
import { spawn } from "node:child_process";

const run = (name, cwd, color) => {
  const p = spawn("npm", ["run", "dev"], { cwd, shell: true });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const out = (d) => process.stdout.write(d.toString().replace(/^(?=.)/gm, prefix));
  p.stdout.on("data", out);
  p.stderr.on("data", out);
  return p;
};

const procs = [run("server", "server", 36), run("web", "web", 35), run("admin", "admin", 33)];
const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
