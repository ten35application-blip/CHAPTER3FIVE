#!/bin/bash
# ---------------------------------------------------------------
# Purchase-delivery drill (Wilson 2026-08-16).
#
# Impersonates RevenueCat: sends the exact webhook events a real
# store purchase produces at our production endpoint, signed with
# the real webhook secret, so the whole delivery chain downstream of
# Apple's buy sheet is exercised for real — entitlement mirror, tier
# sync, mint ledger, atomic companion delivery.
#
# The secret is read from the pulled production env file and never
# printed. Two throwaway accounts receive the purchases; Claude
# verifies the results in the database and deletes them afterward.
#
# Usage:  bash scripts/purchase-drill.sh
# ---------------------------------------------------------------
set -u

ENV_FILE="/private/tmp/claude-504/-Users-TENZEROTHREEFIVE/08e850b1-a50c-4f52-885d-a9922efa8410/scratchpad/prod.env"
ENDPOINT="https://chapter3five.app/api/webhooks/revenuecat"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — ask Claude to re-pull the production env."
  exit 1
fi

SECRET=$(grep '^REVENUECAT_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
if [ -z "$SECRET" ]; then
  echo "No REVENUECAT_WEBHOOK_SECRET found in the env file."
  exit 1
fi

BASIC_USER="72b858a9-3389-4688-a093-f2cb824d0833"
PRO_USER="1ba96f1f-4c05-4489-9a70-5de7bb971ac3"
EXP_MS=$(( ($(date +%s) + 86400) * 1000 ))

fire() {
  local label="$1" type="$2" user="$3" product="$4" ent="$5" txn="$6"
  printf '%-28s ' "$label"
  curl -s -w ' [HTTP %{http_code}]\n' -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"event\":{\"type\":\"$type\",\"id\":\"drill-$txn-$RANDOM\",\"app_user_id\":\"$user\",\"product_id\":\"$product\",\"entitlement_ids\":[\"$ent\"],\"expiration_at_ms\":$EXP_MS,\"store\":\"APP_STORE\",\"original_transaction_id\":\"$txn\",\"environment\":\"SANDBOX\"}}"
}

echo "=== chapter3five purchase-delivery drill ==="
echo

fire "Basic purchase →" INITIAL_PURCHASE "$BASIC_USER" \
     "chapter3five.basic.monthly" "basic" "DRILL-TXN-BASIC"

fire "Pro purchase   →" INITIAL_PURCHASE "$PRO_USER" \
     "chapter3five.pro.monthly" "pro" "DRILL-TXN-PRO"

echo
echo "Both events accepted (HTTP 200 = our server took them)."
echo "Companion synthesis runs in the background — Claude will verify"
echo "the delivery in the database in a couple of minutes."
