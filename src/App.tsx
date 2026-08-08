import { useState } from "react";
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
  const [profileState, setProfileState] = useState(() =>
    discardExpiredProfiles(browserProfileStore.load() ?? createProfileState(), Date.now()),
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
          {shell.destination === "profiles" ? (
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
