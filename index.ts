import { Agent, Conversation } from "@xmtp/agent-sdk";

console.log("ntfy-xmtp-relay");
console.log("Initializing XMTP...");

// Validate required env vars upfront
const requiredEnvVars = [
  "XMTP_WALLET_KEY",
  "XMTP_DB_ENCRYPTION_KEY",
  "XMTP_DB_PATH",
  "XMTP_ENV",
  "RECIPIENT_TYPE",
  "RECIPIENT_ID",
  "NTFY_BASE_URL",
  "NTFY_TOPICS",
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

let agent: Agent;
try {
  agent = await Agent.createFromEnv({
    dbPath: (inboxId: string) =>
      `${process.env.XMTP_DB_PATH}/xmtp-${process.env.XMTP_ENV}-${inboxId}.db3`,
  });
} catch (err) {
  console.error("Failed to initialize XMTP agent:", err);
  process.exit(1);
}

console.log("XMTP initialized.");
console.log(`ETH Address: ${agent.address}`);
console.log(`Inbox ID: ${agent.client.inboxId}`);
console.log(`Environment: ${agent.client.options?.env}`);

let recipient_convo: Conversation;

try {
  if (process.env.RECIPIENT_TYPE === "addr") {
    recipient_convo = await agent.createDmWithAddress(process.env.RECIPIENT_ID!);

  } else if (process.env.RECIPIENT_TYPE === "inboxId") {
    recipient_convo = await agent.client.conversations.createDm(process.env.RECIPIENT_ID!);

  } else if (process.env.RECIPIENT_TYPE === "bsky") {
    let did: string;
    let pdsUrl: string | undefined;

    if (process.env.RECIPIENT_ID!.startsWith("did:")) {
      did = process.env.RECIPIENT_ID!;
    } else {
      const profileRequest = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${process.env.RECIPIENT_ID}`
      );
      if (!profileRequest.ok) {
        throw new Error(`Bluesky profile lookup failed: ${profileRequest.status} ${profileRequest.statusText}`);
      }
      const profileData = await profileRequest.json();
      if (!profileData.did) {
        throw new Error(`No DID found in Bluesky profile response for ${process.env.RECIPIENT_ID}`);
      }
      did = profileData.did;
    }

    const plcRequest = await fetch(`https://plc.directory/${did}`);
    if (!plcRequest.ok) {
      throw new Error(`PLC directory lookup failed: ${plcRequest.status} ${plcRequest.statusText}`);
    }
    const plcData = await plcRequest.json();

    if (!Array.isArray(plcData.service)) {
      throw new Error(`Unexpected PLC directory response shape for DID ${did}`);
    }
    plcData.service.forEach((service: { type: string; serviceEndpoint: string }) => {
      if (service.type === "AtprotoPersonalDataServer") {
        pdsUrl = service.serviceEndpoint;
      }
    });
    if (!pdsUrl) {
      throw new Error(`No AtprotoPersonalDataServer found in PLC record for DID ${did}`);
    }

    const inboxRecordRequest = await fetch(
      `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=org.xmtp.inbox&rkey=self`
    );
    if (!inboxRecordRequest.ok) {
      throw new Error(`XMTP inbox record lookup failed: ${inboxRecordRequest.status} ${inboxRecordRequest.statusText}`);
    }
    const inboxRecordData = await inboxRecordRequest.json();
    if (!inboxRecordData?.value?.id) {
      throw new Error(`No XMTP inbox ID found in AT Proto record for DID ${did}`);
    }

    recipient_convo = await agent.client.conversations.createDm(inboxRecordData.value.id);

  } else {
    console.error("Invalid RECIPIENT_TYPE! Must be addr, inboxId, or bsky.");
    process.exit(1);
  }
} catch (err) {
  console.error("Failed to establish recipient conversation:", err);
  process.exit(1);
}

console.log(`Messages will be sent to ${process.env.RECIPIENT_TYPE}:${process.env.RECIPIENT_ID}`);
console.log(`Connecting to ntfy with URL ${process.env.NTFY_BASE_URL}/${process.env.NTFY_TOPICS}/ws`);

const ntfy_connection = new WebSocket(
  `${process.env.NTFY_BASE_URL}/${process.env.NTFY_TOPICS}/ws`
);

ntfy_connection.addEventListener("open", () => {
  console.log("Successfully connected to ntfy. Beginning to monitor for messages.");
});

ntfy_connection.addEventListener("error", (ev) => {
  console.error("WebSocket error:", ev);
});

ntfy_connection.addEventListener("close", (ev) => {
  console.warn(`WebSocket closed (code ${ev.code}). Exiting.`);
  // Depending on your needs, you could attempt reconnection here instead.
  process.exit(1);
});

ntfy_connection.addEventListener("message", async (ev) => {
  let message: any;
  try {
    message = JSON.parse(ev.data);
  } catch {
    console.error("Failed to parse ntfy message as JSON:", ev.data);
    return;
  }

  if (message.event === "message") {
    const text = message.title
      ? `${message.title}: ${message.message}`
      : message.message;

    if (!text) {
      console.warn(`Received message event ${message.id} with no content, skipping.`);
      return;
    }

    try {
      const sentMessage = await recipient_convo.sendText(text);
      if (sentMessage) {
        console.log(`Message sent for event ${message.id}`);
      } else {
        console.error(`sendText returned falsy for event ${message.id}`);
      }
    } catch (err) {
      console.error(`Failed to send XMTP message for event ${message.id}:`, err);
    }
  }
});