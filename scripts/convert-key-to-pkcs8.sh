#!/bin/bash

# Converts a private key PEM file to unencrypted PKCS#8 PEM format.

set -e # Exit on error

# --- Configuration ---
# Default input key path (adjust if your key is elsewhere)
DEFAULT_INPUT_KEY="keys/ubiquity-os.2025-03-28.private-key.pem"
INPUT_KEY="${1:-$DEFAULT_INPUT_KEY}" # Use first argument or default

# --- Validate Input ---
if [ ! -f "$INPUT_KEY" ]; then
  echo "Error: Input key file not found at '$INPUT_KEY'"
  echo "Usage: $0 [path/to/your/private-key.pem]"
  exit 1
fi

# --- Determine Output Filename ---
# Add "_pkcs8" before the .pem extension
OUTPUT_KEY="${INPUT_KEY%.pem}_pkcs8.pem"

echo "Input Key:  $INPUT_KEY"
echo "Output Key: $OUTPUT_KEY"

# --- Check for openssl ---
if ! command -v openssl &> /dev/null; then
    echo "Error: openssl command not found. Please install OpenSSL."
    exit 1
fi

# --- Perform Conversion ---
echo "Converting key to PKCS#8 format..."
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in "$INPUT_KEY" -out "$OUTPUT_KEY"

# --- Set Permissions (Optional but recommended) ---
chmod 600 "$OUTPUT_KEY"

echo "Conversion complete."
echo "IMPORTANT: Use the content of '$OUTPUT_KEY' for the GITHUB_APP_PRIVATE_KEY environment variable/secret."
echo "Remember to keep this file secure and DO NOT commit it to Git."
