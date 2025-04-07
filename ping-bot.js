const Web3 = require("web3");
const fs = require("fs");
require("dotenv").config();

const web3 = new Web3(
  "wss://sepolia.infura.io/ws/v3/6f968d1ef7b4485ca20b08562dcb1757",
);

const ABI = require("./abi.json");
const ADDRESS = "0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d";

const STATE_FILE = "botState.json";
const contract = new web3.eth.Contract(ABI, ADDRESS);

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const account = web3.eth.accounts.privateKeyToAccount("0x" + PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

let startingBlock = 0;
let lastProcessedBlock = 0;

/* Function that retrieves last processed block and starting block */
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATE_FILE));
    startingBlock = data.startingBlock || 0;
    lastProcessedBlock = data.lastProcessedBlock || 0;
  }
}

/* Updates the STATE_FILE */
function saveState() {
  const data = {
    startingBlock,
    lastProcessedBlock,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

async function handlePingEvent(event) {
  const txHash = event.transactionHash;
  try {
    const tx = contract.methods.pong(txHash);
    const gas = await tx.estimateGas({ from: account.address });
    const gasPrice = await web3.eth.getGasPrice();

    const txData = {
      to: ADDRESS,
      data: tx.encodeABI(),
      gas,
      gasPrice,
    };
    const signedTx = await web3.eth.accounts.signTransaction(
      txData,
      PRIVATE_KEY,
    );
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

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
      } else {
        console.log("Event already processed");
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
    lastProcessedBlock = startingBlock;
    saveState();
  }
  await fetchPastPings();
  pingListener();
}

main();