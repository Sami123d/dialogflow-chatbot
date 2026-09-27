const test = require("node:test");
const assert = require("node:assert/strict");

const { handleClientMessage, handleWebhookRequest } = require("../server.js");

test("forwards a user_message to Dialogflow and returns bot_response", async () => {
  const calls = [];
  const fakeDetect = async (sessionId, text) => {
    calls.push({ sessionId, text });
    return "Hello from the agent";
  };

  const res = await handleClientMessage(
    JSON.stringify({ type: "user_message", text: "hi" }),
    "session-abc",
    fakeDetect
  );

  assert.deepEqual(calls, [{ sessionId: "session-abc", text: "hi" }]);
  assert.deepEqual(res, { type: "bot_response", text: "Hello from the agent" });
});

test("accepts a Buffer, as delivered by the ws library", async () => {
  const res = await handleClientMessage(
    Buffer.from(JSON.stringify({ type: "user_message", text: "buf" })),
    "s",
    async (_s, text) => `echo:${text}`
  );
  assert.deepEqual(res, { type: "bot_response", text: "echo:buf" });
});

test("rejects invalid JSON without calling Dialogflow", async () => {
  let called = false;
  const res = await handleClientMessage("not json", "s", async () => {
    called = true;
  });
  assert.equal(called, false);
  assert.deepEqual(res, { type: "error", text: "Invalid JSON payload received." });
});

test("rejects payloads with the wrong shape", async () => {
  const detect = async () => assert.fail("detect should not be called");
  for (const bad of [
    { type: "other", text: "hi" },
    { type: "user_message", text: 42 },
    { type: "user_message" },
    null,
  ]) {
    const res = await handleClientMessage(JSON.stringify(bad), "s", detect);
    assert.equal(res.type, "error");
    assert.match(res.text, /user_message/);
  }
});

test("returns the Dialogflow error message as an error payload", async () => {
  const origError = console.error;
  console.error = () => {};
  try {
    const res = await handleClientMessage(
      JSON.stringify({ type: "user_message", text: "hi" }),
      "s",
      async () => {
        throw new Error("Permission denied");
      }
    );
    assert.deepEqual(res, { type: "error", text: "Permission denied" });
  } finally {
    console.error = origError;
  }
});

test("webhook handler picks a response based on intent name", async () => {
  const origLog = console.log;
  console.log = () => {};
  try {
    const make = (displayName, queryText = "q") => ({
      queryResult: { intent: { displayName }, parameters: {}, queryText },
    });
    assert.equal(await handleWebhookRequest(make("Default greeting")), "Hello! How can I help you?");
    assert.equal(
      await handleWebhookRequest(make("get.weather")),
      "I can help with weather information. Which city?"
    );
    assert.equal(
      await handleWebhookRequest(make("other", "tell me a joke")),
      "I received your message: tell me a joke"
    );
  } finally {
    console.log = origLog;
  }
});
