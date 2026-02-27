import { Agent, Conversation } from "@xmtp/agent-sdk";

console.log("ntfy-xmtp-relay");
console.log("Initializing XMTP...");

if (!Boolean(process.env.XMTP_WALLET_KEY) || !Boolean(process.env.XMTP_DB_ENCRYPTION_KEY)) {
    console.error("One or both of the XMTP keys are missing!");
    process.exitCode = 1;
    process.exit();
}

const agent = await Agent.createFromEnv({dbPath: function(inboxId){
    return `${process.env.XMTP_DB_PATH}/xmtp-${process.env.XMTP_ENV}-${inboxId}.db3`
}});

console.log("XMTP initialized.");
console.log(`ETH Address: ${agent.address}`);
console.log(`Inbox ID: ${agent.client.inboxId}`);
console.log(`Environment: ${agent.client.options?.env}`);

let recipient_convo:Conversation;

if (process.env.RECIPIENT_TYPE === "addr") {
    recipient_convo = await agent.createDmWithAddress(process.env.RECIPIENT_ID);
} else if (process.env.RECIPIENT_TYPE === "inboxId") {
    recipient_convo = await agent.client.conversations.createDm(process.env.RECIPIENT_ID);
}

console.log(`Messages will be sent to ${process.env.RECIPIENT_TYPE}:${process.env.RECIPIENT_ID}`);

console.log(`Connecting to ntfy with URL ${process.env.NTFY_BASE_URL}/${process.env.NTFY_TOPICS}/ws`);

const ntfy_connection = new WebSocket(`${process.env.NTFY_BASE_URL}/${process.env.NTFY_TOPICS}/ws`);

ntfy_connection.addEventListener('open', (ev) => {
    console.log("Successfully connected to ntfy. Beginning to monitor for messages.");
})

ntfy_connection.addEventListener('message', async (ev) => {
    const message = JSON.parse(ev.data);

    if (message.event === 'message') {
        let sentMessage;

        if (message.title) {
            sentMessage = await recipient_convo.sendMarkdown(`**${message.title}**\n${message.message}`);
        } else {
            sentMessage = await recipient_convo.sendText(message.message);
        }

        if (sentMessage) {
            console.log(`Message sent for event ${message.id}`);
        } else {
            console.error(`Failed to send message for event ${message.id}`);
        }
    }
})