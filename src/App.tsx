import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { isTauri } from "@tauri-apps/api/core";
import type { PluginListenerHandle } from "@capacitor/core";
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
  phZoneLabel,
  phWarning,
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
  selectDestination,
  type Destination,
  type ShellPreferences,
} from "./domain/shell";
import { browserShellStore } from "./platform/shell-store";
import { browserProfileStore } from "./platform/profile-store";
import { browserBatchStore } from "./platform/batch-store";
import { loadWebState, saveWebState } from "./platform/web-store";
import {
  createArchive,
  importArchive,
  refreshArchiveCollisions,
  resolveArchiveCollisions,
  type ArchiveImport,
} from "./platform/archive";
import { loadNativeState, isNativePlatform, saveNativeState } from "./platform/native-store";
import { iosGuideDismissedKey, shouldShowIosInstallGuide } from "./platform/ios-install-guide";
import { isNativeTransferAvailable, pickNativeArchive, shareNativeFile } from "./platform/native-transfer";
import { requestReminderPermission, reconcileReminders } from "./platform/reminders";
import { captureNativePhoto, isNativeCameraAvailable, listenForRestoredCameraPhoto, type CapturedPhoto } from "./platform/camera";
import {
  sharedDataStore,
  type SharedSnapshot,
  type SharedStorageResult,
  type SharedStorageStatus,
} from "./platform/shared-data-store";

const labels: Record<Destination, string> = {
  today: "My batches",
  batches: "My batches",
  calendar: "Calendar",
  profiles: "Profiles",
  settings: "Settings",
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
  if (destination === "today") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
  if (destination === "batches") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3h8M9 3v3l-3 9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3l-3-9V3M7 14h10" /></svg>;
  if (destination === "calendar") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v5m8-5v5M4 11h16m-12 4h1m3 0h1m3 0h1m-9 3h1m3 0h1" /></svg>;
  if (destination === "profiles") return <><span className="design-nav-profile-desktop"><DesignIcon name="book" /></span><span className="design-nav-profile-mobile"><DesignIcon name="jar" /></span></>;
  return <DesignIcon name="user" />;
}

function DesignIcon({ name }: { name: "leaf" | "jar" | "search" | "sort" | "plus" | "bell" | "user" | "sparkles" | "temp" | "clock" | "back" | "check" | "book" | "drop" | "settings" | "close" }) {
  const paths = {
    leaf: "M19 3C9 3 3 7 5 14c2 6 12 6 14-11ZM4 21 15 9m-6 6 6 1",
    jar: "M7 7c0 3-2 3-2 6v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6c0-3-2-3-2-6M5 12h14M5 16h14",
    search: "M16 16l5 5M17.5 10.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    sort: "M3 6h9m5 0h4M3 12h3m5 0h10M3 18h11m5 0h2M16 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0M10 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M18 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    plus: "M12 5v14M5 12h14",
    bell: "M9 20h6m-9-4h12l-2-3V9a4 4 0 0 0-8 0v4l-2 3Z",
    user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 21v-3a7 7 0 0 1 14 0v3",
    sparkles: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM20 2v4m-2-2h4M3 19v4m-2-2h4",
    temp: "M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 8v9",
    clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2",
    back: "m14 5-7 7 7 7",
    check: "m5 12 4 4L19 6",
    close: "m6 6 12 12M6 18 18 6",
    book: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15",
    drop: "M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z",
    settings: "m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{name === "jar" && <rect x="6" y="3" width="12" height="4" rx="1.5" />}<path d={paths[name]} />{name === "temp" && <circle cx="12" cy="18" r="1" />}</svg>;
}

function StationLogo() {
  return <span className="brand-mark" aria-hidden="true"><img alt="" src={`${import.meta.env.BASE_URL}new-design/new_app_logo/FermentStation_Logo_Asset_Pack/transparent/logo-transparent-96.png`} /></span>;
}

type FieldErrors = Record<string, string>;

function fieldErrorProps(errors: FieldErrors, id: string) {
  return { id, "aria-invalid": errors[id] ? true as const : undefined, "aria-describedby": errors[id] ? `${id}-error` : undefined };
}

function FieldError({ errors, id }: { errors: FieldErrors; id: string }) {
  return errors[id] ? <span className="field-error" id={`${id}-error`}>{errors[id]}</span> : null;
}

function captureFieldError(event: React.FormEvent<HTMLElement>, report: (id: string, message: string) => void) {
  const field = event.target;
  if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) && field.id) report(field.id, field.validationMessage);
}

function useUnsavedChanges(message: string) {
  const dirty = useRef(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return { dirty, confirmDiscard: () => !dirty.current || window.confirm(message) };
}

function profileVisual(profile: FermentationProfile) {
  const name = profile.name.toLowerCase();
  if (name.includes("kimchi")) return { photo: "kimchi", color: "var(--colour-action-alt)" };
  if (name.includes("kombucha")) return { photo: "kombucha", color: "var(--colour-accent)" };
  if (name.includes("sourdough")) return { photo: "sourdough", color: "var(--colour-surface)" };
  if (name.includes("sauerkraut")) return { photo: "kraut", color: "var(--colour-action)" };
  return { photo: null, color: "var(--colour-action-alt)" };
}

function BatchPhoto({ batch, detail = false }: { batch: Batch; detail?: boolean }) {
  const visual = profileVisual(batch.profileSnapshot);
  const photo = batch.timeline.filter((entry) => entry.kind === "photo").at(-1);
  const source = photo?.dataUrl ?? (visual.photo ? `${import.meta.env.BASE_URL}new-design/${visual.photo}.webp` : null);
  return <div className={`${detail ? "design-detail-photo" : "design-batch-photo"}${photo ? " user-photo" : ""}`} style={detail ? { background: visual.color } : undefined}>
    {source ? <BatchImage key={source} source={source} userPhoto={!!photo} retryable={detail} description={photo ? `Batch photograph: ${photo.caption || photo.name}` : `${batch.profileSnapshot.name} stand-in photograph`} />
      : <DesignIcon name="jar" />}
    {detail && <span className={`status status-${batch.status}`}>{statusLabel(batch.status)}</span>}
    <span className="design-photo-label">{batch.status === "to-fridge" ? "In the fridge" : batch.status === "ready" && !detail ? batch.finishDate === localDate() ? "Ready today" : "Ready to enjoy" : batch.finishDate ? `Finish ${shortDate(batch.finishDate)}` : "No finish date"}</span>
  </div>;
}

function BatchImage({ source, description, userPhoto, retryable = false }: { source: string; description: string; userPhoto: boolean; retryable?: boolean }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  return <>
    {state !== "loaded" && <span className="batch-photo-fallback" role={state === "failed" ? "img" : undefined} aria-label={state === "failed" ? userPhoto ? "Batch photograph unavailable; original retained" : "Stand-in photograph unavailable" : undefined}><DesignIcon name="jar" /></span>}
    {state !== "failed" && <img alt={description} data-source={userPhoto ? "user" : "stand-in"} onLoad={() => setState("loaded")} onError={() => setState("failed")} src={source} />}
    {!userPhoto && <span className="batch-image-credit">Stand-in</span>}
    {state === "failed" && retryable && <button className="batch-photo-retry" onClick={() => setState("loading")} type="button">Retry photograph</button>}
  </>;
}

function batchDay(batch: Batch) {
  return Math.max(1, Math.floor((Date.parse(`${localDate()}T00:00:00Z`) - Date.parse(`${batch.startDate}T00:00:00Z`)) / 86_400_000) + 1);
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function BatchMeta({ batch, units, guidance = false }: { batch: Batch; units: ShellPreferences["units"]; guidance?: boolean }) {
  const temperature = batch.timeline.filter((entry) => entry.kind === "temperature").at(-1);
  const input = batch.profileSnapshot.inputs.find(({ name }) => batch.inputValues[name] !== undefined);
  const value = input && batch.inputValues[input.name];
  const volume = input && (input.unit === "ml" || input.unit === "l");
  const amount = value !== undefined && input ? units === "imperial" && volume
    ? `${formatCalculationValue(value * (input.unit === "ml" ? 0.001 : 1) / 0.946352946)} qt`
    : `${formatCalculationValue(value)} ${input.unit === "l" ? "L" : input.unit === "ml" ? "mL" : input.unit}` : null;
  const saltFormula = batch.profileSnapshot.calculations.find(({ name }) => name.toLowerCase() === "salt");
  const salt = saltFormula && parseSimpleFormula(saltFormula.formula);
  return <div className="design-batch-meta">
    <span><DesignIcon name="temp" />{temperature ? `${displayTemperature(temperature.value, units)} °${units === "imperial" ? "F" : "C"}` : "No reading"}</span>
    {amount && <span><DesignIcon name="jar" />{amount}</span>}
    {guidance && salt?.percentage && salt.operator === "*" && <span title="Profile formula percentage">Salt {salt.operand}%</span>}
  </div>;
}

function PhotoCredits() {
  return <details className="design-photo-credits"><summary>Photographs via Wikimedia Commons</summary><ul>
    <li><a href="https://commons.wikimedia.org/wiki/File:Kimchi_in_jar.jpg">Kimchi in jar</a> · Shisma · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</li>
    <li><a href="https://commons.wikimedia.org/wiki/File:Kombucha_jar.jpg">Kombucha jar</a> · Romarin · Public domain.</li>
    <li><a href="https://commons.wikimedia.org/wiki/File:Sourdough_starter.jpg">Sourdough starter</a> · PilotChicago · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</li>
    <li><a href="https://commons.wikimedia.org/wiki/File:Sauerkraut_Jar.jpg">Sauerkraut Jar</a> · Bdubay · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>.</li>
  </ul><p>Stand-in photographs, cropped with backgrounds removed. Your own batch photos replace these illustrations.</p></details>;
}

function StatusIcon({ status }: { status: BatchStatus | "attention" }) {
  if (status === "ready") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5l5 5 10-11" /></svg>;
  if (status === "to-fridge") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 9h.5M8 15.5h.5" /></svg>;
  if (status === "attention") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12M12 15.8v.2" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>;
}

type StationDialogState =
  | { kind: "start"; profile?: FermentationProfile }
  | { kind: "profile"; profile: FermentationProfile }
  | { kind: "dates" | "inputs"; batch: Batch }
  | { kind: "info" };

function StationDialog({ title, mode, returnFocus, onClose, children }: { title: string; mode: string; returnFocus: HTMLElement | null; onClose(): void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current!;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [mode, returnFocus]);
  return <dialog aria-labelledby="station-dialog-title" className="station-dialog bowed-clip" onCancel={(event) => { event.preventDefault(); onClose(); }} ref={dialogRef}>
    <div className="station-dialog-heading"><h2 id="station-dialog-title">{title}</h2><button aria-label="Close dialog" className="utility-circle utility-circle-dark station-dialog-close" onClick={onClose} ref={closeRef} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div>
    {children}
  </dialog>;
}

function profileInputsText(profile: FermentationProfile) {
  return profile.inputs.map(({ name, unit, defaultValue }) => `${name}${defaultValue === undefined ? "" : ` ${formatNumber(defaultValue)} ${unit === "l" ? "L" : unit === "ml" ? "mL" : unit}`}`).join(" · ") || "No profile inputs.";
}

function ProfileOverview({ profile, onStart }: { profile: FermentationProfile; onStart(): void }) {
  const salt = parseSimpleFormula(profile.calculations.find(({ name }) => name.toLowerCase() === "salt")?.formula ?? "");
  return <div className="station-dialog-body profile-overview">
    <div className="profile-overview-intro"><div><p className="eyebrow">Reusable fermentation profile</p><ProfileGuidance profile={profile} /></div><ProfilePhoto profile={profile} /></div>
    <dl><dt>Expected fermentation duration</dt><dd>{profile.expectedDurationDays ? `${profile.expectedDurationDays} days` : "Not set"}</dd><dt>Profile temperature range</dt><dd>{profile.temperatureMinC !== undefined && profile.temperatureMaxC !== undefined ? `${profile.temperatureMinC}–${profile.temperatureMaxC} °C` : "Not set"}</dd>{salt?.percentage && salt.operator === "*" && <><dt>Salt guidance</dt><dd>{salt.operand}%</dd></>}</dl>
    {profile.phZones.length > 0 && <section><h3>pH conditions</h3><ul>{profile.phZones.map((zone, index) => <li key={index}>{zone.label}: {zone.min}–{zone.max}</li>)}</ul></section>}
    <h3>Profile inputs</h3><p>{profileInputsText(profile)}</p>
    <h3>Profile calculations</h3>{profile.calculations.length ? <ul>{profile.calculations.map((calculation) => <li key={calculation.name}>{calculation.name} = {calculation.formula} ({calculation.unit})</li>)}</ul> : <p>No calculations defined.</p>}
    <h3>Profile checks</h3><p>{profile.checks.map(({ name, intervalDays }) => `${name} · every ${intervalDays} ${intervalDays === 1 ? "day" : "days"}`).join(" · ") || "No recurring checks."}</p>
    <p className="station-helper">Starting a batch copies this profile. Later edits or deletion will not change that batch.</p>
    <div className="station-dialog-actions"><button className="station-primary" onClick={onStart} type="button">Start a batch</button></div>
  </div>;
}

function ProfilePhoto({ profile }: { profile: FermentationProfile }) {
  const visual = profileVisual(profile);
  return <div className="design-profile-visual">{visual.photo ? <BatchImage key={visual.photo} source={`${import.meta.env.BASE_URL}new-design/${visual.photo}.webp`} description={`${profile.name} stand-in photograph`} userPhoto={false} retryable /> : <DesignIcon name="jar" />}</div>;
}

function ProfileGuidance({ profile }: { profile: FermentationProfile }) {
  return profile.guidance.length ? <ol className="profile-guidance-steps">{profile.guidance.map((step, index) => <li key={index}><RichProfileText value={step} /></li>)}</ol> : <p>No guidance defined yet.</p>;
}

function StartBatchForm({ profiles, initialProfile, onCreate, onCancel, onDirty, onProfiles }: { profiles: FermentationProfile[]; initialProfile?: FermentationProfile; onCreate(batch: Batch): void; onCancel(): void; onDirty(): void; onProfiles(): void }) {
  const [available] = useState(() => initialProfile ? profiles.some(({ id }) => id === initialProfile.id)
    ? profiles.map((profile) => profile.id === initialProfile.id ? initialProfile : profile)
    : [...profiles, initialProfile] : profiles);
  const [profileId, setProfileId] = useState(initialProfile?.id ?? profiles[0]?.id ?? "");
  const inputDrafts = useRef<Record<string, Record<string, string>>>({});
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const profile = available.find(({ id }) => id === profileId);
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const data = new FormData(event.currentTarget);
    try {
      const batch = createBatch(profile, {
        id: createClientId(), name: String(data.get("name") ?? ""), startDate: String(data.get("startDate") ?? ""), today: localDate(),
        inputValues: Object.fromEntries(profile.inputs.map((input) => {
          const raw = String(data.get(`input.${input.name}`) ?? "");
          return [input.name, raw === "" ? undefined : Number(raw)];
        })),
      });
      onCreate(batch);
    } catch (error) {
      const message = (error as Error).message;
      setError(message);
      const index = profile.inputs.findIndex((input) => message === `${input.name} cannot be negative`);
      setFieldErrors({ [index < 0 ? "start-profile" : `start-input-${index}`]: message });
    }
  }
  if (!available.length) return <div className="station-dialog-body"><p>Create or restore a fermentation profile before starting a batch.</p><div className="station-dialog-actions"><button className="station-primary" onClick={onProfiles} type="button">Open Profiles</button></div></div>;
  return <form onChange={onDirty} onInput={() => { setError(""); setFieldErrors({}); }} onInvalid={(event) => captureFieldError(event, (id, message) => setFieldErrors((previous) => ({ ...previous, [id]: message })))} onSubmit={save}>
    <p className="station-helper">Choose a reusable method. This batch will keep its own copy.</p>
    <fieldset className="start-batch-basics"><legend>Your batch</legend>
    <label className="station-field">Batch name<input {...fieldErrorProps(fieldErrors, "start-name")} aria-label="Batch name" className="dark-field" autoComplete="off" maxLength={60} name="name" placeholder="e.g. My weekend kimchi" title="Optional; uses the profile name if blank" /><FieldError errors={fieldErrors} id="start-name" /></label>
    <label className="station-field">Fermentation profile<select {...fieldErrorProps(fieldErrors, "start-profile")} aria-label="Fermentation profile" className="dark-field" name="profileId" onChange={(event) => { setProfileId(event.target.value); setError(""); setFieldErrors({}); }} required value={profileId}>{available.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.expectedDurationDays ? `${profile.expectedDurationDays} days` : "duration not set"}</option>)}</select><FieldError errors={fieldErrors} id="start-profile" /></label>
    <label className="station-field">Start date<input {...fieldErrorProps(fieldErrors, "start-date")} aria-label="Start date" className="dark-field" defaultValue={localDate()} max={localDate()} name="startDate" required type="date" /><FieldError errors={fieldErrors} id="start-date" /></label>
    </fieldset>
    {profile && <section className="start-profile-summary" aria-label="Selected profile guidance"><h3>{profile.name}</h3><p>{profile.expectedDurationDays ? `${profile.expectedDurationDays} days expected fermentation` : "Expected duration not set"}{profile.temperatureMinC !== undefined && profile.temperatureMaxC !== undefined ? ` · ${profile.temperatureMinC}–${profile.temperatureMaxC} °C` : ""}</p><details><summary>Profile guidance and checks</summary><ProfileGuidance profile={profile} /><p>{profile.checks.map((check) => `${check.name} · ${formatCheckInterval(check.intervalDays)}`).join(" · ") || "No recurring checks."}</p></details></section>}
    {profile && profile.inputs.length > 0 ? <details className="station-options"><summary><span>Batch input options</span> · name is optional</summary><div key={profile.id}>{profile.inputs.map((input, index) => <label className="station-field" key={input.name}>{input.name} ({input.unit})<input {...fieldErrorProps(fieldErrors, `start-input-${index}`)} aria-label={`${input.name} (${input.unit})`} className="dark-field" defaultValue={inputDrafts.current[profile.id]?.[input.name] ?? input.defaultValue} onChange={(event) => { inputDrafts.current[profile.id] = { ...inputDrafts.current[profile.id], [input.name]: event.target.value }; }} min="0" name={`input.${input.name}`} step="any" type="number" /><FieldError errors={fieldErrors} id={`start-input-${index}`} /></label>)}<p>Blank inputs use profile defaults. Changes are saved on this device when you start the batch.</p></div></details> : <p className="station-helper">Saved on this device · name is optional.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="station-dialog-actions"><button className="station-secondary" onClick={onCancel} type="button">Cancel</button><button className="station-primary" disabled={!profile} type="submit">Start a batch</button></div>
  </form>;
}

