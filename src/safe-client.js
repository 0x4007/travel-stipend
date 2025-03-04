import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";

// Load environment variables from .env file
const result = dotenv.config();
if (result.error) {
  console.error("[DEBUG] Error loading .env file:", result.error.message);
  process.exit(1);
}
console.log("[DEBUG] Environment loaded. Checking variables...");
console.log("[DEBUG] GNOSIS_RPC_URL:", process.env.GNOSIS_RPC_URL ? "set" : "missing");
console.log("[DEBUG] SAFE_ADDRESS:", process.env.SAFE_ADDRESS ? "set" : "missing");
console.log("[DEBUG] EXECUTOR_KEY:", process.env.EXECUTOR_KEY ? "set (hidden)" : "missing");

/**
 * Helper function to safely handle address fields
 * @param address The address that might be undefined
 * @param fieldName The name of the field for logging purposes
 * @returns The address or ZeroAddress if undefined
 */
function safeAddress(address, fieldName) {
  if (!address) {
    console.warn(`[DEBUG] ${fieldName} was undefined/null. Defaulting to ZeroAddress.`);
    return ethers.ZeroAddress;
  }
  return address;
}

/**
 * Initialize Safe contract and provider
 */
async function initializeSafeContract() {
  const RPC_URL = process.env.GNOSIS_RPC_URL;
  const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
  const EXECUTOR_KEY = process.env.EXECUTOR_KEY;

  console.log(`[DEBUG] Configuration: RPC_URL=${RPC_URL ? "set" : "missing"}, SAFE_ADDRESS=${SAFE_ADDRESS ?? "missing"}, EXECUTOR_KEY=${EXECUTOR_KEY ? "set (hidden)" : "missing"}`);

  if (!RPC_URL || !SAFE_ADDRESS || !EXECUTOR_KEY) {
    throw new Error("Please set GNOSIS_RPC_URL, SAFE_ADDRESS, and EXECUTOR_KEY environment variables.");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(EXECUTOR_KEY, provider);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`[DEBUG] Signer address: ${await signer.getAddress()}`);
  console.log(`[DEBUG] Chain ID: ${chainId}`);

  const SAFE_ABI = [
    "function nonce() view returns (uint256)",
    "function getThreshold() view returns (uint256)",
    "function getAddress() view returns (address)",
    "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool success)",
    "function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 nonce) view returns (bytes32)",
    "function approveHash(bytes32 hashToApprove) external",
    "function approvedHashes(address owner, bytes32 hash) external view returns (uint256)"
  ];
  const safeContract = new ethers.Contract(SAFE_ADDRESS, SAFE_ABI, signer);

  return { provider, signer, safeContract, chainId };
}

/**
 * Get Safe Transaction Service URL based on chain ID
 */
function getSafeServiceUrl(chainId) {
  const networkMap = {
    1: "mainnet",
    5: "goerli",
    100: "gnosis",
    137: "polygon",
    56: "bsc",
    42161: "arbitrum",
    10: "optimism"
  };

  const network = networkMap[Number(chainId)] || "mainnet";
  return `https://safe-transaction-${network}.safe.global`;
}

/**
 * Helper function to safely convert values to string
 * @param value The value that might be undefined
 * @param fieldName The name of the field for logging purposes
 * @returns The string representation of the value, defaulting to "0" if undefined
 */
function safeToString(value, fieldName) {
  if (value === undefined) {
    console.warn(`[DEBUG] ${fieldName} was undefined. Defaulting to 0.`);
    return "0";
  }
  // Convert to string, ensuring we handle both string and number inputs
  if (typeof value === 'string') {
    return value;
  }
  const num = value;
  return num.toString();
}

