import { spawn, spawnSync } from "node:child_process";

const urls = { web: null, admin: null };
let shown = false;

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function banner() {
  if (shown || !urls.web || !urls.admin) return;
  shown = true;
  process.stdout.write(
    [
      "",
      "  \x1b[1m\x1b[35mСайт:\x1b[0m     " + urls.web,
      "  \x1b[1m\x1b[33mАдминка:\x1b[0m  " + urls.admin,
      "",
      "",
    ].join("\n"),
  );
}

const run = (name, cwd, color) => {
  const p = spawn("npm run dev", { cwd, shell: true });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const out = (d) => {
    for (const line of d.toString().split(/\r?\n/)) {
      const plain = strip(line);
      const local = plain.match(/Local:\s+(\S+)/);
      if (local && (name === "web" || name === "admin")) {
        urls[name] = local[1];
        banner();
        continue;
      }
      if (!plain.trim() || /Network:|press h|^> |API запущен|Port \d+ is in use|VITE v[\d.]+\s+ready/.test(plain)) continue;
      process.stdout.write(prefix + line + "\n");
    }
  };
  p.stdout.on("data", out);
  p.stderr.on("data", out);
  return p;
};

const procs = [run("server", "server", 36), run("web", "web", 35), run("admin", "admin", 33)];
const stop = () => {
  for (const p of procs) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"], { stdio: "ignore" });
    else p.kill();
  }
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
