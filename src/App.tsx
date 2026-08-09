import { useEffect, useRef, useState } from "react";
import {
  addTimelineEntry,
  addPhReading,
  addBatchCheck,
  adjustBatchCheck,
  batchStatuses,
  createBatch,
  calendarEvents,
  completeBatchCheck,
  createBatchState,
  deleteBatch,
  deleteTimelineEntry,
  discardExpiredBatches,
  dueBatchChecks,
  filterBatches,
  latestPhReading,
  removeBatchCheck,
  renameBatchCheck,
  prioritizeToday,
  phWarning,
  phZoneLabel,
  restoreBatch,
  restoreTimelineEntry,
  overrideBatchCalculation,
  setBatchInput,
  setFinishDate,
  statusLabel,
  updateTimelineEntry,
  type Batch,
  type CalendarEvent,
  type BatchFilter,
  type BatchState,
  type BatchStatus,
  type TimelineEntry,
  updateBatchForDate,
  updatePhReading,
} from "./domain/batches";
import {
  addProfile,
  createProfileState,
  deleteProfile,
  parseSimpleFormula,
  updateProfile,
  validateProfile,
  type FermentationProfile,
  type MetricUnit,
  type ProfileCalculation,
} from "./domain/profiles";
import {
  createShellState,
  destinations,
  selectDestination,
  type Destination,
  type ShellPreferences,
} from "./domain/shell";
import { browserShellStore } from "./platform/shell-store";
import { browserProfileStore } from "./platform/profile-store";
import { browserBatchStore } from "./platform/batch-store";
import {
  createArchive,
  importArchive,
  resolveArchiveCollisions,
  type ArchiveImport,
} from "./platform/archive";

const labels: Record<Destination, string> = {
  today: "Today",
  batches: "Batches",
  calendar: "Calendar",
  profiles: "Profiles",
  settings: "Settings",
};

