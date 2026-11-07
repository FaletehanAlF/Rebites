export const DEFAULT_CHATBOT_MODEL = 'gpt-6-luna';
export const AI_REQUEST_TIMEOUT_MS = 45000;
export interface AiToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export interface AiMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: AiToolCall[];
    tool_call_id?: string;
}
export interface AiToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}
export interface ChatCompletionArgs {
    messages: AiMessage[];
    tools?: AiToolDefinition[];
    signal?: AbortSignal;
    temperature?: number;
    maxTokens?: number;
}
export interface ChatCompletionResult {
    content: string;
    toolCalls: AiToolCall[];
    finishReason: string;
}
export class AiNotConfiguredError extends Error {
    missing: string[];
    constructor(missing: string[]) {
        super(`Asisten belum dikonfigurasi. Variabel belum diisi: ${missing.join(', ')}.`);
        this.name = 'AiNotConfiguredError';
        this.missing = missing;
    }
}
export class AiProviderError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.name = 'AiProviderError';
        this.status = status;
    }
}
export class AiToolsUnsupportedError extends AiProviderError {
    constructor(message = 'Provider menolak parameter tools.') {
        super(message, 400);
        this.name = 'AiToolsUnsupportedError';
    }
}
export interface AiConfig {
    url: string;
    key: string;
    model: string;
}
export function chatCompletionsUrl(base: string): string {
    const trimmed = base.trim().replace(/\/+$/, '');
    if (!trimmed)
        throw new AiNotConfiguredError(['VIBE_CODE_URL']);
    if (/\/chat\/completions$/i.test(trimmed))
        return trimmed;
    if (/\/v\d+$/i.test(trimmed))
        return `${trimmed}/chat/completions`;
    return `${trimmed}/v1/chat/completions`;
}
export function resolveAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
    const rawUrl = env.VIBE_CODE_URL?.trim() ?? '';
    const key = env.VIBE_CODE_KEY?.trim() ?? '';
    const missing: string[] = [];
    if (!rawUrl)
        missing.push('VIBE_CODE_URL');
    if (!key)
        missing.push('VIBE_CODE_KEY');
    if (missing.length > 0)
        throw new AiNotConfiguredError(missing);
    const model = env.VIBE_CODE_MODEL?.trim() || DEFAULT_CHATBOT_MODEL;
    return { url: chatCompletionsUrl(rawUrl), key, model };
}
export function buildChatPayload(config: AiConfig, args: ChatCompletionArgs): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        model: config.model,
        messages: args.messages,
        temperature: args.temperature ?? 0.3,
    };
    if (typeof args.maxTokens === 'number')
        payload.max_tokens = args.maxTokens;
    if (args.tools && args.tools.length > 0) {
        payload.tools = args.tools;
        payload.tool_choice = 'auto';
    }
    return payload;
}
function readToolCalls(raw: unknown): AiToolCall[] {
    if (!Array.isArray(raw))
        return [];
    const out: AiToolCall[] = [];
    for (const item of raw) {
        const call = item as Partial<AiToolCall> | null;
        const name = call?.function?.name;
        if (!call?.id || typeof name !== 'string' || !name)
            continue;
        out.push({
            id: String(call.id),
            type: 'function',
            function: {
                name,
                arguments: typeof call.function?.arguments === 'string' ? call.function.arguments : '{}',
            },
        });
    }
    return out;
}
export async function chatCompletion(args: ChatCompletionArgs): Promise<ChatCompletionResult> {
    const config = resolveAiConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    const callerSignal = args.signal;
    const forwardAbort = () => controller.abort();
    if (callerSignal) {
        if (callerSignal.aborted)
            controller.abort();
        else
            callerSignal.addEventListener('abort', forwardAbort, { once: true });
    }
    const signal = controller.signal;
    const cleanup = () => {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', forwardAbort);
    };
    try {
        let res: Response;
        try {
            res = await fetch(config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.key}`,
                },
                body: JSON.stringify(buildChatPayload(config, args)),
                signal,
                cache: 'no-store',
            });
        }
        catch (err) {
            const timedOut = err instanceof Error && /abort|timeout/i.test(`${err.name} ${err.message}`);
            throw new AiProviderError(timedOut
                ? 'Asisten tidak menjawab dalam batas waktu. Coba lagi.'
                : 'Tidak dapat menghubungi layanan asisten.', 0);
        }
        if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            if (res.status === 400 && args.tools?.length && /tool/i.test(bodyText)) {
                throw new AiToolsUnsupportedError();
            }
            throw new AiProviderError(`Layanan asisten menjawab ${res.status}.`, res.status);
        }
        const json = (await res.json().catch(() => null)) as {
            choices?: Array<{
                message?: {
                    content?: string | null;
                    tool_calls?: unknown;
                };
                finish_reason?: string;
            }>;
        } | null;
        const choice = json?.choices?.[0];
        const content = typeof choice?.message?.content === 'string' ? choice.message.content : '';
        return {
            content,
            toolCalls: readToolCalls(choice?.message?.tool_calls),
            finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : 'stop',
        };
    }
    finally {
        cleanup();
    }
}
