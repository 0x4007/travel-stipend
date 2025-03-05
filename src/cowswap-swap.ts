import axios from "axios";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();
const requiredEnvVars = ["PRIVATE_KEY", "SAFE_ADDRESS", "RPC_URL"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const SAFE_ADDRESS = process.env.SAFE_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY!;

// CoW Protocol Settlement contract
const COWSWAP_CONTRACT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";
// Destination address for the swapped tokens
const RECEIVER_ADDRESS = "0xefC0e701A824943b469a694aC564Aa1efF7Ab7dd";

const SAFE_ABI = [
  "function nonce() view returns (uint256)",
  "function getThreshold() view returns (uint256)",
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) public payable returns (bool success)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
const safeContract = new ethers.Contract(SAFE_ADDRESS, SAFE_ABI, signer);

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

    // Create the setPreSignature transaction with hardcoded orderUid
    // This matches the format from the reference transaction
    const orderUid = "0xf0624d35ea2e28f7eaeed71e097c2bdb6cd7285f6f71e6292cbb123491ad0b65f95d1352467773676d5435a9ada94a3701efdb6c67c859d6271026e6";

    // Manually construct the transaction data to match the exact format
    const setPreSignatureData = "0xec6cb13f" + // Function selector for setPreSignature
      "0000000000000000000000000000000000000000000000000000000000000040" + // Offset for bytes parameter (64)
      "0000000000000000000000000000000000000000000000000000000000000001" + // bool signed = true
      "0000000000000000000000000000000000000000000000000000000000000038" + // Length of bytes (56)
      orderUid.slice(2); // orderUid without 0x prefix

    console.log("Encoded data:", setPreSignatureData);

    // Transaction details
    const txDetails = {
      to: COWSWAP_CONTRACT,
      value: "0",
      data: setPreSignatureData,
      operation: 0, // Call operation
      nonce: currentNonce,
      safeTxGas: "0",
      baseGas: "0",
      gasPrice: "0",
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000"
    };

    // Sign the transaction
    console.log("✍️  Signing Safe transaction...");

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

    // Calculate SafeTxHash
    const safeTxHash = ethers.TypedDataEncoder.hash(domain, types, message);
    console.log(`   ↪️ SafeTxHash: ${safeTxHash}`);

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
      safeTxHash: safeTxHash,
      sender: signer.address,
      signature: sigHex,
      origin: "{\"url\":\"https://swap.cow.fi\",\"name\":\"CoW Swap\"}"
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

    console.log(`✅ Transaction proposed successfully (status ${proposalResponse.status})`);
    console.log(`   View on Safe: https://app.safe.global/transactions/tx?safe=gno:${SAFE_ADDRESS}&id=${safeTxHash}`);

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
