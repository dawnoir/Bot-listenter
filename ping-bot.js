const Web3 = require("web3");
const fs = require("fs");
require("dotenv").config();

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.SEPOLIA_WSS),
);

const ABI = require("./abi.json");
const ADDRESS = "0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d";

const STATE_FILE = "botState.json";
const PROCESSED_TX_FILE = "processedTx.json";
const contract = new web3.eth.Contract(ABI, ADDRESS);

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const account = web3.eth.accounts.privateKeyToAccount("0x" + PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

let startingBlock = 0;
let lastProcessedBlock = 0;
let processedTxs = new Set();

/* Function that retrieves last processed block and starting block */
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATE_FILE));
    startingBlock = data.startingBlock || 0;
    lastProcessedBlock = data.lastProcessedBlock || 0;
  }
  if (fs.existsSync(PROCESSED_TX_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROCESSED_TX_FILE));
    processedTxs = new Set(data);
  }
}

/* Updates the STATE_FILE */
function saveState() {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ startingBlock, lastProcessedBlock }, null, 2),
  );
  fs.writeFileSync(
    PROCESSED_TX_FILE,
    JSON.stringify([...processedTxs], null, 2),
  );
}

async function sendWithRetry(rawTx, maxRetries = 3, delayMs = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const receipt = await web3.eth.sendSignedTransaction(rawTx);
      console.log(" Pong sent! Tx hash: ${receipt.transactionHash}");
      return receipt;
    } catch (err) {
      console.error(" Error: ${err.message}");
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        throw err;
      }
    }
  }
}

async function handlePingEvent(event) {
  const txHash = event.transactionHash;
  const eventId = txHash + ":" + event.logIndex;
  if (processedTxs.has(eventId)) {
    console.log(`Event already processed: ${eventId}`);
    return;
  }
  try {
    const tx = contract.methods.pong(txHash);
    const gas = await tx.estimateGas({ from: account.address });
    const gasPrice = await web3.eth.getGasPrice();
    const pendingNonce = await web3.eth.getTransactionCount(
      account.address,
      "pending",
    );
    const txData = {
      to: ADDRESS,
      data: tx.encodeABI(),
      gas,
      gasPrice: Math.floor(parseInt(gasPrice) * 1.2),
      nonce: pendingNonce,
    };
    const signedTx = await web3.eth.accounts.signTransaction(
      txData,
      PRIVATE_KEY,
    );
    await sendWithRetry(signedTx.rawTransaction);

    processedTxs.add(eventId);
    lastProcessedBlock = event.blockNumber;
    saveState();
  } catch (err) {
    console.error("Error processing Ping event:", err.message);
  }
}

function pingListener() {
  console.log("Listening for Ping events from contract: " + ADDRESS);
  contract.events
    .Ping({ fromBlock: "latest" })
    .on("data", async (event) => {
      if (event.blockNumber > lastProcessedBlock) {
        await handlePingEvent(event);
      }
    })
    .on("error", (err) => {
      console.error("Error on listener:", err.message);
    });
}

async function fetchPastPings() {
  const currentBlock = await web3.eth.getBlockNumber();
  const fromBlock = lastProcessedBlock + 1;

  if ((startingBlock === 0) & (lastProcessedBlock === 0)) {
    return;
  }

  if (fromBlock > currentBlock) {
    console.log("All past ping events handled.");
    return;
  }

  try {
    const events = await contract.getPastEvents("Ping", {
      fromBlock,
      toBlock: "latest",
    });
    for (const event of events) {
      await handlePingEvent(event);
    }
  } catch (err) {
    console.error("There is an error fetching past events: ", err.message);
  }
}

async function main() {
  loadState();
  if (startingBlock === 0) {
    //save the blocknumber that the bot started and equals to lastProcessed just for the 1st run
    startingBlock = await web3.eth.getBlockNumber();
    console.log("Starting block:", startingBlock);
    lastProcessedBlock = startingBlock;
    saveState();
  }
  await fetchPastPings();
  pingListener();
}

main();