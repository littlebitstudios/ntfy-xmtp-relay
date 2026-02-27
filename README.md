# ntfy-xmtp-relay

A simple Node.js program that relays notifications from ntfy through an XMTP direct message.

# Usage

## Getting XMTP Keys
You'll need to get keys to fill in the `XMTP_WALLET_KEY` and `XMTP_DB_ENCRYPTION_KEY` variables.

XMTP has a generator in their documentation that you can use: https://docs.xmtp.org/agents/get-started/build-an-agent#local-key-generator

## Use with Docker

You'll need Docker on your computer.

Copy `example-compose.yml` to a folder and rename it to `compose.yml`, then edit the variables under `environment:` in that file. There are comments in the Compose file to explain the variables.

## Use Standalone

You'll need Node.js on your computer.

Clone the repository and run `npm i` to install the dependencies.

Copy `.env.example` and rename it to .env, and edit the variables in the file. There are comments to explain the variables.

You can run the program with `npx tsx index.ts`.

# License

This project is licensed under the MIT license.