const descriptions: Partial<Record<Destination, string>> = {
  calendar: "Finish dates and profile checks will appear here.",
  settings: "Your local app preferences will appear here.",
};

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `record-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function NavIcon({ destination }: { destination: Destination }) {
  if (destination === "today") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="4" /><path d="M12 9V5M10 5h4M12 2l1.5 3h-3zM2 13h3M19 13h3M5 5l2 2M19 5l-2 2" /></svg>;
  if (destination === "batches") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3h8M9 3v3l-3 9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3l-3-9V3M7 14h10" /></svg>;
  if (destination === "calendar") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 17.5h2" /></svg>;
  if (destination === "profiles") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3.5c2 1 3.5 3 3.5 5.5 0 1-.3 2-.8 2.8l7.3 7.3v1.4H14l-2-2h-2.5M4 5.5c1.8 1.6 3 3.8 3 6.2v1.8H4.5a2.5 2.5 0 0 1 0-5H5M5 19.5l-1-1.5" /></svg>;
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7 7 0 0 0-1.7-1L14.4 3h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.5-1-2 3.4L6 11a7 7 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.5 1 2-3.4-2.1-1.6a7 7 0 0 0 .1-1z" /></svg>;
}

function StatusIcon({ status }: { status: BatchStatus | "attention" }) {
  if (status === "ready") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5l5 5 10-11" /></svg>;
  if (status === "to-fridge") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 9h.5M8 15.5h.5" /></svg>;
  if (status === "attention") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12M12 15.8v.2" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>;
}

export function App() {
  const [shell, setShell] = useState(
    () => browserShellStore.load() ?? createShellState(),
  );
  const [profileState, setProfileState] = useState(() =>
    browserProfileStore.load() ?? createProfileState(),
  );
  const [batchState, setBatchState] = useState(() =>
    updateBatchDates(
      discardExpiredBatches(browserBatchStore.load() ?? createBatchState(), Date.now()),
    ),
  );
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  function saveProfiles(next: typeof profileState) {
    browserProfileStore.save(next);
    setProfileState(next);
  }

  function navigate(destination: Destination) {
    const next = selectDestination(shell, destination);
    browserShellStore.save(next);
    setShell(next);
    setOpenBatchId(null);
    setEditingProfileId(null);
  }

  function saveBatches(next: BatchState) {
    const current = updateBatchDates(discardExpiredBatches(next, Date.now()));
    browserBatchStore.save(current);
    setBatchState(current);
  }

  function handleProfile(profile: FermentationProfile) {
    const exists = profileState.profiles.some(({ id }) => id === profile.id);
    saveProfiles(exists ? updateProfile(profileState, profile) : addProfile(profileState, profile));
  }

  return (
    <div className={`app-shell${editingProfileId && shell.destination === "profiles" ? " profile-editor-shell" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3h4M12 3v6M6.5 9h11a.5.5 0 0 1 .5.5v1a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-1a.5.5 0 0 1 .5-.5zM7.5 13.5c0 2.5.9 4.2 2.5 5.2v1.8h4v-1.8c1.6-1 2.5-2.7 2.5-5.2M10 20.5h4" /></svg></span>
          <div><strong>FermentStation</strong><span>Household journal</span></div>
        </div>
        <nav aria-label="Primary navigation" className="navigation">
          {destinations.map((destination) => (
            <button
              aria-label={destination === "settings" ? "Settings" : undefined}
              aria-current={shell.destination === destination ? "page" : undefined}
              className={shell.destination === destination ? "selected" : undefined}
              key={destination}
              onClick={() => navigate(destination)}
              type="button"
            >
              <span className="nav-mark" aria-hidden="true"><NavIcon destination={destination} /></span>
              {destination === "settings" ? (
                <span>More</span>
              ) : labels[destination]}
            </button>
          ))}
        </nav>
      </aside>

      <div className="content-shell">
        <header className="masthead">
          <div><strong>{labels[shell.destination]}</strong><span>{shell.destination === "batches" ? "6 batches · 3 fermenting" : "FermentStation · v1"}</span></div>
          <button aria-label="More options" className="masthead-menu" type="button">•••</button>
        </header>

        <main className="main-content">
          {shell.destination === "today" ? (
            <section className="today-screen">
              <div className="screen-head">
                <div>
                  <p className="eyebrow">{formatToday()}</p>
                  <h1>Today</h1>
                  <p className="screen-intro">{screenDescription("today")}</p>
                </div>
              </div>
              <BatchView
                batches={batchState.batches}
                mode="today"
                onNavigate={navigate}
                onOpen={setOpenBatchId}
                openBatchId={openBatchId}
                onChange={(next) => saveBatches({
                  ...batchState,
                  batches: batchState.batches.map((batch) => batch.id === next.id ? next : batch),
                })}
                onCreate={(batch) => saveBatches({
                  ...batchState, batches: [...batchState.batches, batch],
                })}
                onDelete={(id) => saveBatches(deleteBatch(batchState, id, Date.now()))}
                profiles={profileState.profiles}
              />
            </section>
          ) : shell.destination === "batches" ? (
            <section className="batches-screen" aria-label="All batches">
              <div className="screen-head">
                <div>
                  <p className="eyebrow">All jars &amp; crocks</p>
                  <h1>Batches</h1>
                  <p className="screen-intro">{screenDescription("batches")}</p>
                </div>
              </div>
            <BatchView
              batches={batchState.batches}
              mode="batches"
              onNavigate={navigate}
              onOpen={setOpenBatchId}
              openBatchId={openBatchId}
              onChange={(next) => saveBatches({
                ...batchState,
                batches: batchState.batches.map((batch) => batch.id === next.id ? next : batch),
              })}
              onCreate={(batch) => saveBatches({
                ...batchState, batches: [...batchState.batches, batch],
              })}
              onDelete={(id) => saveBatches(deleteBatch(batchState, id, Date.now()))}
               profiles={profileState.profiles}
             />
            </section>
          ) : shell.destination === "calendar" ? (
            <section className="calendar-screen" aria-label="Fermentation calendar">
              <div className="screen-head">
                <div>
                  <p className="eyebrow">Check-ins &amp; ready days</p>
                  <h1>Calendar</h1>
                  <p className="screen-intro">Amber marks a profile check, green a ready day, blue a shift to the fridge.</p>
                </div>
              </div>
              <CalendarView batches={batchState.batches} />
            </section>
          ) : shell.destination === "profiles" ? (
            <section className="profiles-screen" aria-label="Fermentation profiles">
              {!editingProfileId && (
                <div className="screen-head">
                  <div>
                    <p className="eyebrow">Recipes that remember</p>
                    <h1>Profiles</h1>
                    <p className="screen-intro">A fermentation profile carries the inputs, guidance, and calculations a batch follows until it's ready.</p>
                  </div>
                </div>
              )}
              <Profiles
                formulaTerms={shell.formulaTerms}
                profiles={profileState.profiles}
                onDelete={(id) => saveProfiles(deleteProfile(profileState, id))}
                onSave={handleProfile}
                onEditingChange={setEditingProfileId}
              />
            </section>
          ) : shell.destination === "settings" ? (
            <section className="settings-screen" aria-label="Settings">
              <div className="screen-head">
                <div>
                  <p className="eyebrow">Reached from the overflow menu</p>
                  <h1>Settings</h1>
                  <p className="screen-intro">Household preferences for how FermentStation talks to you. No data leaves this device.</p>
                </div>
              </div>
            <SettingsView
              batchState={batchState}
              formulaTerms={shell.formulaTerms}
              preferences={shell}
              profileState={profileState}
              onFormulaTermsChange={(formulaTerms) => {
                const next = { ...shell, formulaTerms };
                browserShellStore.save(next);
                setShell(next);
              }}
              onPreferencesChange={(preferences) => {
                const next = { ...shell, ...preferences };
                browserShellStore.save(next);
                setShell(next);
              }}
               onImport={(profiles, importedBatches) => {
                 saveProfiles(profiles);
                 saveBatches(importedBatches);
               }}
               onRestoreBatch={(id) => saveBatches(restoreBatch(batchState, id, Date.now()))}
             />
            </section>
          ) : (
            <>
              <p className="eyebrow">{labels[shell.destination]}</p>
              <h2>{labels[shell.destination]}</h2>
              <p className="screen-intro">{screenDescription(shell.destination)}</p>
            <section aria-label={`${labels[shell.destination]} placeholder`} className="empty-state">
              <p>{descriptions[shell.destination]}</p>
              <p>Start with a fermentation profile to begin tracking a batch.</p>
            </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function formatToday() {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" })
    .format(new Date(`${localDate()}T12:00:00`));
}

function screenDescription(destination: Destination) {
  if (destination === "today") return "The next small actions for your active ferments.";
  if (destination === "batches") return "Every batch belongs to a fermentation profile and keeps its own dated timeline.";
  if (destination === "calendar") return "Finish dates and recurring profile checks.";
  if (destination === "profiles") return "Reusable guidance, calculations, and check rhythms.";
  return "Preferences and local data exchange.";
}

interface SettingsViewProps {
  batchState: BatchState;
  formulaTerms: string[];
  preferences: ShellPreferences;
  profileState: ReturnType<typeof createProfileState>;
  onFormulaTermsChange(formulaTerms: string[]): void;
  onPreferencesChange(preferences: ShellPreferences): void;
  onImport(profiles: ReturnType<typeof createProfileState>, batches: BatchState): void;
  onRestoreBatch(id: string): void;
}

function SettingsView({ batchState, formulaTerms, preferences, profileState, onFormulaTermsChange, onPreferencesChange, onImport, onRestoreBatch }: SettingsViewProps) {
  const [message, setMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<ArchiveImport | null>(null);
  const [showDeletedBatches, setShowDeletedBatches] = useState(false);
  const [terms, setTerms] = useState(formulaTerms);
  const [newTerm, setNewTerm] = useState("");
  const [termError, setTermError] = useState("");

  function formulaTermError(next: string[]) {
    if (next.length === 0) return "At least one formula term is required.";
    if (next.some((term) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(term))) {
      return "Formula terms must start with a letter and use only letters, numbers, or underscores.";
    }
    if (new Set(next).size !== next.length) return "Formula terms must be unique.";
    return "";
  }

  function addFormulaTerm() {
    const next = [...terms, newTerm.trim()];
    const error = formulaTermError(next);
    if (error) return setTermError(error);
    setTerms(next);
    setNewTerm("");
    setTermError("");
  }

  function saveFormulaTerms() {
    const error = formulaTermError(terms);
    if (error) return setTermError(error);
    onFormulaTermsChange(terms);
    setTermError("");
    setMessage("Formula terms saved on this device.");
  }

  async function downloadArchive() {
    const bytes = await createArchive(profileState, batchState);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fermentstation-${localDate()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Archive exported locally.");
  }

  function downloadJournal() {
    const journal = [
      "FermentStation journal",
      `Exported ${localDate()}`,
      ...batchState.batches.flatMap((batch) => [
        "",
        `${batch.name} (${batch.id})`,
        `Profile: ${batch.profileSnapshot.name}`,
        `Started: ${batch.startDate}`,
        `Status: ${statusLabel(batch.status)}`,
        ...batch.timeline.map((entry) => `${entry.date}: ${timelineEntryText(entry)}`),
      ]),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([journal], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fermentstation-journal-${localDate()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Journal exported locally.");
  }

  async function uploadArchive(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importArchive(
        new Uint8Array(await file.arrayBuffer()),
        profileState,
        batchState,
      );
      setPendingImport(imported.collisions.length > 0 ? imported : null);
      if (imported.collisions.length > 0) {
        setMessage("Import paused. Resolve the listed identifier collisions before changing local data.");
      } else {
        onImport(imported.profileState, imported.batchState);
        setMessage("Archive imported.");
      }
    } catch (error) {
      setPendingImport(null);
      setMessage(`Import rejected: ${(error as Error).message}`);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <section className="settings" aria-label="Local backup and transfer">
      <section className="settings-card" aria-label="Household preferences">
        <div className="setting-row">
          <div className="setting-body"><b>Units</b><p>Readouts for temperature and volume.</p></div>
          <div className="setting-segment" aria-label="Units">
            <button aria-pressed={preferences.units === "metric"} onClick={() => onPreferencesChange({ ...preferences, units: "metric" })} type="button">°C / L</button>
            <button aria-pressed={preferences.units === "imperial"} onClick={() => onPreferencesChange({ ...preferences, units: "imperial" })} type="button">°F / qt</button>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-body"><b>Check reminders</b><p>A quiet nudge the morning a profile check is due.</p></div>
          <div className="setting-segment" aria-label="Check reminders">
            <button aria-pressed={preferences.checkReminders} onClick={() => onPreferencesChange({ ...preferences, checkReminders: true })} type="button">On</button>
            <button aria-pressed={!preferences.checkReminders} onClick={() => onPreferencesChange({ ...preferences, checkReminders: false })} type="button">Off</button>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-body"><b>Suggestions</b><p>Show computed suggested values on timeline entries.</p></div>
          <div className="setting-segment" aria-label="Suggestions">
            <button aria-pressed={preferences.suggestions} onClick={() => onPreferencesChange({ ...preferences, suggestions: true })} type="button">On</button>
            <button aria-pressed={!preferences.suggestions} onClick={() => onPreferencesChange({ ...preferences, suggestions: false })} type="button">Off</button>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-body"><b>Export</b><p>Draft a plain-text journal of every batch timeline.</p></div>
          <button className="setting-export" onClick={downloadJournal} type="button">Export journal</button>
        </div>
        <div className="setting-row">
          <div className="setting-body"><b>Recently deleted batches</b><p>Batches remain recoverable for seven days.</p></div>
          <button
            aria-expanded={showDeletedBatches}
            aria-label={showDeletedBatches ? "Close recently deleted batches" : "Open recently deleted batches"}
            className="setting-trash-button"
            onClick={() => setShowDeletedBatches(!showDeletedBatches)}
            type="button"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
          </button>
        </div>
        {showDeletedBatches && (
          <div className="deleted-batches-panel" aria-label="Recently deleted batches">
            {batchState.trash.length === 0 ? <p>No recently deleted batches.</p> : batchState.trash.map((batch) => (
              <div className="trash-item" key={batch.id}>
                <span>{batch.name}</span>
                <button aria-label={`Restore ${batch.name}`} onClick={() => onRestoreBatch(batch.id)} type="button">Restore</button>
              </div>
            ))}
          </div>
        )}
        <div className="setting-row">
          <div className="setting-body"><b>About</b><p>FermentStation v1 concept · not production software.</p></div>
          <span className="settings-version">v1.0-concept</span>
        </div>
      </section>
      <section className="settings-card formula-term-settings" aria-labelledby="formula-terms-heading">
        <h3 id="formula-terms-heading">Formula dropdown terms</h3>
        <p>These names stay on this device and are not included in archives.</p>
        {terms.map((term, index) => (
          <div className="formula-term" key={index}>
            <label>Formula term {index + 1}<input onChange={(event) => setTerms(terms.map((value, termIndex) => termIndex === index ? event.target.value : value))} value={term} /></label>
            <button aria-label={`Remove formula term ${index + 1}: ${term}`} disabled={terms.length === 1} onClick={() => setTerms(terms.filter((_, termIndex) => termIndex !== index))} type="button">Remove</button>
          </div>
        ))}
        <div className="formula-term">
          <label>New formula term<input onChange={(event) => setNewTerm(event.target.value)} value={newTerm} /></label>
          <button onClick={addFormulaTerm} type="button">Add term</button>
        </div>
        {termError && <p className="notice" role="alert">{termError}</p>}
        <button className="primary-action" onClick={saveFormulaTerms} type="button">Save formula terms</button>
      </section>
      <section className="settings-card settings-exchange">
        <h3>Data exchange</h3>
        <p>Archives are explicit local exchange files. Live databases and app-private directories are never synchronized.</p>
        <button className="primary-action" onClick={downloadArchive} type="button">Export ZIP archive</button>
        <label>Import ZIP archive <input accept=".zip,application/zip" onChange={uploadArchive} type="file" /></label>
      </section>
      {message && <p className="notice" role="status">{message}</p>}
      {pendingImport && (
        <section className="trash" aria-label="Import collisions">
          <h3>Identifier collisions</h3>
          {pendingImport.collisions.map((collision) => (
            <p key={`${collision.kind}-${collision.id}`}>{collision.kind}: {collision.id}</p>
          ))}
          <div className="form-actions">
            <button onClick={() => {
              const resolved = resolveArchiveCollisions(pendingImport, "local");
              onImport(resolved.profileState, resolved.batchState);
              setPendingImport(null);
              setMessage("Archive imported with local records kept for collisions.");
            }} type="button">Keep local versions</button>
            <button onClick={() => {
              const resolved = resolveArchiveCollisions(pendingImport, "archive");
              onImport(resolved.profileState, resolved.batchState);
              setPendingImport(null);
              setMessage("Archive imported with archive records used for collisions.");
            }} type="button">Use archive versions</button>
          </div>
        </section>
      )}
    </section>
  );
}

function updateBatchDates(state: BatchState): BatchState {
  return {
    ...state,
    batches: state.batches.map((batch) => updateBatchForDate(batch, localDate())),
  };
}

function CalendarView({ batches }: { batches: Batch[] }) {
  const [viewDate, setViewDate] = useState(() => new Date(`${localDate()}T12:00:00`));
  const events = calendarEvents(batches);
  const today = localDate();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(firstDay);
  const cells: Array<{ date?: string; events: CalendarEvent[] }> = [
    ...Array.from({ length: leadingDays }, () => ({ events: [] })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
      return { date, events: events.filter((event) => event.date === date) };
    }),
  ];
  const upcoming = events.filter(({ date }) => date >= today).slice(0, 5);
  const overdue = events.filter(({ date, kind }) => kind === "check" && date < today).slice(0, 5);

  function shiftMonth(offset: number) {
    setViewDate(new Date(year, month + offset, 1));
  }

  return (
    <div className="calendar-layout">
      <div className="calendar-panel">
        <div className="calendar-head">
          <h2>{monthLabel}</h2>
          <div className="calendar-nav">
            <button aria-label="Previous month" onClick={() => shiftMonth(-1)} type="button"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <button aria-label="Next month" onClick={() => shiftMonth(1)} type="button"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
          </div>
        </div>
        <div aria-hidden="true" className="calendar-weekdays">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid" role="grid" aria-label={monthLabel}>
          {cells.map((cell, index) => cell.date ? (
            <div
              aria-label={`${cell.date}${cell.events.length ? `, ${cell.events.map(({ label }) => label).join(", ")}` : ""}`}
              className={`calendar-day${cell.date === today ? " today" : ""}`}
              key={cell.date}
              role="gridcell"
            >
              <span className="calendar-day-number">{Number(cell.date.slice(-2))}</span>
              {cell.events.map((event) => (
                <span className={`calendar-event event-${event.kind}`} key={`${event.batchId}-${event.kind}-${event.label}`} title={`${event.batchName}: ${event.label}`}>
                  {event.label}
                </span>
              ))}
            </div>
          ) : <div aria-hidden="true" className="calendar-day other" key={`leading-${index}`} />)}
        </div>
        <div className="calendar-legend">
          <span className="legend-check"><i />Profile check</span>
          <span className="legend-ready"><i />Ready</span>
          <span className="legend-fridge"><i />To fridge</span>
        </div>
      </div>
      <div className="calendar-lists">
        <div>
          <div className="calendar-section-label"><h2>Upcoming checks</h2></div>
          <div className="upcoming-list">
            {upcoming.length === 0 ? <p className="calendar-empty">No finish dates or checks scheduled.</p> : upcoming.map((event) => {
            const date = new Date(`${event.date}T12:00:00`);
            const isFinish = event.kind === "finish";
            return (
              <article className="upcoming-item" key={`${event.batchId}-${event.kind}-${event.date}`}>
                <div className="upcoming-date"><b>{date.getDate()}</b><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)}</span></div>
                <div className="upcoming-body"><time className="calendar-event-date" dateTime={event.date}>{event.date}</time><b>{event.batchName} {isFinish ? "finish date" : event.label}</b><p>{isFinish ? "Ready to bottle or move on." : "Profile check · due"}</p></div>
                <span className={`calendar-status ${isFinish ? "ready" : "attention"}`}><span className="status-dot" />{isFinish ? "ready" : "check"}</span>
              </article>
            );
            })}
          </div>
        </div>
        <div>
          <div className="calendar-section-label"><h2>Overdue</h2></div>
          <div className="upcoming-list">
            {overdue.length === 0 ? <p className="calendar-empty">No overdue checks.</p> : overdue.map((event) => {
              const date = new Date(`${event.date}T12:00:00`);
              return (
                <article className="upcoming-item overdue-item" key={`${event.batchId}-${event.kind}-${event.date}-${event.label}`}>
                  <div className="upcoming-date"><b>{date.getDate()}</b><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)}</span></div>
                  <div className="upcoming-body"><time className="calendar-event-date" dateTime={event.date}>{event.date}</time><b>{event.batchName} {event.label}</b><p>Profile check · overdue</p></div>
                  <span className="calendar-status attention"><span className="status-dot" />overdue</span>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BatchViewProps {
  batches: Batch[];
  mode: "today" | "batches";
  profiles: FermentationProfile[];
  onChange(batch: Batch): void;
  onCreate(batch: Batch): void;
  onDelete(id: string): void;
  onNavigate(destination: Destination): void;
  onOpen(id: string | null): void;
  openBatchId: string | null;
}

type BatchListFilter = BatchFilter | "attention";

function BatchView({ batches, mode, profiles, onChange, onCreate, onDelete, onNavigate, onOpen, openBatchId }: BatchViewProps) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<BatchListFilter>("all");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectedProfile = profiles.find(({ id }) => id === profileId) ?? profiles[0];
  const visible = mode === "today" ? prioritizeToday(batches, localDate()) : filter === "attention"
    ? batches.filter((batch) => batch.status === "active" && dueBatchChecks(batch, localDate()).length > 0)
    : filterBatches(batches, filter);
  const openBatch = visible.find(({ id }) => id === openBatchId);
  const dueChecks = visible.flatMap((batch) => dueBatchChecks(batch, localDate()).map((check) => ({ batch, check })))
    .sort((left, right) => left.check.nextDueDate.localeCompare(right.check.nextDueDate) ||
      left.batch.name.localeCompare(right.batch.name) || left.check.name.localeCompare(right.check.name));
  const readyBatches = visible.filter(({ status }) => status === "ready");
  const today = localDate();
  const upcoming = calendarEvents(batches).filter(({ date }) => date >= today);
  const upcomingDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + offset);
    const dateValue = date.toISOString().slice(0, 10);
    return { date: dateValue, events: upcoming.filter((event) => event.date === dateValue) };
  });

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile = profiles.find(({ id }) => id === data.get("profileId"));
    const startDate = String(data.get("startDate") ?? "");
    if (!profile || !startDate) {
      return;
    }

    const batch = createBatch(profile, {
      id: createClientId(),
      name: String(data.get("name") ?? ""),
      startDate,
      today: localDate(),
      inputValues: Object.fromEntries(profile.inputs.map((input) => {
        const raw = String(data.get(`input.${input.name}`) ?? "");
        return [input.name, raw === "" ? undefined : Number(raw)];
      })),
    });
    onCreate(batch);
    onOpen(batch.id);
    setCreating(false);
  }

  function closeBatch() {
    onOpen(null);
    requestAnimationFrame(() => overviewHeadingRef.current?.focus());
  }

  return (
    <section className="batches" aria-label={mode === "today" ? "Today batch queue" : "Batch list"}>
      {openBatch ? (
        <>
          <div className="batch-breadcrumb">
            <button autoFocus className="back-link" onClick={closeBatch} type="button">← Back to {mode}</button>
            <span aria-hidden="true">/</span>
            <span>{openBatch.id}</span>
          </div>
          <BatchCard batch={openBatch} onChange={onChange} onDelete={onDelete} />
        </>
      ) : (
      <>
      {mode === "batches" && <div className="batch-toolbar">
        <button
          aria-label="Start batch"
          className="primary-action batch-fab"
          disabled={profiles.length === 0}
          onClick={() => setCreating(true)}
          type="button"
        >
          <span aria-hidden="true">+</span><span>Start batch</span>
        </button>
      </div>}

      {mode === "today" && (
        <button
          aria-label="Start batch"
          className="today-fab primary-action"
          disabled={profiles.length === 0}
          onClick={() => setCreating(true)}
          type="button"
        >
          <span aria-hidden="true">+</span><span>Start batch</span>
        </button>
      )}

      {profiles.length === 0 && <p className="notice">Restore or create a profile before starting a batch.</p>}

      {creating && (
        <form className="batch-form" onSubmit={save}>
          <label>
            Fermentation profile
            <select autoFocus name="profileId" onChange={(event) => setProfileId(event.target.value)} required value={selectedProfile?.id ?? ""}>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </label>
          <label>
            Start date
            <input defaultValue={localDate()} name="startDate" required type="date" />
          </label>
          {selectedProfile?.inputs.map((input) => (
            <label key={input.name}>
              {input.name} ({input.unit})
              <input defaultValue={input.defaultValue} min="0" name={`input.${input.name}`} step="any" type="number" />
            </label>
          ))}
          <label>
            Batch name <span className="optional">Optional</span>
            <input name="name" placeholder="Uses profile name if blank" />
          </label>
          <div className="form-actions">
            <button className="primary-action" type="submit">Create active batch</button>
            <button onClick={() => setCreating(false)} type="button">Cancel</button>
          </div>
        </form>
      )}

      {mode === "today" && (dueChecks.length > 0 || readyBatches.length > 0) && (
        <section className="action-queue" aria-labelledby="action-queue-heading">
          <h2 className="queue-heading" id="action-queue-heading">Action queue · due now</h2>
          <div className="queue-grid">
            {dueChecks.map(({ batch, check }) => (
              <article className="queue-card attention" key={`${batch.id}-${check.id}`}>
                <span className="queue-icon" aria-hidden="true">!</span>
                <div><small>{check.overdue ? `Overdue · was due ${check.nextDueDate}` : "Due today"}</small><h4>{check.name} for <span className="queue-batch">{batch.name}</span></h4><p>{batch.profileSnapshot.guidance[0] || "Open the batch and record what you find."}</p></div>
                <button aria-label={`Open ${batch.name} for ${check.name}`} className="primary-action" onClick={() => onOpen(batch.id)} type="button">Open batch</button>
              </article>
            ))}
            {readyBatches.map((batch) => (
              <article className="queue-card ready" key={`ready-${batch.id}`}>
                <span className="queue-icon" aria-hidden="true">✓</span>
                <div><small>Due today</small><h4><span className="queue-batch">{batch.name}</span> is ready</h4><p>Review the batch and choose its next status.</p></div>
                <button aria-label={`Open ready batch ${batch.name}`} className="primary-action" onClick={() => onOpen(batch.id)} type="button">Open batch</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {mode === "batches" && (
        <div className="filter-row" role="group" aria-label="Filter batches by status">
          {(["all", "attention", ...batchStatuses] as BatchListFilter[]).map((status) => (
            <button aria-pressed={filter === status} key={status} onClick={() => setFilter(status)} type="button">
              {status === "all" ? "All" : status === "attention" ? "Active · attention" : statusLabel(status)}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <section className="empty-state">
          <p>{batches.length === 0 ? "No batches yet." : "No batches match this status."}</p>
          <p>Start one from a fermentation profile when you are ready.</p>
        </section>
      ) : (
        <section aria-label={mode === "batches" ? "Batch overview" : undefined} aria-labelledby={mode === "today" ? "batch-overview-heading" : undefined}>
          {mode === "today" ? (
            <div className="section-label">
              <h2 id="batch-overview-heading" ref={overviewHeadingRef} tabIndex={-1}>Active batches</h2>
              <a href="#batches" onClick={(event) => { event.preventDefault(); onNavigate("batches"); }}>All batches</a>
            </div>
          ) : null}
          <div className="batch-overview">
            {visible.map((batch) => <CompactBatchCard batch={batch} key={batch.id} mode={mode} onOpen={onOpen} />)}
          </div>
        </section>
      )}

      {mode === "today" && (
        <section aria-labelledby="upcoming-heading" className="upcoming">
          <div className="section-label">
            <h2 id="upcoming-heading">Upcoming · next 7 days</h2>
            <a href="#calendar" onClick={(event) => { event.preventDefault(); onNavigate("calendar"); }}>Open calendar</a>
          </div>
          <div className="upcoming-strip">
            {upcomingDays.map(({ date: dateValue, events }) => {
              const date = new Date(`${dateValue}T12:00:00`);
              return (
                <button className={dateValue === today ? "today" : undefined} key={dateValue} onClick={() => events[0] && onOpen(events[0].batchId)} type="button">
                  <time dateTime={dateValue}><strong>{date.getDate()}</strong>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date)}</time>
                  <div>{events.map((event) => <span className={`event-${event.kind}`} key={`${event.batchId}-${event.kind}-${event.label}`}>{event.label}</span>)}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}
      </>
      )}
    </section>
  );
}

function CompactBatchCard({ batch, mode, onOpen }: { batch: Batch; mode: "today" | "batches"; onOpen(id: string): void }) {
  const nextCheck = batch.status === "active" ? [...batch.checks].sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate))[0] : undefined;
  const latestPh = latestPhReading(batch);
  const day = Math.max(1, Math.floor((Date.parse(`${localDate()}T00:00:00Z`) - Date.parse(`${batch.startDate}T00:00:00Z`)) / 86_400_000) + 1);
  const next = nextCheck ? `${nextCheck.name} · ${nextCheck.nextDueDate}` : batch.finishDate ? `Finish · ${batch.finishDate}` : "Review timeline";
  const isAttention = batch.status === "active" && dueBatchChecks(batch, localDate()).length > 0;
  const statusText = isAttention ? "Active · attention" : statusLabel(batch.status);
  return (
    <button aria-label={`Open ${batch.name}`} className={mode === "batches" ? "batch-card" : "batch-summary"} onClick={() => onOpen(batch.id)} type="button">
      <div className={mode === "batches" ? "bc-top" : "summary-heading"}><small className={mode === "batches" ? "bc-id" : undefined}>{batch.id.slice(0, 8)}</small><span className={`status status-${isAttention ? "attention" : batch.status}`}><StatusIcon status={isAttention ? "attention" : batch.status} />{statusText}</span></div>
      <h3>{batch.name}</h3>
      <p className={mode === "batches" ? "bc-name" : undefined}>{batch.profileSnapshot.name}</p>
      <div className={mode === "batches" ? "bc-metrics" : "summary-metrics"}><span>Day {day}</span>{latestPh && <span>pH {latestPh.value}</span>}</div>
      <p className={mode === "batches" ? "bc-next" : "summary-next"}><strong>Next:</strong> {next}</p>
    </button>
  );
}

interface BatchCardProps {
  batch: Batch;
  onChange(batch: Batch): void;
  onDelete(id: string): void;
}

function BatchCard({ batch, onChange, onDelete }: BatchCardProps) {
  const [editing, setEditing] = useState<TimelineEntry | null>(null);
  const [editingPh, setEditingPh] = useState<Extract<TimelineEntry, { kind: "ph" }> | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Extract<TimelineEntry, { kind: "photo" }> | null>(null);
  const [checkDrafts, setCheckDrafts] = useState<Record<string, string>>({});
  const [checkError, setCheckError] = useState("");
  const [addingCheck, setAddingCheck] = useState(false);
  const [newCheckName, setNewCheckName] = useState("");
  const [newCheckInterval, setNewCheckInterval] = useState("7");

  function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("kind")) as "note" | "measurement" | "status";
    const common = {
      id: editing?.id ?? createClientId(),
      date: String(data.get("date") ?? ""),
    };
    const entry: TimelineEntry = kind === "status"
      ? { ...common, kind, status: String(data.get("status")) as BatchStatus }
      : { ...common, kind, text: String(data.get("text") ?? "").trim() };
    if (!entry.date || ("text" in entry && !entry.text)) return;
    onChange(editing ? updateTimelineEntry(batch, entry, localDate()) : addTimelineEntry(batch, entry));
    setEditing(null);
    event.currentTarget.reset();
  }

  function recordStatus(status: BatchStatus) {
    onChange(addTimelineEntry(batch, {
      id: createClientId(), date: localDate(), kind: "status", status,
    }));
  }

  function saveInputs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let next = batch;
    for (const input of batch.profileSnapshot.inputs) {
      const raw = String(data.get(input.name) ?? "");
      next = setBatchInput(next, input.name, raw === "" ? undefined : Number(raw));
    }
    onChange(next);
  }

  function savePh(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const entry = {
      id: editingPh?.id ?? createClientId(),
      date: String(data.get("date") ?? ""),
      kind: "ph" as const,
      value: Number(data.get("value")),
    };
    onChange(editingPh ? updatePhReading(batch, entry) : addPhReading(batch, entry));
    setEditingPh(null);
    event.currentTarget.reset();
  }

  async function savePhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = (form.elements.namedItem("photo") as HTMLInputElement).files?.[0];
    if (!file || file.size === 0) {
      if (!editingPhoto) return;
    } else if (!file.type.startsWith("image/")) {
      return;
    }
    const replacement = file && file.size > 0 ? {
      name: file.name,
      mimeType: file.type,
      dataUrl: await fileToDataUrl(file),
    } : editingPhoto!;
    const entry = {
      id: editingPhoto?.id ?? createClientId(),
      date: String(data.get("date") ?? ""),
      kind: "photo" as const,
      name: replacement.name,
      mimeType: replacement.mimeType,
      dataUrl: replacement.dataUrl,
      caption: String(data.get("caption") ?? "").trim(),
    };
    onChange(editingPhoto ? updateTimelineEntry(batch, entry) : addTimelineEntry(batch, entry));
    setEditingPhoto(null);
    form.reset();
  }

  function saveNewCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      onChange(addBatchCheck(batch, newCheckName, Number(newCheckInterval), localDate()));
      setNewCheckName("");
      setNewCheckInterval("7");
      setAddingCheck(false);
      setCheckError("");
    } catch (error) {
      setCheckError((error as Error).message);
    }
  }

  function saveCheckName(checkId: string, currentName: string) {
    try {
      onChange(renameBatchCheck(batch, checkId, checkDrafts[checkId] ?? currentName));
      setCheckDrafts(({ [checkId]: _removed, ...rest }) => rest);
      setCheckError("");
    } catch (error) {
      setCheckError((error as Error).message);
    }
  }

  const latestPh = latestPhReading(batch);
  const phReadings = batch.timeline.filter((entry) => entry.kind === "ph");
  const dueCheck = dueBatchChecks(batch, localDate())[0];
  const nextCheck = [...batch.checks].sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate))[0];
  const day = Math.max(1, Math.floor((Date.parse(`${localDate()}T00:00:00Z`) - Date.parse(`${batch.startDate}T00:00:00Z`)) / 86_400_000) + 1);
  const temperatureInput = batch.profileSnapshot.inputs.find((input) => /temp/i.test(input.name));
  const temperature = temperatureInput ? batch.inputValues[temperatureInput.name] : undefined;
  const phZone = latestPh ? batch.profileSnapshot.phZones.find((zone) => latestPh.value >= zone.min && latestPh.value <= zone.max) : undefined;
  const phRange = batch.profileSnapshot.phZones.length > 0
    ? `${Math.min(...batch.profileSnapshot.phZones.map(({ min }) => min))}–${Math.max(...batch.profileSnapshot.phZones.map(({ max }) => max))}`
    : "No zone defined";
  const phPosition = latestPh && phZone
    ? Math.max(0, Math.min(100, ((latestPh.value - phZone.min) / Math.max(0.01, phZone.max - phZone.min)) * 100))
    : 50;
  const firstCalculation = batch.profileSnapshot.calculations[0];
  const firstCalculationValue = firstCalculation ? batch.calculationValues[firstCalculation.name] : undefined;
  const nextAction = dueCheck
    ? {
        kick: dueCheck.overdue ? `Profile check · overdue since ${dueCheck.nextDueDate}` : "Profile check · due today",
        title: dueCheck.name,
        body: "Record the current readings and note what you see in the vessel.",
      }
    : batch.status === "ready"
      ? { kick: "Ready · review next step", title: "Bottle or choose the next status", body: "The finish window has been reached. Review the timeline before moving it on." }
      : batch.status === "to-fridge"
        ? { kick: "To fridge · in storage", title: "Taste and check in", body: "Keep the batch cold and add the next observation when you taste it." }
        : { kick: "Batch in progress", title: nextCheck ? `Next ${nextCheck.name}` : "Keep the timeline current", body: nextCheck ? `Next check due ${nextCheck.nextDueDate}.` : "Record readings, notes, and status changes as the ferment develops." };

  return (
    <article className="batch-workspace">
      <div className="batch-workspace-head">
        <div>
          <p className="eyebrow">{batch.id} · {batch.profileSnapshot.name} · started {batch.startDate}</p>
          <div className="batch-title-row">
            <h3>{batch.name}</h3>
            <span className={`status status-${batch.status}`}><StatusIcon status={batch.status} />{statusLabel(batch.status)}</span>
          </div>
          <p className="batch-lead">{nextAction.body}</p>
        </div>
        <button className="primary-action" onClick={() => document.getElementById("batch-activity-form")?.scrollIntoView?.({ behavior: "smooth", block: "center" })} type="button">Record observation</button>
      </div>

      <div className="workbench">
        <div className="wb-rail">
          <section className="next-action" aria-labelledby="next-action-heading">
            <div className="next-action-icon"><StatusIcon status={batch.status} /></div>
            <div>
              <p className="next-action-kick">{nextAction.kick}</p>
              <h4 id="next-action-heading">{nextAction.title}</h4>
              <p>{nextAction.body}</p>
            </div>
          </section>

          <section className="wb-panel" aria-labelledby="measurements-heading">
            <h4 id="measurements-heading">Key measurements <span>live batch data</span></h4>
            <div className="meas-grid">
              <div className="meas">
                <div className="meas-label"><span>pH</span><span>zone {phRange}</span></div>
                <strong className="meas-value">{latestPh?.value ?? "—"}<small>{latestPh ? ` · ${phZoneLabel(batch, latestPh.value) ?? "outside zone"}` : " · optional read"}</small></strong>
                <div className="measurement-zone" aria-hidden="true"><span /><i className={!phZone ? "out" : undefined} style={{ left: `${phPosition}%` }} /></div>
                <p className="meas-note">{latestPh ? `Latest read ${latestPh.date}` : "Add a pH reading in the log below."}</p>
              </div>
              <div className="meas">
                <div className="meas-label"><span>Temperature</span></div>
                <strong className="meas-value">{temperature ?? "—"}<small>{temperatureInput ? ` ${temperatureInput.unit}` : " not recorded"}</small></strong>
                <p className="meas-note">{temperatureInput ? `Input · ${temperatureInput.name}` : "Add temperature to the profile inputs."}</p>
              </div>
              <div className="meas">
                <div className="meas-label"><span>Days elapsed</span></div>
                <strong className="meas-value">{day}</strong>
                <p className="meas-note">{nextCheck ? `Check cadence · every ${nextCheck.intervalDays} days` : "No recurring check set"}</p>
              </div>
              <div className="meas">
                <div className="meas-label"><span>Profile calculation</span></div>
                <strong className="meas-value meas-value-small">{firstCalculationValue?.override ?? firstCalculationValue?.suggested ?? "—"}<small>{firstCalculation?.unit ?? "incomplete"}</small></strong>
                <p className="meas-note">{firstCalculation ? firstCalculation.name : "No calculation defined"}</p>
              </div>
            </div>
            <p className="hint">Suggested values recalculate from the profile snapshot. Overrides and input editing remain available below.</p>
          </section>

          <section className="wb-panel batch-guidance" aria-labelledby="guidance-heading">
            <h4 id="guidance-heading">Profile guidance <span>{batch.profileSnapshot.name}</span></h4>
            <p className="snapshot-line"><strong>Profile snapshot:</strong> {batch.profileSnapshot.name}</p>
            {batch.profileSnapshot.guidance.map((guidance, index) => <div className="guide-step" key={`${guidance}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p><RichProfileText value={guidance} /></p></div>)}
            {batch.profileSnapshot.guidance.length === 0 && <p className="muted-copy">No active guidance in this profile snapshot.</p>}
          </section>

          {batch.finishDate && (
            <section className="wb-panel batch-details" aria-labelledby="finish-heading">
              <h4 id="finish-heading">Batch details</h4>
              <label className="finish-date">Finish date<input onChange={(event) => onChange(setFinishDate(batch, event.target.value, localDate()))} type="date" value={batch.finishDate} /></label>
            </section>
          )}

          {batch.profileSnapshot.inputs.length > 0 && (
            <section className="wb-panel" aria-labelledby="inputs-heading">
              <h4 id="inputs-heading">Profile inputs <span>{batch.profileSnapshot.inputs.length}</span></h4>
              <form className="batch-values" onSubmit={saveInputs}>
                {batch.profileSnapshot.inputs.map((input) => (
                  <label key={input.name}>{input.name} ({input.unit})<input defaultValue={batch.inputValues[input.name]} min="0" name={input.name} step="any" type="number" /></label>
                ))}
                <button className="secondary-action" type="submit">Update inputs</button>
              </form>
            </section>
          )}

          {batch.profileSnapshot.calculations.length > 0 && (
            <section className="wb-panel" aria-labelledby="calculations-heading">
              <h4 id="calculations-heading">Profile calculations <span>{batch.profileSnapshot.calculations.length}</span></h4>
              {batch.profileSnapshot.calculations.map((calculation) => {
                const value = batch.calculationValues[calculation.name];
                return (
                  <form className="calculation" key={calculation.name} onSubmit={(event) => {
                    event.preventDefault();
                    const raw = String(new FormData(event.currentTarget).get("override") ?? "");
                    if (raw !== "") onChange(overrideBatchCalculation(batch, calculation.name, Number(raw)));
                  }}>
                    <span><strong>{calculation.name}:</strong> {value?.override ?? value?.suggested ?? "Incomplete"} {calculation.unit}{value?.override !== undefined ? " (overridden)" : " suggested"}</span>
                    <input aria-label={`Override ${calculation.name}`} min="0" name="override" step="any" type="number" />
                    <button className="secondary-action" type="submit">Override</button>
                  </form>
                );
              })}
            </section>
          )}

          <section className="wb-panel checks" aria-label={`${batch.name} checks`}>
            <div className="checks-heading"><h4>Recurring checks</h4><button className="secondary-action" disabled={batch.status !== "active"} onClick={() => { setAddingCheck(true); setCheckError(""); }} type="button">Add check</button></div>
            {checkError && <p className="notice" role="alert">{checkError}</p>}
            {batch.checks.length === 0 && !addingCheck && <p className="muted-copy">No recurring checks yet.</p>}
            {batch.checks.map((check) => {
              const due = dueBatchChecks(batch, localDate()).find(({ id }) => id === check.id);
              return (
                <div className="check" key={check.id}>
                  <label><span>Check name</span><input aria-label={`Check name ${check.id}`} onChange={(event) => setCheckDrafts({ ...checkDrafts, [check.id]: event.target.value })} value={checkDrafts[check.id] ?? check.name} /></label>
                  <span className="check-schedule">{batch.status === "active" ? `${due?.overdue ? "Overdue" : due ? "Due" : "Next"} ${check.nextDueDate}` : "Paused"}</span>
                  <label>Every <input aria-label={`${check.name} interval days`} disabled={batch.status !== "active"} min="1" onChange={(event) => onChange(adjustBatchCheck(batch, check.id, Number(event.target.value), localDate()))} type="number" value={check.intervalDays} /> days</label>
                  <button onClick={() => saveCheckName(check.id, check.name)} type="button">Save name</button>
                  <button disabled={batch.status !== "active"} onClick={() => onChange(completeBatchCheck(batch, check.id, localDate(), createClientId()))} type="button">Complete {check.name}</button>
                  <button aria-label={`Remove ${check.name}`} onClick={() => onChange(removeBatchCheck(batch, check.id))} type="button">Remove</button>
                </div>
              );
            })}
            {addingCheck && <form className="check-form" onSubmit={saveNewCheck}>
              <label>Check name<input autoFocus onChange={(event) => setNewCheckName(event.target.value)} placeholder="e.g. Taste and smell" required value={newCheckName} /></label>
              <label>Every <input min="1" onChange={(event) => setNewCheckInterval(event.target.value)} required type="number" value={newCheckInterval} /> days</label>
              <button className="secondary-action" type="submit">Add recurring check</button>
              <button onClick={() => setAddingCheck(false)} type="button">Cancel</button>
            </form>}
          </section>
        </div>

        <div className="wb-main">
          <section className="wb-panel" aria-label={`${batch.name} pH log`}>
            <h4>pH log <span>{phReadings.length} readings</span></h4>
            <div className="ph-log">
              <p><strong>Latest:</strong> {latestPh ? `${latestPh.value} on ${latestPh.date}` : "No readings yet."}</p>
              {phReadings.map((entry) => (
                <div className="ph-reading" key={entry.id}>
                  <time dateTime={entry.date}>{entry.date}</time><span>pH {entry.value}</span>
                  {phZoneLabel(batch, entry.value) && <span className="zone">{phZoneLabel(batch, entry.value)}</span>}
                  {phWarning(entry.value) && <span className="warning">{phWarning(entry.value)}</span>}
                  <button aria-label={`Edit pH from ${entry.date}`} onClick={() => setEditingPh(entry)} type="button">Edit</button>
                  <button aria-label={`Delete pH from ${entry.date}`} onClick={() => onChange(deleteTimelineEntry(batch, entry.id, Date.now()))} type="button">Delete</button>
                </div>
              ))}
              <form className="ph-form" key={editingPh?.id ?? "new-ph"} onSubmit={savePh}>
                <label>pH date <input defaultValue={editingPh?.date ?? localDate()} name="date" required type="date" /></label>
                <label>pH value <input defaultValue={editingPh?.value} name="value" required step="0.01" type="number" /></label>
                <button className="secondary-action" type="submit">{editingPh ? "Save pH" : "Add pH"}</button>
                {editingPh && <button onClick={() => setEditingPh(null)} type="button">Cancel</button>}
              </form>
            </div>
          </section>

          <section className="wb-panel" aria-label={`${batch.name} timeline`}>
            <div className="timeline-panel-heading"><h4>Timeline <span>{batch.timeline.length} entries</span></h4><p>Every observation stays attached to this batch.</p></div>
            <section className="timeline">
              {batch.timeline.length === 0 && <p>No activity recorded yet.</p>}
              {batch.timeline.filter((entry) => entry.kind !== "ph").map((entry) => (
                <div className={`timeline-entry timeline-${entry.kind}`} key={entry.id}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <time dateTime={entry.date}>{entry.date}</time>
                  <span className="timeline-content">{timelineEntryText(entry)}{entry.kind === "photo" && <img alt={entry.caption || entry.name} src={entry.dataUrl} />}</span>
                  {(entry.kind === "note" || entry.kind === "measurement" || entry.kind === "status") && <button aria-label={`Edit ${entry.kind} from ${entry.date}`} onClick={() => setEditing(entry)} type="button">Edit</button>}
                  {entry.kind === "photo" && <button aria-label={`Edit photo from ${entry.date}`} onClick={() => setEditingPhoto(entry)} type="button">Edit</button>}
                  <button aria-label={`Delete ${entry.kind} from ${entry.date}`} onClick={() => onChange(deleteTimelineEntry(batch, entry.id, Date.now()))} type="button">Delete</button>
                </div>
              ))}
              <form className="timeline-form" id="batch-activity-form" key={editing?.id ?? "new"} onSubmit={saveEntry}>
                <label>Activity type<select defaultValue={editing?.kind ?? "note"} name="kind"><option value="note">Note</option><option value="measurement">Measurement</option><option value="status">Status change</option></select></label>
                <label>Activity date<input defaultValue={editing?.date ?? localDate()} name="date" required type="date" /></label>
                <label>Note or measurement<input defaultValue={editing && (editing.kind === "note" || editing.kind === "measurement") ? editing.text : ""} name="text" /></label>
                <label>Activity status<select defaultValue={editing?.kind === "status" ? editing.status : batch.status} name="status">{batchStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
                <div className="form-actions"><button className="primary-action" type="submit">{editing ? "Save activity" : "Add activity"}</button>{editing && <button onClick={() => setEditing(null)} type="button">Cancel</button>}</div>
              </form>
              <form className="photo-form" key={editingPhoto?.id ?? "new-photo"} onSubmit={savePhoto}>
                <label>Photo date <input defaultValue={editingPhoto?.date ?? localDate()} name="date" required type="date" /></label>
                <label>Photo <input accept="image/*" capture="environment" name="photo" required={!editingPhoto} type="file" /></label>
                <label>Caption <input defaultValue={editingPhoto?.caption} name="caption" /></label>
                <button className="secondary-action" type="submit">{editingPhoto ? "Save photo" : "Attach photo"}</button>
                {editingPhoto && <button onClick={() => setEditingPhoto(null)} type="button">Cancel</button>}
              </form>
              {batch.timelineTrash.length > 0 && <div className="timeline-trash"><strong>Recently deleted activity</strong>{batch.timelineTrash.map((entry) => <button key={entry.id} onClick={() => onChange(restoreTimelineEntry(batch, entry.id, Date.now()))} type="button">Restore {entry.kind} from {entry.date}</button>)}</div>}
            </section>
          </section>

          <div className="form-actions batch-status-actions" aria-label={`Change ${batch.name} status`}>
            {batchStatuses.filter((status) => status !== batch.status).map((status) => <button key={status} onClick={() => recordStatus(status)} type="button">{status === "active" ? "Return to active" : `Mark ${statusLabel(status).toLowerCase()}`}</button>)}
            <button onClick={() => onDelete(batch.id)} type="button">Delete batch</button>
          </div>
        </div>
      </div>
    </article>
  );
}

interface ProfilesProps {
  formulaTerms: string[];
  profiles: FermentationProfile[];
  onDelete(id: string): void;
  onSave(profile: FermentationProfile): void;
  onEditingChange(id: string | null): void;
}

interface ProfilePresentation {
  description: string;
  params: [string, string][];
  inputs: string;
  calculations: string[];
}

interface ProfileCheckRow {
  id: string;
  name: string;
  intervalDays: number;
}

function presentationFor(profile: FermentationProfile): ProfilePresentation {
  const temperature = profile.temperatureMinC === undefined || profile.temperatureMaxC === undefined
    ? "—"
    : profile.temperatureMinC === profile.temperatureMaxC
      ? `${profile.temperatureMinC}°C`
      : `${profile.temperatureMinC}–${profile.temperatureMaxC}°C`;
  const zones = profile.phZones.length > 0
    ? profile.phZones.filter(({ label }) => label === "optimal").length > 0
      ? profile.phZones.filter(({ label }) => label === "optimal")
      : profile.phZones
    : [];
  const ph = zones.length > 0
    ? `pH ${formatNumber(Math.min(...zones.map(({ min }) => min)))}–${formatNumber(Math.max(...zones.map(({ max }) => max)))}`
    : "—";
  const intervals = new Set(profile.checks.map(({ intervalDays }) => intervalDays));
  const cadence = intervals.size === 0 ? "—" : intervals.size > 1 ? `${profile.checks.length} checks` : formatCheckInterval(profile.checks[0].intervalDays);
  return {
    description: profile.guidance[0] || "No guidance defined yet.",
    params: [
      [temperature, "temperature zone"],
      [ph, "pH zone"],
      [profile.expectedDurationDays ? `${profile.expectedDurationDays} d` : "—", "duration"],
      [cadence, "check cadence"],
    ],
    inputs: profile.inputs.map(({ name }) => name).join(", ") || "None defined",
    calculations: profile.calculations
      .filter(({ formula }) => parseSimpleFormula(formula))
      .map(({ name, formula, unit }) => `${name} = ${formula} (${unit})`),
  };
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function formatCheckInterval(intervalDays: number) {
  if (intervalDays === 1) return "daily";
  if (intervalDays === 7) return "weekly";
  return `every ${intervalDays} days`;
}

function RichProfileText({ value }: { value: string }) {
  return <>{value.split(/(<b>.*?<\/b>)/g).map((part, index) => part.startsWith("<b>") ? <strong key={index}>{part.slice(3, -4)}</strong> : part)}</>;
}

interface StructuredFormulaRow {
  id: string;
  kind: "structured";
  source: string;
  sourceUnit: MetricUnit;
  sourceUnitTouched: boolean;
  operator: "+" | "-" | "*" | "/";
  operand: string;
  operandType: "number" | "percentage";
  result: string;
  resultUnit: MetricUnit;
}

interface LegacyFormulaRow {
  id: string;
  kind: "legacy";
  calculation: ProfileCalculation;
}

type FormulaRow = StructuredFormulaRow | LegacyFormulaRow;

const metricUnits: MetricUnit[] = ["g", "kg", "ml", "l"];

function formulaRows(profile: FermentationProfile): FormulaRow[] {
  return profile.calculations.map((calculation) => {
    const parsed = parseSimpleFormula(calculation.formula);
    if (!parsed) return { id: createClientId(), kind: "legacy", calculation };
    const input = profile.inputs.find(({ name }) => name === parsed.source);
    return {
      id: createClientId(),
      kind: "structured",
      source: parsed.source,
      sourceUnit: input?.unit ?? "g",
      sourceUnitTouched: false,
      operator: parsed.operator,
      operand: parsed.operand,
      operandType: parsed.percentage ? "percentage" : "number",
      result: calculation.name,
      resultUnit: calculation.unit,
    };
  });
}

function Profiles({ formulaTerms, profiles, onDelete, onSave, onEditingChange }: ProfilesProps) {
  const [editing, setEditing] = useState<FermentationProfile | null>(null);
  const [viewing, setViewing] = useState<FermentationProfile | null>(null);
  const [calculations, setCalculations] = useState<FormulaRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [checkRows, setCheckRows] = useState<ProfileCheckRow[]>([]);
  const [guidanceRows, setGuidanceRows] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const checkInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const [focusCheckId, setFocusCheckId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusCheckId) return;
    checkInputsRef.current[focusCheckId]?.focus();
    setFocusCheckId(null);
  }, [checkRows, focusCheckId]);

  function currentInputs() {
    return editing?.inputs ?? [];
  }

  function edit(profile: FermentationProfile) {
    setErrors([]);
    setMessage("");
    setViewing(null);
    setEditing(profile);
    setCalculations(formulaRows(profile));
    setGuidanceRows(profile.guidance);
    setCheckRows(profile.checks.map((check) => ({
      id: check.id ?? createClientId(), name: check.name, intervalDays: check.intervalDays,
    })));
    onEditingChange(profile.id);
  }

  function closeEditor() {
    setEditing(null);
    setErrors([]);
    setCheckRows([]);
    setGuidanceRows([]);
    setFocusCheckId(null);
    onEditingChange(null);
  }

  function updateCheck(id: string, update: Partial<ProfileCheckRow>) {
    setCheckRows(checkRows.map((check) => check.id === id ? { ...check, ...update } : check));
  }

  function addCheck() {
    const id = createClientId();
    setCheckRows([...checkRows, { id, name: "", intervalDays: 7 }]);
    setFocusCheckId(id);
  }

  function removeCheck(index: number) {
    setCheckRows(checkRows.filter((_, checkIndex) => checkIndex !== index));
  }

  function addGuidanceStep() {
    setGuidanceRows([...guidanceRows, ""]);
  }

  function updateGuidanceStep(index: number, value: string) {
    setGuidanceRows(guidanceRows.map((step, stepIndex) => stepIndex === index ? value : step));
  }

  function removeGuidanceStep(index: number) {
    setGuidanceRows(guidanceRows.filter((_, stepIndex) => stepIndex !== index));
  }

  function addFormula() {
    const terms = availableResultTerms(formulaTerms, editing, calculations);
    const source = terms.includes("totalWeight") ? "totalWeight" : terms[0];
    const matchingSource = calculations.find((row): row is StructuredFormulaRow => row.kind === "structured" && row.source === source);
    const sourceUnit = matchingSource?.sourceUnit
      ?? currentInputs().find(({ name }) => name === source)?.unit
      ?? "g";
    const usedResults = new Set(calculations.map((row) => row.kind === "structured" ? row.result : row.calculation.name));
    const preferredResults = [...new Set([
      ...["salt", "sugar", "tea"].filter((term) => terms.includes(term)),
      ...terms,
    ])];
    setCalculations([...calculations, {
      id: createClientId(),
      kind: "structured",
      source,
      sourceUnit,
      sourceUnitTouched: matchingSource?.sourceUnitTouched ?? false,
      operator: "*",
      operand: "2",
      operandType: "percentage",
      result: preferredResults.find((term) => !usedResults.has(term)) ?? preferredResults[0],
      resultUnit: "g",
    }]);
  }

  function updateFormula(id: string, update: Partial<StructuredFormulaRow>) {
    setCalculations(calculations.map((row) => row.id === id && row.kind === "structured" ? { ...row, ...update } : row));
  }

  function updateSourceUnit(source: string, sourceUnit: MetricUnit) {
    setCalculations(calculations.map((row) => row.kind === "structured" && row.source === source
      ? { ...row, sourceUnit, sourceUnitTouched: true }
      : row));
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const inputs = editing?.inputs.map((input) => ({ ...input })) ?? [];
    const structuredRows = calculations.filter((row): row is StructuredFormulaRow => row.kind === "structured");
    const resultNames = new Set(calculations.map((row) => row.kind === "structured" ? row.result : row.calculation.name));
    for (const source of new Set(structuredRows.map((row) => row.source))) {
      const matchingRows = structuredRows.filter((row) => row.source === source);
      const index = inputs.findIndex(({ name }) => name === source);
      if (index === -1 && !resultNames.has(source)) inputs.push({ name: source, unit: matchingRows[0].sourceUnit });
      else if (index !== -1) {
        const touched = matchingRows.find(({ sourceUnitTouched }) => sourceUnitTouched);
        if (touched) inputs[index] = { ...inputs[index], unit: touched.sourceUnit };
      }
    }
    const profile = {
      id: editing?.id ?? createClientId(),
      name: String(data.get("name") ?? "").trim(),
      guidance: guidanceRows.map((step) => step.trim()).filter(Boolean),
      temperatureMinC: String(data.get("temperatureMinC") ?? "").trim() === ""
        ? undefined
        : Number(data.get("temperatureMinC")),
      temperatureMaxC: String(data.get("temperatureMaxC") ?? "").trim() === ""
        ? undefined
        : Number(data.get("temperatureMaxC")),
      phZones: parsePhRange(data.get("phMin"), data.get("phMax")),
      expectedDurationDays: data.get("expectedDurationDays")
        ? Number(data.get("expectedDurationDays"))
        : undefined,
      inputs,
      calculations: calculations.map((row) => row.kind === "legacy" ? row.calculation : {
        name: row.result,
        unit: row.resultUnit,
        formula: `${row.source} ${row.operator} ${row.operand}${row.operandType === "percentage" ? "%" : ""}`,
      }),
      checks: checkRows,
    };

    const nextErrors = validateProfile(profile);
    if (!profile.name || nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave(profile);
    setMessage(`${profile.name} profile saved.`);
    closeEditor();
  }

  return (
    <section className="profiles" aria-label="Fermentation profiles">
      <div className="profile-tools">
        <button className="profile-add" onClick={() => {
          edit({ id: createClientId(), name: "", guidance: [], inputs: [], calculations: [], checks: [], phZones: [] });
        }} type="button">
          Add profile
        </button>
      </div>

      {editing && (() => {
        const presentation = presentationFor(editing);
        const duration = editing.expectedDurationDays ? `${editing.expectedDurationDays} days` : "—";
        const phRange = phRangeFor(editing);
        return (
          <div className="profile-editor-page">
            <header className="profile-mobile-bar">
              <span className="brand-mark" aria-hidden="true">F</span>
              <strong>FermentStation</strong>
              <button aria-label="Open menu" className="icon-button" type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
            </header>
            <nav className="profile-editor-crumbs" aria-label="Breadcrumb"><button onClick={closeEditor} type="button">Profiles</button></nav>
            <header className="profile-editor-head">
              <div><p className="profile-editor-eyebrow">Fermentation profile</p><h1><input aria-label="Name" autoFocus className="profile-editor-title-input" defaultValue={editing.name} form="profile-editor-form" name="name" placeholder="Profile name" required /></h1></div>
              <span className="profile-editor-status"><i />Editable profile</span>
            </header>

            <div className="profile-editor-grid">
              <form className="profile-editor-form" id="profile-editor-form" key={editing.id} onSubmit={save}>
                <section className="profile-editor-section">
                  <div className="profile-editor-fields">
                    <div className="profile-editor-guidance">
                      <div className="profile-editor-guidance-head"><span>Guidance (optional)</span><button className="profile-editor-text-button" onClick={addGuidanceStep} type="button">Add step</button></div>
                      {guidanceRows.length === 0 && <p className="profile-editor-check-empty">No guidance steps yet. Add one when this profile needs a sequence to follow.</p>}
                      <div className="profile-editor-guidance-rows">
                        {guidanceRows.map((step, index) => <label className="profile-editor-guidance-row" key={index}><span>Guidance step {index + 1}</span><textarea aria-label={`Guidance step ${index + 1}`} onChange={(event) => updateGuidanceStep(index, event.target.value)} value={step} /><button className="profile-editor-text-button" onClick={() => removeGuidanceStep(index)} type="button">Remove step</button></label>)}
                      </div>
                    </div>
                     <label className="profile-editor-field"><span>Temperature minimum</span><span className="profile-editor-suffix"><input aria-label="Temperature minimum" defaultValue={editing.temperatureMinC ?? ""} min="0" max="100" name="temperatureMinC" step="any" type="number" /><i>°C</i></span></label>
                      <label className="profile-editor-field"><span>Temperature maximum</span><span className="profile-editor-suffix"><input aria-label="Temperature maximum" defaultValue={editing.temperatureMaxC ?? ""} min="0" max="100" name="temperatureMaxC" step="any" type="number" /><i>°C</i></span></label>
                      <label className="profile-editor-field"><span>pH minimum</span><span className="profile-editor-suffix"><input aria-label="pH minimum" defaultValue={phRange.min} min="0" max="14" name="phMin" step="any" type="number" /><i>pH</i></span></label>
                      <label className="profile-editor-field"><span>pH maximum</span><span className="profile-editor-suffix"><input aria-label="pH maximum" defaultValue={phRange.max} min="0" max="14" name="phMax" step="any" type="number" /><i>pH</i></span></label>
                      <label className="profile-editor-field"><span>Expected duration</span><span className="profile-editor-suffix"><input defaultValue={editing.expectedDurationDays ?? ""} min="1" name="expectedDurationDays" type="number" /><i>days</i></span></label>
                   </div>
                </section>

                <section className="profile-editor-section">
                  <div className="profile-editor-section-head"><div><p className="profile-editor-kicker">02 / Recurring checks</p><h2>What should be noticed?</h2><p className="profile-editor-intro">A small number of checks is easier to sustain. These appear in the daily queue when due.</p></div><button className="profile-editor-text-button" onClick={addCheck} type="button">Add check</button></div>
                  <div className="profile-editor-checks">
                    {checkRows.length === 0 && <p className="profile-editor-check-empty">No recurring checks yet. Add one when this profile needs a repeating rhythm.</p>}
                    {checkRows.map((check, index) => (
                      <div className="profile-editor-check-row" key={check.id}>
                        <label><span>Check</span><input aria-label={`Check name ${index + 1}`} onChange={(event) => updateCheck(check.id, { name: event.target.value })} placeholder="e.g. Taste and smell" ref={(input) => { checkInputsRef.current[check.id] = input; }} value={check.name} /></label>
                        <label><span>Every</span><input aria-label={`Check interval ${index + 1}`} min="1" onChange={(event) => updateCheck(check.id, { intervalDays: Number(event.target.value) })} type="number" value={check.intervalDays || ""} /></label>
                        <span className="profile-editor-check-unit">days</span>
                        <button aria-label={`Remove ${check.name || "check"}`} className="profile-editor-icon-button" onClick={() => removeCheck(index)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg></button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="profile-editor-section">
                  <div className="profile-editor-section-head"><div><p className="profile-editor-kicker">03 / Calculations</p><h2>Formulas</h2></div></div>
                  <fieldset className="profile-editor-formula"><legend className="sr-only">Formulas</legend>
                    {calculations.map((row, index) => row.kind === "legacy" ? (
                      <div className="legacy-formula" key={row.id}><p><strong>Legacy calculation {index + 1}: {row.calculation.name}</strong></p><p>This formula uses multiple operations or parentheses. It cannot be edited here, but will be kept when you save.</p><button onClick={() => setCalculations(calculations.filter(({ id }) => id !== row.id))} type="button">Remove calculation {index + 1}</button></div>
                    ) : (
                      <div className="profile-editor-formula-row" key={row.id}>
                        <label>Source term row {index + 1}<select onChange={(event) => { const source = event.target.value; const matchingSource = calculations.find((candidate): candidate is StructuredFormulaRow => candidate.kind === "structured" && candidate.source === source); updateFormula(row.id, { source, sourceUnit: matchingSource?.sourceUnit ?? currentInputs().find(({ name }) => name === source)?.unit ?? row.sourceUnit, sourceUnitTouched: matchingSource?.sourceUnitTouched ?? false }); }} value={row.source}>{availableSourceTerms(formulaTerms, calculations, currentInputs()).map((term) => <option key={term} value={term}>{formulaTermLabel(term)}</option>)}</select></label>
                        <label>Source unit row {index + 1}<select onChange={(event) => updateSourceUnit(row.source, event.target.value as MetricUnit)} value={row.sourceUnit}>{metricUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                        <label>Operator row {index + 1}<select onChange={(event) => updateFormula(row.id, { operator: event.target.value as StructuredFormulaRow["operator"] })} value={row.operator}><option value="+">+</option><option value="-">-</option><option value="*">×</option><option value="/">/</option></select></label>
                        <label>Operand row {index + 1}<input min="0" onChange={(event) => updateFormula(row.id, { operand: event.target.value })} required step="any" type="number" value={row.operand} /></label>
                        <label>Operand type row {index + 1}<select onChange={(event) => updateFormula(row.id, { operandType: event.target.value as StructuredFormulaRow["operandType"] })} value={row.operandType}><option value="number">Number</option><option value="percentage">Percentage</option></select></label>
                        <label>Result term row {index + 1}<select onChange={(event) => updateFormula(row.id, { result: event.target.value })} value={row.result}>{availableResultTerms(formulaTerms, editing, calculations).map((term) => <option key={term} value={term}>{formulaTermLabel(term)}</option>)}</select></label>
                        <label>Result unit row {index + 1}<select onChange={(event) => updateFormula(row.id, { resultUnit: event.target.value as MetricUnit })} value={row.resultUnit}>{metricUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                        <button onClick={() => setCalculations(calculations.filter(({ id }) => id !== row.id))} type="button">Remove calculation {index + 1}</button>
                      </div>
                    ))}
                    <button className="profile-editor-add-formula" onClick={addFormula} type="button">Add formula</button>
                  </fieldset>
                </section>

                {errors.length > 0 && <div className="notice" role="alert">{errors.join(" ")}</div>}
                <div className="profile-editor-actions"><button aria-label="Cancel" className="profile-editor-text-button" onClick={closeEditor} type="button">Cancel changes</button><div><button className="profile-editor-button" onClick={() => setMessage("Preview reflects the current profile settings.")} type="button">Preview</button><button className="profile-editor-button primary" type="submit">Save profile <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button></div></div>
              </form>

               <aside className="profile-editor-aside" aria-label="Profile context">
                 <article className="profile-editor-card"><p className="profile-editor-eyebrow">At a glance</p><h3>{editing.name || "Profile name"}</h3><p>{presentation.description}</p><div className="profile-editor-meta"><div><span>Temperature</span><strong>{presentation.params[0][0]}</strong></div><div><span>Expected duration</span><strong>{duration}</strong></div><div><span>Check cadence</span><strong>{presentation.params[3][0]}</strong></div></div></article>
               </aside>
            </div>
          </div>
        );
      })()}

      {!editing && <div className="profile-list">
        {profiles.map((profile) => {
          const presentation = presentationFor(profile);
          return (
            <article className="profile-card" key={profile.id}>
              <button aria-label={`View ${profile.name} guidance`} className="profile-card-main" onClick={() => setViewing(profile)} type="button">
                <span className="pc-id">Fermentation profile</span>
                <h3>{profile.name}</h3>
                <p className="pc-desc">{presentation.description}</p>
                <div className="pc-params">
                  {presentation.params.map(([value, label]) => <span className="pc-param" key={`${value}-${label}`}><b>{value}</b><span>{label}</span></span>)}
                 </div>
                 <div className="pc-rows">
                   <p><b>Profile inputs</b> {presentation.inputs}</p>
                   <div><p><b>Profile calculations</b></p>{presentation.calculations.length > 0 ? presentation.calculations.map((calculation) => <p key={calculation}>{calculation}</p>) : <p>None defined</p>}</div>
                 </div>
                 <div className="pc-foot"><span className="eyebrow">View guidance →</span></div>
              </button>
              <div className="profile-card-actions">
                <button aria-label={`Edit ${profile.name}`} onClick={() => edit(profile)} type="button">Edit</button>
                <button aria-label={`Delete ${profile.name}`} onClick={() => {
                  setEditing((current) => current?.id === profile.id ? null : current);
                  setViewing((current) => current?.id === profile.id ? null : current);
                  onDelete(profile.id);
                }} type="button">Delete</button>
              </div>
            </article>
          );
        })}
      </div>}

      {message && <div className="profile-editor-toast" role="status">{message}</div>}

      {viewing && (() => {
        const presentation = presentationFor(viewing);
        return (
          <div className="profile-overlay" onClick={(event) => { if (event.target === event.currentTarget) setViewing(null); }}>
             <div aria-labelledby="profile-sheet-title" aria-modal="true" className="profile-sheet" role="dialog">
               <h2 id="profile-sheet-title">{viewing.name}</h2>
               <p className="sheet-sub">Fermentation profile</p>
              <div className="pc-params profile-sheet-params">
                {presentation.params.map(([value, label]) => <span className="pc-param" key={`${value}-${label}`}><b>{value}</b><span>{label}</span></span>)}
              </div>
               <section className="profile-detail-panel">
                 <h3>Profile guidance</h3>
                 {viewing.guidance.map((guidance, index) => <div className="guide-step" key={`${guidance}-${index}`}><span className="g-n">{index + 1}</span><p><RichProfileText value={guidance} /></p></div>)}
                 {viewing.guidance.length === 0 && <p className="muted-copy">No guidance steps yet.</p>}
               </section>
               <section className="profile-detail-panel">
                 <h3>Profile calculations</h3>
                 {presentation.calculations.length > 0 ? presentation.calculations.map((calculation) => <p className="calc-line" key={calculation}><RichProfileText value={calculation} /></p>) : <p className="calc-line">None defined</p>}
               </section>
               <div className="profile-sheet-actions"><button className="primary-action" onClick={() => setViewing(null)} type="button">Done</button></div>
            </div>
          </div>
        );
      })()}

    </section>
  );
}

function availableResultTerms(formulaTerms: string[], editing: FermentationProfile | null, rows: FormulaRow[]) {
  return [...new Set([
    ...formulaTerms,
    ...(editing?.inputs.map(({ name }) => name) ?? []),
    ...(editing?.calculations.map(({ name }) => name) ?? []),
    ...rows.flatMap((row) => row.kind === "structured" ? [row.source, row.result] : [row.calculation.name]),
  ])];
}

function availableSourceTerms(formulaTerms: string[], rows: FormulaRow[], inputs: FermentationProfile["inputs"]) {
  const explicitInputs = new Set(inputs.map(({ name }) => name));
  const selectedSources = new Set(rows.flatMap((row) => row.kind === "structured" ? [row.source] : []));
  const results = new Set(rows.map((row) => row.kind === "structured" ? row.result : row.calculation.name));
  return [...new Set([
    ...formulaTerms.filter((term) => !results.has(term) || explicitInputs.has(term) || selectedSources.has(term)),
    ...explicitInputs,
    ...selectedSources,
  ])];
}

function formulaTermLabel(term: string) {
  const words = term.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return words ? words[0].toUpperCase() + words.slice(1) : term;
}

function phRangeFor(profile: FermentationProfile): { min: number | ""; max: number | "" } {
  const zones = profile.phZones.filter(({ label }) => label === "optimal");
  const selected = zones.length > 0 ? zones : profile.phZones;
  return selected.length > 0
    ? { min: Math.min(...selected.map(({ min }) => min)), max: Math.max(...selected.map(({ max }) => max)) }
    : { min: "", max: "" };
}

function parsePhRange(minValue: FormDataEntryValue | null, maxValue: FormDataEntryValue | null): FermentationProfile["phZones"] {
  const minText = String(minValue ?? "").trim();
  const maxText = String(maxValue ?? "").trim();
  if (!minText || !maxText) return [];
  const min = Number(minText);
  const max = Number(maxText);
  return Number.isFinite(min) && Number.isFinite(max)
    ? [{ label: "optimal", min, max }]
    : [];
}

function timelineEntryText(entry: TimelineEntry): string {
  if (entry.kind === "status") return `Status: ${statusLabel(entry.status)}`;
  if (entry.kind === "check") return `Completed check: ${entry.checkName}`;
  if (entry.kind === "ph") return `pH ${entry.value}`;
  if (entry.kind === "photo") return entry.caption || entry.name;
  return entry.text;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}
