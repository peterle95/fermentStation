import { useState, useSyncExternalStore } from "react";
import { pwaUpdate } from "../platform/pwa";

/** Floating glass toast offering a waiting app version. "Later" hides it until the next launch. */
export function UpdatePrompt() {
  const available = useSyncExternalStore(pwaUpdate.subscribe, pwaUpdate.isAvailable, () => false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  if (!available || dismissed) return null;
  return (
    <div className="update-prompt glass" role="status" aria-live="polite" data-testid="update-prompt">
      <p>A new version of FermentStation is ready.</p>
      <div className="update-prompt-actions">
        <button type="button" className="glass" onClick={() => setDismissed(true)}>Later</button>
        <button
          type="button"
          className="glass"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            void pwaUpdate.apply();
          }}
        >
          {updating ? "Updating…" : "Update"}
        </button>
      </div>
    </div>
  );
}
