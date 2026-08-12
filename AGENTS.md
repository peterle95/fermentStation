## Agent skills

### Issue tracker

Issues and planning tickets live in GitHub Issues for this repository. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default triage label vocabulary documented in `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

### Android debugging

Always give ADB commands a short tool timeout (5 seconds is enough for `adb devices`). On this machine, Windows `portproxy` may own `127.0.0.1:5555` and forward it to a stale WSL address. ADB then reports `emulator-5554 offline` and retries the dead transport about every 22 seconds even when no emulator is running.

Before waiting on ADB, check `Get-Process -Name emulator,qemu-system-x86_64 -ErrorAction SilentlyContinue` and `netsh interface portproxy show all`. If no emulator process exists and port `5555` points to an unreachable address, stop the ADB attempt and report the stale proxy. Do not delete the proxy without user approval because another Android or WSL workflow may own it.
