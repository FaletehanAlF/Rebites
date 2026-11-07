import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checkGeminiConnection } from '../lib/server/gemini.ts';
type ProcessWithLoadEnvFile = NodeJS.Process & {
    loadEnvFile?: (path?: string) => void;
};
function tryLoadProjectEnv(): void {
    for (const rel of ['.env.local', '.env']) {
        const fullPath = path.resolve(process.cwd(), rel);
        if (!existsSync(fullPath))
            continue;
        const loadEnvFile = (process as ProcessWithLoadEnvFile).loadEnvFile;
        if (typeof loadEnvFile === 'function') {
            try {
                loadEnvFile.call(process, fullPath);
            }
            catch {
            }
            continue;
        }
        try {
            const raw = readFileSync(fullPath, 'utf8');
            for (const line of raw.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    continue;
                const eq = trimmed.indexOf('=');
                if (eq <= 0)
                    continue;
                const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, '');
                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
                    continue;
                let value = trimmed.slice(eq + 1).trim();
                const hashIdx = value.indexOf(' #');
                if (hashIdx >= 0 && value[0] !== '"' && value[0] !== "'") {
                    value = value.slice(0, hashIdx).trim();
                }
                if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
                    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
                    value = value.slice(1, -1);
                }
                if (value && process.env[key] === undefined) {
                    process.env[key] = value;
                }
            }
        }
        catch {
        }
    }
}
async function main(): Promise<void> {
    if (!process.env.GEMINI_API_KEY?.trim()) {
        tryLoadProjectEnv();
    }
    const result = await checkGeminiConnection();
    if (result.ok) {
        console.log(`OK - model ${result.model} tersambung (${result.latencyMs} ms).`);
        process.exit(0);
        return;
    }
    console.log(`BELUM SIAP - ${result.reason}${result.model ? ` (model: ${result.model})` : ''}`);
    process.exit(1);
}
void main();
