import assert from "node:assert/strict";
import { it } from "node:test";
import { doubaoProvider } from "../src/server/search.ts";

for (const edition of ["custom", "global"] as const) {
	it(`Doubao ${edition}: correct endpoint, auth, count and normalized evidence`, async () => {
		const provider = doubaoProvider(edition, "private-fake-key", async (url, init) => {
			assert.equal(url, `https://open.feedcoopapi.com/search_api/${edition === "custom" ? "web_search" : "global_search"}`);
			assert.equal((init.headers as Record<string, string>).authorization, "Bearer private-fake-key");
			assert.equal(init.method, "POST");
			const body = JSON.parse(init.body as string);
			assert.equal(body.Query, "架构 原理");
			assert.equal(body.SearchType, "web");
			assert.equal(body[edition === "custom" ? "Count" : "DocCount"], edition === "custom" ? 50 : 20);
			const row = { Title: "Official", Url: "https://example.com/docs", Summary: "summary\n evidence", Snippet: edition === "custom" ? "short display" : [{ Type: "image", Text: "skip" }, { Type: "text", Text: "summary\n evidence" }] };
			return Response.json({ Result: { [edition === "custom" ? "WebResults" : "Documents"]: [null, { Url: "file:///private" }, row], ErrorCode: 0 } });
		});
		assert.deepEqual(await provider.search("架构 原理", 99), [{ title: "Official", url: "https://example.com/docs", snippet: "summary evidence" }]);
	});
	it(`Doubao ${edition}: rejects HTTP, service errors and malformed responses without leaking bodies`, async () => {
		for (const response of [new Response("private-fake-key", { status: 401 }), Response.json({ ResponseMetadata: { Error: { Message: "private-fake-key" } } }), Response.json({ Result: { ErrorCode: 10403, ErrorMsg: "private-fake-key" } }), Response.json({}), new Response("private-fake-key")]) {
			await assert.rejects(doubaoProvider(edition, "private-fake-key", async () => response).search("q", 1), (error: Error) => !error.message.includes("private-fake-key"));
		}
	});
	it(`Doubao ${edition}: valid zero results and bounded snippets`, async () => {
		assert.deepEqual(await doubaoProvider(edition, "fake", async () => Response.json({ Result: { ResultCount: 0, TotalDocCount: 0, ErrorCode: 0 } })).search("q", 1), []);
	});
}