function revealDetailSection(section: string | HTMLElement) {
  const target = typeof section === "string" ? document.getElementById(section) : section;
  const scroller = target?.closest<HTMLElement>(".design-detail, .design-dashboard");
  if (!target || !scroller) return;
  for (let parent = target.parentElement; parent && parent !== scroller; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  scroller.scrollTo?.({ top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  (target.querySelector<HTMLElement>("input:not([type=file]):enabled, textarea:enabled, button:enabled") ?? target).focus({ preventScroll: true });
}

export function App() {
  const webStorage = useRef<"loading" | "indexeddb" | "fallback" | "failed">(
    !isNativePlatform() && !isTauri() && typeof indexedDB !== "undefined" ? "loading" : "fallback",
  );
  const [webReady, setWebReady] = useState(webStorage.current !== "loading");
  const [webStorageError, setWebStorageError] = useState(!isNativePlatform() && !isTauri() && typeof indexedDB === "undefined");
  const [webRetry, setWebRetry] = useState(0);
  const [webLoadRetry, setWebLoadRetry] = useState(0);
  const [showIosGuide, setShowIosGuide] = useState(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(iosGuideDismissedKey) === "true"; } catch { /* Storage may be unavailable. */ }
    return shouldShowIosInstallGuide({
      native: isNativePlatform(),
      vendor: navigator.vendor,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
      displayModeStandalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
      dismissed,
    });
  });
  const browserHadData = useRef(
    browserShellStore.load() !== null || browserProfileStore.load() !== null || browserBatchStore.load() !== null,
  );
  const notificationPermissionRequest = useRef(0);
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
  const beforeBatchReplace = useRef<((nextBatches?: Batch[]) => boolean) | null>(null);
  const [showPhoneDetail, setShowPhoneDetail] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [detailOrigin, setDetailOrigin] = useState<"calendar" | "checks" | null>(null);
  const batchReturnFocus = useRef<HTMLElement | null>(null);
  const calendarReturnScroll = useRef(0);
  const [dialog, setDialog] = useState<StationDialogState | null>(null);
  const profileDraft = useUnsavedChanges("Discard unsaved profile changes? Your saved profile and existing batches will not change.");
  const startDraft = useUnsavedChanges("Discard this unsaved batch? Its name, date and inputs will be lost.");
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const [batchListVersion, setBatchListVersion] = useState(0);
  function closeDialog() {
    if (!startDraft.confirmDiscard()) return;
    startDraft.dirty.current = false;
    setDialog(null);
  }
  function showDialog(next: StationDialogState) {
    if (!startDraft.confirmDiscard()) return;
    startDraft.dirty.current = false;
    if (!dialog) dialogTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialog(next);
  }
  const [announcement, setAnnouncement] = useState<{ message: string } | null>(null);
  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => setAnnouncement(null), 3500);
    return () => window.clearTimeout(timer);
  }, [announcement]);
  useEffect(() => {
    if (openBatchId && !batchState.batches.some(({ id }) => id === openBatchId)) setOpenBatchId(null);
  }, [batchState.batches, openBatchId]);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [nativeReady, setNativeReady] = useState(() => !isNativePlatform());
  const [storageStatus, setStorageStatus] = useState(() => sharedDataStore.getStatus());
  const stateRef = useRef<SharedSnapshot>({ shell, profileState, batchState });
  stateRef.current = { shell, profileState, batchState };
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) main.scrollTop = 0;
  }, [shell.destination]);

  useEffect(() => {
    if (webStorage.current !== "loading") return;
    let active = true;
    void loadWebState().then((stored) => {
      if (!active) return;
      if (stored?.shell) setShell(stored.shell);
      if (stored?.profileState) setProfileState(stored.profileState);
      if (stored?.batchState) setBatchState(updateBatchDates(discardExpiredBatches(stored.batchState, Date.now())));
      if (stored) browserHadData.current = true;
      webStorage.current = "indexeddb";
    }).catch(() => {
      if (!active) return;
      webStorage.current = "failed";
      setWebStorageError(true);
    }).finally(() => { if (active) setWebReady(true); });
    return () => { active = false; };
  }, [webLoadRetry]);

  function retryWebLoad() {
    webStorage.current = "loading";
    setWebReady(false);
    setWebStorageError(false);
    setWebLoadRetry((value) => value + 1);
  }

  useEffect(() => {
    if (!webReady || webStorage.current !== "indexeddb") return;
    let active = true;
    void saveWebState({ shell, profileState, batchState }).then(() => {
      if (active) setWebStorageError(false);
    }).catch(() => { if (active) setWebStorageError(true); });
    return () => { active = false; };
  }, [webReady, shell, profileState, batchState, webRetry]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const shared = await sharedDataStore.initialize();
      if (!active) return;
      setStorageStatus(shared.status);
      if (shared.status.location && shared.status.state !== "migration") {
        if (shared.snapshot) applySharedSnapshot(shared.snapshot);
        setNativeReady(true);
        return;
      }
      if (isNativePlatform()) {
        const stored = await loadNativeState();
        if (!active) return;
        if (stored?.shell) setShell(stored.shell);
        if (stored?.profileState) setProfileState(stored.profileState);
        if (stored?.batchState) setBatchState(updateBatchDates(discardExpiredBatches(stored.batchState, Date.now())));
        if (stored) browserHadData.current = true;
      }
      setNativeReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!nativeReady || storageStatus.location) return;
    void saveNativeState(shell, profileState, batchState);
  }, [batchState, nativeReady, profileState, shell, storageStatus.location]);

  useEffect(() => {
    async function reloadShared() {
      if (!sharedDataStore.getStatus().location) return;
      applySharedResult(await sharedDataStore.reload());
    }
    const onFocus = () => { void reloadShared(); };
    window.addEventListener("focus", onFocus);
    let nativeListener: PluginListenerHandle | undefined;
    if (isNativePlatform()) {
      void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void reloadShared();
      }).then((listener) => { nativeListener = listener; });
    }
    return () => {
      window.removeEventListener("focus", onFocus);
      void nativeListener?.remove();
    };
  }, []);

  useEffect(() => {
    if (!nativeReady) return;
    void reconcileReminders(batchState, shell.notificationMode);
  }, [batchState, nativeReady, shell.notificationMode]);

  function saveProfiles(next: typeof profileState) {
    browserHadData.current = true;
    if (webStorage.current === "fallback") browserProfileStore.save(next);
    setProfileState(next);
    persistShared(sharedDataStore.saveProfiles(next));
  }

  function navigate(destination: Destination) {
    if (destination === "profiles" && shell.destination === "profiles" && editingProfileId) return true;
    if (!profileDraft.confirmDiscard() || !startDraft.confirmDiscard()) return false;
    profileDraft.dirty.current = false;
    startDraft.dirty.current = false;
    const next = selectDestination(shell, destination);
    if (webStorage.current === "fallback") browserShellStore.save(next);
    setShell(next);
    persistShared(sharedDataStore.saveShell(next));
    setShowPhoneDetail(false);
    setShowChecks(false);
    setDetailOrigin(null);
    setEditingProfileId(null);
    setDialog(null);
    return true;
  }

  function updatePreferences(preferences: ShellPreferences, requestNotificationPermission = false) {
    browserHadData.current = true;
    if (requestNotificationPermission) notificationPermissionRequest.current += 1;
    const request = notificationPermissionRequest.current;
    if (requestNotificationPermission && preferences.notificationMode !== "off" && isNativePlatform()) {
      void requestReminderPermission().then((granted) => {
        if (request !== notificationPermissionRequest.current) return;
        const modeChanged = stateRef.current.shell.notificationMode !== preferences.notificationMode;
        const next = {
          ...stateRef.current.shell,
          notificationMode: granted ? preferences.notificationMode : "off" as const,
        };
        if (webStorage.current === "fallback") browserShellStore.save(next);
        setShell(next);
        persistShared(sharedDataStore.saveShell(next));
        if (granted && !modeChanged) void reconcileReminders(stateRef.current.batchState, next.notificationMode);
      });
      return;
    }
    const next = { ...shell, ...preferences };
    if (webStorage.current === "fallback") browserShellStore.save(next);
    setShell(next);
    persistShared(sharedDataStore.saveShell(next));
  }

  function saveBatches(next: BatchState) {
    browserHadData.current = true;
    const current = updateBatchDates(discardExpiredBatches(next, Date.now()));
    if (webStorage.current === "fallback") browserBatchStore.save(current);
    stateRef.current = { ...stateRef.current, batchState: current };
    setBatchState(current);
    persistShared(sharedDataStore.saveBatches(current));
  }

  function openBatch(id: string | null, origin: "calendar" | "checks" | null = shell.destination === "calendar" ? "calendar" : showChecks ? "checks" : null) {
    if (id && id !== openBatchId && beforeBatchReplace.current?.() === false) return;
    if (id) {
      batchReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (origin === "calendar") calendarReturnScroll.current = document.getElementById("main-content")?.scrollTop ?? 0;
      if (origin === "calendar" && !navigate("batches")) return;
      setDetailOrigin(origin);
      setOpenBatchId(id);
    } else {
      if (detailOrigin === "calendar") navigate("calendar");
      if (detailOrigin === "checks") setShowChecks(true);
      requestAnimationFrame(() => {
        const heading = document.querySelector<HTMLElement>(detailOrigin === "calendar" ? ".calendar-screen h1" : detailOrigin === "checks" ? ".design-checks-view h1" : "#batch-overview-heading");
        (batchReturnFocus.current?.isConnected ? batchReturnFocus.current : heading)?.focus({ preventScroll: true });
        const main = document.getElementById("main-content");
        if (detailOrigin === "calendar" && main) main.scrollTop = calendarReturnScroll.current;
      });
    }
    setShowPhoneDetail(id !== null);
  }

  function openChecks() {
    if (!navigate("batches")) return;
    setShowChecks(true);
  }

  function saveBatch(next: Batch) {
    updateBatch(next.id, () => next);
  }

  function completeCheck(batchId: string, checkId: string) {
    const batch = stateRef.current.batchState.batches.find(({ id }) => id === batchId);
    const check = batch?.checks.find(({ id }) => id === checkId);
    if (!batch || batch.status !== "active" || !check || check.lastCompletedDate === localDate()) return;
    const next = completeBatchCheck(batch, checkId, localDate(), createClientId());
    saveBatch(next);
    setAnnouncement({ message: `Check completed · next due ${shortDate(next.checks.find(({ id }) => id === checkId)!.nextDueDate)}` });
  }

  function updateBatch(id: string, update: (batch: Batch) => Batch) {
    const current = stateRef.current.batchState;
    if (!current.batches.some((batch) => batch.id === id)) return;
    saveBatches({ ...current, batches: current.batches.map((batch) => batch.id === id ? update(batch) : batch) });
  }

  function persistShared(operation: Promise<void>) {
    void operation.catch(() => undefined).finally(() => setStorageStatus(sharedDataStore.getStatus()));
  }

  function applySharedSnapshot(snapshot: SharedSnapshot) {
    // Keep the editor mounted, but accept newer collections before a draft saves.
    const nextShell = profileDraft.dirty.current || startDraft.dirty.current
      ? { ...snapshot.shell, destination: stateRef.current.shell.destination }
      : snapshot.shell;
    const batches = updateBatchDates(discardExpiredBatches(snapshot.batchState, Date.now()));
    if (beforeBatchReplace.current?.(batches.batches) === false) {
      setStorageStatus({ ...sharedDataStore.getStatus(), state: "problem", message: "Shared data was not loaded because it would discard unsaved batch work. Finish your draft, then reload the shared folder in Settings." });
      return;
    }
    if (webStorage.current === "fallback") {
      browserShellStore.save(nextShell);
      browserProfileStore.save(snapshot.profileState);
      browserBatchStore.save(batches);
    }
    stateRef.current = { shell: nextShell, profileState: snapshot.profileState, batchState: batches };
    setShell(nextShell);
    setProfileState(snapshot.profileState);
    setBatchState(batches);
  }

  function applySharedResult(result: SharedStorageResult) {
    setStorageStatus(result.status);
    if (result.snapshot) applySharedSnapshot(result.snapshot);
  }

  async function chooseSharedLocation() {
    applySharedResult(await sharedDataStore.chooseLocation(stateRef.current, browserHadData.current));
  }

  async function reloadSharedLocation() {
    applySharedResult(await sharedDataStore.reload());
  }

  async function resolveSharedMigration(choice: "shared" | "device") {
    applySharedResult(await sharedDataStore.resolveMigration(choice, stateRef.current));
  }

  function handleProfile(profile: FermentationProfile) {
    const exists = profileState.profiles.some(({ id }) => id === profile.id);
    saveProfiles(exists ? updateProfile(profileState, profile) : addProfile(profileState, profile));
  }

  if (!webReady) return <p className="app-loading" role="status">Loading saved data…</p>;

  return (
    <div className={`app-shell new-design${openBatchId && showPhoneDetail ? " has-open-batch" : ""}${editingProfileId && shell.destination === "profiles" ? " profile-editor-shell" : ""}`}>
      <a className="design-skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <div className="brand">
          <StationLogo />
          <div><strong>FermentStation</strong></div>
        </div>
        <nav aria-label="Primary navigation" className="navigation">
          {(["today", "checks", "calendar", "profiles"] as const).map((destination) => (
            <button
              aria-label={destination === "checks" ? "Checks" : labels[destination]}
              aria-current={(destination === "checks" ? showChecks : !showChecks && (shell.destination === destination || destination === "today" && shell.destination === "batches")) ? "page" : undefined}
              className={`nav-${destination}`}
              key={destination}
              onClick={() => destination === "checks" ? openChecks() : navigate(destination)}
              type="button"
            >
              <span className="nav-mark" aria-hidden="true">{destination === "checks" ? <DesignIcon name="check" /> : <NavIcon destination={destination} />}</span>
              <span className="nav-word">{destination === "checks" ? "Checks" : labels[destination]}</span>
              {destination === "today" && <span className="design-nav-count">{batchState.batches.length}</span>}
            </button>
          ))}
        </nav>
        <div className="design-sidebar-bottom">
          <button aria-label="Home — station information" className="design-account" onClick={() => showDialog({ kind: "info" })} type="button"><span className="design-avatar"><DesignIcon name="user" /></span><span>Home</span><span aria-hidden="true">›</span></button>
        </div>
      </aside>

      <div className="content-shell">
        <header className="design-topbar">
          <button aria-label="Open station information" className="utility-circle station-identity" onClick={() => showDialog({ kind: "info" })} type="button"><StationLogo /></button>
          <div className="design-topbar-copy"><p>{formatToday()}</p></div>
          <button aria-label="Open calendar" className="design-date-chip" onClick={() => navigate("calendar")} type="button"><NavIcon destination="calendar" /><span>{shortDate(localDate())}</span></button>
          <div className="design-topbar-actions">
            <button aria-label="View batch checks" className="utility-circle" onClick={openChecks} type="button"><DesignIcon name="bell" /></button>
            <button aria-label="Settings" aria-current={shell.destination === "settings" ? "page" : undefined} className="utility-circle" onClick={() => navigate("settings")} type="button"><DesignIcon name="settings" /></button>
            <button aria-label="Start a batch" className="batch-fab primary-action" onClick={() => showDialog({ kind: "start" })} type="button"><DesignIcon name="plus" /><span>Start a batch</span></button>
          </div>
        </header>
        {webStorageError && <section role="alert" className="storage-warning">
          <strong>Changes may not be saved on this device.</strong>{" "}
          Export a backup from Settings before closing the app.
          {shell.destination !== "settings" && <button onClick={() => navigate("settings")} type="button">Open backup settings</button>}
          {webStorage.current === "indexeddb" && <button type="button" onClick={() => setWebRetry((value) => value + 1)}>Retry saving</button>}
          {webStorage.current === "failed" && <button type="button" onClick={retryWebLoad}>Retry loading</button>}
        </section>}
        {shell.destination !== "settings" && ["problem", "conflict", "migration"].includes(storageStatus.state) && <section className="storage-warning" role="alert">
          <strong>{storageStatus.state === "migration" ? "Choose which storage data to keep." : "Shared storage needs attention."}</strong>
          <p>{storageStatus.message}</p><button onClick={() => navigate("settings")} type="button">Review data storage</button>
        </section>}
        {showIosGuide && (
          <section className="ios-install-guide" aria-labelledby="ios-install-title">
            <button type="button" className="ios-install-dismiss" aria-label="Dismiss install guide" onClick={() => {
              setShowIosGuide(false);
              try { localStorage.setItem(iosGuideDismissedKey, "true"); } catch { /* Dismiss for this session. */ }
            }}>✕</button>
            <p className="eyebrow">Install on iPhone</p>
            <h2 id="ios-install-title">Add FermentStation to your Home Screen</h2>
            <p>Keep your fermentation journal handy and open it like an app.</p>
            <ol>
              <li>Tap the <strong>Share</strong> button (square with the arrow) at the bottom of Safari.</li>
              <li>Choose <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> — FermentStation opens full screen, like a real app.</li>
            </ol>
            <p>Install first: data entered in a Safari tab will not transfer to the Home Screen app because their storage is separate.</p>
          </section>
        )}
        <main className="main-content" id="main-content" tabIndex={-1}>
            <section className="today-screen" hidden={shell.destination === "calendar" || shell.destination === "settings"}>
              <BatchView
                visible={shell.destination !== "calendar" && shell.destination !== "settings"}
                batches={batchState.batches}
                beforeBatchReplace={beforeBatchReplace}
                mode={shell.destination === "today" ? "today" : "batches"}
                pane={showChecks ? "checks" : shell.destination === "profiles" ? "profiles" : "batches"}
                showPhoneDetail={showPhoneDetail}
                backLabel={detailOrigin === "calendar" ? "Calendar" : showChecks ? "Checks" : "batches"}
                onObservationAdded={() => setAnnouncement({ message: "Observation added" })}
                profilePane={shell.destination === "profiles" && <section className="profiles-screen" aria-label="Fermentation profiles">
                  {!editingProfileId && <div className="design-view-heading"><h1>Fermentation profiles</h1><p>The methods, inputs, and guidance behind your batches.</p></div>}
                  <Profiles draft={profileDraft} formulaTerms={shell.formulaTerms} profiles={profileState.profiles} onDelete={(id) => saveProfiles(deleteProfile(profileState, id))} onSave={handleProfile} onEditingChange={setEditingProfileId} onView={(profile) => showDialog({ kind: "profile", profile })} />
                </section>}
                onDialog={showDialog}
                batchListVersion={batchListVersion}
                onNavigate={navigate}
                onOpen={openBatch}
                onSelect={setOpenBatchId}
                openBatchId={openBatchId}
                onChange={saveBatch}
                onUpdate={updateBatch}
                onComplete={completeCheck}
                onDelete={(id) => { if (beforeBatchReplace.current?.() !== false) saveBatches(deleteBatch(batchState, id, Date.now())); }}
                profiles={profileState.profiles}
                units={shell.units}
              />
            </section>
          <section className="calendar-screen" aria-label="Fermentation calendar" hidden={shell.destination !== "calendar"}>
              <div className="screen-head">
                <div>
                  <p className="eyebrow">Your batch schedule</p>
                  <h1 tabIndex={-1}>Calendar</h1>
                  <p className="screen-intro">Check dates and finish dates. Choose a scheduled day to open its batch.</p>
                </div>
              </div>
              <CalendarView batches={batchState.batches} onOpen={(id) => openBatch(id, "calendar")} />
          </section>
          {shell.destination === "settings" ? (
            <section className="settings-screen" aria-label="Settings">
              <div className="screen-head">
                <div>
                  <h1>Settings</h1>
                  <p className="screen-intro">Preferences, backups, and recovery for your local journal. Shared folders and file transfers stay under your control.</p>
                </div>
              </div>
            <SettingsView
              batchState={batchState}
              formulaTerms={shell.formulaTerms}
              preferences={shell}
              profileState={profileState}
               onFormulaTermsChange={(formulaTerms) => {
                 browserHadData.current = true;
                const next = { ...shell, formulaTerms };
                 if (webStorage.current === "fallback") browserShellStore.save(next);
                 setShell(next);
                 persistShared(sharedDataStore.saveShell(next));
               }}
               onPreferencesChange={updatePreferences}
               onImport={(profiles, importedBatches) => {
                 saveProfiles(profiles);
                 saveBatches(importedBatches);
               }}
                 onRestoreBatch={(id) => {
                   const next = restoreBatch(stateRef.current.batchState, id, Date.now());
                   saveBatches(next);
                   return next.batches.some((batch) => batch.id === id);
                 }}
                storageStatus={storageStatus}
                onChooseStorage={chooseSharedLocation}
                onReloadStorage={reloadSharedLocation}
                onResolveStorage={resolveSharedMigration}
              />
            </section>
          ) : null}
        </main>
      </div>
      {dialog && <StationDialog mode={dialog.kind} title={dialog.kind === "start" ? "Start a batch" : dialog.kind === "profile" ? dialog.profile.name : dialog.kind === "dates" ? "Batch dates" : dialog.kind === "inputs" ? "Profile inputs" : "Your fermentation station"} returnFocus={dialogTrigger.current} onClose={closeDialog}>
        {dialog.kind === "start" && <StartBatchForm profiles={profileState.profiles} initialProfile={dialog.profile} onProfiles={() => navigate("profiles")} onDirty={() => { startDraft.dirty.current = true; }} onCancel={closeDialog} onCreate={(batch) => {
          if (beforeBatchReplace.current?.() === false || !profileDraft.confirmDiscard()) return;
          profileDraft.dirty.current = false;
          startDraft.dirty.current = false;
          const current = stateRef.current.batchState;
          saveBatches({ ...current, batches: [...current.batches, batch] });
          navigate("batches");
          setBatchListVersion((version) => version + 1);
          openBatch(batch.id);
          setDetailOrigin(null);
          setAnnouncement({ message: `Batch started · ${batch.name}` });
          requestAnimationFrame(() => document.querySelector<HTMLElement>(".design-detail")?.focus({ preventScroll: true }));
        }} />}
        {dialog.kind === "profile" && <ProfileOverview profile={dialog.profile} onStart={() => showDialog({ kind: "start", profile: dialog.profile })} />}
        {dialog.kind === "dates" && <div className="station-dialog-body"><dl><dt>Start date</dt><dd>{shortDate(dialog.batch.startDate)}</dd><dt>Finish date</dt><dd>{dialog.batch.finishDate ? shortDate(dialog.batch.finishDate) : "Not set"}</dd><dt>Batch status</dt><dd>{statusLabel(dialog.batch.status)}</dd></dl><p>A batch becomes ready on its finish date. Moving it to the fridge slows fermentation.</p></div>}
        {dialog.kind === "inputs" && <div className="station-dialog-body"><p>{profileInputsText(dialog.batch.profileSnapshot)}</p><h3>Profile guidance</h3><p><RichProfileText value={dialog.batch.profileSnapshot.guidance.join(" ") || "No guidance defined yet."} /></p></div>}
        {dialog.kind === "info" && <div className="station-dialog-body"><p>A local fermentation journal for tracking household fermentation batches.</p><h3>Try it out</h3><p>Filter and search batches, open batch details, complete a check, or add an observation. Start a batch from any fermentation profile.</p><h3>Your data</h3><p>Data is saved on this device. Manage backups, shared folders, and credits in <button className="station-text-action" onClick={() => navigate("settings")} type="button">Settings</button>.</p></div>}
      </StationDialog>}
      <div aria-atomic="true" aria-live="polite" className="sr-only" role={announcement ? "status" : undefined}>{announcement?.message}</div>
      <div aria-hidden="true" className="design-toast" hidden={!announcement}>{announcement?.message}</div>
    </div>
  );
}

