require("dotenv").config({ path: ".env.local" });

const http = require("http");
const WebSocket = require("ws");
const { GoogleAuth } = require("google-auth-library");

const PORT = process.env.PORT || 3001;
const PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID;
const LANGUAGE_CODE = process.env.DIALOGFLOW_LANGUAGE_CODE || "en-US";
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const SERVICE_ACCOUNT_BASE64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;

if (!PROJECT_ID) {
  console.error("Missing DIALOGFLOW_PROJECT_ID environment variable.");
  process.exit(1);
}

function parseServiceAccountFromEnv() {
  try {
    if (SERVICE_ACCOUNT_JSON) {
      return JSON.parse(SERVICE_ACCOUNT_JSON);
    }

    if (SERVICE_ACCOUNT_BASE64) {
      const decoded = Buffer.from(SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
      return JSON.parse(decoded);
    }

    return null;
  } catch (error) {
    console.error("Invalid Google service account JSON in environment variables.");
    console.error(error);
    process.exit(1);
  }
}

const serviceAccountCredentials = parseServiceAccountFromEnv();
const authOptions = {
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
};

if (serviceAccountCredentials) {
  authOptions.credentials = serviceAccountCredentials;
}

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const auth = new GoogleAuth(authOptions);

async function getAccessToken() {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken) {
    throw new Error("Unable to obtain Google access token.");
  }
  return typeof accessToken === "string" ? accessToken : accessToken.token;
}

async function detectIntent(sessionId, text) {
  const token = await getAccessToken();
  const url = `https://dialogflow.googleapis.com/v2/projects/${PROJECT_ID}/agent/sessions/${sessionId}:detectIntent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      queryInput: {
        text: {
          text,
          languageCode: LANGUAGE_CODE,
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMessage = data.error?.message || JSON.stringify(data);
    throw new Error(errorMessage);
  }

  return data.queryResult?.fulfillmentText || "Sorry, I could not understand that.";
}

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Webhook endpoint for Dialogflow
  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const webhookRequest = JSON.parse(body);
        console.log("Webhook received:", JSON.stringify(webhookRequest, null, 2));

        const fulfillmentText = await handleWebhookRequest(webhookRequest);

        const response = {
          fulfillmentText,
          fulfillmentMessages: [
            {
              text: {
                text: [fulfillmentText],
              },
            },
          ],
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error("Webhook error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            fulfillmentText: "An error occurred processing your request.",
          })
        );
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

async function handleWebhookRequest(webhookRequest) {
  const { queryResult } = webhookRequest;
  const { intent, parameters, queryText } = queryResult;

  console.log(`Intent: ${intent.displayName}`);
  console.log(`Query: ${queryText}`);
  console.log(`Parameters:`, parameters);

  // Add your custom logic here based on intent
  let response = "I received your message: " + queryText;

  // Example: Simple echo response
  if (intent.displayName.includes("greeting")) {
    response = "Hello! How can I help you?";
  } else if (intent.displayName.includes("weather")) {
    response = "I can help with weather information. Which city?";
  }

  return response;
}

const wss = new WebSocket.Server({ server });

wss.on("connection", (socket) => {
  const sessionId = `session-${Math.random().toString(36).slice(2, 10)}`;

  socket.send(
    JSON.stringify({
      type: "status",
      text: "Connected to Dialogflow WebSocket server.",
      sessionId,
    })
  );

  socket.on("message", async (message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: "error",
          text: "Invalid JSON payload received.",
        })
      );
      return;
    }

    if (payload.type !== "user_message" || typeof payload.text !== "string") {
      socket.send(
        JSON.stringify({
          type: "error",
          text: "Expected a user_message payload with a text string.",
        })
      );
      return;
    }

    try {
      const reply = await detectIntent(sessionId, payload.text);
      socket.send(
        JSON.stringify({
          type: "bot_response",
          text: reply,
        })
      );
    } catch (error) {
      console.error("Dialogflow request failed:", error);
      socket.send(
        JSON.stringify({
          type: "error",
          text: error.message || "Dialogflow request failed.",
        })
      );
    }
  });

  socket.on("close", () => {
    console.log(`WebSocket disconnected session=${sessionId}`);
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
});
