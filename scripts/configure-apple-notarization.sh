#!/usr/bin/env bash
# Local-only handoff for a legitimately issued Apple Developer ID Application p12 and App Store Connect API key.
set -euo pipefail
umask 077
REPO="saramjh/cokacremote-desktop"
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ -t 0 ]] || die "Run this script interactively on your Mac. Never paste signing credentials into ChatGPT."
command -v gh >/dev/null || die "GitHub CLI is required."
command -v openssl >/dev/null || die "OpenSSL is required."
gh auth status >/dev/null 2>&1 || die "Sign into GitHub CLI first."
printf 'Apple Developer ID notarization provisioning for %s\n' "$REPO"
read -r -p "Absolute path to the Developer ID Application .p12: " CERT_FILE
[[ -f "$CERT_FILE" && "$CERT_FILE" == *.p12 ]] || die "A .p12 file is required."
read -r -s -p "Password used when exporting the .p12 (hidden): " CERT_PASS
printf '\n'
export CERT_PASS
openssl pkcs12 -in "$CERT_FILE" -passin env:CERT_PASS -noout >/dev/null 2>&1 || die "Certificate export password or .p12 file is invalid."
printf 'Installed Developer ID signing identities:\n'
security find-identity -v -p codesigning | grep 'Developer ID Application' || die "Install the Developer ID Application certificate and private key in login Keychain first."
read -r -p "Paste the exact Developer ID Application identity shown above: " SIGN_ID
[[ "$SIGN_ID" == "Developer ID Application:"* ]] || die "Expected a Developer ID Application identity."
security find-identity -v -p codesigning | grep -F -- "\"$SIGN_ID\"" >/dev/null || die "Specified signing identity was not found in the keychain."
read -r -p "Absolute path to the App Store Connect API AuthKey_*.p8: " KEY_FILE
[[ -f "$KEY_FILE" && "$KEY_FILE" == *.p8 ]] || die "An App Store Connect .p8 key is required."
read -r -p "App Store Connect API Key ID: " KEY_ID
[[ "$KEY_ID" =~ ^[[:alnum:]]{10}$ ]] || die "API Key ID should be 10 alphanumeric characters."
read -r -p "App Store Connect API Issuer ID (UUID): " ISSUER_ID
[[ "$ISSUER_ID" =~ ^[[:xdigit:]-]{36}$ ]] || die "Issuer ID must be a 36-character UUID."
read -r -p "Store seven signing/notary secrets in GitHub repo $REPO? Type YES: " APPROVE
[[ "$APPROVE" == YES ]] || die "Cancelled without creating GitHub secrets."
printf 'Writing GitHub Actions Secrets securely via stdin (values will not be printed)...\n'
openssl base64 -A -in "$CERT_FILE" | gh secret set APPLE_CERTIFICATE -R "$REPO"
printf '%s' "$CERT_PASS" | gh secret set APPLE_CERTIFICATE_PASSWORD -R "$REPO"
unset CERT_PASS
printf '%s' "$SIGN_ID" | gh secret set APPLE_SIGNING_IDENTITY -R "$REPO"
openssl rand -base64 36 | tr -d '\n' | gh secret set KEYCHAIN_PASSWORD -R "$REPO"
printf '%s' "$ISSUER_ID" | gh secret set APPLE_API_ISSUER -R "$REPO"
printf '%s' "$KEY_ID" | gh secret set APPLE_API_KEY -R "$REPO"
gh secret set APPLE_API_PRIVATE_KEY -R "$REPO" < "$KEY_FILE"
printf 'All seven secret names stored. Their values remain unreadable via GitHub CLI.\n'
gh secret list -R "$REPO" --json name --jq '.[].name' | grep -E '^(APPLE_|KEYCHAIN_PASSWORD)' | sort
printf 'Provisioning complete. Do not publish until a publish=false signed/notarized CI build passes.\n'

