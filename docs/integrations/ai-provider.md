# AI Provider Integration

> **Implementation:** `lib/server/ai-provider.ts`, `lib/server/gemini.ts`, `lib/server/courier-ai.ts`, `app/api/chat/route.ts`, `app/api/chat/actions/route.ts`

---

## Role

AI powers two distinct features:

| Feature | Model | Use Case |
|---------|-------|----------|
| **Chatbot** (buyer/seller) | Google Gemini 1.5 Flash | Product search, order help, FAQ, store info |
| **Courier AI Assistant** | Google Gemini 1.5 Flash | Route optimization, delivery instructions, customer messages |

---

## Configuration

| Env Variable | Description | Required |
|-------------|-------------|----------|
| `GEMINI_API_KEY` | Google AI Studio API key | ✅ |
| `AI_MODEL` | Model name (default: `gemini-1.5-flash`) | Optional |
| `AI_MAX_TOKENS` | Max output tokens (default: 2048) | Optional |
| `AI_TEMPERATURE` | Sampling temp (default: 0.3) | Optional |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  POST /api/chat  │────▶│  AI Provider    │
│  (Chat UI)  │     │  (auth required) │     │  (Gemini)       │
└─────────────┘     └────────┬─────────┘     └────────┬────────┘
                             │                      │
                             ▼                      ▼
                    ┌──────────────────┐     ┌─────────────────┐
                    │  Context Loader  │     │  Tool Executor  │
                    │  (profile, orders,│     │  (search, order │
                    │   store data)    │     │   lookup, etc.) │
                    └──────────────────┘     └─────────────────┘
```

---

## `lib/server/ai-provider.ts` — Abstraction Layer

```typescript
export interface AIProvider {
  generateResponse(messages: AIMessage[], tools?: AITool[]): Promise<AIResponse>;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
}

export interface AITool {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface AIResponse {
  content: string;
  tool_calls?: AIToolCall[];
}
```

### Implementation: `GeminiProvider`

```typescript
export class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = 'gemini-1.5-flash',
    private maxTokens: number = 2048,
    private temperature: number = 0.3
  ) {}

  async generateResponse(messages: AIMessage[], tools?: AITool[]): Promise<AIResponse> {
    // Transform to Gemini format
    // Call generateContent API
    // Parse response
  }
}
```

---

## Chatbot Tools (Function Calling)

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_products` | Search catalog by query/category | `{ query?: string, category?: string, max_price?: number }` |
| `get_order_status` | Lookup order by code | `{ order_code: string }` |
| `get_store_info` | Get seller store details | `{ store_slug: string }` |
| `get_delivery_estimate` | Calculate ETA for address | `{ address_id: string }` |
| `create_support_ticket` | Escalate to human support | `{ category: string, description: string }` |

### Tool Execution Flow

```typescript
// In app/api/chat/route.ts
const response = await aiProvider.generateResponse(messages, availableTools);

if (response.tool_calls) {
  for (const call of response.tool_calls) {
    const result = await executeTool(call.name, call.arguments);
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
  }
  // Second call with tool results
  const finalResponse = await aiProvider.generateResponse(messages);
  return finalResponse.content;
}
```

---

## Courier AI Assistant

### `lib/server/courier-ai.ts`

Specialized prompts for courier operations:

```typescript
const COURIER_SYSTEM_PROMPT = `
Kamu adalah asisten kurir ReBites. Tugasmu:
1. Bantu kurir dengan rute pengiriman optimal
2. Terjemahkan instruksi pelanggan ke bahasa Indonesia baku
3. Sarankan alternatif jika alamat sulit ditemukan
4. JANGAN memberikan informasi pribadi pembeli (no HP, alamat lengkap)
`;

const COURIER_TOOLS = [
  {
    name: 'get_route_geometry',
    description: 'Dapatkan rute polyline dari toko ke alamat tujuan',
    parameters: { type: 'object', properties: { order_code: { type: 'string' } } }
  },
  {
    name: 'get_delivery_instructions',
    description: 'Ambil catatan pengiriman dari pesanan',
    parameters: { type: 'object', properties: { order_code: { type: 'string' } } }
  }
];
```

Used in `/api/chat/actions` when `context.type === 'courier'`.

---

## Context Injection

### Buyer Context

```typescript
const buyerContext = {
  user: { id, name, role: 'buyer' },
  recentOrders: [],      // Last 5 orders
  savedAddresses: [],    // For delivery estimates
  likedProducts: [],     // For recommendations
  currentPage: 'home'    // Page context
};
```

### Seller Context

```typescript
const sellerContext = {
  user: { id, name, role: 'umkm' },
  store: { id, name, slug, city, openHours },
  products: [],          // Active products
  pendingOrders: [],     // Orders needing action
  subscription: { status, plan }
};
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/chat` | 20 req | 1 min |
| `POST /api/chat/actions` | 10 req | 1 min |

Enforced per user via `verifyThrottle`.

---

## Error Handling

| Scenario | Response |
|----------|----------|
| API key missing | 500 "AI service not configured" |
| Gemini 429 | Retry with backoff (3x) |
| Gemini 5xx | Fallback to cached/template responses |
| Token limit exceeded | Truncate history, retry |
| Tool execution error | Return error to AI for self-correction |

---

## Cost Management

| Model | Input Cost | Output Cost | Est. Monthly |
|-------|------------|-------------|--------------|
| Gemini 1.5 Flash | $0.075/1M tokens | $0.30/1M tokens | ~$10-50 (depends on usage) |

**Optimization:**
- Limit conversation history to 10 messages
- Use `temperature: 0.3` for deterministic responses
- Cache frequent queries (product search, FAQ)

---

## Testing

### Unit Tests

```typescript
// tests/ai-provider.test.ts
const mockProvider = new MockAIProvider();
mockProvider.setResponse({ content: 'Test response' });
const result = await chatHandler(req, mockProvider);
```

### Integration Tests

- `tests/chat-integration.test.ts` — Full flow with real Gemini (optional, requires API key)

---

## Local Development

```env
GEMINI_API_KEY=your_gemini_api_key
AI_MODEL=gemini-1.5-flash
```

Get key from [Google AI Studio](https://aistudio.google.com/apikey).

---

## Monitoring

| Metric | Alert |
|--------|-------|
| AI error rate > 5% | Key invalid / quota exceeded |
| Avg latency > 3s | Model overloaded |
| Token usage spike | Abuse / bug |
| Fallback rate > 20% | Primary model failing |

Log prefixes: `[chat]`, `[chat/actions]`, `[courier-ai]`

---

## Future Considerations

| Idea | Status |
|------|--------|
| OpenAI fallback | Planned |
| Fine-tuned model for food domain | Research |
| Voice input (STT) | Backlog |
| Multilingual (English, Javanese) | Backlog |

---

## Related Docs

- [API: Chat](../api/overview.md#chatbot-ai-assistant) — Endpoint details
- [Features: Chatbot](../features/chatbot.md) — UI/UX flows
- [Features: Courier Dashboard](../features/courier-dashboard.md) — Courier AI
- [Security: Input Validation](../security/input-validation.md) — Prompt injection prevention
- [Integrations: Supabase](../integrations/supabase.md) — Context data source