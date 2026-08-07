import { useState } from "react";
import {
  createShellState,
  destinations,
  selectDestination,
  type Destination,
} from "./domain/shell";
import { browserShellStore } from "./platform/shell-store";

const labels: Record<Destination, string> = {
  today: "Today",
  batches: "Batches",
  calendar: "Calendar",
  profiles: "Profiles",
  settings: "Settings",
};

const descriptions: Record<Destination, string> = {
  today: "Your fermentation attention queue will appear here.",
  batches: "Your active, ready, and to-fridge batches will appear here.",
  calendar: "Finish dates and profile checks will appear here.",
  profiles: "Your fermentation profiles will appear here.",
  settings: "Your local app preferences will appear here.",
};

export function App() {
  const [shell, setShell] = useState(
    () => browserShellStore.load() ?? createShellState(),
  );

  function navigate(destination: Destination) {
    const next = selectDestination(shell, destination);
    browserShellStore.save(next);
    setShell(next);
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <p className="eyebrow">Household fermentation</p>
        <h1>FermentStation</h1>
        <p className="intro">Keep the next small action close at hand.</p>
      </header>

      <div className="layout">
        <nav aria-label="Primary navigation" className="navigation">
          {destinations.map((destination) => (
            <button
              aria-current={shell.destination === destination ? "page" : undefined}
              className={shell.destination === destination ? "selected" : undefined}
              key={destination}
              onClick={() => navigate(destination)}
              type="button"
            >
              {labels[destination]}
            </button>
          ))}
        </nav>

        <main>
          <p className="eyebrow">{labels[shell.destination]}</p>
          <h2>{labels[shell.destination]}</h2>
          <section aria-label={`${labels[shell.destination]} placeholder`} className="empty-state">
            <p>{descriptions[shell.destination]}</p>
            <p>Start with a fermentation profile to begin tracking a batch.</p>
          </section>
        </main>
      </div>
    </div>
  );
}
