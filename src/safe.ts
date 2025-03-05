import axios from "axios";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();
const requiredEnvVars = ["PRIVATE_KEY", "SAFE_ADDRESS", "RPC_URL", "SAFE_TX_HASH"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const SAFE_ADDRESS = process.env.SAFE_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY!;
const SAFE_TX_HASH = process.env.SAFE_TX_HASH!;

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

    // Fetch transaction details from Safe API
    console.log("🔍 Fetching transaction details from Safe API...");
    const apiUrl = `https://safe-client.safe.global/v1/chains/100/transactions/${SAFE_TX_HASH}`;

    try {
      const response = await axios.get(apiUrl);
      const txData = response.data.txData;
      const execInfo = response.data.detailedExecutionInfo;
      const txStatus = response.data.txStatus;

      if (!txData || !execInfo) {
        throw new Error("Transaction details not found in response");
      }

      // Extract the transaction details
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

      // Check if we need to sign
      const confirmations = execInfo.confirmations || [];
      const alreadySignedByOwner = confirmations.some(
        (c: any) => c.signer.value.toLowerCase() === signer.address.toLowerCase()
      );

      if (!alreadySignedByOwner) {
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
      } else {
        console.log("Already signed by this owner, skipping signature...");
      }

      // Check if we have enough signatures to relay
      const updatedResponse = await axios.get(apiUrl);
      const updatedExecInfo = updatedResponse.data.detailedExecutionInfo;
      const updatedConfirmations = updatedExecInfo.confirmations || [];

      if (updatedConfirmations.length >= threshold) {
        console.log(`\n🎯 Transaction has enough signatures (${updatedConfirmations.length}/${threshold}), preparing relay...`);

        // Sort and concatenate signatures
        const sortedConfs = [...updatedConfirmations].sort((a, b) =>
          a.signer.value.toLowerCase().localeCompare(b.signer.value.toLowerCase())
        );
        let signaturesConcat = "0x";
        for (const conf of sortedConfs) {
          const sig = conf.signature.replace(/^0x/, "");
          signaturesConcat += sig;
        }

        // Encode execTransaction call
        const iFace = new ethers.Interface(SAFE_ABI);
        const execTxData = iFace.encodeFunctionData("execTransaction", [
          txData.to.value,
          txData.value,
          txData.hexData,
          txData.operation,
          execInfo.safeTxGas,
          execInfo.baseGas,
          execInfo.gasPrice,
          execInfo.gasToken,
          execInfo.refundReceiver.value,
          signaturesConcat
        ]);

        // Send relay request
        const relayUrl = `https://safe-client.safe.global/v1/chains/100/relay`;
        const relayBody = {
          to: SAFE_ADDRESS,
          data: execTxData,
          gasLimit: "500000",
          version: "1.3.0+L2"
        };

        console.log("📡 Sending relay request...");
        const relayResponse = await axios.post(relayUrl, relayBody, {
          headers: { "Content-Type": "application/json" }
        });
        console.log("✨ Relay task submitted:", relayResponse.data);
      } else {
        console.log(`\n⏳ Not enough signatures yet (${updatedConfirmations.length}/${threshold}), waiting for more...`);
      }
    } catch (error) {
      console.error("Error fetching/signing transaction:", error);
      process.exit(1);
    }
  } catch (error) {
    console.error("Unhandled error in script:", error);
    process.exit(1);
  }
})();
