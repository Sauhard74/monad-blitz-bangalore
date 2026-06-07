#!/usr/bin/env bash
#
# Provision an Azure VM that hosts the whole Living Company stack (Paperclip +
# web app) via Docker Compose. The image build + run happen ON THE VM, so your
# local disk is irrelevant.
#
# Prereqs: `az login` done. (Install az: `brew install azure-cli`.)
#
# Usage:
#   cd infra/single-machine
#   AZURE_SUBSCRIPTION_ID=... REPO_URL=https://github.com/<you>/<repo>.git ./azure-vm.sh
#
set -euo pipefail
cd "$(dirname "$0")"

: "${AZURE_SUBSCRIPTION_ID:?set AZURE_SUBSCRIPTION_ID}"
: "${AZURE_LOCATION:=eastus}"
: "${RESOURCE_GROUP:=living-company-rg}"
: "${VM_NAME:=living-company-vm}"
# 2 vCPU / 8 GiB — enough for the large Paperclip image build. Bump for headroom.
: "${VM_SIZE:=Standard_D2s_v3}"
: "${OS_DISK_GB:=64}"
: "${ADMIN_USER:=azureuser}"
# Optional: if set, cloud build clones it; otherwise you scp/clone the repo yourself.
: "${REPO_URL:=}"

command -v az >/dev/null || { echo "ERROR: Azure CLI (az) not installed. brew install azure-cli"; exit 1; }
az account show >/dev/null 2>&1 || { echo "ERROR: run 'az login' first."; exit 1; }
az account set --subscription "$AZURE_SUBSCRIPTION_ID"

echo "==> Resource group: $RESOURCE_GROUP ($AZURE_LOCATION)"
az group create -n "$RESOURCE_GROUP" -l "$AZURE_LOCATION" -o none

echo "==> Creating VM $VM_NAME ($VM_SIZE, ${OS_DISK_GB}GB disk) — this also installs Docker via cloud-init"
az vm create \
  -g "$RESOURCE_GROUP" -n "$VM_NAME" -l "$AZURE_LOCATION" \
  --image Ubuntu2204 --size "$VM_SIZE" \
  --admin-username "$ADMIN_USER" --generate-ssh-keys \
  --os-disk-size-gb "$OS_DISK_GB" \
  --public-ip-sku Standard \
  --custom-data cloud-init.yaml \
  -o none

echo "==> Opening HTTP (80) and keeping SSH (22)"
az vm open-port -g "$RESOURCE_GROUP" -n "$VM_NAME" --port 80 --priority 900 -o none

IP=$(az vm show -d -g "$RESOURCE_GROUP" -n "$VM_NAME" --query publicIps -o tsv)

cat <<EOF

============================================================
✅ VM provisioned. Public IP: $IP

Give cloud-init ~1–2 min to finish installing Docker, then:

  ssh ${ADMIN_USER}@${IP}

On the VM:
  ${REPO_URL:+git clone $REPO_URL living-company && }cd living-company/infra/single-machine
  cp .env.example .env       # add AZURE_AI_ENDPOINT + AZURE_AI_KEY
  ./setup.sh                 # builds + runs the whole stack

Then open:  http://${IP}      (the office)
Admin dash: ssh -L 3100:localhost:3100 ${ADMIN_USER}@${IP}  →  http://localhost:3100

Tear down everything:  az group delete -n ${RESOURCE_GROUP} --yes --no-wait
============================================================
EOF
