#!/bin/bash
# Phase 1: Sleep Prevention & Server Hardening
# Run this script with sudo from a terminal on the Mac Mini:
#   sudo bash nanoclaw/scripts/setup-always-on.sh

set -e

echo "=== Configuring pmset for always-on operation ==="
pmset -c sleep 0
pmset -c disksleep 0
pmset -c displaysleep 10
pmset -c standby 0
pmset -c autopoweroff 0
pmset -c autorestart 1
pmset -c womp 1
pmset -c tcpkeepalive 1
pmset -c powernap 0
pmset -c proximitywake 0

echo ""
echo "=== Setting restart-on-freeze ==="
systemsetup -setrestartfreeze on 2>/dev/null || echo "(skipped — may need Full Disk Access)"

echo ""
echo "=== Disabling Spotlight on NanoClaw data directories ==="
mdutil -i off /Users/fambot/Projects/Sigma/nanoclaw/store 2>/dev/null || true
mdutil -i off /Users/fambot/Projects/Sigma/nanoclaw/data 2>/dev/null || true

echo ""
echo "=== Current pmset settings ==="
pmset -g

echo ""
echo "=== Verify these values ==="
echo "  sleep        = 0"
echo "  disksleep    = 0"
echo "  autorestart  = 1"
echo "  standby      = 0"
echo "  autopoweroff = 0"
echo ""
echo "Done! Now install the caffeinate launchd agent (no sudo needed):"
echo "  launchctl load ~/Library/LaunchAgents/com.sigma.caffeinate.plist"
