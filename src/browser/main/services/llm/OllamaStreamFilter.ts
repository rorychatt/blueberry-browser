export async function ollamaFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const originalResponse = await globalThis.fetch(input, init);

  if (!originalResponse.body) {
    return originalResponse;
  }

  const modifiedStream = new ReadableStream({
    async start(controller) {
      const reader = originalResponse.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      const encoder = new TextEncoder();
      let inReasoning = false;
      let buffer = "";

      const processLine = (line: string) => {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") {
            controller.enqueue(encoder.encode(line + "\n"));
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              const reasoning = delta.reasoning;
              const content = delta.content;

              if (reasoning && (!content || content === "")) {
                if (!inReasoning) {
                  inReasoning = true;
                  delta.content = "<think>\n" + reasoning;
                } else {
                  delta.content = reasoning;
                }
                delete delta.reasoning;
              } else if (content && content !== "") {
                if (inReasoning) {
                  inReasoning = false;
                  delta.content = "\n</think>\n\n" + content;
                }
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n`));
          } catch {
            controller.enqueue(encoder.encode(line + "\n"));
          }
        } else {
          controller.enqueue(encoder.encode(line + "\n"));
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              processLine(buffer);
            }
            if (inReasoning) {
              const lastLine =
                'data: {"id":"chatcmpl-custom","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"\\n</think>\\n\\n"}}]}\n';
              controller.enqueue(encoder.encode(lastLine));
            }
            break;
          }

          const chunkText = decoder.decode(value, { stream: true });
          buffer += chunkText;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            processLine(line);
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(modifiedStream, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers: originalResponse.headers,
  });
}
