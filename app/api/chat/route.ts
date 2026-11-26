import { fetchWithSession, SERVER_API_BASE } from "@/lib/serverFetch";
import { checkChatRateLimit, RATE_LIMIT_WINDOW_MS } from "@/lib/chatRateLimit";
import { z } from "zod";

export const maxDuration = 30;

const AI_API_URL =
  process.env.AI_API_URL || "https://api.deepseek.com/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

/** Max model round-trips per request before we stop dispatching tools. */
const MAX_TOOL_TURNS = 8;

/** Caps on client-supplied input. Each request can cost up to MAX_TOOL_TURNS
 *  streamed model calls against a paid API, so the input side is bounded too. */
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;

interface ToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

/** A turn in the conversation sent upstream — wider than what a client may send. */
type ConversationMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: ToolCall["function"];
  }[];
  tool_call_id?: string;
};

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  token: string,
) {
  switch (name) {
    case "searchMedia": {
      const url = new URL(`${SERVER_API_BASE}/media/search`);
      url.searchParams.set("query", args.query as string);
      if (args.type) url.searchParams.set("type", args.type as string);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { results: [], error: "Failed to search media." };
      const data = await res.json();
      return { results: data.results?.slice(0, 3) || [], error: null };
    }
    case "getUserLibrary": {
      const res = await fetch(`${SERVER_API_BASE}/watchlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok)
        return { library: [], error: "Failed to fetch user library." };
      const data = await res.json();
      // GET /watchlist returns { items, total, limit, offset, has_more } —
      // not a bare array. Calling .map on the envelope threw on every request.
      const items = Array.isArray(data) ? data : (data.items ?? []);
      return {
        library: items.map(
          (item: {
            title: string;
            mediaType: string;
            status: string;
            year: number;
          }) => ({
            title: item.title,
            mediaType: item.mediaType,
            status: item.status,
            year: item.year,
          }),
        ),
        error: null,
      };
    }
    case "addToLibrary": {
      const res = await fetch(`${SERVER_API_BASE}/watchlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: args.title,
          mediaType: args.mediaType,
          year: args.year,
          status: args.status,
          notes: args.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        return {
          success: false,
          item: null,
          error: err.detail || "Failed to add item.",
        };
      }
      const data = await res.json();
      return { success: true, item: data, error: null };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "searchMedia",
      description:
        "Search for a movie, tv show, or anime title to get its exact details (type, year, overview).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The title to search for." },
          type: {
            type: "string",
            enum: ["movie", "tv", "anime"],
            description: "The media type to search.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getUserLibrary",
      description:
        "Fetch the user's current watchlist/library to see what they have watched or want to watch.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "addToLibrary",
      description:
        "Add a specific movie, tv show, or anime to the user's library.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The exact title of the media.",
          },
          mediaType: {
            type: "string",
            description: "The type of media: movie, tv, or anime.",
          },
          year: { type: "number", description: "The release year." },
          status: {
            type: "string",
            description: "The status: watched, pending, or wishlist.",
          },
          notes: {
            type: "string",
            description: "A short AI-generated review or trivia.",
          },
        },
        required: ["title", "mediaType", "year", "status"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Vault Intelligence, a premium, highly knowledgeable film critic and personal media library manager. Your goal is to help the user discover amazing content, organize their library, and provide personalized recommendations.

CAPABILITIES & INSTRUCTIONS:

1. **Semantic & Vibe Search**: If a user asks for "that movie about dreams" or "a sad movie about space", first use your own internal knowledge to identify the exact movie title (e.g. Inception, Interstellar). Then, use the searchMedia tool with that exact title to get the TMDB details.

2. **Adding to Library**: ONLY use the addToLibrary tool when the user EXPLICITLY asks you to add something (e.g. "add this to my list", "put it in my library", "add to my watchlist"). NEVER add items proactively or on your own initiative. When you do add, provide a short, engaging 1-2 sentence personalized review or trivia in the notes field.

3. **Recommendations**: If a user asks for recommendations based on their taste, use the getUserLibrary tool to analyze their current watchlist (pay attention to genres and highly rated/watched items). Then suggest 2-3 NEW items they haven't seen yet, explaining exactly why they will like them based on their library.

BEHAVIOR:
- Never apologize excessively. Be confident, concise, and sophisticated.
- Do not narrate your tool usage (don't say "I will now search for..."). Just do it.
- Format your text beautifully using markdown (bolding titles, using bullet points).`;

/**
 * Client-supplied conversation turns.
 *
 * `role` is deliberately limited to user/assistant. A client that can send
 * `role: "system"` gets a second system message spliced in ahead of the tool
 * definitions below — and those tools write to the caller's library. Prompt
 * text is not an authorization boundary, so the boundary lives here.
 */
const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_MESSAGE_CHARS),
});

const ChatBodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(MAX_MESSAGES),
});

function getApiKey() {
  return process.env.AI_API_KEY?.trim();
}

export function GET() {
  return Response.json(
    { enabled: Boolean(getApiKey()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const apiKey = getApiKey();
  if (!apiKey) return new Response("AI assistant is unavailable", { status: 503 });

  let accountId: string;
  let token: string;
  try {
    const { response: verified, accessToken } = await fetchWithSession("/auth/me", { cache: "no-store" });
    if (verified.status === 401) return new Response("Unauthorized", { status: 401 });
    if (!verified.ok) return new Response("Session service unavailable", { status: 503 });
    const user = await verified.json();
    if (typeof user.id !== "string") return new Response("Session service unavailable", { status: 503 });
    if (!accessToken) return new Response("Unauthorized", { status: 401 });
    accountId = user.id;
    token = accessToken;
  } catch {
    return new Response("Session service unavailable", { status: 503 });
  }

  if (!checkChatRateLimit(accountId)) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(RATE_LIMIT_WINDOW_MS / 1000) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const parsed = ChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request body", { status: 400 });
  }
  const { messages } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Widened past the validated client shape: the loop appends assistant
        // turns (whose content is null when the model only requested tools)
        // and tool results. Client input is still narrowed to user/assistant
        // by ChatBodySchema before it reaches here.
        const conversation: ConversationMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ];

        // Bounded: the loop only exits when the model stops requesting tools,
        // so a model that keeps calling them would spin until maxDuration.
        let keepGoing = true;
        for (let turn = 0; keepGoing && turn < MAX_TOOL_TURNS; turn++) {
          const apiRes = await fetch(AI_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: AI_MODEL,
              messages: conversation,
              tools: TOOLS,
              stream: true,
            }),
          });

          if (!apiRes.ok) {
            const errBody = await apiRes.text();
            console.error("AI API error:", apiRes.status, errBody);
            controller.enqueue(
              encoder.encode(`[Error: AI API returned ${apiRes.status}]`),
            );
            break;
          }

          const reader = apiRes.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let assistantMessage = "";
          const toolCalls: ToolCall[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                  assistantMessage += delta.content;
                  controller.enqueue(encoder.encode(delta.content));
                }

                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    if (!toolCalls[idx]) {
                      toolCalls[idx] = {
                        id: tc.id || "",
                        type: "function",
                        function: {
                          name: tc.function?.name || "",
                          arguments: "",
                        },
                      };
                    }
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name)
                      toolCalls[idx].function.name = tc.function.name;
                    if (tc.function?.arguments)
                      toolCalls[idx].function.arguments +=
                        tc.function.arguments;
                  }
                }
              } catch {}
            }
          }

          if (toolCalls.length === 0) {
            keepGoing = false;
            break;
          }

          conversation.push({
            role: "assistant" as const,
            content: assistantMessage || null,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: tc.function,
            })),
          });

          for (const tc of toolCalls) {
            try {
              const args = JSON.parse(tc.function.arguments);
              const result = await executeTool(tc.function.name, args, token);
              const resultStr = JSON.stringify(result);
              conversation.push({
                role: "tool",
                tool_call_id: tc.id,
                content: resultStr,
              });
            } catch (e) {
              conversation.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ error: String(e) }),
              });
            }
          }
        }
      } catch (e: unknown) {
        // Log the detail; stream a generic message. Raw exception text can
        // carry upstream URLs and internals straight to the browser.
        console.error("Chat error:", e);
        controller.enqueue(
          encoder.encode("[Error: something went wrong. Please try again.]"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