function formatToday() {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", month: "long", day: "numeric" })
    .format(new Date(`${localDate()}T12:00:00`)).replace(/^(\w+) /, "$1, ");
}

function validFormulaTerm(term: string) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(term);
}

interface SettingsViewProps {
  batchState: BatchState;
  formulaTerms: string[];
  preferences: ShellPreferences;
  profileState: ReturnType<typeof createProfileState>;
  onFormulaTermsChange(formulaTerms: string[]): void;
  onPreferencesChange(preferences: ShellPreferences, requestNotificationPermission?: boolean): void;
  onImport(profiles: ReturnType<typeof createProfileState>, batches: BatchState): void;
  onRestoreBatch(id: string): boolean;
  storageStatus: SharedStorageStatus;
  onChooseStorage(): Promise<void>;
  onReloadStorage(): Promise<void>;
  onResolveStorage(choice: "shared" | "device"): Promise<void>;
}

function SettingsView({ batchState, formulaTerms, preferences, profileState, onFormulaTermsChange, onPreferencesChange, onImport, onRestoreBatch, storageStatus, onChooseStorage, onReloadStorage, onResolveStorage }: SettingsViewProps) {
  const [message, setMessage] = useState("");
  const [exchangeError, setExchangeError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [operation, setOperation] = useState<{ area: "storage" | "exchange"; label: string } | null>(null);
  const operationInProgress = useRef(false);
  const [pendingImport, setPendingImport] = useState<ArchiveImport | null>(null);
  const currentImport = pendingImport && refreshArchiveCollisions(pendingImport, profileState, batchState);
  const importInput = useRef<HTMLInputElement>(null);
  const collisionHeading = useRef<HTMLHeadingElement>(null);
  const [showDeletedBatches, setShowDeletedBatches] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [terms, setTerms] = useState(formulaTerms);
  const [newTerm, setNewTerm] = useState("");
  const [termError, setTermError] = useState("");
  const [termErrorSource, setTermErrorSource] = useState<"new" | "terms">("new");
  const [termMessage, setTermMessage] = useState("");
  const dataChoicePending = !!operation || !!pendingImport;
  const storageLabels: Record<SharedStorageStatus["state"], string> = {
    unavailable: "Device storage", unconfigured: "No shared folder", ready: "Folder connected",
    migration: "Choose a data source", problem: "Storage needs attention", conflict: "Conflicting files preserved",
  };
  useEffect(() => {
    if (pendingImport) collisionHeading.current?.focus();
  }, [pendingImport]);

  function finishImport(strategy: "local" | "archive" | "cancel") {
    if (!currentImport) return;
    if (strategy !== "cancel") {
      const resolved = resolveArchiveCollisions(currentImport, strategy);
      onImport(resolved.profileState, resolved.batchState);
    }
    setPendingImport(null);
    setMessage(strategy === "cancel" ? "Import canceled. Existing data unchanged." : `Archive imported with ${strategy === "local" ? "local records kept" : "archive records used"} for collisions.`);
    requestAnimationFrame(() => importInput.current?.focus({ preventScroll: true }));
  }

  async function runOperation(area: "storage" | "exchange", label: string, work: () => Promise<void>) {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setOperation({ area, label });
    if (area === "exchange") { setMessage(""); setExchangeError(""); }
    else setStorageError("");
    try {
      await work();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (area === "exchange") setExchangeError(`Transfer failed: ${detail}. Your existing data has not been changed. Try again.`);
      else setStorageError(`Storage action failed: ${detail}. Choose a folder or reload to try again.`);
    } finally {
      operationInProgress.current = false;
      setOperation(null);
    }
  }

  function formulaTermError(next: string[]) {
    if (next.length === 0) return "At least one formula term is required.";
    if (next.some((term) => !validFormulaTerm(term))) {
      return "Formula terms must start with a letter and use only letters, numbers, or underscores.";
    }
    if (new Set(next).size !== next.length) return "Formula terms must be unique.";
    return "";
  }

  function addFormulaTerm() {
    setTermMessage("");
    setTermErrorSource("new");
    const next = [...terms, newTerm.trim()];
    const error = formulaTermError(next);
    if (error) return setTermError(error);
    setTerms(next);
    setNewTerm("");
    setTermError("");
  }

  function saveFormulaTerms() {
    setTermMessage("");
    setTermErrorSource("terms");
    const error = formulaTermError(terms);
    if (error) return setTermError(error);
    onFormulaTermsChange(terms);
    setTermError("");
    setTermMessage("Formula terms saved on this device.");
  }

  async function downloadArchive() {
    const bytes = await createArchive(profileState, batchState);
    if (isNativeTransferAvailable()) {
      await shareNativeFile(bytes, `fermentstation-${localDate()}.zip`, "Export FermentStation archive");
      setMessage("Archive ready to share or save.");
      return;
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fermentstation-${localDate()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Archive exported locally.");
  }

  async function downloadJournal() {
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
    if (isNativeTransferAvailable()) {
      await shareNativeFile(new TextEncoder().encode(journal), `fermentstation-journal-${localDate()}.txt`, "Export FermentStation journal");
      setMessage("Journal ready to share or save.");
      return;
    }
    const url = URL.createObjectURL(new Blob([journal], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fermentstation-journal-${localDate()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Journal exported locally.");
  }

  async function importBytes(bytes: Uint8Array) {
    const imported = await importArchive(bytes, profileState, batchState);
    setPendingImport(imported.collisions.length > 0 ? imported : null);
    if (imported.collisions.length > 0) {
      setMessage("Import paused. Resolve the listed identifier collisions before changing local data.");
    } else {
      onImport(imported.profileState, imported.batchState);
      setMessage("Archive imported.");
    }
  }

  async function uploadArchive(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await runOperation("exchange", "Reading and checking archive…", async () => {
      await importBytes(new Uint8Array(await file.arrayBuffer()));
    });
    input.value = "";
  }

  async function pickArchive() {
    const bytes = await pickNativeArchive();
    if (bytes) await importBytes(bytes);
  }

  return (
    <section className="settings" aria-label="Local backup and transfer">
      <section className="settings-card bowed settings-preferences" aria-labelledby="preferences-heading">
        <div className="settings-card-heading"><span className="settings-emblem"><DesignIcon name="settings" /></span><h2 id="preferences-heading">Household preferences</h2></div>
        <div className="setting-body"><b>Units</b><p>Readouts for temperature and volume.</p></div>
        <div className="toggle-list" aria-label="Units" role="group">
          <button aria-pressed={preferences.units === "metric"} className="toggle-row" onClick={() => onPreferencesChange({ ...preferences, units: "metric" })} type="button">°C / L</button>
          <button aria-pressed={preferences.units === "imperial"} className="toggle-row" onClick={() => onPreferencesChange({ ...preferences, units: "imperial" })} type="button">°F / qt</button>
        </div>
        <p>Show computed suggested values on timeline entries.</p>
        <div className="toggle-list">
          <button aria-checked={preferences.suggestions} className="toggle-row" onClick={() => onPreferencesChange({ ...preferences, suggestions: !preferences.suggestions })} role="switch" type="button">
            <span className="toggle-avatar"><DesignIcon name="sparkles" /></span><span className="toggle-label">Suggestions</span><span className="toggle-switch" />
          </button>
        </div>
        <p>Preferences save automatically. Formula terms are saved separately below.</p>
      </section>
      <section className="settings-card bowed settings-notifications" aria-labelledby="notifications-heading">
        <div className="settings-card-heading"><span className="settings-emblem"><DesignIcon name="bell" /></span><h2 id="notifications-heading">Notifications</h2></div>
        <p>Choose alerts for due checks, ready batches, both, or neither.</p>
        <div className="toggle-list" aria-label="Notifications" role="group">
          {([["all", "All"], ["checks", "Checks"], ["ready", "Ready"], ["off", "Off"]] as const).map(([mode, label]) => (
            <button aria-pressed={preferences.notificationMode === mode} className="toggle-row" key={mode} onClick={() => onPreferencesChange({ ...preferences, notificationMode: mode }, true)} type="button">{label}</button>
          ))}
        </div>
        <p>Scheduled alerts require the Android app and notification permission. Each batch can also be muted in its details.</p>
      </section>
      <section className="settings-card bowed settings-storage" aria-labelledby="data-storage-heading">
        <div className="settings-card-heading"><span className="settings-emblem"><DesignIcon name="jar" /></span><h2 id="data-storage-heading">Data storage</h2></div>
        <div aria-atomic="true" className="settings-storage-status" role={storageStatus.state === "problem" || storageStatus.state === "conflict" ? "alert" : "status"}>
          <strong className="settings-state-label">{storageLabels[storageStatus.state]}</strong>
          <p>{storageStatus.message}</p>
        </div>
        <p className="settings-location">Shared folder: {storageStatus.location ?? "Not selected"}</p>
        <div className="form-actions">
          {storageStatus.state !== "unavailable" && <button className="primary-action" disabled={dataChoicePending} onClick={() => void runOperation("storage", "Opening folder selection…", onChooseStorage)} type="button">Choose folder</button>}
          {storageStatus.location && <button disabled={dataChoicePending} onClick={() => void runOperation("storage", "Reloading shared folder…", onReloadStorage)} type="button">Reload from shared folder</button>}
        </div>
        {storageStatus.state === "migration" && <div className="settings-recovery">
          <h3>Choose which data to keep</h3>
          <p>Both this device and the folder contain data. Export a ZIP backup before choosing; these copies will not be merged.</p>
          <p>Use shared folder data replaces this device's current records and preferences. Use this device's data replaces the folder's records; its previous files are backed up in that folder.</p>
          <div className="form-actions">
            <button disabled={dataChoicePending} onClick={() => void runOperation("storage", "Using shared folder data…", () => onResolveStorage("shared"))} type="button">Use shared folder data</button>
            <button disabled={dataChoicePending} onClick={() => void runOperation("storage", "Using this device's data…", () => onResolveStorage("device"))} type="button">Use this device's data</button>
          </div>
        </div>}
        {storageStatus.conflicts.length > 0 && <div className="settings-recovery">
          <h3>Preserved conflict files</h3>
          <p>Review these files in your shared folder before removing any copy. Reload after resolving them outside the app.</p>
          <ul>{storageStatus.conflicts.map((path) => <li key={path}>{path}</li>)}</ul>
        </div>}
        <div aria-atomic="true" className="settings-live" role="status">{operation?.area === "storage" && <p className="notice">{operation.label}</p>}</div>
        <div aria-atomic="true" aria-live="assertive" className="settings-live" role={storageError ? "alert" : undefined}>{storageError && <p>{storageError}</p>}</div>
        {dataChoicePending && <p>Finish the current transfer or import choice before changing storage.</p>}
      </section>
      <section className="settings-card bowed settings-exchange" aria-labelledby="exchange-heading">
        <div className="settings-card-heading"><span className="settings-emblem"><DesignIcon name="book" /></span><h2 id="exchange-heading">Data exchange</h2></div>
        <p>Archives are explicit local exchange files. Live databases and app-private directories are never synchronized.</p>
        <p>Archives contain profiles, batches (including trash), and photos, up to 200 MB zipped (250 MB expanded). They do not include app settings such as destination, units, notifications, suggestions, or formula terms.</p>
        <div className="form-actions">
          <button className="primary-action" disabled={!!operation} onClick={() => void runOperation("exchange", "Preparing ZIP archive…", downloadArchive)} type="button">Export ZIP archive</button>
          {isNativeTransferAvailable() && <button disabled={dataChoicePending} onClick={() => void runOperation("exchange", "Choosing and checking archive…", pickArchive)} type="button">Choose ZIP from device</button>}
        </div>
        <label>Import ZIP archive <input accept=".zip,application/zip" disabled={dataChoicePending} onChange={uploadArchive} ref={importInput} type="file" /></label>
        <div aria-atomic="true" className="settings-live" role="status">{(operation?.area === "exchange" ? operation.label : message) && <p className="notice">{operation?.area === "exchange" ? operation.label : message}</p>}</div>
        <div aria-atomic="true" aria-live="assertive" className="settings-live" role={exchangeError ? "alert" : undefined}>{exchangeError && <p>{exchangeError}</p>}</div>
        {currentImport && <section className="settings-recovery" aria-labelledby="import-collisions-heading">
          <h3 id="import-collisions-heading" ref={collisionHeading} tabIndex={-1}>Identifier collisions</h3>
          <p>{currentImport.collisions.length > 0 ? "These identifiers already exist on this device." : "No matching identifiers remain on this device."} Keep local versions to retain your records, or use archive versions to replace the matching records. Other records from the archive will be added with either choice.</p>
          <ul aria-live="polite" aria-relevant="additions removals">{currentImport.collisions.map((collision) => <li key={`${collision.kind}-${collision.id}`}>{collision.kind}: {collision.id}</li>)}</ul>
          <div className="form-actions">
            <button disabled={!!operation} onClick={() => finishImport("local")} type="button">Keep local versions</button>
            <button disabled={!!operation} onClick={() => finishImport("archive")} type="button">Use archive versions</button>
            <button disabled={!!operation} onClick={() => finishImport("cancel")} type="button">Cancel import</button>
          </div>
        </section>}
        <div className="setting-row">
          <div className="setting-body"><h3>Journal export</h3><p>A readable plain-text copy of every active batch timeline, not a restorable backup.</p></div>
          <button className="setting-export" disabled={!!operation} onClick={() => void runOperation("exchange", "Preparing journal…", downloadJournal)} type="button">Export journal</button>
        </div>
      </section>
      <section className="settings-card bowed settings-trash" aria-labelledby="trash-heading">
        <div className="settings-card-heading"><span className="settings-emblem"><DesignIcon name="clock" /></span><h2 id="trash-heading">Recently deleted batches</h2></div>
        <p>Batches remain recoverable for seven days, then are permanently deleted. Restore timeline entries from their batch's timeline. Deleted profiles cannot be restored.</p>
          <button
            aria-controls="deleted-batches-panel"
            aria-expanded={showDeletedBatches}
            aria-label={showDeletedBatches ? "Close recently deleted batches" : "Open recently deleted batches"}
            className="settings-trash-toggle"
            onClick={() => setShowDeletedBatches(!showDeletedBatches)}
            type="button"
          >
            <span>{showDeletedBatches ? "Close recently deleted batches" : "Open recently deleted batches"}</span><span className="settings-count">{batchState.trash.length}</span>
          </button>
          <div className="deleted-batches-panel" hidden={!showDeletedBatches} id="deleted-batches-panel">
            {batchState.trash.length === 0 ? <p>No recently deleted batches.</p> : batchState.trash.map((batch) => (
              <div className="trash-item" key={batch.id}>
                <span>{batch.name}</span>
                <button aria-label={`Restore ${batch.name}`} disabled={dataChoicePending} onClick={() => {
                  const restored = onRestoreBatch(batch.id);
                  setRestoreMessage(restored ? `Batch restored · ${batch.name}` : `The seven-day recovery period for ${batch.name} has ended. This batch can no longer be restored.`);
                  document.querySelector<HTMLButtonElement>(".settings-trash-toggle")?.focus({ preventScroll: true });
                }} type="button">Restore</button>
              </div>
            ))}
          </div>
        <div aria-atomic="true" className="settings-live" role="status">{restoreMessage && <p className="notice">{restoreMessage}</p>}</div>
        {dataChoicePending && <p>Finish the current transfer or import choice before restoring a batch.</p>}
      </section>
      <section className="settings-card bowed formula-term-settings" aria-labelledby="formula-terms-heading">
        <div className="settings-card-heading"><span className="settings-emblem"><DesignIcon name="plus" /></span><h2 id="formula-terms-heading">Formula dropdown terms</h2></div>
        <p>These names are stored in the shared folder when configured and are not included in archives.</p>
        <p id="formula-term-help">Start with a letter; use letters, numbers, or underscores. Keep at least one unique term.</p>
        {terms.map((term, index) => (
          <div className="formula-term" key={index}>
            <label>Formula term {index + 1}<input aria-describedby={termError ? "formula-term-help formula-term-error" : "formula-term-help"} aria-invalid={termError && termErrorSource === "terms" && (!validFormulaTerm(term) || terms.indexOf(term) !== terms.lastIndexOf(term)) ? true : undefined} onChange={(event) => { setTerms(terms.map((value, termIndex) => termIndex === index ? event.target.value : value)); setTermMessage(""); setTermError(""); }} value={term} /></label>
            <button aria-label={`Remove formula term ${index + 1}: ${term}`} disabled={terms.length === 1} onClick={() => { setTerms(terms.filter((_, termIndex) => termIndex !== index)); setTermMessage(""); }} type="button">Remove</button>
          </div>
        ))}
        <div className="formula-term">
          <label>New formula term<input aria-describedby={termError ? "formula-term-help formula-term-error" : "formula-term-help"} aria-invalid={termError && termErrorSource === "new" ? true : undefined} onChange={(event) => { setNewTerm(event.target.value); setTermError(""); }} value={newTerm} /></label>
          <button onClick={addFormulaTerm} type="button">Add term</button>
        </div>
        <div aria-atomic="true" aria-live="assertive" className="settings-live" id="formula-term-error" role={termError ? "alert" : undefined}>{termError && <p>{termError}</p>}</div>
        <button className="primary-action" onClick={saveFormulaTerms} type="button">Save formula terms</button>
        <div aria-atomic="true" className="settings-live" role="status">{termMessage && <p className="notice">{termMessage}</p>}</div>
      </section>
      <section className="settings-card bowed settings-about" aria-labelledby="about-heading">
        <div className="settings-card-heading"><StationLogo /><h2 id="about-heading">About FermentStation</h2></div>
        <p>A local journal for household fermentation batches, observations, and recurring checks.</p>
        <p>FermentStation v1 concept · not production software.</p><span className="settings-version">v1.0-concept</span>
      </section>
      <section className="settings-card bowed settings-credits" aria-labelledby="credits-heading">
        <div className="settings-card-heading"><span className="settings-emblem"><DesignIcon name="leaf" /></span><h2 id="credits-heading">Credits and licenses</h2></div>
        <p>Unique by Rajesh Rajput. Original, unmodified web fonts are bundled for offline use, with the user's confirmed rights. <a href={`${import.meta.env.BASE_URL}fonts/unique/License.pdf`}>Unique end-user license</a>. System sans is the font-load and unsupported-character fallback.</p>
        <p>Legacy bundled font: Outfit © 2021 The Outfit Project Authors. <a href={`${import.meta.env.BASE_URL}new-design/OFL.txt`}>SIL Open Font License 1.1</a>. Not used by the current interface.</p>
        <p>Legacy bundled font: Sofia Sans Extra Condensed © 2019 The Sofia Sans Project Authors. <a href={`${import.meta.env.BASE_URL}new-design/SofiaSansExtraCondensed-OFL.txt`}>Sofia Sans Open Font License</a>. Not used by the current interface.</p>
        <PhotoCredits />
      </section>
    </section>
  );
}

function updateBatchDates(state: BatchState): BatchState {
  return {
    ...state,
    batches: state.batches.map((batch) => updateBatchForDate(batch, localDate())),
  };
}

interface BatchPickerProps {
  date: string;
  events: CalendarEvent[];
  onClose(): void;
  onOpen(id: string): void;
}

function BatchPicker({ date, events, onClose, onOpen }: BatchPickerProps) {
  const batchIds = [...new Set(events.map(({ batchId }) => batchId))];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || batchIds.length < 2) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const trigger = returnFocus.current;
    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [batchIds.length]);

  if (batchIds.length < 2) return null;

  return (
    <dialog aria-label={`Choose a batch for ${date}`} className="station-dialog bowed-clip upcoming-batch-picker" id={`upcoming-batch-picker-${date}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} ref={dialogRef}>
        <div className="station-dialog-heading">
          <div><p className="eyebrow">{shortDate(date)}</p><h2>Choose a batch</h2></div>
          <button aria-label="Close" className="utility-circle utility-circle-dark" onClick={onClose} type="button"><DesignIcon name="close" /></button>
        </div>
        {batchIds.map((batchId) => {
          const batchEvents = events.filter((event) => event.batchId === batchId);
          const batchName = batchEvents[0].batchName;
          return (
            <button aria-label={`Open ${batchName}`} className="upcoming-batch-choice" key={batchId} onClick={() => {
              // Release native modal inertness before handing the day trigger to openBatch.
              dialogRef.current?.close();
              returnFocus.current?.focus({ preventScroll: true });
              onClose();
              onOpen(batchId);
            }} type="button">
              <strong>{batchName}</strong>
              <span>{batchEvents.map((event) => event.label).join(" · ")}</span>
            </button>
          );
        })}
    </dialog>
  );
}

function CalendarView({ batches, onOpen }: { batches: Batch[]; onOpen(id: string): void }) {
  const [viewDate, setViewDate] = useState(() => new Date(`${localDate()}T12:00:00`));
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState(localDate);
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
    const date = new Date(year, month + offset, 1);
    setViewDate(date);
    setFocusDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`);
  }

  return (
    <div className="calendar-layout">
      <div className="calendar-panel bowed">
        <div className="calendar-head">
          <h2 aria-live="polite" aria-atomic="true">{monthLabel}</h2>
          <div className="calendar-nav">
            <button className="calendar-today" onClick={() => { setViewDate(new Date(`${today}T12:00:00`)); setFocusDate(today); }} type="button">Today</button>
            <button aria-label="Previous month" className="utility-circle utility-circle-dark" onClick={() => shiftMonth(-1)} type="button"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <button aria-label="Next month" className="utility-circle utility-circle-dark" onClick={() => shiftMonth(1)} type="button"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
          </div>
        </div>
        <div className="calendar-grid" role="grid" aria-label={monthLabel} onKeyDown={(event) => {
          const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-date]");
          if (!cell) return;
          const day = Number(cell.dataset.date!.slice(-2));
          const weekday = (leadingDays + day - 1) % 7;
          const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday }[event.key];
          if (offset === undefined) return;
          event.preventDefault();
          const nextDay = Math.max(1, Math.min(daysInMonth, day + offset));
          const nextDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
          setFocusDate(nextDate);
          const nextCell = event.currentTarget.querySelector<HTMLElement>(`[data-date="${nextDate}"]`);
          (nextCell?.querySelector("button") ?? nextCell)?.focus({ preventScroll: true });
        }}>
          <div className="calendar-weekdays" role="row">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span role="columnheader" key={day}>{day}</span>)}
          </div>
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => <div className="calendar-week" role="row" key={week}>{cells.slice(week * 7, week * 7 + 7).map((cell, index) => {
            if (!cell.date) return <div aria-label="Outside this month" className="calendar-day other" role="gridcell" key={`leading-${index}`} />;
            const dateValue = cell.date;
            const batchIds = [...new Set(cell.events.map(({ batchId }) => batchId))];
            const canChooseBatch = batchIds.length > 1;
            const contents = <>
              <span className="calendar-day-number">{Number(cell.date.slice(-2))}</span>
              {cell.events.length > 0 && <span aria-hidden="true" className="calendar-markers">{(["check", "finish"] as const).filter((kind) => cell.events.some((event) => event.kind === kind)).map((kind) => <i className={`event-${kind}`} key={kind} />)}</span>}
              {cell.events.length > 0 && <span className="sr-only" id={`calendar-events-${dateValue}`}>{cell.events.map((event) => `${event.batchName}: ${event.label}`).join(". ")}</span>}
            </>;
            return (
              <div
                aria-label={cell.events.length ? undefined : cell.date}
                aria-current={dateValue === today ? "date" : undefined}
                aria-selected={dateValue === selectedDate}
                className={`calendar-day${dateValue === today ? " today" : ""}${cell.events.length ? " has-events" : ""}${dateValue === selectedDate ? " selected" : ""}`}
                data-date={dateValue}
                key={dateValue}
                onFocus={() => setFocusDate(dateValue)}
                role="gridcell"
                tabIndex={cell.events.length || focusDate !== dateValue ? -1 : 0}
              >
                {cell.events.length ? (
                  <button
                    aria-controls={canChooseBatch ? `upcoming-batch-picker-${dateValue}` : undefined}
                    aria-current={dateValue === today ? "date" : undefined}
                    aria-describedby={`calendar-events-${dateValue}`}
                    aria-expanded={canChooseBatch ? openDate === dateValue : undefined}
                    aria-haspopup={canChooseBatch ? "dialog" : undefined}
                    aria-label={canChooseBatch ? `Choose a batch for ${dateValue}` : `Open ${cell.events[0].batchName} for ${dateValue}`}
                    className="calendar-day-button"
                    onClick={() => { setSelectedDate(dateValue); if (canChooseBatch) setOpenDate(dateValue); else onOpen(batchIds[0]); }}
                    tabIndex={focusDate === dateValue ? 0 : -1}
                    type="button"
                  >
                    {contents}
                  </button>
                ) : contents}
              </div>
            );
          })}</div>)}
        </div>
        <div className="calendar-legend">
          <span className="legend-check"><i />Check date</span>
          <span className="legend-ready"><i />Finish date</span>
        </div>
        <p className="calendar-helper">Checks pause when a batch is ready or in the fridge. Finish dates stay visible.</p>
      </div>
      <div className="calendar-lists">
        <div>
          <div className="calendar-section-label"><h2>Upcoming dates</h2><span className="design-badge">Next {upcoming.length}</span></div>
          <div className="upcoming-list">
            {upcoming.length === 0 ? <p className="calendar-empty">No finish dates or checks scheduled.</p> : upcoming.map((event) => {
            const date = new Date(`${event.date}T12:00:00`);
            const isFinish = event.kind === "finish";
            return (
              <button aria-label={`Open ${event.batchName}: ${event.label}`} className="upcoming-item" key={`${event.batchId}-${event.kind}-${event.date}-${event.label}`} onClick={() => onOpen(event.batchId)} type="button">
                <time className="upcoming-date" dateTime={event.date}><b>{date.getDate()}</b><span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(date)}</span></time>
                <div className="upcoming-body"><b>{event.batchName}</b><p>{isFinish ? "Finish date" : event.label}</p></div>
                <span className={`calendar-status ${isFinish ? "ready" : "attention"}`}>{isFinish ? "Finish" : "Check"}</span>
              </button>
            );
            })}
          </div>
        </div>
        <div>
          <div className="calendar-section-label"><h2>Overdue</h2><span className="design-badge">{overdue.length} shown</span></div>
          <div className="upcoming-list">
            {overdue.length === 0 ? <p className="calendar-empty">No overdue checks.</p> : overdue.map((event) => {
              const date = new Date(`${event.date}T12:00:00`);
              return (
                <button aria-label={`Open ${event.batchName}: ${event.label}`} className="upcoming-item overdue-item" key={`${event.batchId}-${event.kind}-${event.date}-${event.label}`} onClick={() => onOpen(event.batchId)} type="button">
                  <time className="upcoming-date" dateTime={event.date}><b>{date.getDate()}</b><span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(date)}</span></time>
                  <div className="upcoming-body"><b>{event.batchName}</b><p>{event.label} · overdue</p></div>
                  <span aria-hidden="true" className="calendar-overdue-mark">!</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {openDate && <BatchPicker date={openDate} events={events.filter((event) => event.date === openDate)} onClose={() => setOpenDate(null)} onOpen={onOpen} />}
    </div>
  );
}

type BatchReplacementGuard = RefObject<((nextBatches?: Batch[]) => boolean) | null>;

interface BatchViewProps {
  beforeBatchReplace: BatchReplacementGuard;
  visible: boolean;
  onObservationAdded(): void;
  batches: Batch[];
  onDialog(dialog: StationDialogState): void;
  batchListVersion: number;
  mode: "today" | "batches";
  pane: "batches" | "checks" | "profiles";
  profilePane: ReactNode;
  showPhoneDetail: boolean;
  backLabel: string;
  profiles: FermentationProfile[];
  units: ShellPreferences["units"];
  onChange(batch: Batch): void;
  onUpdate(id: string, update: (batch: Batch) => Batch): void;
  onComplete(batchId: string, checkId: string): void;
  onDelete(id: string): void;
  onNavigate(destination: Destination): void;
  onOpen(id: string | null): void;
  onSelect(id: string): void;
  openBatchId: string | null;
}

type BatchListFilter = BatchFilter | "attention";

function compareScheduledChecks(left: { batch: Batch; check: Batch["checks"][number] }, right: { batch: Batch; check: Batch["checks"][number] }) {
  return left.check.nextDueDate.localeCompare(right.check.nextDueDate) || left.batch.name.localeCompare(right.batch.name) || left.check.name.localeCompare(right.check.name);
}

function ChecksView({ batches, onOpen, onComplete }: { batches: Batch[]; onOpen(id: string): void; onComplete(batchId: string, checkId: string): void }) {
  const today = localDate();
  const checks = batches.filter(({ status }) => status === "active").flatMap((batch) => batch.checks.map((check) => ({ batch, check })))
    .sort((left, right) => Number(left.check.lastCompletedDate === today) - Number(right.check.lastCompletedDate === today) || compareScheduledChecks(left, right));
  const due = checks.filter(({ check }) => check.nextDueDate <= today);
  const paused = batches.filter(({ status, checks }) => status !== "active" && checks.length > 0);
  return <section aria-label="Batch checks" className="design-checks-view">
    <div className="design-view-heading"><p className="eyebrow">Care for your cultures</p><h1 tabIndex={-1}>Your batch checks</h1><p>Complete a check here, or open its batch for notes and readings.</p></div>
    <div className="checks-summary bowed"><div><strong>{due.length}</strong><span>Due or overdue</span></div><div><strong>{paused.length}</strong><span>Paused batches</span></div></div>
    <div className="design-section-head"><h2>Scheduled checks</h2><span className="design-badge">{checks.length} checks</span></div>
    <div className="design-all-checks">{checks.map(({ batch, check }) => {
      const completed = check.lastCompletedDate === today;
      const overdue = !completed && check.nextDueDate < today;
      return <article className={`queue-card${completed ? " done" : overdue ? " overdue" : ""}`} key={`${batch.id}-${check.id}`}>
        <span className={`queue-icon${overdue ? " overdue" : ""}`} aria-hidden="true">{overdue ? "!" : <DesignIcon name={check.name.toLowerCase().includes("brine") ? "drop" : "leaf"} />}</span>
        <button aria-label={`Open ${batch.name} for ${check.name}`} className="design-check-copy" onClick={() => onOpen(batch.id)} type="button"><strong>{check.name}</strong><span>{batch.name} · {check.nextDueDate === today ? "Today" : `${overdue ? "Overdue" : "Due"} ${shortDate(check.nextDueDate)}`}</span>{completed && <span>Completed today</span>}</button>
        <button aria-label={`${completed ? "Completed" : "Complete"} ${check.name} for ${batch.name}`} className="design-check-complete" disabled={completed} onClick={(event) => { if (document.activeElement === event.currentTarget) (event.currentTarget.previousElementSibling as HTMLButtonElement)?.focus({ preventScroll: true }); onComplete(batch.id, check.id); }} type="button"><DesignIcon name="check" /></button>
      </article>;
    })}</div>
    {checks.length === 0 && <p className="design-empty-checks">No checks scheduled for your active batches.</p>}
    {checks.length > 0 && due.length === 0 && <p className="checks-caught-up">All caught up. You can still complete an upcoming check early.</p>}
    {paused.length > 0 && <section className="checks-paused" aria-labelledby="paused-checks-heading"><h2 id="paused-checks-heading">Paused checks</h2><p>Checks resume when a batch becomes active again.</p><div className="design-all-checks">{paused.map((batch) => <button aria-label={`Open paused batch ${batch.name}`} className="checks-paused-row" onClick={() => onOpen(batch.id)} key={batch.id} type="button"><span><strong>{batch.name}</strong><span>{batch.checks.map(({ name }) => name).join(" · ")}</span></span><span className="design-badge">{statusLabel(batch.status)} · paused</span></button>)}</div></section>}
  </section>;
}

function BatchView({ beforeBatchReplace, visible: workspaceVisible, batches, mode, pane, profilePane, showPhoneDetail, backLabel, onObservationAdded, profiles, units, onDialog, batchListVersion, onChange, onUpdate, onComplete, onDelete, onNavigate, onOpen, onSelect, openBatchId }: BatchViewProps) {
  const [filter, setFilter] = useState<BatchListFilter>("all");
  const [query, setQuery] = useState("");
  const [sorted, setSorted] = useState(false);
  useEffect(() => { setFilter("all"); setQuery(""); }, [batchListVersion]);
  const [openUpcomingDate, setOpenUpcomingDate] = useState<string | null>(null);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!openBatchId || !showPhoneDetail) return;
    if (detailRef.current) detailRef.current.scrollTop = 0;
    if (!window.matchMedia?.("(min-width: 1024px)").matches) detailRef.current?.focus({ preventScroll: true });
  }, [openBatchId, showPhoneDetail]);
  const filtered = filter === "attention"
    ? batches.filter((batch) => batch.status === "active" && dueBatchChecks(batch, localDate()).length > 0)
    : filterBatches(batches, filter);
  const visible = filtered.filter((batch) => `${batch.name} ${batch.profileSnapshot.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  if (sorted) visible.sort((left, right) => (left.finishDate || "9999").localeCompare(right.finishDate || "9999"));
  const openBatch = batches.find(({ id }) => id === openBatchId);
  const initializedSelection = useRef(false);
  useEffect(() => {
    if (!batches.length || initializedSelection.current) return;
    initializedSelection.current = true;
    if (!openBatchId) onSelect(batches[0].id);
  }, [batches, onSelect, openBatchId]);
  const dueChecks = prioritizeToday(batches, localDate()).flatMap((batch) => dueBatchChecks(batch, localDate()).map((check) => ({ batch, check })))
    .sort(compareScheduledChecks);
  const readyBatches = batches.filter(({ status }) => status === "ready");
  const today = localDate();
  const upcoming = calendarEvents(batches).filter(({ date }) => date >= today);
  const upcomingDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + offset);
    const dateValue = date.toISOString().slice(0, 10);
    return { date: dateValue, events: upcoming.filter((event) => event.date === dateValue) };
  });
  const selectedUpcomingEvents = upcomingDays.find(({ date }) => date === openUpcomingDate)?.events ?? [];

  function closeBatch() {
    // Release the responsive focus-within pane before restoring its hidden origin.
    if (detailRef.current?.contains(document.activeElement) && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onOpen(null);
  }

  return (
    <section className={`batches design-workspace${pane === "profiles" ? " profile-workspace" : ""}${openBatch && showPhoneDetail ? " design-selected" : ""}`} aria-label="Fermentation workspace">
      <div className="design-dashboard" key={pane}>
      {pane === "profiles" ? profilePane : pane === "checks" ? <ChecksView batches={batches} onOpen={onOpen} onComplete={onComplete} /> : <>
        <h1 id="batch-overview-heading" ref={overviewHeadingRef} tabIndex={-1} className="sr-only">My batches <span>{batches.length}</span></h1>
        <div className="design-search-row"><div className="design-search"><div className="dark-field design-search-box"><DesignIcon name="search" /><input aria-label="Search batches" autoComplete="off" onChange={(event) => setQuery(event.target.value)} placeholder="Search your batches" type="search" value={query} /></div><button aria-label="Sort batches by finish date" aria-pressed={sorted} className="utility-circle utility-circle-dark" onClick={() => setSorted(!sorted)} type="button"><DesignIcon name="sort" /></button></div><div className="batch-view-switch" role="group" aria-label="My batches view"><button aria-pressed={mode === "today"} onClick={() => onNavigate("today")} type="button">Overview</button><button aria-pressed={mode === "batches"} onClick={() => onNavigate("batches")} type="button">All batches</button></div></div>
        <section className="design-summary bowed" aria-label="Kitchen summary" hidden={mode !== "today"}>
          <div className="design-gauge"><strong>{batches.length}</strong><span>Total batches</span><small>{dueChecks.length} checks due</small></div>
          <div className="design-summary-label"><h2>Kitchen summary</h2><p>{readyBatches.length} ready to enjoy</p></div>
          <div className="design-summary-stats">{batchStatuses.map((status) => {
            const count = batches.filter((batch) => batch.status === status).length;
            return <div className="design-stat-row" key={status}><div>{statusLabel(status)}<span className="design-stat-number">{count}<span>/{batches.length}</span></span></div><div className="design-stat-track"><i style={{ width: `${batches.length ? count / batches.length * 100 : 0}%` }} /></div></div>;
          })}</div>
        </section>
        <div className="design-section-head"><h2>{mode === "today" ? "Batch overview" : "All batches"}</h2><span>{visible.length} shown</span></div>
        <div className="filter-row" role="group" aria-label="Filter batches by status">
          {(["all", ...batchStatuses] as BatchFilter[]).map((status) => <button aria-pressed={filter === status} key={status} onClick={() => setFilter(status)} type="button">{status === "all" ? "All" : statusLabel(status)}</button>)}
        </div>

      {profiles.length === 0 && <p className="notice">Restore or create a profile before starting a batch. <button className="station-text-action" onClick={() => onNavigate("profiles")} type="button">Open Profiles</button></p>}

      {visible.length === 0 ? (
        <section className="empty-state">
          <p>{batches.length === 0 ? "No batches yet." : query ? "No batches found." : "No batches match this status."}</p>
          <p>{query ? "Try another name or batch status." : "Start one from a fermentation profile when you are ready."}</p>
        </section>
      ) : (
        <section aria-label="Batch overview">
          <div className="batch-overview">
            {visible.map((batch) => <CompactBatchCard batch={batch} key={batch.id} onOpen={onOpen} selected={batch.id === openBatchId} units={units} />)}
          </div>
        </section>
      )}

      <section className="action-queue" aria-labelledby="action-queue-heading">
          <div className="design-section-head"><h2 id="action-queue-heading"><span className="sr-only">Action queue · </span>A little care today</h2><span className="design-badge">{dueChecks.length} checks</span></div>
          <div className="queue-grid">
            {dueChecks.map(({ batch, check }) => (
              <article className="queue-card attention" key={`${batch.id}-${check.id}`}>
                <span className={`queue-icon${check.overdue ? " overdue" : ""}`} aria-hidden="true">{check.overdue ? "!" : <DesignIcon name={check.name.toLowerCase().includes("brine") ? "drop" : "leaf"} />}</span>
                <button aria-label={`Open ${batch.name} for ${check.name}`} className="design-check-copy" onClick={() => onOpen(batch.id)} type="button"><strong>{check.name}</strong><span>{batch.name} · {check.overdue ? `Overdue ${shortDate(check.nextDueDate)}` : "Today"}</span></button>
                <button aria-label={`Complete ${check.name} for ${batch.name}`} className="design-check-complete" onClick={() => onComplete(batch.id, check.id)} type="button"><DesignIcon name="check" /></button>
              </article>
            ))}
          </div>
          {dueChecks.length === 0 && readyBatches.length === 0 && <p className="design-empty-checks">All caught up. Your next checks will appear here.</p>}
      </section>
      <div className="design-tip"><DesignIcon name="leaf" /><div><h3>Keep an eye on the temperature</h3><p>A temperature reading helps you notice how your kitchen affects each batch.</p></div></div>

      <details className="design-more-actions" open={moreActionsOpen}><summary onClick={(event) => { event.preventDefault(); setMoreActionsOpen((open) => !open); }}>{readyBatches.length > 0 ? `${readyBatches.length} ready · ` : ""}More batch actions</summary>
      <div hidden={!moreActionsOpen}>
        <button aria-pressed={filter === "attention"} className="design-quiet" onClick={() => setFilter(filter === "attention" ? "all" : "attention")} type="button">Active · attention</button>
        <div className="queue-grid">{readyBatches.map((batch) => <article className="queue-card ready" key={`ready-${batch.id}`}><span className="queue-icon" aria-hidden="true">✓</span><button aria-label={`Open ready batch ${batch.name}`} className="design-check-copy" onClick={() => onOpen(batch.id)} type="button"><strong>{batch.name} is ready</strong><span>Review the batch and choose its next status.</span></button></article>)}</div>
      {mode === "today" && (
        <section aria-labelledby="upcoming-heading" className="upcoming">
          <div className="section-label">
            <h2 id="upcoming-heading">Upcoming · next 7 days</h2>
            <a href="#calendar" onClick={(event) => { event.preventDefault(); onNavigate("calendar"); }}>Open calendar</a>
          </div>
          <div className="upcoming-strip">
            {upcomingDays.map(({ date: dateValue, events }) => {
              const date = new Date(`${dateValue}T12:00:00`);
              const batchIds = [...new Set(events.map(({ batchId }) => batchId))];
              const canChooseBatch = batchIds.length > 1;
              return (
                <button
                  aria-controls={canChooseBatch ? `upcoming-batch-picker-${dateValue}` : undefined}
                  aria-expanded={canChooseBatch ? openUpcomingDate === dateValue : undefined}
                  aria-haspopup={canChooseBatch ? "dialog" : undefined}
                  aria-label={canChooseBatch ? `Choose a batch for ${dateValue}` : undefined}
                  className={dateValue === today ? "today" : undefined}
                  key={dateValue}
                  onClick={() => {
                    if (canChooseBatch) return setOpenUpcomingDate((openDate) => openDate === dateValue ? null : dateValue);
                    setOpenUpcomingDate(null);
                    if (batchIds.length === 1) onOpen(batchIds[0]);
                  }}
                  type="button"
                >
                  <time dateTime={dateValue}><strong>{date.getDate()}</strong>{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date)}</time>
                  <div>{events.map((event) => <span className={`event-${event.kind}`} key={`${event.batchId}-${event.kind}-${event.label}`}>{event.label}</span>)}</div>
                </button>
              );
            })}
          </div>
          {openUpcomingDate && <BatchPicker date={openUpcomingDate} events={selectedUpcomingEvents} onClose={() => setOpenUpcomingDate(null)} onOpen={onOpen} />}
        </section>
      )}
      </div>
      </details>
      <PhotoCredits />
      </>}
      </div>
      <aside aria-label="Selected batch" className="design-detail" ref={detailRef} tabIndex={-1}>
        {openBatch ? <><div className="design-detail-top"><button aria-label={`Back to ${backLabel}`} className="utility-circle utility-circle-dark design-back" onClick={closeBatch} type="button"><DesignIcon name="back" /></button><h2>Batch details</h2><button aria-label="View batch dates" className="utility-circle utility-circle-dark" onClick={() => onDialog({ kind: "dates", batch: openBatch })} type="button"><NavIcon destination="calendar" /></button></div><BatchCard batch={openBatch} key={openBatch.id} beforeBatchReplace={beforeBatchReplace} visible={workspaceVisible} onChange={onChange} onUpdate={onUpdate} onComplete={onComplete} onObservationAdded={onObservationAdded} onDialog={onDialog} onDelete={onDelete} units={units} /></> : <div className="design-detail-empty"><DesignIcon name="jar" /><h2>Your batch details</h2><p>Choose a batch to see its progress and record an observation.</p></div>}
      </aside>
    </section>
  );
}

function CompactBatchCard({ batch, selected, units, onOpen }: { batch: Batch; selected: boolean; units: ShellPreferences["units"]; onOpen(id: string): void }) {
  const nextCheck = batch.status === "active" ? [...batch.checks].sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate))[0] : undefined;
  const latestPh = latestPhReading(batch);
  const day = batchDay(batch);
  const next = nextCheck ? `${nextCheck.name} · ${nextCheck.nextDueDate}` : batch.finishDate ? `Finish · ${batch.finishDate}` : "Review timeline";
  const isAttention = batch.status === "active" && dueBatchChecks(batch, localDate()).length > 0;
  const statusText = isAttention ? "Active · attention" : statusLabel(batch.status);
  return (
    <button aria-label={`Open ${batch.name}`} aria-pressed={selected} className={`design-batch-card bowed${selected ? " selected" : ""}`} style={{ "--batch-colour": profileVisual(batch.profileSnapshot).color } as CSSProperties} onClick={() => onOpen(batch.id)} type="button">
      <div className="design-batch-copy"><span className={`status status-${batch.status}`}>{statusText}</span><h3>{batch.name}</h3><p className="design-batch-profile">{batch.profileSnapshot.name}</p><BatchMeta batch={batch} units={units} /><div className="design-batch-bottom"><strong>{batch.status === "to-fridge" ? "Chilled" : `Day ${day}`}</strong>{batch.status !== "to-fridge" && batch.finishDate && <span>/ {Math.max(1, Math.round((Date.parse(batch.finishDate) - Date.parse(batch.startDate)) / 86_400_000))} days</span>}</div><p className="design-batch-next">{nextCheck ? `${nextCheck.name} · ${shortDate(nextCheck.nextDueDate)}` : batch.finishDate ? `Finish · ${shortDate(batch.finishDate)}` : "No finish date"}</p><span className="sr-only">{latestPh && `pH ${latestPh.value}.`} Next: {next}</span></div>
      <BatchPhoto batch={batch} />
    </button>
  );
}

interface BatchCardProps {
  beforeBatchReplace: BatchReplacementGuard;
  visible: boolean;
  onObservationAdded(): void;
  batch: Batch;
  onChange(batch: Batch): void;
  onUpdate(id: string, update: (batch: Batch) => Batch): void;
  onComplete(batchId: string, checkId: string): void;
  onDialog(dialog: StationDialogState): void;
  onDelete(id: string): void;
  units: ShellPreferences["units"];
}

type LoggerKind = "note" | "ph" | "temperature" | "status" | "photo";
type EditableTimelineEntry = Extract<TimelineEntry, { kind: LoggerKind }>;

function BatchCard({ beforeBatchReplace, batch, visible, onChange, onUpdate, onComplete, onObservationAdded, onDialog, onDelete, units }: BatchCardProps) {
  const [editing, setEditing] = useState<EditableTimelineEntry | null>(null);
  const [loggerKind, setLoggerKind] = useState<LoggerKind>("status");
  const [checkDrafts, setCheckDrafts] = useState<Record<string, string>>({});
  const [checkError, setCheckError] = useState("");
  const [checkErrorField, setCheckErrorField] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [addingCheck, setAddingCheck] = useState(false);
  const [newCheckName, setNewCheckName] = useState("");
  const [newCheckInterval, setNewCheckInterval] = useState("7");
  const [loggerModal, setLoggerModal] = useState(false);
  const [observationMode, setObservationMode] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [toolErrors, setToolErrors] = useState<FieldErrors>({});
  const [toolFeedback, setToolFeedback] = useState("");
  const managementRef = useRef<HTMLElement>(null);
  const addCheckRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const observationTrigger = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const modal = useRef(false);
  const revision = useRef(0);
  const operation = useRef(0);
  const abandonedSave = useRef(0);
  const dirty = useRef(false);
  const managementDrafts = useRef(new Set<string>());
  const basicObservation = loggerModal && observationMode;
  // The modal logger is a sheet, so its controls wear the field-on-black look; inline they stay on the white card.
  const sheetField = loggerModal ? "dark-field" : undefined;

  useEffect(() => {
    beforeBatchReplace.current = (nextBatches) => {
      const next = nextBatches?.find(({ id }) => id === batch.id);
      const losesObservation = !next || !!editing && !next.timeline.some(({ id }) => id === editing.id);
      const lostEditors = [...managementDrafts.current].filter((key) => !next ||
        key.startsWith("check:") && !next.checks.some(({ id }) => key === `check:${id}`) ||
        key.startsWith("calculation:") && !next.profileSnapshot.calculations.some(({ name }) => key === `calculation:${name}`) ||
        key === "inputs" && !batch.profileSnapshot.inputs.every(({ name }) => next.profileSnapshot.inputs.some((input) => input.name === name)));
      if ((losesObservation && dirty.current || lostEditors.length > 0) && !window.confirm("Discard unsaved batch work? Notes, selected photos and editor changes that have not been saved will be lost.")) return false;
      if (next) {
        for (const key of lostEditors) managementDrafts.current.delete(key);
        if (lostEditors.some((key) => key.startsWith("check:"))) setCheckDrafts((drafts) => Object.fromEntries(Object.entries(drafts).filter(([id]) => !lostEditors.includes(`check:${id}`))));
        if (losesObservation) { dirty.current = false; discardDraft(); }
      } else {
        dirty.current = false;
        managementDrafts.current.clear();
        revision.current++;
        operation.current++;
      }
      return true;
    };
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      if (!dirty.current && managementDrafts.current.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnOnUnload);
    return () => { beforeBatchReplace.current = null; window.removeEventListener("beforeunload", warnOnUnload); };
  }, [beforeBatchReplace, batch, editing]);

  function discardDraft() {
    if (dirty.current && !window.confirm("Discard this unsaved observation and its selected photo?")) return false;
    abandonedSave.current++;
    revision.current++;
    operation.current++;
    dirty.current = false;
    setEditing(null);
    setObservationMode(false);
    setCapturedPhoto(null);
    setPhotoError("");
    formRef.current?.reset();
    formRef.current?.querySelector("textarea")?.setCustomValidity("");
    return true;
  }

  function dismissLogger(restoreFocus = true) {
    modal.current = false;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    if (dialog) dialog.open = true;
    setLoggerModal(false);
    const trigger = returnFocus.current;
    if (restoreFocus && trigger?.isConnected && !trigger.closest("[hidden]") && (typeof trigger.checkVisibility !== "function" || trigger.checkVisibility({ checkVisibilityCSS: true }))) trigger.focus({ preventScroll: true });
  }

  useEffect(() => {
    mounted.current = true;
    const dialog = dialogRef.current!;
    return () => {
      mounted.current = false;
      modal.current = false;
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current!;
    // showModal rejects an already-open nonmodal dialog. Its queued close event
    // is ignored below once this same node has reopened.
    if (loggerModal) {
      if (dialog.open) dialog.close();
      dialog.showModal();
      dialog.scrollTop = 0;
      closeRef.current?.focus({ preventScroll: true });
    } else dialog.open = true; // inline: no show() autofocus or React open conflict
  }, [loggerModal]);

  useEffect(() => { if (!visible && modal.current) dismissLogger(false); }, [visible]);

  function showLogger(event: React.MouseEvent<HTMLButtonElement>) {
    returnFocus.current = event.currentTarget;
    if (!dirty.current && !editing && !capturedPhoto) {
      setObservationMode(true);
      setLoggerKind("note");
    }
    modal.current = true;
    setLoggerModal(true);
  }

  function revealLogger() {
    if (!modal.current) setManagementOpen(true);
    const form = formRef.current;
    const version = revision.current;
    const request = operation.current;
    requestAnimationFrame(() => {
      if (mounted.current && !modal.current && form && formRef.current === form && revision.current === version && operation.current === request && !form.closest("[hidden]")) revealDetailSection(form);
    });
  }

  function revealManagementSection(section: string) {
    if (managementOpen) return revealDetailSection(section);
    setManagementOpen(true);
    requestAnimationFrame(() => {
      if (mounted.current) revealDetailSection(section);
    });
  }

  function changeKind(kind: LoggerKind) {
    revision.current++;
    dirty.current = true;
    formRef.current?.querySelector("textarea")?.setCustomValidity("");
    setObservationMode(false);
    setLoggerKind(kind);
  }

  async function takePhoto() {
    changeKind("photo");
    setPhotoError("");
    const form = formRef.current;
    const version = revision.current;
    const request = ++operation.current;
    revealLogger();
    if (!isNativeCameraAvailable()) return;
    try {
      const photo = await captureNativePhoto();
      if (mounted.current && formRef.current === form && revision.current === version && operation.current === request) setCapturedPhoto(photo);
    } catch (error) {
      if (mounted.current && formRef.current === form && revision.current === version && operation.current === request) setPhotoError(`Camera unavailable: ${(error as Error).message}`);
    }
  }

  useEffect(() => {
    if (!editing) return;
    revealLogger();
  }, [editing]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let active = true;
    void listenForRestoredCameraPhoto((photo) => {
      if (!active) return;
      revision.current++;
      dirty.current = true;
      setObservationMode(false);
      setLoggerKind("photo");
      setCapturedPhoto(photo);
      revealLogger();
    }).then((remove) => { if (active) dispose = remove; else remove(); });
    return () => { active = false; dispose?.(); };
  }, []);

  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const originId = batch.id;
    const originEditing = editing;
    const originUnits = units;
    const originBasic = basicObservation;
    const abandonedVersion = abandonedSave.current;
    const version = revision.current;
    const request = ++operation.current;
    const kind = originEditing?.kind ?? loggerKind;
    const common = {
      id: originEditing?.id ?? createClientId(),
      date: String(data.get("date") ?? ""),
    };
    const context = String(data.get("text") ?? "").trim();
    const withContext = (next: Batch) => kind !== "note" && context
      ? addTimelineEntry(next, { id: createClientId(), date: common.date, kind: "note", text: context })
      : next;
    const finish = () => {
      if (!mounted.current || formRef.current !== form || revision.current !== version || operation.current !== request) return;
      revision.current++;
      dirty.current = false;
      setEditing(null);
      setLoggerKind("status");
      setObservationMode(false);
      setCapturedPhoto(null);
      setPhotoError("");
      form.reset();
      if (modal.current) dismissLogger();
      if (originBasic) onObservationAdded();
    };
    if (originBasic) {
      const text = String(data.get("text") ?? "").trim();
      const raw = String(data.get("value") ?? "");
      const textarea = form.elements.namedItem("text") as HTMLTextAreaElement;
      if (!text && raw === "") {
        textarea.setCustomValidity("Add a note or a temperature reading.");
        textarea.reportValidity();
        return;
      }
      if (!form.reportValidity()) return;
      const entries: TimelineEntry[] = [];
      if (text) entries.push({ ...common, kind: "note", text });
      if (raw !== "") entries.push({ id: createClientId(), date: common.date, kind: "temperature", value: originUnits === "imperial" ? (Number(raw) - 32) * 5 / 9 : Number(raw) });
      onUpdate(originId, (current) => entries.reduce((next, entry) => addTimelineEntry(next, entry), current));
      finish();
      return;
    }
    let entry: TimelineEntry;
    if (kind === "status") {
      entry = { ...common, kind, status: String(data.get("status")) as BatchStatus };
    } else if (kind === "ph") {
      entry = { ...common, kind, value: Number(data.get("value")) };
    } else if (kind === "temperature") {
      const value = Number(data.get("value"));
      entry = { ...common, kind, value: originUnits === "imperial" ? (value - 32) * 5 / 9 : value };
    } else if (kind === "photo") {
      const file = (form.elements.namedItem("photo") as HTMLInputElement).files?.[0];
      const current = originEditing?.kind === "photo" ? originEditing : undefined;
      if ((!file || file.size === 0) && !capturedPhoto && !current) return;
      if (file && file.size > 0 && !file.type.startsWith("image/")) return;
      let selected = capturedPhoto;
      if (file && file.size > 0) {
        try {
          selected = { name: file.name, mimeType: file.type, dataUrl: await fileToDataUrl(file) };
        } catch {
          if (mounted.current && formRef.current === form && revision.current === version && operation.current === request) setPhotoError("Could not read this photograph. Select it again or choose another file. Your draft has been kept.");
          return;
        }
      }
      if (abandonedSave.current !== abandonedVersion) return;
      const photo: TimelineEntry = {
        ...common,
        kind,
        name: selected?.name ?? current!.name,
        mimeType: selected?.mimeType ?? current!.mimeType,
        dataUrl: selected?.dataUrl ?? current!.dataUrl,
        caption: String(data.get("caption") ?? "").trim(),
      };
      onUpdate(originId, (current) => withContext(originEditing ? updateTimelineEntry(current, photo) : addTimelineEntry(current, photo)));
      finish();
      return;
    } else {
      entry = { ...common, kind, text: String(data.get("text") ?? "").trim() };
    }
    if (!entry.date || ("value" in entry && !Number.isFinite(entry.value)) || ("text" in entry && !entry.text)) return;
    if (kind === "ph") {
      const phEntry = entry as Extract<TimelineEntry, { kind: "ph" }>;
      onUpdate(originId, (current) => withContext(originEditing ? updatePhReading(current, phEntry) : addPhReading(current, phEntry)));
      finish();
      return;
    }
    onUpdate(originId, (current) => withContext(originEditing ? updateTimelineEntry(current, entry, localDate()) : addTimelineEntry(current, entry)));
    finish();
  }

  function saveInputs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    let next = batch;
    for (const input of batch.profileSnapshot.inputs) {
      const raw = String(data.get(input.name) ?? "");
      next = setBatchInput(next, input.name, raw === "" ? undefined : Number(raw));
    }
    onChange(next);
    managementDrafts.current.delete("inputs");
    setToolFeedback("Batch inputs saved. Non-overridden suggestions recalculated; overrides and their saved suggestions kept.");
  }

  function discardToolChanges(event: React.MouseEvent<HTMLButtonElement>) {
    if (managementDrafts.current.size && !window.confirm("Discard unsaved tool changes? Saved batch values and observations will stay intact.")) return;
    managementRef.current?.querySelectorAll("form").forEach((form) => form.reset());
    managementDrafts.current.clear();
    setCheckDrafts({});
    setNewCheckName("");
    setNewCheckInterval("7");
    setAddingCheck(false);
    setCheckError("");
    setToolErrors({});
    setToolFeedback("Unsaved tool changes discarded. Saved values kept.");
    event.currentTarget.focus({ preventScroll: true });
  }

  function editEntry(entry: TimelineEntry) {
    if (entry.kind === "check" || entry.kind === "measurement") return;
    if (!discardDraft()) return;
    changeKind(entry.kind);
    const form = formRef.current!;
    form.reset();
    (form.elements.namedItem("date") as HTMLInputElement).value = entry.date;
    (form.elements.namedItem("text") as HTMLTextAreaElement).value = entry.kind === "note" ? entry.text : "";
    form.querySelector<HTMLInputElement>('[data-value="ph"]')!.value = entry.kind === "ph" ? String(entry.value) : "";
    form.querySelector<HTMLInputElement>('[data-value="temperature"]')!.value = entry.kind === "temperature" ? String(displayTemperature(entry.value, units)) : "";
    (form.elements.namedItem("caption") as HTMLInputElement).value = entry.kind === "photo" ? entry.caption ?? "" : "";
    (form.elements.namedItem("status") as HTMLSelectElement).value = entry.kind === "status" ? entry.status : batch.status;
    setCapturedPhoto(null);
    setEditing(entry);
  }

  function cancelEntry() {
    if (modal.current) return dismissLogger();
    discardDraft();
  }

  function saveNewCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    try {
      onChange(addBatchCheck(batch, newCheckName, Number(newCheckInterval), localDate()));
      setNewCheckName("");
      setNewCheckInterval("7");
      setAddingCheck(false);
      managementDrafts.current.delete("new-check");
      setCheckError("");
      setToolFeedback("Recurring check added to this batch only.");
      focusAddCheck();
    } catch (error) {
      setCheckErrorField("new");
      setCheckError((error as Error).message);
    }
  }

  function focusAddCheck() {
    const target = addCheckRef.current?.disabled ? managementRef.current?.querySelector<HTMLElement>("#batch-check-editor") : addCheckRef.current;
    target?.focus({ preventScroll: true });
  }

  function checkErrorProps(field: string) {
    return { "aria-invalid": checkError && checkErrorField === field ? true as const : undefined, "aria-describedby": checkError && checkErrorField === field ? "batch-check-error" : undefined };
  }

  function saveCheckName(checkId: string, currentName: string) {
    try {
      onChange(renameBatchCheck(batch, checkId, checkDrafts[checkId] ?? currentName));
      setCheckDrafts(({ [checkId]: _removed, ...rest }) => rest);
      managementDrafts.current.delete(`check:${checkId}`);
      setCheckError("");
      setToolFeedback("Check name saved. Its schedule is unchanged.");
    } catch (error) {
      setCheckErrorField(`name:${checkId}`);
      setCheckError((error as Error).message);
    }
  }

  const latestPh = latestPhReading(batch);
  const dueCheck = dueBatchChecks(batch, localDate())[0];
  const isAttention = batch.status === "active" && dueCheck !== undefined;
  const nextCheck = [...batch.checks].sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate))[0];
  const day = batchDay(batch);
  const temperatureReadings = batch.timeline.filter((entry) => entry.kind === "temperature");
  const latestTemperature = temperatureReadings[temperatureReadings.length - 1];
  const temperatureRange = batch.profileSnapshot.temperatureMinC !== undefined && batch.profileSnapshot.temperatureMaxC !== undefined
    ? { min: batch.profileSnapshot.temperatureMinC, max: batch.profileSnapshot.temperatureMaxC }
    : undefined;
  const temperatureUnit = units === "imperial" ? "°F" : "°C";
  const temperatureRangeLabel = temperatureRange
    ? `${displayTemperature(temperatureRange.min, units)}–${displayTemperature(temperatureRange.max, units)}${temperatureUnit}`
    : "range not set";
  const temperatureAlert = latestTemperature && temperatureRange
    ? latestTemperature.value < temperatureRange.min ? " meas-cool" : latestTemperature.value > temperatureRange.max ? " meas-alert" : ""
    : "";
  const phZone = latestPh ? batch.profileSnapshot.phZones.find((zone) => latestPh.value >= zone.min && latestPh.value <= zone.max) : undefined;
  const phBounds = batch.profileSnapshot.phZones.length > 0
    ? {
        min: Math.min(...batch.profileSnapshot.phZones.map(({ min }) => min)),
        max: Math.max(...batch.profileSnapshot.phZones.map(({ max }) => max)),
      }
    : undefined;
  const phRange = phBounds
    ? `${phBounds.min}–${phBounds.max}`
    : "No zone defined";
  const phOutsideZone = Boolean(latestPh && phBounds && !phZone);
  const phPosition = latestPh && phBounds
    ? Math.max(0, Math.min(100, ((latestPh.value - phBounds.min) / Math.max(0.01, phBounds.max - phBounds.min)) * 100))
    : 50;
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
      <div className="design-detail-card bowed">
        <div className="design-detail-heading"><span className="design-check-symbol"><DesignIcon name="jar" /></span><div><h3>{batch.name}</h3><p>{batch.profileSnapshot.name} batch</p></div><button aria-label="Add observation" className="primary-action design-record-observation" onClick={showLogger} ref={observationTrigger} type="button"><DesignIcon name="plus" /><span>Add observation</span></button></div>
        <div className="design-detail-metrics"><span>Started {shortDate(batch.startDate)}</span><strong>Day {day}<small>{batch.finishDate ? ` / ${Math.max(1, Math.round((Date.parse(batch.finishDate) - Date.parse(batch.startDate)) / 86_400_000))}` : ""}</small></strong></div>
        <BatchPhoto batch={batch} detail />
        <dl className="detail-readings" aria-label="Latest observed readings"><div><dt><DesignIcon name="drop" />pH</dt><dd>{latestPh ? latestPh.value : "Not recorded"}</dd>{latestPh && <time dateTime={latestPh.date}>{shortDate(latestPh.date)}</time>}</div><div><dt><DesignIcon name="temp" />Temperature</dt><dd>{latestTemperature ? `${displayTemperature(latestTemperature.value, units)} ${temperatureUnit}` : "Not recorded"}</dd>{latestTemperature && <time dateTime={latestTemperature.date}>{shortDate(latestTemperature.date)}</time>}</div></dl>
        {batch.status === "active" && nextCheck && <section className="design-detail-next" aria-label="Next batch check"><div><p>{dueCheck ? "Check due" : "Next check"}</p><strong>{dueCheck?.name ?? nextCheck.name}</strong><p>{dueCheck?.overdue ? "Overdue · " : "Due · "}{shortDate((dueCheck ?? nextCheck).nextDueDate)}</p></div>{dueCheck && <button aria-label={`Complete check: ${dueCheck.name} for this batch`} className="primary-action" onClick={(event) => { if (document.activeElement === event.currentTarget && dueBatchChecks(batch, localDate()).length === 1) observationTrigger.current?.focus({ preventScroll: true }); onComplete(batch.id, dueCheck.id); }} type="button"><DesignIcon name="check" /><span>Complete check</span></button>}</section>}
        {(!nextCheck || batch.status !== "active") && <p className="detail-check-state">{batch.status !== "active" ? "Recurring checks paused while this batch is not active." : "No recurring checks scheduled."}</p>}
      </div>
      <section className="design-input-summary"><div className="design-section-head"><h3>Profile inputs</h3><button className="design-quiet" onClick={() => onDialog({ kind: "inputs", batch })} type="button">See all</button></div><div className="design-ingredients">{batch.profileSnapshot.inputs.map((input) => <span key={input.name}>{input.name}</span>)}{batch.profileSnapshot.inputs.length === 0 && <p>No profile inputs.</p>}</div></section>
      <div className="workbench">
        <div className="wb-rail">
      <section className="batch-management" hidden={!managementOpen} id="batch-management" aria-label="Batch management tools" ref={managementRef} onInvalid={(event) => captureFieldError(event, (id, message) => setToolErrors((previous) => ({ ...previous, [id]: message })))} onInput={(event) => { const id = (event.target as HTMLInputElement).id; setToolErrors((previous) => ({ ...previous, [id]: "" })); setToolFeedback(""); }}>
      <header className="batch-tools-heading"><div><p className="eyebrow">This batch only</p><h3>Batch tools</h3><p>Adjust this preparation without changing its profile.</p></div><button className="design-quiet" onClick={discardToolChanges} type="button">Discard tool changes</button></header>
      <div className="batch-tools-shortcuts" role="group" aria-label="Batch tool shortcuts">
        <button onClick={() => revealManagementSection("batch-date-editor")} type="button">Edit batch dates</button>
        <button onClick={() => revealManagementSection("batch-input-editor")} type="button">Edit batch inputs and calculations</button>
        <button onClick={() => revealManagementSection("batch-check-editor")} type="button">Edit recurring checks</button>
      </div>
      <p className="batch-tool-feedback" role="status">{toolFeedback}</p>
      <div className="batch-workspace-head">
        <div className="batch-head-actions">
          <button aria-label="Take photo" className="utility-circle utility-circle-dark batch-head-camera" onClick={takePhoto} type="button"><svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 7h3l1.2-2h7.6L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></svg></button>
          <button
            aria-label={`Notifications for ${batch.name}`}
            aria-pressed={!batch.notificationsMuted}
            className="utility-circle utility-circle-dark utility-capsule batch-head-notifications"
            onClick={() => { onChange({ ...batch, notificationsMuted: !batch.notificationsMuted }); setToolFeedback(batch.notificationsMuted ? "Batch notifications enabled, subject to device notification settings." : "Batch notifications muted."); }}
            title={batch.notificationsMuted ? "Enable notifications for this batch" : "Mute notifications for this batch"}
            type="button"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />{batch.notificationsMuted && <path d="M4 4l16 16" />}</svg>
            <span>Notifications {batch.notificationsMuted ? "muted" : "on"}</span>
          </button>
          <button onClick={revealLogger} type="button">Open advanced logger</button>
        </div>
      </div>

          <section className={`next-action${isAttention ? " attention" : ""}`} aria-labelledby="next-action-heading">
            <div className="next-action-icon"><StatusIcon status={isAttention ? "attention" : batch.status} /></div>
            <div>
              <p className="next-action-kick">{nextAction.kick}</p>
              <h4 id="next-action-heading">{nextAction.title}</h4>
              <p>{nextAction.body}</p>
            </div>
            {dueCheck && <button aria-label={`Complete ${dueCheck.name} check`} className="next-action-complete" onClick={() => onComplete(batch.id, dueCheck.id)} title={`Complete ${dueCheck.name}`} type="button"><span aria-hidden="true">✓</span></button>}
          </section>

          <section className="wb-panel" aria-labelledby="measurements-heading">
            <h4 id="measurements-heading">Key measurements <span>live batch data</span></h4>
            <div className="meas-grid">
              <div className={`meas${phOutsideZone ? " meas-alert" : ""}`}>
                <div className="meas-label"><span>pH</span><span>zone {phRange}</span></div>
                <strong className="meas-value">{latestPh?.value ?? "—"}<small>{latestPh ? ` · ${phZoneLabel(batch, latestPh.value) ?? "outside zone"}` : " · optional read"}</small></strong>
                <div className="measurement-zone" aria-hidden="true"><span /><i className={phOutsideZone ? "out" : undefined} style={{ left: `${phPosition}%` }} /></div>
                <p className="meas-note">{latestPh ? `Latest read ${latestPh.date}` : "Add a pH reading in the log below."}</p>
              </div>
              <div className={`meas${temperatureAlert}`}>
                <div className="meas-label"><span>Temperature</span><span>range {temperatureRangeLabel}</span></div>
                <strong className="meas-value">{latestTemperature ? displayTemperature(latestTemperature.value, units) : "—"}<small>{latestTemperature ? ` ${temperatureUnit}` : " not recorded"}</small></strong>
                <p className="meas-note">{latestTemperature ? `Latest read ${latestTemperature.date}` : "Record temperature in the log below."}</p>
              </div>
              <div className="meas">
                <div className="meas-label"><span>Days elapsed</span></div>
                <strong className="meas-value">{day}</strong>
                <p className="meas-note">{nextCheck ? `Check cadence · every ${nextCheck.intervalDays} days` : "No recurring check set"}</p>
              </div>
              {batch.profileSnapshot.calculations.length > 0 ? batch.profileSnapshot.calculations.map((calculation) => {
                const value = batch.calculationValues[calculation.name];
                return <div className="meas" key={calculation.name}>
                  <div className="meas-label"><span>Profile calculation</span></div>
                  <strong className="meas-value meas-value-small">{formatCalculationValue(value?.override ?? value?.suggested)}<small>{calculation.unit}</small></strong>
                  <p className="meas-note">{calculation.name}</p>
                </div>;
              }) : <div className="meas">
                <div className="meas-label"><span>Profile calculation</span></div>
                <strong className="meas-value meas-value-small">—<small>incomplete</small></strong>
                <p className="meas-note">No calculation defined</p>
              </div>}
            </div>
            <p className="hint">Suggested values recalculate from the profile snapshot. Overrides and input editing remain available below.</p>
          </section>

        <section className="batch-components-shell" aria-label="Batch configuration components">
          <div className="batch-components-grid">
            <article className="batch-component-card bowed" aria-labelledby="finish-heading" id="batch-date-editor">
              <header className="batch-component-header"><h4 id="finish-heading">Batch dates</h4><span className="batch-component-step" aria-hidden="true">01</span></header>
              <p className="component-empty">Started <time dateTime={batch.startDate}>{shortDate(batch.startDate)}</time> · {statusLabel(batch.status)}</p>
              <label className="component-field"><span>Finish date</span><input {...fieldErrorProps(toolErrors, "batch-finish-date")} onChange={(event) => { if (event.target.reportValidity()) { onChange(setFinishDate(batch, event.target.value, localDate())); setToolFeedback("Finish date saved. Batch status and check scheduling updated."); } }} required type="date" value={batch.finishDate ?? ""} /><FieldError errors={toolErrors} id="batch-finish-date" /></label>
              <p className="component-empty">Saves immediately. A future finish date returns this batch to active; on its finish date it becomes ready.</p>
            </article>

            <article className="batch-component-card bowed" aria-labelledby="inputs-heading" id="batch-input-editor">
              <header className="batch-component-header"><h4 id="inputs-heading">Profile inputs</h4><span className="batch-component-step" aria-hidden="true">02</span></header>
              {batch.profileSnapshot.inputs.length > 0 ? <form className="component-inputs" onChange={() => managementDrafts.current.add("inputs")} onSubmit={saveInputs}>
                <div className="component-input-fields">
                  {batch.profileSnapshot.inputs.map((input, index) => (
                    <label className="component-field" key={input.name}><span>{input.name} ({input.unit})</span><input {...fieldErrorProps(toolErrors, `batch-input-${index}`)} defaultValue={batch.inputValues[input.name]} min="0" name={input.name} step="any" type="number" /><FieldError errors={toolErrors} id={`batch-input-${index}`} /></label>
                  ))}
                </div>
                <button className="component-button component-button-primary" type="submit">Update inputs</button>
                <p className="component-empty">Blank values remain unset. Suggestions use this batch’s saved profile snapshot.</p>
              </form> : <p className="component-empty">No profile inputs.</p>}
            </article>

            <article className="batch-component-card bowed" aria-labelledby="calculations-heading">
              <header className="batch-component-header"><h4 id="calculations-heading">Profile calculations</h4><span className="batch-component-step" aria-hidden="true">03</span></header>
              {batch.profileSnapshot.calculations.length > 0 ? batch.profileSnapshot.calculations.map((calculation, index) => {
                const value = batch.calculationValues[calculation.name];
                return (
                  <div className="component-calculation" key={calculation.name}>
                    <span className="component-pair-label">{calculation.name}:</span>
                    <div className="component-calculation-value"><strong>{formatCalculationValue(value?.override ?? value?.suggested)} {calculation.unit}</strong><span>{value?.override !== undefined ? " (overridden)" : " suggested"}</span></div>
                    <span className="sr-only">{formatCalculationValue(value?.override ?? value?.suggested)} {calculation.unit}{value?.override !== undefined ? " (overridden)" : " suggested"}</span>
                    <p className="component-empty">{value?.override !== undefined ? "Suggestion saved before override" : "Suggested"}: {formatCalculationValue(value?.suggested)} {calculation.unit}{value?.suggested == null ? value?.override !== undefined ? " · No suggestion was available before this override." : " · Add the required inputs to calculate." : ""}</p>
                    <form className="component-override" onChange={() => managementDrafts.current.add(`calculation:${calculation.name}`)} onSubmit={(event) => {
                      event.preventDefault();
                      if (!event.currentTarget.reportValidity()) return;
                      const raw = String(new FormData(event.currentTarget).get("override") ?? "");
                      if (raw !== "") { onChange(overrideBatchCalculation(batch, calculation.name, Number(raw))); managementDrafts.current.delete(`calculation:${calculation.name}`); event.currentTarget.reset(); setToolFeedback(`${calculation.name} override saved for this batch.`); }
                    }}>
                      <label className="component-field"><span>Override</span><input {...fieldErrorProps(toolErrors, `batch-override-${index}`)} aria-label={`Override ${calculation.name}`} min="0" name="override" required step="any" type="number" /><FieldError errors={toolErrors} id={`batch-override-${index}`} /></label>
                      <button className="component-button" type="submit">Override</button>
                    </form>
                  </div>
                );
              }) : <p className="component-empty">No calculations.</p>}
            </article>

            <article className="batch-component-card bowed" aria-label={`${batch.name} checks`} id="batch-check-editor" tabIndex={-1}>
              <header className="batch-component-header"><h4>Recurring checks</h4><button className="component-button component-button-quiet" disabled={batch.status !== "active"} onClick={() => { setAddingCheck(true); setCheckError(""); }} ref={addCheckRef} type="button">Add check</button></header>
              <p className="component-check-state">{batch.status === "active" ? "Intervals save immediately. New checks count from today and belong only to this batch." : "Checks paused. Adding checks and changing intervals are unavailable until this batch is active. Names and removal remain available."}</p>
              {checkError && <p className="notice" id="batch-check-error" role="alert">{checkError}</p>}
              {batch.checks.length === 0 && !addingCheck && <p className="component-empty">No recurring checks yet.</p>}
              {batch.checks.map((check) => {
                const due = dueBatchChecks(batch, localDate()).find(({ id }) => id === check.id);
                return (
                  <div className="component-check" key={check.id}>
                    <label className="component-field"><span>Check name</span><input {...checkErrorProps(`name:${check.id}`)} aria-label={`Check name: ${check.name}`} onChange={(event) => { managementDrafts.current.add(`check:${check.id}`); setCheckDrafts({ ...checkDrafts, [check.id]: event.target.value }); setCheckError(""); }} value={checkDrafts[check.id] ?? check.name} /></label>
                    <div className="component-check-meta">
                      <label className="component-field"><span>Next</span><input aria-label={`${check.name} next date`} readOnly type="date" value={check.nextDueDate} /></label>
                      <label className="component-field"><span>Every (days)</span><input {...checkErrorProps(`interval:${check.id}`)} aria-label={`${check.name} interval days`} disabled={batch.status !== "active"} min="1" onChange={(event) => { try { onChange(adjustBatchCheck(batch, check.id, Number(event.target.value), localDate())); setCheckError(""); setToolFeedback("Check interval saved. Next date recalculated."); } catch (error) { setCheckErrorField(`interval:${check.id}`); setCheckError((error as Error).message); } }} step="1" type="number" value={check.intervalDays} /></label>
                    </div>
                    <p className="component-check-status">{batch.status === "active" ? `${due?.overdue ? "Overdue" : due ? "Due" : "Next"} ${check.nextDueDate}` : "Paused"}</p>
                    <div className="component-check-actions"><button className="component-button" onClick={() => saveCheckName(check.id, check.name)} type="button">Save name</button><button className="component-remove" aria-label={`Remove ${check.name}`} onClick={() => { if (managementDrafts.current.has(`check:${check.id}`) && !window.confirm("Discard the unsaved name and remove this check?")) return; managementDrafts.current.delete(`check:${check.id}`); setCheckDrafts(({ [check.id]: _removed, ...rest }) => rest); onChange(removeBatchCheck(batch, check.id)); setCheckError(""); setToolFeedback(`${check.name} removed. Existing completion history kept.`); managementRef.current?.querySelector<HTMLElement>("#batch-check-editor")?.focus({ preventScroll: true }); }} type="button">Remove</button></div>
                  </div>
                );
              })}
              {addingCheck && <form className="component-check component-new-check" onChange={() => managementDrafts.current.add("new-check")} onSubmit={saveNewCheck}>
                <label className="component-field"><span>Check name</span><input {...fieldErrorProps(toolErrors, "batch-new-check-name")} aria-describedby={checkError && checkErrorField === "new" ? "batch-check-error" : toolErrors["batch-new-check-name"] ? "batch-new-check-name-error" : undefined} aria-invalid={checkError && checkErrorField === "new" || toolErrors["batch-new-check-name"] ? true : undefined} autoFocus onChange={(event) => { setNewCheckName(event.target.value); setCheckError(""); }} placeholder="e.g. Taste and smell" required value={newCheckName} /><FieldError errors={toolErrors} id="batch-new-check-name" /></label>
                <label className="component-field"><span>Every (days)</span><input {...fieldErrorProps(toolErrors, "batch-new-check-interval")} disabled={batch.status !== "active"} min="1" onChange={(event) => setNewCheckInterval(event.target.value)} required step="1" type="number" value={newCheckInterval} /><FieldError errors={toolErrors} id="batch-new-check-interval" /></label>
                <div className="component-check-actions"><button className="component-button" disabled={batch.status !== "active"} type="submit">Add recurring check</button><button className="component-remove" onClick={() => { if (!managementDrafts.current.has("new-check") || window.confirm("Discard this unsaved recurring check?")) { managementDrafts.current.delete("new-check"); setAddingCheck(false); setNewCheckName(""); setNewCheckInterval("7"); setCheckError(""); focusAddCheck(); } }} type="button">Cancel</button></div>
              </form>}
            </article>
          </div>
        </section>
        <section className="batch-tools-danger" aria-label="Batch deletion"><div><h4>Delete this batch</h4><p>Move it to Recently deleted in Settings. You can restore it for seven days.</p></div><button onClick={() => { if (window.confirm(`Move ${batch.name} to Recently deleted? It can be restored for seven days.`)) onDelete(batch.id); }} type="button">Delete batch</button></section>
      </section>

          <section className="wb-panel batch-guidance" aria-labelledby="guidance-heading">
            <div className="design-guidance-title"><h4 id="guidance-heading"><span><DesignIcon name="leaf" /></span>Profile guidance</h4><DesignIcon name="sparkles" /></div>
            {batch.profileSnapshot.guidance.map((guidance, index) => <div className="guide-step" key={`${guidance}-${index}`}><p><RichProfileText value={guidance} /></p></div>)}
            {batch.profileSnapshot.guidance.length === 0 && <p className="muted-copy">No active guidance in this profile snapshot.</p>}
            <button className="design-snapshot" onClick={() => onDialog({ kind: "profile", profile: batch.profileSnapshot })} type="button">See fermentation profile</button><p className="snapshot-line sr-only"><strong>Profile snapshot:</strong> {batch.profileSnapshot.name}</p>
          </section>

        </div>

        <div className="wb-main">
          <section className="wb-panel activity-logger" aria-labelledby="activity-logger-heading" hidden={!managementOpen && !loggerModal}>
            <h2 hidden={loggerModal} id="activity-logger-heading">Log {loggerKind === "ph" ? "pH reading" : loggerKind === "status" ? "status change" : loggerKind}</h2>
            <dialog aria-labelledby={loggerModal ? "observation-dialog-title" : undefined} className={`observation-logger${loggerModal ? " station-dialog bowed-clip" : " inline-logger"}`} onCancel={(event) => { event.preventDefault(); dismissLogger(); }} onClose={(event) => { if (!event.currentTarget.open && modal.current) dismissLogger(); }} ref={dialogRef} role={loggerModal ? "dialog" : "presentation"}>
            <div className="station-dialog-heading" hidden={!loggerModal}><h2 id="observation-dialog-title">{editing ? "Edit observation" : "Add observation"}</h2><button aria-label="Close dialog" className="utility-circle utility-circle-dark station-dialog-close" onClick={() => dismissLogger()} ref={closeRef} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div>
            <form className={basicObservation ? "observation-form" : "timeline-form quick-log-form"} id="batch-activity-form" onChange={() => { revision.current++; dirty.current = true; }} onInput={() => { revision.current++; dirty.current = true; formRef.current?.querySelector("textarea")?.setCustomValidity(""); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") event.currentTarget.requestSubmit(); }} onSubmit={saveEntry} ref={formRef}>
              <p className="station-dialog-body" hidden={!loggerModal}>{batch.name}</p>
              <label className="sr-only" hidden={basicObservation}>Activity type<select disabled={!!editing || basicObservation} name="kind" onChange={(event) => changeKind(event.target.value as LoggerKind)} tabIndex={-1} value={loggerKind}>
                <option value="status">Status change</option><option value="ph">pH reading</option><option value="temperature">Temperature</option><option value="note">Note</option><option value="photo">Photo</option>
              </select></label>
              <div className="quick-log-types" aria-label="Activity choices" hidden={basicObservation} role="group">
                {(["status", "ph", "temperature", "note", "photo"] as LoggerKind[]).map((kind) => {
                  const label = kind === "ph" ? "pH reading" : kind === "status" ? "Status change" : kind[0].toUpperCase() + kind.slice(1);
                  return <button aria-pressed={loggerKind === kind} disabled={!!editing} key={kind} onClick={() => changeKind(kind)} type="button">{label}</button>;
                })}
              </div>
              <div className={basicObservation ? "observation-fields" : "quick-log-fields"}>
                <label className={basicObservation ? "station-field" : "quick-log-wide logger-context"}>{basicObservation ? "Observation" : <>Context <span>optional</span></>}<textarea aria-label={basicObservation ? "Observation" : "Activity context"} className={sheetField} maxLength={basicObservation ? 500 : undefined} name="text" placeholder={basicObservation ? "What do you notice about this batch?" : "What should future-you know?"} required={!basicObservation && loggerKind === "note"} /></label>
                <label hidden={basicObservation || loggerKind !== "ph"}>pH value<input className={sheetField} data-value="ph" disabled={basicObservation || loggerKind !== "ph"} name="value" required step="0.01" type="number" /></label>
                <label className={basicObservation ? "station-field" : undefined} hidden={!basicObservation && loggerKind !== "temperature"}>{basicObservation ? `Temperature reading (${temperatureUnit})` : `Temperature (${temperatureUnit})`}<div className={basicObservation ? "observation-temperature" : "quick-log-measure"}><input aria-label={basicObservation ? `Temperature reading (${temperatureUnit})` : `Temperature (${temperatureUnit})`} className={sheetField} data-value="temperature" disabled={!basicObservation && loggerKind !== "temperature"} max={basicObservation ? units === "imperial" ? 212 : 100 : undefined} min={basicObservation ? units === "imperial" ? -4 : -20 : undefined} name="value" placeholder={basicObservation ? units === "imperial" ? "e.g. 70" : "e.g. 21" : undefined} required={!basicObservation} step={basicObservation ? "0.1" : "any"} type="number" /><span hidden={basicObservation}>{temperatureUnit}</span></div></label>
                <label hidden={basicObservation || loggerKind !== "status"}>New status<select aria-label="Activity status" className={sheetField} defaultValue={batch.status} disabled={basicObservation || loggerKind !== "status"} name="status">{batchStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
                <label className="quick-log-wide" hidden={basicObservation || loggerKind !== "photo"}>Photo<input accept="image/*" capture="environment" className={sheetField} disabled={basicObservation || loggerKind !== "photo"} name="photo" required={!editing && !capturedPhoto} type="file" /></label>
                <label hidden={basicObservation}>Activity date<input className={sheetField} defaultValue={localDate()} name="date" required type="date" /></label>
                <label hidden={basicObservation || loggerKind !== "photo"}>Caption<input className={sheetField} disabled={basicObservation || loggerKind !== "photo"} name="caption" /></label>
              </div>
              {loggerKind === "photo" && isNativeCameraAvailable() && <button className="quick-log-camera" onClick={takePhoto} type="button">Take photo</button>}
              {capturedPhoto && <p className="notice" role="status">Photo captured. Add a caption or save the activity.</p>}
              {photoError && <p role="alert">{photoError}</p>}
              <p className="station-helper" hidden={!basicObservation}>Add a note, a reading, or both.</p>
              <div className="logger-options"><button className="design-quiet" hidden={!basicObservation} onClick={() => { setObservationMode(false); if (formRef.current?.querySelector<HTMLInputElement>('[data-value="temperature"]')?.value) setLoggerKind("temperature"); }} type="button">Advanced options</button><button className="design-quiet" onClick={() => { if (discardDraft()) { if (modal.current) dismissLogger(); else setLoggerKind("status"); } }} type="button">Discard draft</button><span>Closing keeps your draft.</span></div>
              <div className={basicObservation ? "station-dialog-actions" : "quick-log-actions"}><span hidden={loggerModal}>Save with <kbd>Ctrl</kbd> <kbd>↵</kbd></span><div className={basicObservation ? "observation-actions" : undefined}><button className={basicObservation ? "station-secondary" : undefined} hidden={!loggerModal && !editing} onClick={cancelEntry} type="button">Cancel</button><button aria-label={basicObservation ? "Add observation" : editing ? "Save activity" : "Log activity"} className={basicObservation ? "station-primary" : "primary-action"} type="submit">{basicObservation ? "Add observation" : "Save activity"}</button></div></div>
            </form>
            </dialog>
          </section>

          <section className="wb-panel design-timeline-panel" aria-label={`${batch.name} timeline`}>
            <div className="timeline-panel-heading"><h3>Batch timeline <span className="sr-only">{batch.timeline.length} entries</span></h3><div className="timeline-panel-actions"><button aria-controls="batch-management" aria-expanded={managementOpen} aria-label="More batch tools" className="design-quiet" onClick={() => setManagementOpen((open) => !open)} type="button">Tools</button><button aria-label="Record timeline observation" className="design-quiet" onClick={showLogger} type="button">Add observation</button></div></div>
            <section className="timeline">
              {batch.timeline.length === 0 && <p>No activity recorded yet.</p>}
              {[...batch.timeline].reverse().map((entry) => (
                <div className={`timeline-entry bowed timeline-${entry.kind}`} key={entry.id}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <span className="timeline-content"><strong>{entry.kind === "ph" ? "pH reading" : entry.kind === "check" ? "Check completed" : entry.kind === "status" ? "Status change" : entry.kind[0].toUpperCase() + entry.kind.slice(1)}</strong><span className="timeline-description">{timelineEntryText(entry, units)}{entry.kind === "ph" && phZoneLabel(batch, entry.value) && <span className="zone">{phZoneLabel(batch, entry.value)}</span>}{entry.kind === "ph" && phWarning(entry.value) && <span className="warning">{phWarning(entry.value)}</span>}{entry.kind === "photo" && <span className="timeline-photo user-photo"><BatchImage key={entry.dataUrl} source={entry.dataUrl} description={entry.caption || entry.name} userPhoto retryable /></span>}</span></span>
                  <time dateTime={entry.date}>{shortDate(entry.date)}</time>
                  <div className="timeline-entry-actions" hidden={!managementOpen}>
                    {entry.kind !== "check" && entry.kind !== "measurement" && <button aria-label={`Edit ${entry.kind === "ph" ? "pH" : entry.kind} from ${entry.date}`} onClick={() => editEntry(entry)} type="button">Edit</button>}
                    <button aria-label={`Delete ${entry.kind} from ${entry.date}`} onClick={() => { if (editing?.id === entry.id && !discardDraft()) return; onChange(deleteTimelineEntry(batch, entry.id, Date.now())); }} type="button">Delete</button>
                  </div>
                </div>
              ))}
              {batch.timelineTrash.length > 0 && <div className="timeline-trash" hidden={!managementOpen}><strong>Recently deleted activity</strong>{batch.timelineTrash.map((entry) => <button key={entry.id} onClick={() => onChange(restoreTimelineEntry(batch, entry.id, Date.now()))} type="button">Restore {entry.kind} from {entry.date}</button>)}</div>}
            </section>
          </section>

        </div>

      </div>
      <div className="design-detail-footer"><DesignIcon name="leaf" />Your observations, kept in one place.</div>
      <div className="detail-photo-credits"><PhotoCredits /></div>
    </article>
  );
}

interface ProfilesProps {
  draft: ReturnType<typeof useUnsavedChanges>;
  formulaTerms: string[];
  profiles: FermentationProfile[];
  onDelete(id: string): void;
  onSave(profile: FermentationProfile): void;
  onEditingChange(id: string | null): void;
  onView(profile: FermentationProfile): void;
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

function formatCalculationValue(value: number | null | undefined) {
  return value === null || value === undefined ? "Incomplete" : formatNumber(Number(value.toFixed(2)));
}

function displayTemperature(celsius: number, units: ShellPreferences["units"]): string {
  const value = units === "imperial" ? celsius * 9 / 5 + 32 : celsius;
  return formatNumber(Number(value.toFixed(2)));
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

function Profiles({ draft, formulaTerms, profiles, onDelete, onSave, onEditingChange, onView }: ProfilesProps) {
  const [editing, setEditing] = useState<FermentationProfile | null>(null);
  const [calculations, setCalculations] = useState<FormulaRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [checkRows, setCheckRows] = useState<ProfileCheckRow[]>([]);
  const [guidanceRows, setGuidanceRows] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const checkInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const addProfileRef = useRef<HTMLButtonElement>(null);
  const editButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const returnProfileId = useRef<string | null>(null);
  const [focusCheckId, setFocusCheckId] = useState<string | null>(null);

  useEffect(() => {
    if (editing || !returnProfileId.current) return;
    (editButtons.current[returnProfileId.current] ?? addProfileRef.current)?.focus({ preventScroll: true });
    returnProfileId.current = null;
  }, [editing]);

  useEffect(() => {
    if (!focusCheckId) return;
    checkInputsRef.current[focusCheckId]?.focus();
    setFocusCheckId(null);
  }, [checkRows, focusCheckId]);

  function currentInputs() {
    return editing?.inputs ?? [];
  }

  function edit(profile: FermentationProfile) {
    draft.dirty.current = false;
    returnProfileId.current = profile.id;
    setErrors([]);
    setFieldErrors({});
    setMessage("");
    setEditing(profile);
    setCalculations(formulaRows(profile));
    setGuidanceRows(profile.guidance);
    setCheckRows(profile.checks.map((check) => ({
      id: check.id ?? createClientId(), name: check.name, intervalDays: check.intervalDays,
    })));
    onEditingChange(profile.id);
  }

  function closeEditor() {
    if (!draft.confirmDiscard()) return;
    draft.dirty.current = false;
    setEditing(null);
    setErrors([]);
    setFieldErrors({});
    setCheckRows([]);
    setGuidanceRows([]);
    setFocusCheckId(null);
    onEditingChange(null);
  }

  function updateCheck(id: string, update: Partial<ProfileCheckRow>) {
    setCheckRows(checkRows.map((check) => check.id === id ? { ...check, ...update } : check));
  }

  function addCheck() {
    draft.dirty.current = true;
    const id = createClientId();
    setCheckRows([...checkRows, { id, name: "", intervalDays: 7 }]);
    setFocusCheckId(id);
  }

  function removeCheck(index: number) {
    draft.dirty.current = true;
    setCheckRows(checkRows.filter((_, checkIndex) => checkIndex !== index));
  }

  function addGuidanceStep() {
    draft.dirty.current = true;
    setGuidanceRows([...guidanceRows, ""]);
  }

  function updateGuidanceStep(index: number, value: string) {
    setGuidanceRows(guidanceRows.map((step, stepIndex) => stepIndex === index ? value : step));
  }

  function removeGuidanceStep(index: number) {
    draft.dirty.current = true;
    setGuidanceRows(guidanceRows.filter((_, stepIndex) => stepIndex !== index));
  }

  function addFormula() {
    draft.dirty.current = true;
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

  function removeFormula(id: string) {
    draft.dirty.current = true;
    setCalculations(calculations.filter((row) => row.id !== id));
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
    if (!editing) return;
    const originalPh = phRangeFor(editing);
    const phUnchanged = String(data.get("phMin") ?? "") === String(originalPh.min) && String(data.get("phMax") ?? "") === String(originalPh.max);
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
      phZones: phUnchanged ? editing.phZones : [...editing.phZones.filter(({ label }) => label !== "optimal"), ...parsePhRange(data.get("phMin"), data.get("phMax"))],
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
    if ((String(data.get("phMin") ?? "").trim() === "") !== (String(data.get("phMax") ?? "").trim() === "")) {
      nextErrors.push("The optimal pH zone must include both minimum and maximum values.");
    }
    if (!profile.name || nextErrors.length > 0) {
      setErrors(nextErrors);
      const adjacent: FieldErrors = {};
      const mark = (ids: string[], messages: string[]) => { if (messages.length) for (const id of ids) adjacent[id] = messages.join(" "); };
      if (!profile.name) adjacent["profile-name"] = "Profile name is required.";
      mark(["profile-duration"], nextErrors.filter((message) => message.startsWith("Expected duration")));
      mark(["profile-temperature-min", "profile-temperature-max"], nextErrors.filter((message) => message.startsWith("Temperature range")));
      mark(["profile-ph-min", "profile-ph-max"], nextErrors.filter((message) => message.includes("pH zone")));
      for (const check of checkRows) {
        if (!check.name.trim() || checkRows.filter((row) => row.name.trim().toLowerCase() === check.name.trim().toLowerCase()).length > 1) {
          mark([`profile-check-${check.id}-name`], nextErrors.filter((message) => message === "Check names must be present and unique."));
        }
        mark([`profile-check-${check.id}-interval`], nextErrors.filter((message) => message === `${check.name || "Check"} interval must be a positive whole number.`));
      }
      for (const row of calculations) {
        if (row.kind !== "structured") continue;
        mark([`profile-formula-${row.id}-source`], nextErrors.filter((message) => message.startsWith(`Input name ${row.source} `) || message === `${row.result}: Unknown input ${row.source}`));
        mark([`profile-formula-${row.id}-operand`], nextErrors.filter((message) => message.startsWith(`${row.result}: `) && !message.includes("Unknown input")));
        if (!row.result || profile.calculations.filter(({ name }) => name === row.result).length > 1) {
          mark([`profile-formula-${row.id}-result`], nextErrors.filter((message) => message === "Calculation names must be present and unique."));
        }
      }
      setFieldErrors(adjacent);
      return;
    }

    onSave(profile);
    draft.dirty.current = false;
    setMessage(`${profile.name} profile saved.`);
    closeEditor();
  }

  return (
    <section className="profiles">
      {editing && (() => {
        const phRange = phRangeFor(editing);
        return (
          <div className="profile-editor-page" onChange={() => { draft.dirty.current = true; }} onInput={() => { setErrors([]); setFieldErrors({}); }} onInvalid={(event) => captureFieldError(event, (id, message) => setFieldErrors((previous) => ({ ...previous, [id]: message })))}>
            <header className="profile-mobile-bar">
              <StationLogo />
              <strong>FermentStation</strong>
              <button aria-label="Back to profiles" className="utility-circle" onClick={closeEditor} type="button"><DesignIcon name="back" /></button>
            </header>
            <nav className="profile-editor-crumbs" aria-label="Breadcrumb"><button onClick={closeEditor} type="button">Profiles</button></nav>
            <header className="profile-editor-head bowed">
              <div><label className="profile-editor-eyebrow" htmlFor="profile-name">Name</label><h1><input {...fieldErrorProps(fieldErrors, "profile-name")} autoFocus className="profile-editor-title-input" defaultValue={editing.name} form="profile-editor-form" name="name" placeholder="Profile name" required /><FieldError errors={fieldErrors} id="profile-name" /></h1></div>
              <span className="profile-editor-status"><i />Editable profile</span>
            </header>

            <div className="profile-editor-grid">
              <form className="profile-editor-form" id="profile-editor-form" key={editing.id} onSubmit={save}>
                <section className="profile-editor-section bowed">
                  <div className="profile-editor-section-head profile-editor-basics-head"><div><p className="profile-editor-kicker">01 / The method</p><h2>Guidance and conditions</h2><p className="profile-editor-intro">Set the steps and conditions used to start new batches.</p></div></div>
                  <div className="profile-editor-fields">
                    <div className="profile-editor-guidance">
                      <div className="profile-editor-guidance-head"><span>Guidance (optional)</span><button className="profile-editor-text-button" onClick={addGuidanceStep} type="button">Add step</button></div>
                      {guidanceRows.length === 0 && <p className="profile-editor-check-empty">No guidance steps yet. Add one when this profile needs a sequence to follow.</p>}
                      <div className="profile-editor-guidance-rows">
                        {guidanceRows.map((step, index) => <label className="profile-editor-guidance-row" key={index}><span>Guidance step {index + 1}</span><textarea aria-label={`Guidance step ${index + 1}`} onChange={(event) => updateGuidanceStep(index, event.target.value)} value={step} /><button className="profile-editor-text-button" onClick={() => removeGuidanceStep(index)} type="button">Remove step</button></label>)}
                      </div>
                    </div>
                     <label className="profile-editor-field"><span>Temperature minimum</span><span className="profile-editor-suffix"><input {...fieldErrorProps(fieldErrors, "profile-temperature-min")} aria-label="Temperature minimum" defaultValue={editing.temperatureMinC ?? ""} min="0" max="100" name="temperatureMinC" step="any" type="number" /><i>°C</i></span><FieldError errors={fieldErrors} id="profile-temperature-min" /></label>
                      <label className="profile-editor-field"><span>Temperature maximum</span><span className="profile-editor-suffix"><input {...fieldErrorProps(fieldErrors, "profile-temperature-max")} aria-label="Temperature maximum" defaultValue={editing.temperatureMaxC ?? ""} min="0" max="100" name="temperatureMaxC" step="any" type="number" /><i>°C</i></span><FieldError errors={fieldErrors} id="profile-temperature-max" /></label>
                      <label className="profile-editor-field"><span>pH minimum</span><span className="profile-editor-suffix"><input {...fieldErrorProps(fieldErrors, "profile-ph-min")} aria-label="pH minimum" defaultValue={phRange.min} min="0" max="14" name="phMin" step="any" type="number" /><i>pH</i></span><FieldError errors={fieldErrors} id="profile-ph-min" /></label>
                      <label className="profile-editor-field"><span>pH maximum</span><span className="profile-editor-suffix"><input {...fieldErrorProps(fieldErrors, "profile-ph-max")} aria-label="pH maximum" defaultValue={phRange.max} min="0" max="14" name="phMax" step="any" type="number" /><i>pH</i></span><FieldError errors={fieldErrors} id="profile-ph-max" /></label>
                      <label className="profile-editor-field"><span>Expected duration</span><span className="profile-editor-suffix"><input {...fieldErrorProps(fieldErrors, "profile-duration")} aria-label="Expected duration" defaultValue={editing.expectedDurationDays ?? ""} min="1" name="expectedDurationDays" type="number" /><i>days</i></span><FieldError errors={fieldErrors} id="profile-duration" /></label>
                      <p className="profile-editor-field wide">The pH range edits the optimal zone. Other saved pH zones are kept.</p>
                   </div>
                </section>

                <section className="profile-editor-section bowed">
                  <div className="profile-editor-section-head"><div><p className="profile-editor-kicker">02 / Recurring checks</p><h2>Checks for each batch</h2><p className="profile-editor-intro">Copied to new batches and scheduled from their start date.</p></div><button className="profile-editor-text-button" onClick={addCheck} type="button">Add check</button></div>
                  <div className="profile-editor-checks">
                    {checkRows.length === 0 && <p className="profile-editor-check-empty">No recurring checks yet. Add one when this profile needs a repeating rhythm.</p>}
                    {checkRows.map((check, index) => (
                      <div className="profile-editor-check-row" key={check.id}>
                        <label><span>Check</span><input {...fieldErrorProps(fieldErrors, `profile-check-${check.id}-name`)} aria-label={`Check name ${index + 1}`} onChange={(event) => updateCheck(check.id, { name: event.target.value })} placeholder="e.g. Taste and smell" ref={(input) => { checkInputsRef.current[check.id] = input; }} value={check.name} /><FieldError errors={fieldErrors} id={`profile-check-${check.id}-name`} /></label>
                        <label><span>Every</span><input {...fieldErrorProps(fieldErrors, `profile-check-${check.id}-interval`)} aria-label={`Check interval ${index + 1}`} min="1" onChange={(event) => updateCheck(check.id, { intervalDays: Number(event.target.value) })} type="number" value={check.intervalDays || ""} /><FieldError errors={fieldErrors} id={`profile-check-${check.id}-interval`} /></label>
                        <span className="profile-editor-check-unit">days</span>
                        <button aria-label={`Remove ${check.name || "check"}`} className="profile-editor-icon-button" onClick={() => removeCheck(index)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg></button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="profile-editor-section bowed">
                  <div className="profile-editor-section-head"><div><p className="profile-editor-kicker">03 / Calculations</p><h2>Formulas</h2></div></div>
                  <fieldset className="profile-editor-formula"><legend className="sr-only">Formulas</legend>
                    {calculations.map((row, index) => row.kind === "legacy" ? (
                      <div className="legacy-formula" key={row.id}><p><strong>Legacy calculation {index + 1}: {row.calculation.name}</strong></p><p>This formula uses multiple operations or parentheses. It cannot be edited here, but will be kept when you save.</p><button onClick={() => removeFormula(row.id)} type="button">Remove calculation {index + 1}</button></div>
                    ) : (
                      <div className="profile-editor-formula-row" key={row.id}>
                        <label>Source term row {index + 1}<select {...fieldErrorProps(fieldErrors, `profile-formula-${row.id}-source`)} aria-label={`Source term row ${index + 1}`} onChange={(event) => { const source = event.target.value; const matchingSource = calculations.find((candidate): candidate is StructuredFormulaRow => candidate.kind === "structured" && candidate.source === source); updateFormula(row.id, { source, sourceUnit: matchingSource?.sourceUnit ?? currentInputs().find(({ name }) => name === source)?.unit ?? row.sourceUnit, sourceUnitTouched: matchingSource?.sourceUnitTouched ?? false }); }} value={row.source}>{availableSourceTerms(formulaTerms, calculations, currentInputs()).map((term) => <option key={term} value={term}>{formulaTermLabel(term)}</option>)}</select><FieldError errors={fieldErrors} id={`profile-formula-${row.id}-source`} /></label>
                        <label>Source unit row {index + 1}<select onChange={(event) => updateSourceUnit(row.source, event.target.value as MetricUnit)} value={row.sourceUnit}>{metricUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                        <label>Operator row {index + 1}<select onChange={(event) => updateFormula(row.id, { operator: event.target.value as StructuredFormulaRow["operator"] })} value={row.operator}><option value="+">+</option><option value="-">-</option><option value="*">×</option><option value="/">/</option></select></label>
                        <label>Operand row {index + 1}<input {...fieldErrorProps(fieldErrors, `profile-formula-${row.id}-operand`)} aria-label={`Operand row ${index + 1}`} min="0" onChange={(event) => updateFormula(row.id, { operand: event.target.value })} required step="any" type="number" value={row.operand} /><FieldError errors={fieldErrors} id={`profile-formula-${row.id}-operand`} /></label>
                        <label>Operand type row {index + 1}<select onChange={(event) => updateFormula(row.id, { operandType: event.target.value as StructuredFormulaRow["operandType"] })} value={row.operandType}><option value="number">Number</option><option value="percentage">Percentage</option></select></label>
                        <label>Result term row {index + 1}<select {...fieldErrorProps(fieldErrors, `profile-formula-${row.id}-result`)} aria-label={`Result term row ${index + 1}`} onChange={(event) => updateFormula(row.id, { result: event.target.value })} value={row.result}>{availableResultTerms(formulaTerms, editing, calculations).map((term) => <option key={term} value={term}>{formulaTermLabel(term)}</option>)}</select><FieldError errors={fieldErrors} id={`profile-formula-${row.id}-result`} /></label>
                        <label>Result unit row {index + 1}<select onChange={(event) => updateFormula(row.id, { resultUnit: event.target.value as MetricUnit })} value={row.resultUnit}>{metricUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                        <button onClick={() => removeFormula(row.id)} type="button">Remove calculation {index + 1}</button>
                      </div>
                    ))}
                    <button className="profile-editor-add-formula" onClick={addFormula} type="button">Add formula</button>
                  </fieldset>
                </section>

                {errors.length > 0 && <div className="notice" role="alert">{errors.join(" ")}</div>}
                <div className="profile-editor-actions"><button aria-label="Cancel" className="profile-editor-text-button" onClick={closeEditor} type="button">Cancel changes</button><button className="profile-editor-button primary" type="submit">Save profile <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button></div>
              </form>

               <aside className="profile-editor-aside" aria-label="Profile context">
                 <article className="profile-editor-card"><h2>Profile inputs</h2><p>{profileInputsText(editing)}</p><p>Formula sources add inputs. Existing inputs and defaults are kept; choose actual quantities when starting a batch.</p></article>
                 <article className="profile-editor-card profile-editor-note"><h2>Existing batches stay intact</h2><p>Saving or deleting a profile never changes the snapshots, checks or observations in batches you already started.</p></article>
               </aside>
            </div>
          </div>
        );
      })()}

      {!editing && <div className="profile-toolbar"><p>{profiles.length} reusable {profiles.length === 1 ? "method" : "methods"}</p><button className="profile-add" ref={addProfileRef} onClick={() => edit({ id: createClientId(), name: "", guidance: [], inputs: [], calculations: [], checks: [], phZones: [] })} type="button"><DesignIcon name="plus" />Add profile</button></div>}
      {!editing && <div className="profile-list">
        {profiles.length === 0 && <section className="empty-state"><DesignIcon name="jar" /><h2>No fermentation profiles yet</h2><p>Add a reusable method, then start a batch from its guidance.</p></section>}
        {profiles.map((profile) => {
          const presentation = presentationFor(profile);
          return (
            <article className="profile-card bowed" key={profile.id} style={{ "--profile-colour": profileVisual(profile).color } as CSSProperties}>
              <button aria-label={`View ${profile.name} guidance`} className="profile-card-main" onClick={() => onView(profile)} type="button">
                <span className="design-profile-copy"><h2>{profile.name}</h2><span className="profile-facts"><span>{profile.expectedDurationDays ? `${profile.expectedDurationDays} days` : "Duration not set"}</span><span>{profile.temperatureMinC === undefined ? "Temperature not set" : presentation.params[0][0]}</span></span><span className="profile-card-guidance"><RichProfileText value={presentation.description} /></span></span>
                <span className="profile-card-link">View guidance <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m7 17 10-10M7 7h10v10" /></svg></span>
              </button>
              <ProfilePhoto profile={profile} />
              <div className="profile-card-actions"><button aria-label={`Edit ${profile.name}`} ref={(button) => { editButtons.current[profile.id] = button; }} onClick={() => edit(profile)} type="button">Edit profile</button><button aria-label={`Delete ${profile.name}`} onClick={() => { if (window.confirm(`Delete ${profile.name}? This cannot be undone. Existing batches keep their profile snapshot.`)) { onDelete(profile.id); setMessage(`${profile.name} profile deleted. Existing batches are unchanged.`); addProfileRef.current?.focus(); } }} type="button">Delete</button></div>
            </article>
          );
        })}
      </div>}

      {!editing && <PhotoCredits />}

      {message && <div className="profile-editor-toast" role="status">{message}</div>}

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

function timelineEntryText(entry: TimelineEntry, units: ShellPreferences["units"] = "metric"): string {
  if (entry.kind === "status") return `Status: ${statusLabel(entry.status)}`;
  if (entry.kind === "check") return `Completed check: ${entry.checkName}`;
  if (entry.kind === "ph") return `pH ${entry.value}`;
  if (entry.kind === "temperature") return `Temperature ${displayTemperature(entry.value, units)}°${units === "imperial" ? "F" : "C"}`;
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
