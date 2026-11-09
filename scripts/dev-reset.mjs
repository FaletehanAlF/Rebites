import { execFileSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT ?? 3000);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectName = basename(projectRoot);

function listeningPids(targetPort) {
    const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line))
            continue;
        const columns = line.trim().split(/\s+/);
        const local = columns[1] ?? '';
        const pid = columns[columns.length - 1];
        if (local.endsWith(`:${targetPort}`) && /^\d+$/.test(pid))
            pids.add(pid);
    }
    return [...pids];
}

function commandLineOf(pid) {
    try {
        const output = execFileSync('powershell', [
            '-NoProfile',
            '-Command',
            `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
        ], { encoding: 'utf8' });
        return output.trim();
    }
    catch (error) {
        console.error(`Gagal membaca command line PID ${pid}: ${error.message}`);
        return '';
    }
}

const pids = listeningPids(port);
if (pids.length === 0) {
    console.log(`Port ${port} bebas. Jalankan: npm run dev`);
    process.exit(0);
}

const mine = [];
const others = [];
for (const pid of pids) {
    const command = commandLineOf(pid);
    if (command.includes(projectName) && command.includes('node'))
        mine.push({ pid, command });
    else
        others.push({ pid, command: command || '(command line tidak terbaca)' });
}

for (const entry of others) {
    console.warn(`PID ${entry.pid} memakai port ${port} dan BUKAN proses proyek ini — tidak dimatikan.`);
    console.warn(`  ${entry.command}`);
}

for (const entry of mine) {
    try {
        execFileSync('taskkill', ['/F', '/T', '/PID', entry.pid], { stdio: 'inherit' });
        console.log(`Dimatikan: PID ${entry.pid} (${projectName}).`);
    }
    catch (error) {
        console.error(`Gagal mematikan PID ${entry.pid}: ${error.message}`);
    }
}

if (mine.length > 0 && others.length === 0)
    console.log(`Port ${port} bebas. Jalankan: npm run dev`);

process.exit(others.length > 0 ? 1 : 0);
