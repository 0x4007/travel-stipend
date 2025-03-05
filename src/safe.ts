import axios from "axios";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["PRIVATE_KEY", "SAFE_ADDRESS", "RPC_URL"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// ====== Configuration: Safe details and RPC/keys ======
const SAFE_ADDRESS = process.env.SAFE_ADDRESS!; // Gnosis Safe address (on chain 100)
const RPC_URL = process.env.RPC_URL!; // Gnosis Chain RPC endpoint
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY!; // Safe owner private key

// Get the transaction hash to sign from env
const SAFE_TX_HASH = process.env.SAFE_TX_HASH!;
if (!SAFE_TX_HASH) {
  throw new Error("Missing required environment variable: SAFE_TX_HASH");
}

// ====== ABI fragments for Gnosis Safe (needed events and functions) ======
const SAFE_ABI = [
  // Events for on-chain approvals and execution outcomes
  "event ApproveHash(bytes32 indexed approvedHash, address indexed owner)",
  "event ExecutionSuccess(bytes32 indexed txHash, uint256 payment)",
  "event ExecutionFailure(bytes32 indexed txHash, uint256 payment)",
  // Required state getters
  "function nonce() view returns (uint256)",
  "function getThreshold() view returns (uint256)",
];

// ====== Initialize ethers provider and contract ======
const provider = new ethers.JsonRpcProvider(RPC_URL);
const safeContract = new ethers.Contract(SAFE_ADDRESS, SAFE_ABI, provider);
const signer = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

(async () => {
  try {
    console.log("🔗 Connecting to Gnosis Chain (chainId 100)...");
    const network = await provider.getNetwork();
    console.log(`✅ Connected to network: ${network.name} (chainId ${network.chainId})`);

    // Fetch Safe contract state
    const [currentNonce, threshold] = await Promise.all([
      safeContract.nonce().then((n: bigint) => Number(n)),
      safeContract.getThreshold().then((t: bigint) => Number(t)),
    ]);
    console.log(`🔎 Safe at ${SAFE_ADDRESS}`);
    console.log(`   - Current nonce: ${currentNonce}`);
    console.log(`   - Required confirmations (threshold): ${threshold}`);

    // Fetch both on-chain approvals and Safe API pending transactions
    console.log("📡 Fetching pending transactions from on-chain events and Safe API...");

    // Initialize approvals tracking
    interface ApprovalsMap {
      [txHash: string]: Set<string>;
    }
    const approvals: ApprovalsMap = {};

    // Fetch transaction details from Safe API
    console.log("🔍 Fetching transaction details from Safe API...");
    const apiUrl = `https://safe-client.safe.global/v1/chains/100/transactions/${SAFE_TX_HASH}`;

    try {
      const response = await axios.get(apiUrl);
      console.log("Raw API Response:", JSON.stringify(response.data, null, 2));

      const txData = response.data.txData;
      const execInfo = response.data.detailedExecutionInfo;

      if (!txData || !execInfo) {
        throw new Error("Transaction details not found in response");
      }

      // Extract the transaction details from the response
      const txDetails = {
        to: txData.to.value,
        value: txData.value,
        data: txData.hexData,
        operation: txData.operation,
        nonce: execInfo.nonce,
        safeTxGas: execInfo.safeTxGas,
        baseGas: execInfo.baseGas,
        gasPrice: execInfo.gasPrice,
        gasToken: execInfo.gasToken,
        refundReceiver: execInfo.refundReceiver.value
      };

      console.log("Parsed Transaction Details:", txDetails);

      // Sign the transaction
      console.log(`✍️  Signing Safe transaction hash ${SAFE_TX_HASH} with owner key ${signer.address}...`);

      const domain = {
        chainId: 100,
        verifyingContract: SAFE_ADDRESS
      };

      const types = {
        SafeTx: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
          { name: 'operation', type: 'uint8' },
          { name: 'safeTxGas', type: 'uint256' },
          { name: 'baseGas', type: 'uint256' },
          { name: 'gasPrice', type: 'uint256' },
          { name: 'gasToken', type: 'address' },
          { name: 'refundReceiver', type: 'address' },
          { name: 'nonce', type: 'uint256' }
        ]
      };

      const message = {
        to: txDetails.to,
        value: BigInt(txDetails.value),
        data: txDetails.data,
        operation: txDetails.operation,
        safeTxGas: BigInt(txDetails.safeTxGas),
        baseGas: BigInt(txDetails.baseGas),
        gasPrice: BigInt(txDetails.gasPrice),
        gasToken: txDetails.gasToken,
        refundReceiver: txDetails.refundReceiver,
        nonce: BigInt(txDetails.nonce)
      };
      console.log(`   ↪️ Using provided SafeTxHash: ${SAFE_TX_HASH}`);
      const sigHex = await signer.signTypedData(domain, types, message);
      console.log(`   ↪️ Signature: ${sigHex}`);

      // Submit the signature to the Safe API
      const proposalUrl = `https://safe-client.safe.global/v1/chains/100/transactions/${SAFE_ADDRESS}/propose`;
      const proposalPayload = {
        to: message.to,
        value: message.value.toString(),
        data: message.data,
        operation: message.operation,
        safeTxGas: message.safeTxGas.toString(),
        baseGas: message.baseGas.toString(),
        gasPrice: message.gasPrice.toString(),
        gasToken: message.gasToken,
        refundReceiver: message.refundReceiver,
        nonce: message.nonce.toString(),
        safeTxHash: SAFE_TX_HASH,
        sender: signer.address,
        signature: sigHex,
        origin: null
      };

      console.log("🚀 Submitting signature to Safe API...");
      const proposalResponse = await axios.post(proposalUrl, proposalPayload, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Origin": "https://app.safe.global",
          "Referer": "https://app.safe.global/"
        }
      });

      console.log(`✅ Signature submitted successfully (status ${proposalResponse.status})`);
    } catch (error) {
      console.error("Error fetching/signing transaction:", error);
      process.exit(1);
    }
  } catch (error) {
    console.error("Unhandled error in script:", error);
    process.exit(1);
  }
})();
