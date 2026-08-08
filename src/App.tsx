import { useState } from "react";
import {
  addTimelineEntry,
  batchStatuses,
  createBatch,
  createBatchState,
  deleteBatch,
  deleteTimelineEntry,
  discardExpiredBatches,
  filterBatches,
  prioritizeToday,
  restoreBatch,
  restoreTimelineEntry,
  statusLabel,
  updateTimelineEntry,
  type Batch,
  type BatchFilter,
  type BatchState,
  type BatchStatus,
  type TimelineEntry,
} from "./domain/batches";
import {
  addProfile,
  createProfileState,
  deleteProfile,
  discardExpiredProfiles,
  restoreProfile,
  updateProfile,
  type FermentationProfile,
} from "./domain/profiles";
import {
  createShellState,
  destinations,
  selectDestination,
  type Destination,
} from "./domain/shell";
import { browserShellStore } from "./platform/shell-store";
import { browserProfileStore } from "./platform/profile-store";
import { browserBatchStore } from "./platform/batch-store";

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

export function App() {
  const [shell, setShell] = useState(
    () => browserShellStore.load() ?? createShellState(),
  );
  const [profileState, setProfileState] = useState(() =>
    discardExpiredProfiles(browserProfileStore.load() ?? createProfileState(), Date.now()),
  );
  const [batchState, setBatchState] = useState(() =>
    discardExpiredBatches(browserBatchStore.load() ?? createBatchState(), Date.now()),
  );

  function saveProfiles(next: typeof profileState) {
    const current = discardExpiredProfiles(next, Date.now());
    browserProfileStore.save(current);
    setProfileState(current);
  }

  function navigate(destination: Destination) {
    const next = selectDestination(shell, destination);
    browserShellStore.save(next);
    setShell(next);
  }

  function saveBatches(next: BatchState) {
    const current = discardExpiredBatches(next, Date.now());
    browserBatchStore.save(current);
    setBatchState(current);
  }

  function handleProfile(profile: FermentationProfile) {
    const exists = profileState.profiles.some(({ id }) => id === profile.id);
    saveProfiles(exists ? updateProfile(profileState, profile) : addProfile(profileState, profile));
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
          {shell.destination === "today" || shell.destination === "batches" ? (
            <BatchView
              batches={batchState.batches}
              mode={shell.destination}
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
          ) : shell.destination === "profiles" ? (
            <Profiles
              profiles={profileState.profiles}
              trash={profileState.trash}
              onDelete={(id) => saveProfiles(deleteProfile(profileState, id, Date.now()))}
              onRestore={(id) => saveProfiles(restoreProfile(profileState, id, Date.now()))}
              onSave={handleProfile}
            />
          ) : (
            <section aria-label={`${labels[shell.destination]} placeholder`} className="empty-state">
              <p>{descriptions[shell.destination]}</p>
              <p>Start with a fermentation profile to begin tracking a batch.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

interface BatchViewProps {
  batches: Batch[];
  mode: "today" | "batches";
  profiles: FermentationProfile[];
  trash: { id: string; name: string; deletedAt: number }[];
  onChange(batch: Batch): void;
  onCreate(batch: Batch): void;
  onDelete(id: string): void;
  onRestore(id: string): void;
}

function BatchView({ batches, mode, profiles, trash, onChange, onCreate, onDelete, onRestore }: BatchViewProps) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<BatchFilter>("all");
  const visible = mode === "today" ? prioritizeToday(batches) : filterBatches(batches, filter);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile = profiles.find(({ id }) => id === data.get("profileId"));
    const startDate = String(data.get("startDate") ?? "");
    if (!profile || !startDate) {
      return;
    }

    onCreate(
      createBatch(profile, {
        id: crypto.randomUUID(),
        name: String(data.get("name") ?? ""),
        startDate,
      }),
    );
    setCreating(false);
  }

  return (
    <section className="batches" aria-label={mode === "today" ? "Today batch queue" : "Batch list"}>
      <div className="batch-toolbar">
        <button
          className="primary-action"
          disabled={profiles.length === 0}
          onClick={() => setCreating(true)}
          type="button"
        >
          Start batch
        </button>
        {mode === "batches" && (
          <label className="batch-filter">
            Status
            <select onChange={(event) => setFilter(event.target.value as BatchFilter)} value={filter}>
              <option value="all">All statuses</option>
              {batchStatuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {profiles.length === 0 && <p className="notice">Restore or create a profile before starting a batch.</p>}

      {creating && (
        <form className="batch-form" onSubmit={save}>
          <label>
            Fermentation profile
            <select autoFocus name="profileId" required>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </label>
          <label>
            Start date
            <input defaultValue={localDate()} name="startDate" required type="date" />
          </label>
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

      {visible.length === 0 ? (
        <section className="empty-state">
          <p>{batches.length === 0 ? "No batches yet." : "No batches match this status."}</p>
          <p>Start one from a fermentation profile when you are ready.</p>
        </section>
      ) : (
        <div className="batch-list">
          {visible.map((batch) => (
            <BatchCard batch={batch} key={batch.id} onChange={onChange} onDelete={onDelete} />
          ))}
        </div>
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

interface BatchCardProps {
  batch: Batch;
  onChange(batch: Batch): void;
  onDelete(id: string): void;
}

function BatchCard({ batch, onChange, onDelete }: BatchCardProps) {
  const [editing, setEditing] = useState<TimelineEntry | null>(null);

  function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("kind")) as TimelineEntry["kind"];
    const common = {
      id: editing?.id ?? crypto.randomUUID(),
      date: String(data.get("date") ?? ""),
    };
    const entry: TimelineEntry = kind === "status"
      ? { ...common, kind, status: String(data.get("status")) as BatchStatus }
      : { ...common, kind, text: String(data.get("text") ?? "").trim() };
    if (!entry.date || (entry.kind !== "status" && !entry.text)) return;
    onChange(editing ? updateTimelineEntry(batch, entry) : addTimelineEntry(batch, entry));
    setEditing(null);
    event.currentTarget.reset();
  }

  function recordStatus(status: BatchStatus) {
    onChange(addTimelineEntry(batch, {
      id: crypto.randomUUID(), date: localDate(), kind: "status", status,
    }));
  }

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
        {batch.timeline.map((entry) => (
          <div className="timeline-entry" key={entry.id}>
            <time dateTime={entry.date}>{entry.date}</time>
            <span>{entry.kind === "status" ? `Status: ${statusLabel(entry.status)}` : entry.text}</span>
            <button aria-label={`Edit ${entry.kind} from ${entry.date}`} onClick={() => setEditing(entry)} type="button">Edit</button>
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
            <input defaultValue={editing && editing.kind !== "status" ? editing.text : ""} name="text" />
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
  profiles: FermentationProfile[];
  trash: { id: string; name: string; deletedAt: number }[];
  onDelete(id: string): void;
  onRestore(id: string): void;
  onSave(profile: FermentationProfile): void;
}

function Profiles({ profiles, trash, onDelete, onRestore, onSave }: ProfilesProps) {
  const [editing, setEditing] = useState<FermentationProfile | null>(null);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile = {
      id: editing?.id ?? crypto.randomUUID(),
      name: String(data.get("name") ?? "").trim(),
      guidance: String(data.get("guidance") ?? "").trim(),
      instructions: String(data.get("instructions") ?? "").trim(),
    };

    if (!profile.name) {
      return;
    }

    onSave(profile);
    setEditing(null);
  }

  return (
    <section className="profiles" aria-label="Fermentation profiles">
      <button className="primary-action" onClick={() => setEditing({ id: crypto.randomUUID(), name: "", guidance: "", instructions: "" })} type="button">
        Add profile
      </button>

      {editing && (
        <form className="profile-form" key={editing.id} onSubmit={save}>
          <label>Name <input autoFocus defaultValue={editing.name} name="name" required /></label>
          <label>Guidance <textarea defaultValue={editing.guidance} name="guidance" /></label>
          <label>Instructions <textarea defaultValue={editing.instructions} name="instructions" /></label>
          <div className="form-actions">
            <button className="primary-action" type="submit">Save profile</button>
            <button onClick={() => setEditing(null)} type="button">Cancel</button>
          </div>
        </form>
      )}

      <div className="profile-list">
        {profiles.map((profile) => (
          <article className="profile-card" key={profile.id}>
            <h3>{profile.name}</h3>
            <p><strong>Guidance:</strong> {profile.guidance || "None yet."}</p>
            <p><strong>Instructions:</strong> {profile.instructions || "None yet."}</p>
            <div className="form-actions">
              <button aria-label={`Edit ${profile.name}`} onClick={() => setEditing(profile)} type="button">Edit</button>
              <button aria-label={`Delete ${profile.name}`} onClick={() => {
                setEditing((current) => current?.id === profile.id ? null : current);
                onDelete(profile.id);
              }} type="button">Delete</button>
            </div>
          </article>
        ))}
      </div>

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
