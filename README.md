# 🔁 Ethereum Ping-Pong Bot

This bot listens for `Ping()` events on a smart contract and responds with a `pong(txHash)` transaction.  
It is built to be **reliable**, **resilient**, and **recover automatically** from crashes or network failures.

---

## 📦 Features

- ✅ Listens to live `Ping()` events via WebSocket
- ✅ Sends `pong()` transactions in response
- ✅ Recovers missed events on restart (`getPastEvents`)
- ✅ Persists state (last processed block + handled events)
- ✅ Retries transactions with exponential gas and backoff
- ✅ Avoids duplicate processing with event IDs

---

## ⚙️ Requirements

- Node.js v16+
- `.env` file with the following:

```env
SEPOLIA_WSS=wss://your-sepolia-ws-endpoint
PRIVATE_KEY=your_private_key_without_0x
