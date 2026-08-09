import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { POST } from "@/app/api/chat/route";

/** Encode a list of OpenAI-style SSE deltas as a streaming response body. */
function sseStream(chunks: unknown[]): Response {
  const body = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(c)}\n\n`));
      }
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function textDelta(content: string) {
  return { choices: [{ delta: { content } }] };
}

function toolDelta(name: string, args: string, id = "call_1") {
  return {
    choices: [
      {
        delta: {
          tool_calls: [{ index: 0, id, function: { name, arguments: args } }],
        },
      },
    ],
  };
}

function chatRequest(messages: unknown[] = [{ role: "user", content: "hi" }]) {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

async function readAll(res: Response): Promise<string> {
  return await new Response(res.body).text();
}

describe("POST /api/chat", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    cookieStore.get.mockReturnValue({ value: "token-123" });
    process.env.AI_API_KEY = "test-key";
  });

  it("rejects an unauthenticated request", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const res = await POST(chatRequest());
    expect(res.status).toBe(401);
  });

  it("errors when the AI key is not configured", async () => {
    delete process.env.AI_API_KEY;
    const res = await POST(chatRequest());
    expect(res.status).toBe(500);
  });

  it("streams assistant text back to the client", async () => {
    fetchMock.mockResolvedValueOnce(
      sseStream([textDelta("Hello "), textDelta("there.")]),
    );

    const out = await readAll(await POST(chatRequest()));
    expect(out).toBe("Hello there.");
  });

  it("surfaces an upstream AI failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 502 }));

    const out = await readAll(await POST(chatRequest()));
    expect(out).toContain("502");
  });

  describe("getUserLibrary tool", () => {
    it("reads items out of the paginated envelope", async () => {
      // GET /watchlist returns { items, total, ... }. Treating it as an array
      // threw "data.map is not a function" on every call.
      fetchMock
        .mockResolvedValueOnce(sseStream([toolDelta("getUserLibrary", "{}")]))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              items: [
                {
                  title: "Dune",
                  mediaType: "movie",
                  status: "watched",
                  year: 2021,
                },
              ],
              total: 1,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(sseStream([textDelta("You watched Dune.")]));

      const out = await readAll(await POST(chatRequest()));
      expect(out).toContain("You watched Dune.");

      // The tool result fed back to the model must contain the real title.
      const followUp = JSON.parse(fetchMock.mock.calls[2][1].body as string);
      const toolMessage = followUp.messages.find(
        (m: { role: string }) => m.role === "tool",
      );
      expect(toolMessage.content).toContain("Dune");
      expect(toolMessage.content).not.toContain("is not a function");
    });

    it("still accepts a bare array for backwards compatibility", async () => {
      fetchMock
        .mockResolvedValueOnce(sseStream([toolDelta("getUserLibrary", "{}")]))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                title: "Arrival",
                mediaType: "movie",
                status: "watched",
                year: 2016,
              },
            ]),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(sseStream([textDelta("ok")]));

      await readAll(await POST(chatRequest()));

      const followUp = JSON.parse(fetchMock.mock.calls[2][1].body as string);
      const toolMessage = followUp.messages.find(
        (m: { role: string }) => m.role === "tool",
      );
      expect(toolMessage.content).toContain("Arrival");
    });

    it("reports a backend failure as a tool error", async () => {
      fetchMock
        .mockResolvedValueOnce(sseStream([toolDelta("getUserLibrary", "{}")]))
        .mockResolvedValueOnce(new Response("{}", { status: 500 }))
        .mockResolvedValueOnce(sseStream([textDelta("done")]));

      await readAll(await POST(chatRequest()));

      const followUp = JSON.parse(fetchMock.mock.calls[2][1].body as string);
      const toolMessage = followUp.messages.find(
        (m: { role: string }) => m.role === "tool",
      );
      expect(toolMessage.content).toContain("Failed to fetch user library");
    });
  });

  it("stops dispatching tools after the turn cap", async () => {
    // A model that never stops calling tools previously spun until maxDuration.
    fetchMock.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("/watchlist")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return sseStream([toolDelta("getUserLibrary", "{}")]);
    });

    await readAll(await POST(chatRequest()));

    const aiCalls = fetchMock.mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("chat/completions"),
    );
    expect(aiCalls.length).toBeLessThanOrEqual(8);
  });
});