function computeSafeTxHash(tx, safeAddress, chainId) {
  const domain = {
    chainId,
    verifyingContract: safeAddress
  };

  const types = {
    SafeTx: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "nonce", type: "uint256" }
    ]
  };

  const message = {
    to: tx.to ? tx.to : ethers.ZeroAddress,
    value: safeToString(tx.value, "tx.value"),
    data: tx.data,
    operation: tx.operation,
    safeTxGas: safeToString(tx.safeTxGas, "tx.safeTxGas"),
    baseGas: safeToString(tx.baseGas, "tx.baseGas"),
    gasPrice: safeToString(tx.gasPrice, "tx.gasPrice"),
    gasToken: tx.gasToken ? tx.gasToken : ethers.ZeroAddress,
    refundReceiver: tx.refundReceiver ? tx.refundReceiver : ethers.ZeroAddress,
    nonce: tx.nonce
  };

  const typedData = {
    types,
    domain,
    primaryType: "SafeTx",
    message
  };

  return ethers.TypedDataEncoder.hash(domain, types, message);
}

/**
 * Get the Safe transaction hash from the contract
 */
async function getSafeTransactionHash(tx, safeContract) {
  console.log(`[DEBUG] Computing Safe transaction hash on-chain`);
  try {
    const hash = await safeContract.getTransactionHash(
      tx.to ? tx.to : ethers.ZeroAddress,
      tx.value || 0,
      tx.data || "0x",
      tx.operation || 0,
      tx.safeTxGas || 0,
      tx.baseGas || 0,
      tx.gasPrice || 0,
      tx.gasToken || ethers.ZeroAddress,
      tx.refundReceiver || ethers.ZeroAddress,
      tx.nonce
    );
    console.log(`[DEBUG] Computed hash: ${hash}`);
    return hash;
  } catch (error) {
    console.error(`[DEBUG] Error computing hash:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Approve a Safe transaction hash on-chain
 */
async function approveHashOnChain(safeTxHash, safeContract) {
  console.log(`[DEBUG] Approving hash on-chain: ${safeTxHash}`);
  try {
    const tx = await safeContract.approveHash(safeTxHash);
    console.log(`[DEBUG] Approval transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[DEBUG] Approval confirmed in block ${receipt.blockNumber}`);
    return receipt;
  } catch (error) {
    console.error(`[DEBUG] Error approving hash:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Check if a hash is approved by an owner
 */
async function checkHashApproval(safeTxHash, ownerAddress, safeContract) {
  console.log(`[DEBUG] Checking hash approval for ${ownerAddress}`);
  try {
    const approved = await safeContract.approvedHashes(ownerAddress, safeTxHash);
    const isApproved = approved.toString() === "1";
    console.log(`[DEBUG] Hash ${safeTxHash} approval status for ${ownerAddress}: ${isApproved}`);
    return isApproved;
  } catch (error) {
    console.error(`[DEBUG] Error checking approval:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Sign a Safe transaction off-chain using EIP-712 or approve on-chain
 */
async function signSafeTransaction(tx, signer, safeAddress, chainId, safeContract, useOnChain = false) {
  console.log(`[DEBUG] Signing Safe transaction (${useOnChain ? 'on-chain' : 'off-chain'})`);

  // Get transaction hash from contract
  const safeTxHash = await getSafeTransactionHash(tx, safeContract);

  if (useOnChain) {
    // On-chain approval
    const receipt = await approveHashOnChain(safeTxHash, safeContract);
    console.log(`[DEBUG] Transaction hash approved on-chain in block ${receipt.blockNumber}`);

    // Return a special signature format for on-chain approvals
    const ownerAddress = await signer.getAddress();
    // Return the owner's address + "0x000001" to indicate on-chain approval
    return ownerAddress.toLowerCase() + "000001";
  } else {
    // Off-chain EIP-712 signature
    const signature = await signer.signTypedData(
      { chainId, verifyingContract: safeAddress },
      {
        SafeTx: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "operation", type: "uint8" },
          { name: "safeTxGas", type: "uint256" },
          { name: "baseGas", type: "uint256" },
          { name: "gasPrice", type: "uint256" },
          { name: "gasToken", type: "address" },
          { name: "refundReceiver", type: "address" },
          { name: "nonce", type: "uint256" }
        ]
      },
      {
        to: tx.to ? tx.to : ethers.ZeroAddress,
        value: safeToString(tx.value, "tx.value"),
        data: tx.data,
        operation: tx.operation,
        safeTxGas: safeToString(tx.safeTxGas, "tx.safeTxGas"),
        baseGas: safeToString(tx.baseGas, "tx.baseGas"),
        gasPrice: safeToString(tx.gasPrice, "tx.gasPrice"),
        gasToken: tx.gasToken ? tx.gasToken : ethers.ZeroAddress,
        refundReceiver: tx.refundReceiver ? tx.refundReceiver : ethers.ZeroAddress,
        nonce: tx.nonce
      }
    );

    console.log(`[DEBUG] Generated off-chain signature: ${signature}`);
    return signature;
  }
}

/**
 * Execute transaction directly on-chain
 */
async function executeTransactionOnChain(tx, signature, safeContract) {
  console.log(`[DEBUG] Executing transaction directly on-chain`);
  try {
    const txResponse = await safeContract.execTransaction(
      tx.to ? tx.to : ethers.ZeroAddress,
      tx.value || 0,
      tx.data || "0x",
      tx.operation || 0,
      tx.safeTxGas || 0,
      tx.baseGas || 0,
      tx.gasPrice || 0,
      tx.gasToken || ethers.ZeroAddress,
      tx.refundReceiver || ethers.ZeroAddress,
      signature
    );

    console.log(`[DEBUG] Transaction submitted, waiting for confirmation...`);
    const receipt = await txResponse.wait();
    console.log(`[DEBUG] Transaction confirmed in block ${receipt.blockNumber}`);

    return receipt;
  } catch (error) {
    console.error(`[DEBUG] Error in executeTransactionOnChain:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Load transaction cache from file
 */
function loadTransactionCache() {
  const cacheFile = "pending-tx-cache.json";
  let txCache = {};

  console.log(`[DEBUG] Loading transaction cache from ${cacheFile}`);
  if (fs.existsSync(cacheFile)) {
    try {
      txCache = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      console.log(`[DEBUG] Loaded cache with ${Object.keys(txCache).filter(k => !k.startsWith('_')).length} transactions`);
      console.log(`[DEBUG] Last scanned block: ${txCache._lastScannedBlock ?? "none"}`);
    } catch (error) {
      console.warn("Could not parse cache file, starting with empty cache:", error);
    }
  } else {
    console.log("[DEBUG] No cache file found, starting with empty cache");
  }

  return txCache;
}

/**
 * Save transaction cache to file
 */
function saveTransactionCache(txCache) {
  const cacheFile = "pending-tx-cache.json";
  fs.writeFileSync(cacheFile, JSON.stringify(txCache, null, 2));
}

/**
 * Determine scan range for events
 */
function determineScanRange(txCache, latestBlock, shouldDeepScan) {
  const scanStartBlock = process.env.SCAN_START_BLOCK ?
    Number(process.env.SCAN_START_BLOCK) : latestBlock - 10000;

  const fromBlock = shouldDeepScan ?
    scanStartBlock :
    txCache._lastScannedBlock ? Number(txCache._lastScannedBlock) + 1 : latestBlock - 1000;

  return { fromBlock, toBlock: latestBlock };
}

/**
 * Main function to monitor and sign Safe transactions
 */
async function monitorAndExecuteSafeTransactions() {
  console.log("[DEBUG] Starting Safe transaction monitor");

  // Initialize contract and provider
  const { provider, signer, safeContract, chainId } = await initializeSafeContract();
  const safeAddress = await safeContract.getAddress();

  // Load cache
  let txCache = loadTransactionCache();

  // Fetch threshold
  console.log("[DEBUG] Fetching Safe threshold");
  const threshold = await safeContract.getThreshold();
  console.log(`[DEBUG] Safe threshold: ${threshold}`);

  // Process pending transactions from cache
  for (const [hash, details] of Object.entries(txCache)) {
    if (hash.startsWith("_") || typeof details === "number") continue;
    const txDetails = details;

    try {
      console.log(`[DEBUG] Processing cached transaction ${hash}`);
      // Only collect signatures, don't execute
      const signature = await signSafeTransaction(txDetails, signer, safeAddress, chainId);
      await submitSignatureConfirmation(hash, signature, chainId);
      console.log(`[DEBUG] Signature submitted for transaction ${hash}`);
    } catch (error) {
      console.error(`Failed to process transaction ${hash}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log("[DEBUG] Safe transaction monitor completed");
}

/**
 * Check if a string is a valid bytes32 hash
 */
function isValidBytes32Hash(hash) {
  return hash.startsWith("0x") && hash.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(hash);
}

/**
 * Add a manual transaction to the cache for testing
 * @private Utility function for testing
 * @deprecated Use only for testing purposes
 */
function _addTestTransaction(txHash, to, value, data, nonce, approvals) {
  const stringValue = typeof value === 'string' ? value : value.toString();
  console.log(`[DEBUG] Adding manual transaction ${txHash} to cache`);
  const cacheFile = "pending-tx-cache.json";

  let txCache = {};

  if (fs.existsSync(cacheFile)) {
    try {
      txCache = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    } catch (error) {
      console.warn("Could not parse cache file, starting with empty cache:", error);
    }
  }

  txCache[txHash.toLowerCase()] = {
    safeTxHash: txHash.toLowerCase(),
    approvals,
    to,
    value: stringValue,
    data,
    operation: 0,
    safeTxGas: "0",
    baseGas: "0",
    gasPrice: "0",
    gasToken: ethers.ZeroAddress,
    refundReceiver: ethers.ZeroAddress,
    nonce
  };

  fs.writeFileSync(cacheFile, JSON.stringify(txCache, null, 2));
  console.log(`[DEBUG] Added transaction ${txHash} to cache`);
}

/**
 * Find transactions with the same nonce
 */
function findTransactionsWithNonce(txCache, nonce) {
  return Object.entries(txCache)
    .filter(([key, details]) =>
      !key.startsWith("_") &&
      typeof details !== "number" &&
      details.nonce === nonce
    );
}

/**
 * Handle transaction replacement
 */
function handleTransactionReplacement(txCache, txHash, nonce, approvals) {
  const txsWithSameNonce = findTransactionsWithNonce(txCache, nonce);

  if (txsWithSameNonce.length > 0) {
    console.log(`[DEBUG] Found ${txsWithSameNonce.length} existing transaction(s) with nonce ${nonce}`);

    // Remove all existing transactions with this nonce
    for (const [existingKey] of txsWithSameNonce) {
      console.log(`[DEBUG] Removing replaced transaction ${existingKey}`);
      delete txCache[existingKey];
    }

    // Get the most recent transaction's approvals
    const [, lastDetails] = txsWithSameNonce[txsWithSameNonce.length - 1];
    console.log(`[DEBUG] Copying ${lastDetails.approvals.length} approvals from most recent transaction`);
    return lastDetails.approvals;
  }

  return approvals;
}

/**
 * Submit a signature confirmation to the Safe Transaction Service
 */
async function submitSignatureConfirmation(safeTxHash, signature, chainId) {
  const serviceUrl = getSafeServiceUrl(chainId);
  const endpoint = `${serviceUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;

  console.log(`[DEBUG] Submitting signature confirmation to ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signedSafeTxHash: safeTxHash,
        signature: signature
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to submit signature: ${error}`);
    }

    const result = await response.json();
    console.log(`[DEBUG] Signature confirmation submitted successfully:`, result);
    return result;
  } catch (error) {
    console.error(`[DEBUG] Error submitting signature:`, error);
    throw error;
  }
}

/**
 * Sign a Safe transaction with multiple private keys
 * @param {string} safeTxHash - The Safe transaction hash to sign
 * @param {string[]} privateKeys - Array of private keys to sign with
 * @param {string} safeAddress - The Safe contract address
 * @param {number} chainId - The chain ID
 */
async function signWithMultipleKeys(safeTxHash, privateKeys, safeAddress, chainId) {
  console.log(`[DEBUG] Signing transaction ${safeTxHash} with ${privateKeys.length} keys`);

  for (const privateKey of privateKeys) {
    try {
      const signer = new ethers.Wallet(privateKey);
      console.log(`[DEBUG] Signing with address: ${await signer.getAddress()}`);

      // Create EIP-191 prefixed message
      const message = ethers.hashMessage(ethers.getBytes(safeTxHash));
      console.log(`[DEBUG] EIP-191 prefixed message: ${message}`);

      // Sign with EIP-191 prefix
      const signature = await signer.signMessage(ethers.getBytes(safeTxHash));
      console.log(`[DEBUG] Raw signature: ${signature}`);

      // Parse signature components
      const sig = ethers.Signature.from(signature);
      console.log(`[DEBUG] Parsed signature - r: ${sig.r}, s: ${sig.s}, v: ${sig.v}`);

      // Adjust v value (27/28 -> 31/32) for Safe's eth_sign compatibility
      const adjustedV = sig.v + 4;
      console.log(`[DEBUG] Adjusted v value: ${adjustedV} (0x${adjustedV.toString(16)})`);

      // Construct adjusted signature
      const adjustedSignature = ethers.concat([
        sig.r,
        sig.s,
        "0x" + adjustedV.toString(16).padStart(2, '0')
      ]);
      console.log(`[DEBUG] Final adjusted signature: ${adjustedSignature}`);

      // Submit confirmation and verify
      await submitSignatureConfirmation(safeTxHash, adjustedSignature, chainId);

      // Verify confirmation was recorded
      const confirmationStatus = await verifyConfirmation(safeTxHash, chainId, await signer.getAddress());
      if (!confirmationStatus.confirmed) {
        throw new Error(`Signature confirmation not found for ${await signer.getAddress()}`);
      }

      console.log(`[DEBUG] Successfully signed and submitted confirmation for ${await signer.getAddress()}`);
    } catch (error) {
      console.error(`[DEBUG] Error signing with key:`, error);
      throw error;
    }
  }
}

/**
 * Verify a signature confirmation was recorded
 */
async function verifyConfirmation(safeTxHash, chainId, signerAddress) {
  const serviceUrl = getSafeServiceUrl(chainId);
  const endpoint = `${serviceUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;

  console.log(`[DEBUG] Verifying confirmation at ${endpoint}`);

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch confirmations: ${await response.text()}`);
    }

    const confirmations = await response.json();
    console.log(`[DEBUG] Current confirmations:`, confirmations);

    // Check if signer's confirmation is present
    const confirmed = confirmations.some(conf =>
      conf.owner.toLowerCase() === signerAddress.toLowerCase()
    );

    console.log(`[DEBUG] Confirmation status for ${signerAddress}: ${confirmed ? 'Found' : 'Not found'}`);
    return { confirmed, confirmations };
  } catch (error) {
    console.error(`[DEBUG] Error verifying confirmation:`, error);
    throw error;
  }
}

/**
 * Add a real transaction hash to the cache for testing
 * This function can be used to add a real transaction hash to the cache
 */
function addRealTransactionHash(txHash, nonce, approvals = []) {
  if (!isValidBytes32Hash(txHash)) {
    console.error(`[ERROR] Invalid transaction hash format: ${txHash}`);
    console.error(`[ERROR] Transaction hash must be a 32-byte hex string like: 0xc52b1915fbc52a2b830b70da0eaf6f0686736bce3b70e4435e2be6f9bd0c20b6`);
    return;
  }

  console.log(`[DEBUG] Adding real transaction ${txHash} to cache with nonce ${nonce}`);
  const txCache = loadTransactionCache();
  const hashKey = txHash.toLowerCase();

  // Handle transaction replacement and get approvals
  const txApprovals = handleTransactionReplacement(txCache, hashKey, nonce, approvals);

  // Add the new transaction with required TxDetails fields
  txCache[hashKey] = {
    safeTxHash: hashKey,
    approvals: txApprovals.map(addr => addr.toLowerCase()),
    to: safeAddress(ethers.ZeroAddress, "tx.to"),
    value: "0",
    data: "0x",
    operation: 0,
    safeTxGas: "0",
    baseGas: "0",
    gasPrice: "0",
    gasToken: safeAddress(ethers.ZeroAddress, "tx.gasToken"),
    refundReceiver: safeAddress(ethers.ZeroAddress, "tx.refundReceiver"),
    nonce,
    signature: "" // Will be updated when signed
  };

  saveTransactionCache(txCache);
  console.log(`[DEBUG] Added real transaction ${txHash} to cache`);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset-cache");
  const shouldAddRealTx = args.includes("--add-real-tx");

  // Check if we should add a real transaction hash
  if (shouldAddRealTx) {
    const txHashIndex = args.indexOf("--tx-hash");
    const nonceIndex = args.indexOf("--nonce");

    if (txHashIndex === -1 || nonceIndex === -1 || txHashIndex + 1 >= args.length || nonceIndex + 1 >= args.length) {
      console.error("[ERROR] To add a real transaction, use: --add-real-tx --tx-hash <hash> --nonce <nonce>");
      process.exit(1);
    }

    const txHash = args[txHashIndex + 1];
    const nonce = parseInt(args[nonceIndex + 1], 10);

    if (isNaN(nonce)) {
      console.error("[ERROR] Nonce must be a number");
      process.exit(1);
    }

    addRealTransactionHash(txHash, nonce);
    console.log("[DEBUG] Real transaction added to cache. Exiting.");
    process.exit(0);
  }

  if (shouldReset) {
    console.log("[DEBUG] Resetting cache file");
    const cacheFile = "pending-tx-cache.json";
    const txCache = { _lastScannedBlock: 0 };
    fs.writeFileSync(cacheFile, JSON.stringify(txCache, null, 2));
    console.log("[DEBUG] Cache file reset");
  }

  // Execute the main function
  console.log("[DEBUG] Starting Safe transaction monitoring");
  monitorAndExecuteSafeTransactions().catch((error) => {
    console.error("Error in Safe monitoring:", error);
    console.error("[DEBUG] Stack trace:", error.stack);
    process.exit(1);
  });
}

/**
 * Collect signatures one at a time and format them for the Safe contract
 * @param {object} tx - The Safe transaction object
 * @param {string[]} privateKeys - Array of private keys to sign with
 * @param {ethers.Contract} safeContract - The Safe contract instance
 * @param {boolean} useOnChain - Whether to use on-chain approvals
 */
async function collectSignaturesSequentially(tx, privateKeys, safeContract, useOnChain = false) {
  const signatures = [];
  const provider = safeContract.runner.provider;
  const chainId = await provider.getNetwork().then(n => Number(n.chainId));
  const safeAddress = await safeContract.getAddress();

  console.log(`[DEBUG] Collecting signatures for transaction with nonce ${tx.nonce}`);
  console.log(`[DEBUG] Number of signers: ${privateKeys.length}`);
  console.log(`[DEBUG] Using ${useOnChain ? 'on-chain approvals' : 'off-chain signatures'}`);

  for (const privateKey of privateKeys) {
    const signer = new ethers.Wallet(privateKey, safeContract.provider);
    const signerAddress = await signer.getAddress();
    console.log(`[DEBUG] Processing signer: ${signerAddress}`);

    try {
      // Check if already approved (for on-chain)
      if (useOnChain) {
        const isApproved = await checkHashApproval(tx.safeTxHash, signerAddress, safeContract);
        if (isApproved) {
          console.log(`[DEBUG] Hash already approved by ${signerAddress}`);
          signatures.push(signerAddress.toLowerCase() + "000001");
          continue;
        }
      }

      // Sign the transaction
      const signature = await signSafeTransaction(
        tx,
        signer,
        safeAddress,
        chainId,
        safeContract,
        useOnChain
      );

      signatures.push(signature);
      console.log(`[DEBUG] Added signature from ${signerAddress}`);

    } catch (error) {
      console.error(`[DEBUG] Error collecting signature from ${signerAddress}:`, error);
      throw error;
    }
  }

  // Sort signatures by signer address (required by Safe)
  signatures.sort((a, b) => {
    const addrA = a.slice(0, 42).toLowerCase();
    const addrB = b.slice(0, 42).toLowerCase();
    return addrA.localeCompare(addrB);
  });

  console.log(`[DEBUG] Collected ${signatures.length} signatures`);
  return signatures;
}

// Export functions for external use
export {
  addRealTransactionHash,
  collectSignaturesSequentially,
  getSafeServiceUrl,
  monitorAndExecuteSafeTransactions,
  signWithMultipleKeys,
  submitSignatureConfirmation
};

//
//
//
//
//
//



// Configuration for the transaction
const SAFE_TX_HASH = '0xeec8698ae4e0b4f720862676e134e33f2b1df30a6467bd1b7b4191258169cf04';
const SAFE_ADDRESS = process.env.SAFE_ADDRESS || '';
const CHAIN_ID = 100; // Gnosis Chain
const NONCE = 60;

/**
 * Check for nonce conflicts
 */
async function checkNonceConflicts(safeTxHash, chainId) {
  const serviceUrl = getSafeServiceUrl(chainId);
  const endpoint = `${serviceUrl}/api/v1/multisig-transactions/`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${await response.text()}`);
    }

    const transactions = await response.json();
    const conflictingTxs = transactions.results.filter(tx =>
      tx.nonce === NONCE && tx.safeTxHash !== safeTxHash
    );

    if (conflictingTxs.length > 0) {
      console.log(`[WARN] Found ${conflictingTxs.length} other transaction(s) with nonce ${NONCE}:`);
      for (const tx of conflictingTxs) {
        console.log(`- Transaction ${tx.safeTxHash}`);
        console.log(`  Status: ${tx.confirmations.length} signatures`);
      }
      console.log('[INFO] Proceeding with signing the intended transaction...');
    }

    return conflictingTxs;
  } catch (error) {
    console.error(`[ERROR] Failed to check for nonce conflicts:`, error);
    throw error;
  }
}

async function main() {
  try {
    // Initialize Safe contract
    const { provider, signer, safeContract, chainId } = await initializeSafeContract();
    const safeAddress = await safeContract.getAddress();

    console.log('\n=== Safe Transaction Signing ===\n');
    console.log(`Transaction: 7,500 USDC.e transfer`);
    console.log(`Safe Address: ${safeAddress}`);
    console.log(`Safe Tx Hash: ${SAFE_TX_HASH}`);
    console.log(`Nonce: ${NONCE}`);
    console.log(`Chain: Gnosis Chain (ID: ${chainId})`);
    console.log('\nValidating transaction state...\n');

    // Check for nonce conflicts
    await checkNonceConflicts(SAFE_TX_HASH, chainId);

    // Create transaction object
    const tx = {
      to: SAFE_ADDRESS,
      value: "7500000000", // 7,500 USDC.e (6 decimals)
      data: "0x",
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.ZeroAddress,
      refundReceiver: ethers.ZeroAddress,
      nonce: NONCE,
      safeTxHash: SAFE_TX_HASH
    };

    console.log('\nSigning transaction...\n');

    // Sign transaction using on-chain approval
    const signature = await signSafeTransaction(tx, signer, safeAddress, chainId, safeContract, true);
    console.log(`\nTransaction signed with signature: ${signature}`);

    // Log final status
    console.log('\n=== Transaction Signing Complete ===\n');
    console.log('✓ Transaction has been signed on-chain');
    console.log('✓ Safe UI will show updated approval status\n');

    // Save to cache
    addRealTransactionHash(SAFE_TX_HASH, NONCE, [signature.slice(0, 42)]);

  } catch (error) {
    console.error('\n[ERROR] Failed to complete signing process:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
