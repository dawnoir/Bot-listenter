# Bot-listenter

A Node.js bot that listens for `Ping` events from an Ethereum smart contract (on the Sepolia testnet via WebSocket) and automatically responds by calling the `pong` function. Perfect for automation triggered by smart contract events.

---

## ⚙️ How It Works

- Connects to the Sepolia Ethereum network using WebSocket.
- Listens for `Ping` events emitted by a specified contract.
- When a new `Ping` is detected, it sends a transaction calling the `pong` function.
- Maintains state using a local JSON file to avoid processing duplicate events.

---

## 📦 Requirements

- Node.js 16+
- An Ethereum account with Sepolia ETH
- A `.env` file containing:
  ```env
  PRIVATE_KEY=your_private_key_without_0x
  SEPOLIA_WSS=wss://your-sepolia-websocket-url
