import { useRef, useState } from "react";
import {
  addTimelineEntry,
  addPhReading,
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
  type TrashedBatch,
  updateBatchForDate,
  updatePhReading,
} from "./domain/batches";
import {
  addProfile,
  createProfileState,
  deleteProfile,
  discardExpiredProfiles,
  parseSimpleFormula,
  restoreProfile,
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

function NavIcon({ destination }: { destination: Destination }) {
  if (destination === "today") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="4" /><path d="M12 9V5M10 5h4M12 2l1.5 3h-3zM2 13h3M19 13h3M5 5l2 2M19 5l-2 2" /></svg>;
  if (destination === "batches") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3h8M9 3v3l-3 9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3l-3-9V3M7 14h10" /></svg>;
  if (destination === "calendar") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 17.5h2" /></svg>;
  if (destination === "profiles") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3.5c2 1 3.5 3 3.5 5.5 0 1-.3 2-.8 2.8l7.3 7.3v1.4H14l-2-2h-2.5M4 5.5c1.8 1.6 3 3.8 3 6.2v1.8H4.5a2.5 2.5 0 0 1 0-5H5M5 19.5l-1-1.5" /></svg>;
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7 7 0 0 0-1.7-1L14.4 3h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.5-1-2 3.4L6 11a7 7 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.5 1 2-3.4-2.1-1.6a7 7 0 0 0 .1-1z" /></svg>;
}

function StatusIcon({ status }: { status: BatchStatus | "attention" | "archived" }) {
  if (status === "ready") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5l5 5 10-11" /></svg>;
  if (status === "to-fridge") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 9h.5M8 15.5h.5" /></svg>;
  if (status === "archived") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M6 7l1.5 13h9L18 7M9 11v5M15 11v5M9 3h6l1 4H8z" /></svg>;
  if (status === "attention") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12M12 15.8v.2" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>;
}

export function App() {
  const [shell, setShell] = useState(
    () => browserShellStore.load() ?? createShellState(),
  );
  const [profileState, setProfileState] = useState(() =>
    discardExpiredProfiles(browserProfileStore.load() ?? createProfileState(), Date.now()),
  );
  const [batchState, setBatchState] = useState(() =>
    updateBatchDates(
      discardExpiredBatches(browserBatchStore.load() ?? createBatchState(), Date.now()),
    ),
  );
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  function saveProfiles(next: typeof profileState) {
    const current = discardExpiredProfiles(next, Date.now());
    browserProfileStore.save(current);
    setProfileState(current);
  }

  function navigate(destination: Destination) {
    const next = selectDestination(shell, destination);
    browserShellStore.save(next);
    setShell(next);
    setOpenBatchId(null);
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3h4M12 3v6M6.5 9h11a.5.5 0 0 1 .5.5v1a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-1a.5.5 0 0 1 .5-.5zM7.5 13.5c0 2.5.9 4.2 2.5 5.2v1.8h4v-1.8c1.6-1 2.5-2.7 2.5-5.2M10 20.5h4" /></svg></span>
          <div><strong>FermentStation</strong><span>Household · v1 concept</span></div>
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
                onRestore={(id) => saveBatches(restoreBatch(batchState, id, Date.now()))}
                profiles={profileState.profiles}
                trash={batchState.trash}
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
              onRestore={(id) => saveBatches(restoreBatch(batchState, id, Date.now()))}
              profiles={profileState.profiles}
              trash={batchState.trash}
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
              <div className="screen-head">
                <div>
                  <p className="eyebrow">Recipes that remember</p>
                  <h1>Profiles</h1>
                  <p className="screen-intro">A fermentation profile carries the inputs, guidance, and calculations a batch follows until it's ready.</p>
                </div>
              </div>
              <Profiles
                formulaTerms={shell.formulaTerms}
                profiles={profileState.profiles}
                trash={profileState.trash}
                onDelete={(id) => saveProfiles(deleteProfile(profileState, id, Date.now()))}
                onRestore={(id) => saveProfiles(restoreProfile(profileState, id, Date.now()))}
                onSave={handleProfile}
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
}

function SettingsView({ batchState, formulaTerms, preferences, profileState, onFormulaTermsChange, onPreferencesChange, onImport }: SettingsViewProps) {
  const [message, setMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<ArchiveImport | null>(null);
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
    </div>
  );
}

interface BatchViewProps {
  batches: Batch[];
  mode: "today" | "batches";
  profiles: FermentationProfile[];
  trash: TrashedBatch[];
  onChange(batch: Batch): void;
  onCreate(batch: Batch): void;
  onDelete(id: string): void;
  onNavigate(destination: Destination): void;
  onOpen(id: string | null): void;
  onRestore(id: string): void;
  openBatchId: string | null;
}

type BatchListFilter = BatchFilter | "attention" | "archived";

function BatchView({ batches, mode, profiles, trash, onChange, onCreate, onDelete, onNavigate, onOpen, onRestore, openBatchId }: BatchViewProps) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<BatchListFilter>("all");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectedProfile = profiles.find(({ id }) => id === profileId) ?? profiles[0];
  const visible = mode === "today" ? prioritizeToday(batches, localDate()) : filter === "attention"
    ? batches.filter((batch) => batch.status === "active" && dueBatchChecks(batch, localDate()).length > 0)
    : filter === "archived" ? trash : filterBatches(batches, filter);
  const openBatch = visible.find(({ id }) => id === openBatchId);
  const dueChecks = visible.flatMap((batch) => dueBatchChecks(batch, localDate()).map((check) => ({ batch, check })));
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
      id: crypto.randomUUID(),
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
          <button autoFocus className="back-link" onClick={closeBatch} type="button">← Back to {mode}</button>
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
                <div><small>{check.overdue ? `Overdue · was due ${check.nextDueDate}` : "Due today"}</small><h4>{check.name} for <span className="queue-batch">{batch.name}</span></h4><p>{batch.profileSnapshot.guidance || "Open the batch and record what you find."}</p></div>
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
          {(["all", "attention", ...batchStatuses, "archived"] as BatchListFilter[]).map((status) => (
            <button aria-pressed={filter === status} key={status} onClick={() => setFilter(status)} type="button">
              {status === "all" ? "All" : status === "attention" ? "Active · attention" : status === "archived" ? "Archived" : statusLabel(status)}
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
            {visible.map((batch) => <CompactBatchCard archived={filter === "archived"} batch={batch} key={batch.id} mode={mode} onOpen={onOpen} />)}
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
      {trash.length > 0 && (
        <section className="trash" aria-label="Deleted batches">
          <h3>Recently deleted batches</h3>
          <p>Batches remain recoverable for seven days.</p>
          {trash.map((batch) => (
            <div className="trash-item" key={batch.id}>
              <span>{batch.name}</span>
              <button aria-label={`Restore ${batch.name}`} onClick={() => onRestore(batch.id)} type="button">Restore</button>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

function CompactBatchCard({ archived, batch, mode, onOpen }: { archived?: boolean; batch: Batch; mode: "today" | "batches"; onOpen(id: string): void }) {
  const nextCheck = batch.status === "active" ? [...batch.checks].sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate))[0] : undefined;
  const latestPh = latestPhReading(batch);
  const day = Math.max(1, Math.floor((Date.parse(`${localDate()}T00:00:00Z`) - Date.parse(`${batch.startDate}T00:00:00Z`)) / 86_400_000) + 1);
  const next = archived ? "" : nextCheck ? `${nextCheck.name} · ${nextCheck.nextDueDate}` : batch.finishDate ? `Finish · ${batch.finishDate}` : "Review timeline";
  const isAttention = batch.status === "active" && dueBatchChecks(batch, localDate()).length > 0;
  const statusText = archived ? "Archived" : isAttention ? "Active · attention" : statusLabel(batch.status);
  return (
    <button aria-label={`Open ${batch.name}`} className={mode === "batches" ? "batch-card" : "batch-summary"} onClick={() => onOpen(batch.id)} type="button">
      <div className={mode === "batches" ? "bc-top" : "summary-heading"}><small className={mode === "batches" ? "bc-id" : undefined}>{batch.id.slice(0, 8)}</small><span className={`status status-${archived ? "archived" : isAttention ? "attention" : batch.status}`}><StatusIcon status={archived ? "archived" : isAttention ? "attention" : batch.status} />{statusText}</span></div>
      <h3>{batch.name}</h3>
      <p className={mode === "batches" ? "bc-name" : undefined}>{batch.profileSnapshot.name}</p>
      <div className={mode === "batches" ? "bc-metrics" : "summary-metrics"}><span>Day {day}</span>{latestPh && <span>pH {latestPh.value}</span>}</div>
      {!archived && <p className={mode === "batches" ? "bc-next" : "summary-next"}><strong>Next:</strong> {next}</p>}
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

  function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("kind")) as "note" | "measurement" | "status";
    const common = {
      id: editing?.id ?? crypto.randomUUID(),
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
      id: crypto.randomUUID(), date: localDate(), kind: "status", status,
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
      id: editingPh?.id ?? crypto.randomUUID(),
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
      id: editingPhoto?.id ?? crypto.randomUUID(),
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

  const latestPh = latestPhReading(batch);
  const phReadings = batch.timeline.filter((entry) => entry.kind === "ph");

  return (
    <article className="batch-card">
      <div className="batch-heading">
        <div>
          <span className={`status status-${batch.status}`}>{statusLabel(batch.status)}</span>
          <h3>{batch.name}</h3>
        </div>
        <time dateTime={batch.startDate}>Started {batch.startDate}</time>
      </div>
      <p><strong>Profile snapshot:</strong> {batch.profileSnapshot.name}</p>
      {batch.profileSnapshot.guidance && <p>{batch.profileSnapshot.guidance}</p>}
      {batch.finishDate && (
        <label className="finish-date">
          Finish date
          <input onChange={(event) => onChange(setFinishDate(batch, event.target.value, localDate()))} type="date" value={batch.finishDate} />
        </label>
      )}
      {batch.profileSnapshot.inputs.length > 0 && (
        <form className="batch-values" onSubmit={saveInputs}>
          {batch.profileSnapshot.inputs.map((input) => (
            <label key={input.name}>
              {input.name} ({input.unit})
              <input defaultValue={batch.inputValues[input.name]} min="0" name={input.name} step="any" type="number" />
            </label>
          ))}
          <button type="submit">Update inputs</button>
        </form>
      )}
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
            <button type="submit">Override</button>
          </form>
        );
      })}
      {batch.checks.length > 0 && (
        <section className="checks" aria-label={`${batch.name} checks`}>
          <h4>Checks</h4>
          {batch.checks.map((check) => {
            const due = dueBatchChecks(batch, localDate()).find(({ id }) => id === check.id);
            return (
              <div className="check" key={check.id}>
                <span><strong>{check.name}</strong> <span>{batch.status === "active" ? `${due?.overdue ? "Overdue" : due ? "Due" : "Next"} ${check.nextDueDate}` : "Paused"}</span></span>
                <label>Every <input aria-label={`${check.name} interval days`} min="1" onChange={(event) => onChange(adjustBatchCheck(batch, check.id, Number(event.target.value)))} type="number" value={check.intervalDays} /> days</label>
                <button disabled={batch.status !== "active"} onClick={() => onChange(completeBatchCheck(batch, check.id, localDate(), crypto.randomUUID()))} type="button">Complete {check.name}</button>
              </div>
            );
          })}
        </section>
      )}
      <section className="ph-log" aria-label={`${batch.name} pH log`}>
        <h4>pH log</h4>
        <p><strong>Latest:</strong> {latestPh ? `${latestPh.value} on ${latestPh.date}` : "No readings yet."}</p>
        {phReadings.map((entry) => (
          <div className="ph-reading" key={entry.id}>
            <time dateTime={entry.date}>{entry.date}</time>
            <span>pH {entry.value}</span>
            {phZoneLabel(batch, entry.value) && <span className="zone">{phZoneLabel(batch, entry.value)}</span>}
            {phWarning(entry.value) && <span className="warning">{phWarning(entry.value)}</span>}
            <button aria-label={`Edit pH from ${entry.date}`} onClick={() => setEditingPh(entry)} type="button">Edit</button>
            <button aria-label={`Delete pH from ${entry.date}`} onClick={() => onChange(deleteTimelineEntry(batch, entry.id, Date.now()))} type="button">Delete</button>
          </div>
        ))}
        <form className="ph-form" key={editingPh?.id ?? "new-ph"} onSubmit={savePh}>
          <label>pH date <input defaultValue={editingPh?.date ?? localDate()} name="date" required type="date" /></label>
          <label>pH value <input defaultValue={editingPh?.value} name="value" required step="0.01" type="number" /></label>
          <button type="submit">{editingPh ? "Save pH" : "Add pH"}</button>
          {editingPh && <button onClick={() => setEditingPh(null)} type="button">Cancel</button>}
        </form>
      </section>
      <div className="form-actions" aria-label={`Change ${batch.name} status`}>
        {batchStatuses.filter((status) => status !== batch.status).map((status) => (
          <button key={status} onClick={() => recordStatus(status)} type="button">
            {status === "active" ? "Return to active" : `Mark ${statusLabel(status).toLowerCase()}`}
          </button>
        ))}
        <button onClick={() => onDelete(batch.id)} type="button">Delete batch</button>
      </div>

      <section className="timeline" aria-label={`${batch.name} timeline`}>
        <h4>Timeline</h4>
        {batch.timeline.length === 0 && <p>No activity recorded yet.</p>}
        {batch.timeline.filter((entry) => entry.kind !== "ph").map((entry) => (
          <div className="timeline-entry" key={entry.id}>
            <time dateTime={entry.date}>{entry.date}</time>
            <span className="timeline-content">
              {timelineEntryText(entry)}
              {entry.kind === "photo" && <img alt={entry.caption || entry.name} src={entry.dataUrl} />}
            </span>
            {(entry.kind === "note" || entry.kind === "measurement" || entry.kind === "status") && <button aria-label={`Edit ${entry.kind} from ${entry.date}`} onClick={() => setEditing(entry)} type="button">Edit</button>}
            {entry.kind === "photo" && <button aria-label={`Edit photo from ${entry.date}`} onClick={() => setEditingPhoto(entry)} type="button">Edit</button>}
            <button aria-label={`Delete ${entry.kind} from ${entry.date}`} onClick={() => onChange(deleteTimelineEntry(batch, entry.id, Date.now()))} type="button">Delete</button>
          </div>
        ))}
        <form className="timeline-form" key={editing?.id ?? "new"} onSubmit={saveEntry}>
          <label>
            Activity type
            <select defaultValue={editing?.kind ?? "note"} name="kind">
              <option value="note">Note</option>
              <option value="measurement">Measurement</option>
              <option value="status">Status change</option>
            </select>
          </label>
          <label>
            Activity date
            <input defaultValue={editing?.date ?? localDate()} name="date" required type="date" />
          </label>
          <label>
            Note or measurement
            <input defaultValue={editing && (editing.kind === "note" || editing.kind === "measurement") ? editing.text : ""} name="text" />
          </label>
          <label>
            Activity status
            <select defaultValue={editing?.kind === "status" ? editing.status : batch.status} name="status">
              {batchStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </label>
          <div className="form-actions">
            <button className="primary-action" type="submit">{editing ? "Save activity" : "Add activity"}</button>
            {editing && <button onClick={() => setEditing(null)} type="button">Cancel</button>}
          </div>
        </form>
        <form className="photo-form" key={editingPhoto?.id ?? "new-photo"} onSubmit={savePhoto}>
          <label>Photo date <input defaultValue={editingPhoto?.date ?? localDate()} name="date" required type="date" /></label>
          <label>Photo <input accept="image/*" capture="environment" name="photo" required={!editingPhoto} type="file" /></label>
          <label>Caption <input defaultValue={editingPhoto?.caption} name="caption" /></label>
          <button type="submit">{editingPhoto ? "Save photo" : "Attach photo"}</button>
          {editingPhoto && <button onClick={() => setEditingPhoto(null)} type="button">Cancel</button>}
        </form>
        {batch.timelineTrash.length > 0 && (
          <div className="timeline-trash">
            <strong>Recently deleted activity</strong>
            {batch.timelineTrash.map((entry) => (
              <button key={entry.id} onClick={() => onChange(restoreTimelineEntry(batch, entry.id, Date.now()))} type="button">
                Restore {entry.kind} from {entry.date}
              </button>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

interface ProfilesProps {
  formulaTerms: string[];
  profiles: FermentationProfile[];
  trash: { id: string; name: string; deletedAt: number }[];
  onDelete(id: string): void;
  onRestore(id: string): void;
  onSave(profile: FermentationProfile): void;
}

interface ProfilePresentation {
  tag: string;
  description: string;
  params: [string, string][];
  inputs: string;
  guidance: string[];
  calculation: string;
  batches: string;
}

const profilePresentations: Record<string, ProfilePresentation> = {
  "Kombucha F1": {
    tag: "Sweet tea · SCOBY · 7–12 days",
    description: "Continuous sweet-tea ferment. The pellicle (SCOBY) converts sugar to acetic acid; you bottle when the tea turns dry and tart.",
    params: [["18–28°C", "temperature zone"], ["pH 2.5–3.5", "zone"], ["7–12 d", "duration"], ["every 2 d", "check cadence"], ["3–4 L", "typical vessel"], ["0.9–1.2", "target gravity"]],
    inputs: "pH, temperature, days elapsed, taste, pellicle condition",
    guidance: [
      "Add 100 g sugar per L of sweet tea; cool below 30°C before pouring over the SCOBY.",
      "Keep the vessel covered with cotton; ferment in a warm, still spot away from direct sun.",
      "Run a <b>profile check</b> every 2 days: read pH, temperature, and taste.",
      "Bottle when pH lands below <b>3.5</b> or the tea turns pleasantly dry — the <b>suggested value</b> is pH 3.2–3.4.",
    ],
    calculation: "pH drop ≈ <b>(last pH − this pH)</b> ÷ days between reads. When the last two reads both sit inside the zone and drift has flattened to ≤ 0.1/day, the batch is ready.",
    batches: "KB-004 · KB-003 · KB-002",
  },
  Sauerkraut: {
    tag: "2% salt brine · 3–6 weeks",
    description: "Cabbage weighted under its own brine. Salt pulls water out and selects for lactobacillus; no vinegar, no starter.",
    params: [["16–22°C", "temperature zone"], ["pH 3.4–3.8", "zone"], ["21–42 d", "duration"], ["weekly", "check cadence"], ["2–3%", "salt weight"], ["2 L", "typical crock"]],
    inputs: "pH, temperature, days elapsed, brine level, aroma",
    guidance: [
      "Mass cabbage at 2% salt; knead until the brine pools at the base of the bowl.",
      "Pack into the crock and weight it so brine fully covers the cabbage — exposed leaves rot.",
      "Run a <b>profile check</b> weekly: read pH, confirm the brine line, and sniff for clean sour.",
      "Ready when pH sits between <b>3.4 and 3.8</b> — suggested value pH 3.6 — and the aroma is bright, not funky.",
    ],
    calculation: "Ferment speed = pH drop per 7 days. Two consecutive weekly reads inside the zone at ≤ 0.2/week drift means the batch is ready to move to the fridge.",
    batches: "SK-012 · SK-009",
  },
  Kimchi: {
    tag: "Fast ferment · 1–3 days out, then fridge",
    description: "Napa cabbage and radish paste, briefly fermented warm, then parked in the fridge to ripen slowly for weeks.",
    params: [["18–22°C", "temperature zone"], ["pH ≤ 4.2", "zone"], ["1–3 d", "out-of-fridge"], ["daily", "check cadence"], ["5–8 cm", "jar headspace"], ["3 L", "typical jar"]],
    inputs: "pH, temperature, days elapsed, gas, aroma",
    guidance: [
      "Salt the cabbage 90 minutes, rinse, then rub with the gochujang paste.",
      "Pack firmly so juice rises; leave headspace for CO₂ build-up.",
      "A <b>profile check</b> daily while out: pH falls fast — first day is the loudest.",
      "Shift <b>to fridge</b> once pH reaches <b>4.2</b>, before it turns mushy.",
    ],
    calculation: "Brine rise time ≈ (target pH 4.2 − current pH) ÷ daily drop. Below 4.2 it is technically ready; after that, fridge time is flavour, not safety.",
    batches: "KK-211",
  },
  "Milk kefir": {
    tag: "24-hour culture · room temperature",
    description: "A daily rhythm: culture the milk, strain the grains, start the next jar. Stops being active the moment it hits the fridge.",
    params: [["21–24°C", "temperature zone"], ["pH ~4.2", "zone"], ["24 h", "duration"], ["daily", "check cadence"], ["1:10", "grain:milk"], ["1 L", "typical jar"]],
    inputs: "pH, temperature, hours elapsed, grain size",
    guidance: [
      "Add grains at about 1:10 of milk by volume.",
      "Strain after <b>24 hours</b> — longer turns it tart and thin.",
      "A <b>profile check</b> reads pH only; the grains set the rhythm.",
      "Below pH <b>4.2</b> it is ready — keep the grains to start tomorrow's batch.",
    ],
    calculation: "The strain window is time-based: expected pH ≈ f(hours at 21–24°C). Suggested value pH 4.2 at 24 h; colder room ⇒ fewer hours.",
    batches: "None yet — first batch pending",
  },
  "Sourdough starter": {
    tag: "Feed 1:1:1 · 23–28°C · 4–8 h to peak",
    description: "A living culture you feed on a schedule. The starter stays active as long as it is fed; sleeps in the fridge between bakes.",
    params: [["23–28°C", "temperature zone"], ["peak 4–8 h", "rise time"], ["1:1:1", "feed ratio"], ["daily", "check cadence"], ["25 g", "base flour"], ["500 ml", "jar"]],
    inputs: "Rise time, hours to peak, temperature, aroma",
    guidance: [
      "Feed 1:1:1 by weight: 25 g starter, 25 g flour, 25 g water — same time each day.",
      "Discard most of it before feeding, or the jar overflows.",
      "A <b>profile check</b> measures hours to peak; below <b>8 h</b> the starter is strong.",
      "Bake when it peaks under <b>8 h</b> twice in a row — the suggested value is 4–6 h.",
    ],
    calculation: "Peak time trend = hours-to-peak across the last 3 feeds. Halved peak time ≈ doubled culture activity; steady under 8 h means bake-ready.",
    batches: "None yet — first batch pending",
  },
};

function presentationFor(profile: FermentationProfile): ProfilePresentation {
  return profilePresentations[profile.name] ?? {
    tag: profile.expectedDurationDays ? `${profile.expectedDurationDays} day profile` : "Custom fermentation profile",
    description: profile.guidance || "A local fermentation profile with its own inputs and guidance.",
    params: [[profile.expectedDurationDays ? `${profile.expectedDurationDays} d` : "—", "duration"], [profile.inputs.length ? String(profile.inputs.length) : "—", "inputs"], [profile.checks.length ? `${profile.checks.length}` : "—", "check rhythms"]],
    inputs: profile.inputs.map(({ name }) => name).join(", ") || "No inputs defined",
    guidance: [profile.instructions || "No guidance defined yet."],
    calculation: profile.calculations[0]?.formula || "No calculation defined yet.",
    batches: "No batches yet",
  };
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
    if (!parsed) return { id: crypto.randomUUID(), kind: "legacy", calculation };
    const input = profile.inputs.find(({ name }) => name === parsed.source);
    return {
      id: crypto.randomUUID(),
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

function Profiles({ formulaTerms, profiles, trash, onDelete, onRestore, onSave }: ProfilesProps) {
  const [editing, setEditing] = useState<FermentationProfile | null>(null);
  const [viewing, setViewing] = useState<FermentationProfile | null>(null);
  const [calculations, setCalculations] = useState<FormulaRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputsRef = useRef<HTMLTextAreaElement>(null);

  function currentInputs() {
    return inputsRef.current ? parseInputs(inputsRef.current.value) : editing?.inputs ?? [];
  }

  function edit(profile: FermentationProfile) {
    setErrors([]);
    setViewing(null);
    setEditing(profile);
    setCalculations(formulaRows(profile));
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
      id: crypto.randomUUID(),
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
    const inputs = parseInputs(String(data.get("inputs") ?? ""));
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
      id: editing?.id ?? crypto.randomUUID(),
      name: String(data.get("name") ?? "").trim(),
      guidance: String(data.get("guidance") ?? "").trim(),
      instructions: String(data.get("instructions") ?? "").trim(),
      expectedDurationDays: data.get("expectedDurationDays")
        ? Number(data.get("expectedDurationDays"))
        : undefined,
      inputs,
      calculations: calculations.map((row) => row.kind === "legacy" ? row.calculation : {
        name: row.result,
        unit: row.resultUnit,
        formula: `${row.source} ${row.operator} ${row.operand}${row.operandType === "percentage" ? "%" : ""}`,
      }),
      checks: parseChecks(String(data.get("checks") ?? "")),
      phZones: parsePhZones(String(data.get("phZones") ?? "")),
    };

    const nextErrors = validateProfile(profile);
    if (!profile.name || nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave(profile);
    setEditing(null);
  }

  return (
    <section className="profiles" aria-label="Fermentation profiles">
      <div className="profile-tools">
        <button className="profile-add" onClick={() => {
          edit({ id: crypto.randomUUID(), name: "", guidance: "", instructions: "", inputs: [], calculations: [], checks: [], phZones: [] });
        }} type="button">
          Add profile
        </button>
      </div>

      {editing && (
        <form className="profile-form" key={editing.id} onSubmit={save}>
          <label>Name <input autoFocus defaultValue={editing.name} name="name" required /></label>
          <label>Guidance <textarea defaultValue={editing.guidance} name="guidance" /></label>
          <label>Instructions <textarea defaultValue={editing.instructions} name="instructions" /></label>
          <label>Expected duration (days) <input defaultValue={editing.expectedDurationDays} min="1" name="expectedDurationDays" type="number" /></label>
          <label>Inputs <span className="optional">One per line: name, unit, default</span><textarea defaultValue={editing.inputs.map((input) => `${input.name}, ${input.unit}, ${input.defaultValue ?? ""}`).join("\n")} name="inputs" ref={inputsRef} /></label>
          <fieldset className="formula-builder">
            <legend>Calculations</legend>
            {calculations.map((row, index) => row.kind === "legacy" ? (
              <div className="legacy-formula" key={row.id}>
                <p><strong>Legacy calculation {index + 1}: {row.calculation.name}</strong></p>
                <p>This formula uses multiple operations or parentheses. It cannot be edited here, but will be kept when you save.</p>
                <button onClick={() => setCalculations(calculations.filter(({ id }) => id !== row.id))} type="button">Remove calculation {index + 1}</button>
              </div>
            ) : (
              <div className="formula-row" key={row.id}>
                <label>Source term row {index + 1}<select onChange={(event) => {
                  const source = event.target.value;
                  const matchingSource = calculations.find((candidate): candidate is StructuredFormulaRow => candidate.kind === "structured" && candidate.source === source);
                  updateFormula(row.id, {
                    source,
                    sourceUnit: matchingSource?.sourceUnit ?? currentInputs().find(({ name }) => name === source)?.unit ?? row.sourceUnit,
                    sourceUnitTouched: matchingSource?.sourceUnitTouched ?? false,
                  });
                }} value={row.source}>{availableSourceTerms(formulaTerms, calculations, currentInputs()).map((term) => <option key={term} value={term}>{formulaTermLabel(term)}</option>)}</select></label>
                <label>Source unit row {index + 1}<select onChange={(event) => updateSourceUnit(row.source, event.target.value as MetricUnit)} value={row.sourceUnit}>{metricUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                <label>Operator row {index + 1}<select onChange={(event) => updateFormula(row.id, { operator: event.target.value as StructuredFormulaRow["operator"] })} value={row.operator}>
                  <option value="+">+</option><option value="-">-</option><option value="*">×</option><option value="/">/</option>
                </select></label>
                <label>Operand row {index + 1}<input min="0" onChange={(event) => updateFormula(row.id, { operand: event.target.value })} required step="any" type="number" value={row.operand} /></label>
                <label>Operand type row {index + 1}<select onChange={(event) => updateFormula(row.id, { operandType: event.target.value as StructuredFormulaRow["operandType"] })} value={row.operandType}><option value="number">Number</option><option value="percentage">Percentage</option></select></label>
                <label>Result term row {index + 1}<select onChange={(event) => updateFormula(row.id, { result: event.target.value })} value={row.result}>{availableResultTerms(formulaTerms, editing, calculations).map((term) => <option key={term} value={term}>{formulaTermLabel(term)}</option>)}</select></label>
                <label>Result unit row {index + 1}<select onChange={(event) => updateFormula(row.id, { resultUnit: event.target.value as MetricUnit })} value={row.resultUnit}>{metricUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                <button onClick={() => setCalculations(calculations.filter(({ id }) => id !== row.id))} type="button">Remove calculation {index + 1}</button>
              </div>
            ))}
            <button onClick={addFormula} type="button">Add formula</button>
          </fieldset>
          <label>Recurring checks <span className="optional">One per line: name, interval days</span><textarea defaultValue={editing.checks.map((check) => `${check.name}, ${check.intervalDays}`).join("\n")} name="checks" /></label>
          <label>pH zones <span className="optional">One per line: danger|safe|optimal, min, max</span><textarea defaultValue={editing.phZones.map((zone) => `${zone.label}, ${zone.min}, ${zone.max}`).join("\n")} name="phZones" /></label>
          {errors.length > 0 && <div className="notice" role="alert">{errors.join(" ")}</div>}
          <div className="form-actions">
            <button className="primary-action" type="submit">Save profile</button>
            <button onClick={() => setEditing(null)} type="button">Cancel</button>
          </div>
        </form>
      )}

      <div className="profile-list">
        {profiles.map((profile) => {
          const presentation = presentationFor(profile);
          const calculation = presentation.calculation.replace(/<[^>]+>/g, "");
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
                  <p><b>Profile calculation</b> {calculation.slice(0, 86)}…</p>
                </div>
                <div className="pc-foot"><span className="mono">{presentation.batches}</span><span className="eyebrow">View guidance →</span></div>
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
      </div>

      {viewing && (() => {
        const presentation = presentationFor(viewing);
        return (
          <div className="profile-overlay" onClick={(event) => { if (event.target === event.currentTarget) setViewing(null); }}>
            <div aria-labelledby="profile-sheet-title" aria-modal="true" className="profile-sheet" role="dialog">
              <h2 id="profile-sheet-title">{viewing.name}</h2>
              <p className="sheet-sub">{presentation.tag}</p>
              <div className="pc-params profile-sheet-params">
                {presentation.params.map(([value, label]) => <span className="pc-param" key={`${value}-${label}`}><b>{value}</b><span>{label}</span></span>)}
              </div>
              <section className="profile-detail-panel">
                <h3>Profile guidance</h3>
                {presentation.guidance.map((guidance, index) => <div className="guide-step" key={guidance}><span className="g-n">{index + 1}</span><p><RichProfileText value={guidance} /></p></div>)}
              </section>
              <section className="profile-detail-panel">
                <h3>Profile calculation</h3>
                <p className="calc-line"><RichProfileText value={presentation.calculation} /></p>
              </section>
              <p className="profile-batch-hint">Batches on this profile: {presentation.batches}</p>
              <div className="profile-sheet-actions"><button className="primary-action" onClick={() => setViewing(null)} type="button">Done</button></div>
            </div>
          </div>
        );
      })()}

      {trash.length > 0 && (
        <section className="trash" aria-label="Deleted profiles">
          <h3>Recently deleted</h3>
          <p>Profiles remain recoverable for seven days.</p>
          {trash.map((profile) => (
            <div className="trash-item" key={profile.id}>
              <span>{profile.name}</span>
              <button aria-label={`Restore ${profile.name}`} onClick={() => onRestore(profile.id)} type="button">Restore</button>
            </div>
          ))}
        </section>
      )}
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

function parseInputs(value: string): FermentationProfile["inputs"] {
  return value.split("\n").filter((line) => line.trim()).map((line) => {
    const [name = "", unit = "", defaultValue = ""] = line.split(",").map((part) => part.trim());
    return {
      name,
      unit: unit as FermentationProfile["inputs"][number]["unit"],
      defaultValue: defaultValue === "" ? undefined : Number(defaultValue),
    };
  });
}

function parseChecks(value: string): FermentationProfile["checks"] {
  return value.split("\n").filter((line) => line.trim()).map((line) => {
    const [name = "", intervalDays = ""] = line.split(",").map((part) => part.trim());
    return { name, intervalDays: Number(intervalDays) };
  });
}

function parsePhZones(value: string): FermentationProfile["phZones"] {
  return value.split("\n").filter((line) => line.trim()).map((line) => {
    const [label = "", min = "", max = ""] = line.split(",").map((part) => part.trim());
    return {
      label: label as FermentationProfile["phZones"][number]["label"],
      min: Number(min),
      max: Number(max),
    };
  });
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
