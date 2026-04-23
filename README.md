This is a [Next.js](https://nextjs.org) project with a WebSocket-based chat UI and a separate Node.js WebSocket server that forwards messages to Dialogflow ES.

## Project Overview

- `app/components/chat.tsx` contains the frontend chat interface.
- `server.js` implements the WebSocket server and Dialogflow ES REST integration.
- The frontend and server communicate in real time over WebSocket, matching the evaluation requirements.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set Dialogflow environment variables:

- `DIALOGFLOW_PROJECT_ID` — your Dialogflow ES project ID
- `GOOGLE_APPLICATION_CREDENTIALS` — path to a Google Cloud service account JSON file
- (Optional) `DIALOGFLOW_LANGUAGE_CODE` — default is `en-US`

Example (PowerShell):

```powershell
$env:DIALOGFLOW_PROJECT_ID = "your-project-id"
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
```

3. Start the WebSocket server:

```bash
npm run server
```

4. Start the Next.js app in a separate terminal:

```bash
npm run dev
```

5. Open the chat UI:

```text
http://localhost:3000
```

## How it works

- The browser opens a WebSocket connection to `ws://localhost:3001`.
- The server receives user messages and forwards them to Dialogflow ES with `/detectIntent`.
- Dialogflow responses are sent back over WebSocket and rendered in the chat UI.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs/app)
- [Dialogflow ES REST API](https://cloud.google.com/dialogflow/es/docs/reference/rest/v2/projects.agent.sessions/detectIntent)

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
