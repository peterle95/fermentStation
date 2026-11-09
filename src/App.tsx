import { useEffect, useRef, useState, type ReactNode } from "react";
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
  destinations,
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
  today: "Today",
  batches: "Batches",
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

function DesignIcon({ name }: { name: "leaf" | "jar" | "search" | "sort" | "plus" | "bell" | "user" | "sparkles" | "temp" | "clock" | "back" | "check" | "book" | "drop" }) {
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
    book: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15",
    drop: "M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{name === "jar" && <rect x="6" y="3" width="12" height="4" rx="1.5" />}<path d={paths[name]} />{name === "temp" && <circle cx="12" cy="18" r="1" />}</svg>;
}

function profileVisual(profile: FermentationProfile) {
  const name = profile.name.toLowerCase();
  if (name.includes("kimchi")) return { photo: "kimchi", color: "#fbd4f3", emoji: "🥬" };
  if (name.includes("kombucha")) return { photo: "kombucha", color: "#dbe6fb", emoji: "🍵" };
  if (name.includes("sourdough")) return { photo: "sourdough", color: "#f7eab9", emoji: "🌾" };
  if (name.includes("sauerkraut")) return { photo: "kraut", color: "#e0ecd0", emoji: "🥬" };
  return { photo: null, color: "#e4eee2", emoji: "🫙" };
}

function BatchPhoto({ batch, detail = false }: { batch: Batch; detail?: boolean }) {
  const visual = profileVisual(batch.profileSnapshot);
  const photo = batch.timeline.filter((entry) => entry.kind === "photo").at(-1);
  return <div className={detail ? "design-detail-photo" : "design-batch-photo"} style={{ background: visual.color }}>
    {photo ? <img alt={`Batch photograph: ${photo.caption || photo.name}`} src={photo.dataUrl} /> : visual.photo
      ? <img alt={`${batch.profileSnapshot.name} stand-in photograph`} data-source="stand-in" src={`${import.meta.env.BASE_URL}new-design/${visual.photo}.webp`} />
      : <DesignIcon name="jar" />}
    {detail && <span className={`status status-${batch.status}`}>{statusLabel(batch.status)}</span>}
    <span className="design-photo-label">{batch.status === "to-fridge" ? "In the fridge" : batch.status === "ready" && !detail ? batch.finishDate === localDate() ? "Ready today" : "Ready to enjoy" : batch.finishDate ? `Finish ${shortDate(batch.finishDate)}` : "No finish date"}</span>
  </div>;
}

function batchDay(batch: Batch) {
  return Math.max(1, Math.floor((Date.parse(`${localDate()}T00:00:00Z`) - Date.parse(`${batch.startDate}T00:00:00Z`)) / 86_400_000) + 1);
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function inputEmoji(name: string) {
  const term = name.toLowerCase();
  return term.includes("carrot") ? "🥕" : term.includes("chilli") || term.includes("chili") ? "🌶️" : term.includes("salt") ? "🧂" : term.includes("water") ? "💧" : term.includes("flour") ? "🌾" : term.includes("sugar") ? "🍬" : term.includes("tea") ? "🍵" : term.includes("ginger") ? "🫚" : term.includes("cabbage") ? "🥬" : "🫙";
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
    {amount && <span><span aria-hidden="true">{profileVisual(batch.profileSnapshot).emoji}</span>{amount}</span>}
    {guidance && salt?.percentage && salt.operator === "*" && <span title="Profile formula percentage"><span aria-hidden="true">🧂</span>{salt.operand}%</span>}
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
  return <dialog aria-labelledby="station-dialog-title" className="station-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} ref={dialogRef}>
    <div className="station-dialog-heading"><h2 id="station-dialog-title">{title}</h2><button aria-label="Close dialog" className="station-dialog-close" onClick={onClose} ref={closeRef} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div>
    {children}
  </dialog>;
}

function profileInputsText(profile: FermentationProfile) {
  return profile.inputs.map(({ name, unit, defaultValue }) => `${name}${defaultValue === undefined ? "" : ` ${formatNumber(defaultValue)} ${unit === "l" ? "L" : unit === "ml" ? "mL" : unit}`}`).join(" · ") || "No profile inputs.";
}

function ProfileOverview({ profile, onStart }: { profile: FermentationProfile; onStart(): void }) {
  const salt = parseSimpleFormula(profile.calculations.find(({ name }) => name.toLowerCase() === "salt")?.formula ?? "");
  return <div className="station-dialog-body">
    <p><RichProfileText value={profile.guidance.join(" ") || "No guidance defined yet."} /></p>
    <dl><dt>Expected fermentation duration</dt><dd>{profile.expectedDurationDays ? `${profile.expectedDurationDays} days` : "Not set"}</dd><dt>Profile temperature range</dt><dd>{profile.temperatureMinC !== undefined && profile.temperatureMaxC !== undefined ? `${profile.temperatureMinC}–${profile.temperatureMaxC} °C` : "Not set"}</dd>{salt?.percentage && salt.operator === "*" && <><dt>Salt guidance</dt><dd>{salt.operand}%</dd></>}</dl>
    <h3>Profile inputs</h3><p>{profileInputsText(profile)}</p>
    <h3>Profile checks</h3><p>{profile.checks.map(({ name, intervalDays }) => `${name} · every ${intervalDays} ${intervalDays === 1 ? "day" : "days"}`).join(" · ") || "No recurring checks."}</p>
    <div className="station-dialog-actions"><button className="station-primary" onClick={onStart} type="button">Start a batch</button></div>
  </div>;
}

function StartBatchForm({ profiles, initialProfile, onCreate, onCancel }: { profiles: FermentationProfile[]; initialProfile?: FermentationProfile; onCreate(batch: Batch): void; onCancel(): void }) {
  const available = initialProfile ? profiles.some(({ id }) => id === initialProfile.id)
    ? profiles.map((profile) => profile.id === initialProfile.id ? initialProfile : profile)
    : [...profiles, initialProfile] : profiles;
  const [profileId, setProfileId] = useState(initialProfile?.id ?? profiles[0]?.id ?? "");
  const [error, setError] = useState("");
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
      setError((error as Error).message);
    }
  }
  return <form onSubmit={save}>
    <p className="station-dialog-body">Choose a fermentation profile for your next batch.</p>
    <label className="station-field">Batch name<input autoComplete="off" maxLength={60} name="name" placeholder="e.g. My weekend kimchi" title="Optional; uses the profile name if blank" /></label>
    <label className="station-field">Fermentation profile<select name="profileId" onChange={(event) => { setProfileId(event.target.value); setError(""); }} required value={profileId}>{available.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.expectedDurationDays ? `${profile.expectedDurationDays} days` : "duration not set"}</option>)}</select></label>
    <label className="station-field">Start date<input defaultValue={localDate()} max={localDate()} name="startDate" required type="date" /></label>
    {profile && profile.inputs.length > 0 ? <details className="station-options"><summary><span>Batch input options</span> · name is optional</summary><div key={profile.id}>{profile.inputs.map((input) => <label className="station-field" key={input.name}>{input.name} ({input.unit})<input defaultValue={input.defaultValue} min="0" name={`input.${input.name}`} step="any" type="number" /></label>)}<p>Blank inputs use profile defaults. Changes are saved on this device.</p></div></details> : <p className="station-helper">Saved on this device · name is optional.</p>}
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
  const [showPhoneDetail, setShowPhoneDetail] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [dialog, setDialog] = useState<StationDialogState | null>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const [batchListVersion, setBatchListVersion] = useState(0);
  function showDialog(next: StationDialogState) {
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
    const next = selectDestination(shell, destination);
    if (webStorage.current === "fallback") browserShellStore.save(next);
    setShell(next);
    persistShared(sharedDataStore.saveShell(next));
    setShowPhoneDetail(false);
    setShowChecks(false);
    setEditingProfileId(null);
    setDialog(null);
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

  function openBatch(id: string | null) {
    if (id) setOpenBatchId(id);
    setShowPhoneDetail(id !== null);
  }

  function openChecks() {
    navigate("batches");
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
    const batches = updateBatchDates(discardExpiredBatches(snapshot.batchState, Date.now()));
    if (webStorage.current === "fallback") {
      browserShellStore.save(snapshot.shell);
      browserProfileStore.save(snapshot.profileState);
      browserBatchStore.save(batches);
    }
    setShell(snapshot.shell);
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
          <span className="brand-mark" aria-hidden="true"><DesignIcon name="leaf" /></span>
          <div><strong>FermentStation</strong></div>
        </div>
        <nav aria-label="Primary navigation" className="navigation">
          {destinations.map((destination) => (
            <button
              aria-label={destination === "calendar" ? "Checks" : labels[destination]}
              aria-current={(destination === "calendar" ? showChecks : !showChecks && (shell.destination === destination || destination === "today" && shell.destination === "batches")) ? "page" : undefined}
              className={`nav-${destination}`}
              key={destination}
              onClick={() => destination === "calendar" ? openChecks() : navigate(destination)}
              type="button"
            >
              <span className="nav-mark" aria-hidden="true"><NavIcon destination={destination} /></span>
              {destination === "settings" ? (
                <span>More</span>
               ) : <span className="nav-word">{destination === "today" ? "My batches" : destination === "calendar" ? "Checks" : labels[destination]}</span>}
              {destination === "today" && <span className="design-nav-count">{batchState.batches.length}</span>}
            </button>
          ))}
          {(shell.destination === "calendar" || shell.destination === "settings") && <button aria-label="Start a batch" className="batch-fab primary-action design-global-start" disabled={profileState.profiles.length === 0} onClick={() => showDialog({ kind: "start" })} type="button"><span className="nav-mark"><DesignIcon name="plus" /></span><span>Start a batch</span></button>}
          <button aria-label="Open station information" className="design-mobile-info" onClick={() => showDialog({ kind: "info" })} type="button"><span className="nav-mark"><DesignIcon name="user" /></span></button>
        </nav>
        <div className="design-sidebar-bottom">
          <div className="design-side-note"><DesignIcon name="sparkles" /><h2>A little care.<br />A living kitchen.</h2><p>Keep your cultures close, and your batch notes closer.</p></div>
          <button aria-label="Open station information" className="design-account" onClick={() => showDialog({ kind: "info" })} type="button"><span className="design-avatar"><DesignIcon name="user" /></span><span>My kitchen<small>Home fermenter</small></span><span aria-hidden="true">›</span></button>
        </div>
      </aside>

      <div className="content-shell">
        {webStorageError && <section role="alert" className="storage-warning">
          <strong>Changes may not be saved on this device.</strong>{" "}
          Export a backup from Settings before closing the app.
          {webStorage.current === "indexeddb" && <button type="button" onClick={() => setWebRetry((value) => value + 1)}>Retry saving</button>}
          {webStorage.current === "failed" && <button type="button" onClick={retryWebLoad}>Retry loading</button>}
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
                mode={shell.destination === "today" ? "today" : "batches"}
                pane={showChecks ? "checks" : shell.destination === "profiles" ? "profiles" : "batches"}
                showPhoneDetail={showPhoneDetail}
                onChecks={openChecks}
                onObservationAdded={() => setAnnouncement({ message: "Observation added" })}
                profilePane={shell.destination === "profiles" && <section className="profiles-screen" aria-label="Fermentation profiles">
                  {!editingProfileId && <div className="design-view-heading"><h1>Fermentation profiles</h1><p>The methods, inputs, and guidance behind your batches.</p></div>}
                  <Profiles formulaTerms={shell.formulaTerms} profiles={profileState.profiles} onDelete={(id) => saveProfiles(deleteProfile(profileState, id))} onSave={handleProfile} onEditingChange={setEditingProfileId} onView={(profile) => showDialog({ kind: "profile", profile })} />
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
                onDelete={(id) => saveBatches(deleteBatch(batchState, id, Date.now()))}
                profiles={profileState.profiles}
                units={shell.units}
              />
            </section>
          {shell.destination === "calendar" ? (
            <section className="calendar-screen" aria-label="Fermentation calendar">
              <div className="screen-head">
                <div>
                  <p className="eyebrow">Check-ins &amp; ready days</p>
                  <h1>Calendar</h1>
                  <p className="screen-intro">Amber marks a profile check, green a ready day, blue a shift to the fridge.</p>
                </div>
              </div>
              <CalendarView batches={batchState.batches} onOpen={(id) => { navigate("batches"); openBatch(id); }} />
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
              <button className="primary-action" onClick={() => navigate("calendar")} type="button">Calendar</button>
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
                onRestoreBatch={(id) => saveBatches(restoreBatch(batchState, id, Date.now()))}
                storageStatus={storageStatus}
                onChooseStorage={chooseSharedLocation}
                onReloadStorage={reloadSharedLocation}
                onResolveStorage={resolveSharedMigration}
              />
            </section>
          ) : null}
        </main>
      </div>
      {dialog && <StationDialog mode={dialog.kind} title={dialog.kind === "start" ? "Start a batch" : dialog.kind === "profile" ? dialog.profile.name : dialog.kind === "dates" ? "Batch dates" : dialog.kind === "inputs" ? "Profile inputs" : "Your fermentation station"} returnFocus={dialogTrigger.current} onClose={() => setDialog(null)}>
        {dialog.kind === "start" && <StartBatchForm profiles={profileState.profiles} initialProfile={dialog.profile} onCancel={() => setDialog(null)} onCreate={(batch) => {
          const current = stateRef.current.batchState;
          saveBatches({ ...current, batches: [...current.batches, batch] });
          navigate("batches");
          setBatchListVersion((version) => version + 1);
          openBatch(batch.id);
          setAnnouncement({ message: `Batch started · ${batch.name}` });
          requestAnimationFrame(() => document.querySelector<HTMLElement>(".design-detail")?.focus({ preventScroll: true }));
        }} />}
        {dialog.kind === "profile" && <ProfileOverview profile={dialog.profile} onStart={() => showDialog({ kind: "start", profile: dialog.profile })} />}
        {dialog.kind === "dates" && <div className="station-dialog-body"><dl><dt>Start date</dt><dd>{shortDate(dialog.batch.startDate)}</dd><dt>Finish date</dt><dd>{dialog.batch.finishDate ? shortDate(dialog.batch.finishDate) : "Not set"}</dd><dt>Batch status</dt><dd>{statusLabel(dialog.batch.status)}</dd></dl><p>A batch becomes ready on its finish date. Moving it to the fridge slows fermentation.</p></div>}
        {dialog.kind === "inputs" && <div className="station-dialog-body"><p>{profileInputsText(dialog.batch.profileSnapshot)}</p><h3>Profile guidance</h3><p><RichProfileText value={dialog.batch.profileSnapshot.guidance.join(" ") || "No guidance defined yet."} /></p></div>}
        {dialog.kind === "info" && <div className="station-dialog-body"><p>A local fermentation journal for tracking household fermentation batches.</p><h3>Try it out</h3><p>Filter and search batches, open batch details, complete a check, or add an observation. Start a batch from any fermentation profile.</p><h3>Your data</h3><p>Data is saved on this device. Manage backups, shared folders, and credits in <button className="station-text-action" onClick={() => navigate("settings")} type="button">Settings</button>.</p></div>}
      </StationDialog>}
      <div aria-atomic="true" className="design-toast" hidden={!announcement} role="status">{announcement?.message}</div>
    </div>
  );
}

function formatToday() {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", month: "long", day: "numeric" })
    .format(new Date(`${localDate()}T12:00:00`)).replace(/^(\w+) /, "$1, ");
}

interface SettingsViewProps {
  batchState: BatchState;
  formulaTerms: string[];
  preferences: ShellPreferences;
  profileState: ReturnType<typeof createProfileState>;
  onFormulaTermsChange(formulaTerms: string[]): void;
  onPreferencesChange(preferences: ShellPreferences, requestNotificationPermission?: boolean): void;
  onImport(profiles: ReturnType<typeof createProfileState>, batches: BatchState): void;
  onRestoreBatch(id: string): void;
  storageStatus: SharedStorageStatus;
  onChooseStorage(): void;
  onReloadStorage(): void;
  onResolveStorage(choice: "shared" | "device"): void;
}

function SettingsView({ batchState, formulaTerms, preferences, profileState, onFormulaTermsChange, onPreferencesChange, onImport, onRestoreBatch, storageStatus, onChooseStorage, onReloadStorage, onResolveStorage }: SettingsViewProps) {
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
    try {
      const imported = await importArchive(bytes, profileState, batchState);
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
    }
  }

  async function uploadArchive(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await importBytes(new Uint8Array(await file.arrayBuffer()));
    event.target.value = "";
  }

  async function pickArchive() {
    try {
      const bytes = await pickNativeArchive();
      if (bytes) await importBytes(bytes);
    } catch (error) {
      setMessage(`Import rejected: ${(error as Error).message}`);
    }
  }

  return (
    <section className="settings" aria-label="Local backup and transfer">
      <section className="settings-card settings-exchange" aria-labelledby="data-storage-heading">
        <h3 id="data-storage-heading">Data storage</h3>
        <p>Shared folder: {storageStatus.location ?? "Not selected"}</p>
        <p>Status: {storageStatus.message}</p>
        {storageStatus.state !== "unavailable" && (
          <button className="primary-action" onClick={onChooseStorage} type="button">Choose folder</button>
        )}
        {storageStatus.location && (
          <button onClick={onReloadStorage} type="button">Reload from shared folder</button>
        )}
        {storageStatus.state === "migration" && (
          <div className="form-actions">
            <button onClick={() => onResolveStorage("shared")} type="button">Use shared folder data</button>
            <button onClick={() => onResolveStorage("device")} type="button">Use this device's data</button>
          </div>
        )}
        {storageStatus.conflicts.length > 0 && (
          <div className="notice" role="alert">
            <b>Synchronization conflict detected. Your files have been preserved.</b>
            {storageStatus.conflicts.map((path) => <span key={path}>{path}</span>)}
          </div>
        )}
      </section>
      <section className="settings-card" aria-label="Household preferences">
        <div className="setting-row">
          <div className="setting-body"><b>Units</b><p>Readouts for temperature and volume.</p></div>
          <div className="setting-segment" aria-label="Units">
            <button aria-pressed={preferences.units === "metric"} onClick={() => onPreferencesChange({ ...preferences, units: "metric" })} type="button">°C / L</button>
            <button aria-pressed={preferences.units === "imperial"} onClick={() => onPreferencesChange({ ...preferences, units: "imperial" })} type="button">°F / qt</button>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-body"><b>Notifications</b><p>Choose alerts for due checks, ready batches, both, or neither.</p></div>
          <div className="setting-segment notification-segment" aria-label="Notifications" role="group">
            {([["all", "All"], ["checks", "Checks"], ["ready", "Ready"], ["off", "Off"]] as const).map(([mode, label]) => (
              <button aria-pressed={preferences.notificationMode === mode} key={mode} onClick={() => onPreferencesChange({ ...preferences, notificationMode: mode }, true)} type="button">{label}</button>
            ))}
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
        <p>These names are stored in the shared folder when configured and are not included in archives.</p>
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
        <p>Archives contain profiles, batches (including trash), and photos, up to 200 MB zipped (250 MB expanded). They do not include app settings such as destination, units, notifications, suggestions, or formula terms.</p>
        <button className="primary-action" onClick={downloadArchive} type="button">Export ZIP archive</button>
        {isNativeTransferAvailable() && <button onClick={pickArchive} type="button">Choose ZIP from device</button>}
        <label>Import ZIP archive <input accept=".zip,application/zip" onChange={uploadArchive} type="file" /></label>
      </section>
      <section className="settings-card" aria-labelledby="credits-heading"><h3 id="credits-heading">Credits and licenses</h3><p>Outfit © 2021 The Outfit Project Authors. <a href={`${import.meta.env.BASE_URL}new-design/OFL.txt`}>SIL Open Font License 1.1</a>.</p><PhotoCredits /></section>
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

interface BatchPickerProps {
  date: string;
  events: CalendarEvent[];
  onClose(): void;
  onOpen(id: string): void;
}

function BatchPicker({ date, events, onClose, onOpen }: BatchPickerProps) {
  const batchIds = [...new Set(events.map(({ batchId }) => batchId))];

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [onClose]);

  if (batchIds.length < 2) return null;

  return (
    <div className="upcoming-batch-picker-overlay" onClick={onClose}>
      <div aria-label={`Choose a batch for ${date}`} aria-modal="true" className="upcoming-batch-picker" id={`upcoming-batch-picker-${date}`} onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="upcoming-batch-picker-heading">
          <strong>Choose a batch</strong>
          <button onClick={onClose} type="button">Close</button>
        </div>
        {batchIds.map((batchId) => {
          const batchEvents = events.filter((event) => event.batchId === batchId);
          const batchName = batchEvents[0].batchName;
          return (
            <button aria-label={`Open ${batchName}`} className="upcoming-batch-choice" key={batchId} onClick={() => { onClose(); onOpen(batchId); }} type="button">
              <strong>{batchName}</strong>
              <span>{batchEvents.map((event) => event.label).join(" · ")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarView({ batches, onOpen }: { batches: Batch[]; onOpen(id: string): void }) {
  const [viewDate, setViewDate] = useState(() => new Date(`${localDate()}T12:00:00`));
  const [openDate, setOpenDate] = useState<string | null>(null);
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
          {cells.map((cell, index) => {
            if (!cell.date) return <div aria-hidden="true" className="calendar-day other" key={`leading-${index}`} />;
            const dateValue = cell.date;
            const batchIds = [...new Set(cell.events.map(({ batchId }) => batchId))];
            const canChooseBatch = batchIds.length > 1;
            const contents = <>
              <span className="calendar-day-number">{Number(cell.date.slice(-2))}</span>
              {cell.events.map((event) => (
                <span className={`calendar-event event-${event.kind}`} key={`${event.batchId}-${event.kind}-${event.label}`} title={`${event.batchName}: ${event.label}`}>
                  {event.label}
                </span>
              ))}
            </>;
            return (
              <div
                aria-label={cell.events.length ? undefined : cell.date}
                className={`calendar-day${dateValue === today ? " today" : ""}${cell.events.length ? " has-events" : ""}`}
                key={dateValue}
                role="gridcell"
              >
                {cell.events.length ? (
                  <button
                    aria-controls={canChooseBatch ? `upcoming-batch-picker-${dateValue}` : undefined}
                    aria-expanded={canChooseBatch ? openDate === dateValue : undefined}
                    aria-haspopup={canChooseBatch ? "dialog" : undefined}
                    aria-label={canChooseBatch ? `Choose a batch for ${dateValue}` : `Open ${cell.events[0].batchName} for ${dateValue}`}
                    className="calendar-day-button"
                    onClick={() => canChooseBatch ? setOpenDate((current) => current === dateValue ? null : dateValue) : onOpen(batchIds[0])}
                    type="button"
                  >
                    {contents}
                  </button>
                ) : contents}
              </div>
            );
          })}
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
              <button aria-label={`Open ${event.batchName}: ${event.label}`} className="upcoming-item" key={`${event.batchId}-${event.kind}-${event.date}`} onClick={() => onOpen(event.batchId)} type="button">
                <div className="upcoming-date"><b>{date.getDate()}</b><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)}</span></div>
                <div className="upcoming-body"><time className="calendar-event-date" dateTime={event.date}>{event.date}</time><b>{event.batchName} {isFinish ? "finish date" : event.label}</b><p>{isFinish ? "Ready to bottle or move on." : "Profile check · due"}</p></div>
                <span className={`calendar-status ${isFinish ? "ready" : "attention"}`}><span className="status-dot" />{isFinish ? "ready" : "check"}</span>
              </button>
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
                <button aria-label={`Open ${event.batchName}: ${event.label}`} className="upcoming-item overdue-item" key={`${event.batchId}-${event.kind}-${event.date}-${event.label}`} onClick={() => onOpen(event.batchId)} type="button">
                  <div className="upcoming-date"><b>{date.getDate()}</b><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)}</span></div>
                  <div className="upcoming-body"><time className="calendar-event-date" dateTime={event.date}>{event.date}</time><b>{event.batchName} {event.label}</b><p>Profile check · overdue</p></div>
                  <span className="calendar-status attention"><span className="status-dot" />overdue</span>
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

interface BatchViewProps {
  visible: boolean;
  onObservationAdded(): void;
  batches: Batch[];
  onDialog(dialog: StationDialogState): void;
  batchListVersion: number;
  mode: "today" | "batches";
  pane: "batches" | "checks" | "profiles";
  profilePane: ReactNode;
  showPhoneDetail: boolean;
  onChecks(): void;
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

function BatchView({ visible: workspaceVisible, batches, mode, pane, profilePane, showPhoneDetail, onChecks, onObservationAdded, profiles, units, onDialog, batchListVersion, onChange, onUpdate, onComplete, onDelete, onNavigate, onOpen, onSelect, openBatchId }: BatchViewProps) {
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
    if (!window.matchMedia?.("(min-width: 901px)").matches) detailRef.current?.focus({ preventScroll: true });
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
    .sort((left, right) => left.check.nextDueDate.localeCompare(right.check.nextDueDate) ||
      left.batch.name.localeCompare(right.batch.name) || left.check.name.localeCompare(right.check.name));
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
    onOpen(null);
    requestAnimationFrame(() => overviewHeadingRef.current?.focus({ preventScroll: true }));
  }

  return (
    <section className={`batches design-workspace${openBatch && showPhoneDetail ? " design-selected" : ""}`} aria-label="Fermentation workspace">
      <header className="design-topbar">
        <button aria-label="Open station information" className="design-avatar design-mobile-avatar" onClick={() => onDialog({ kind: "info" })} type="button"><DesignIcon name="leaf" /></button>
        <div className="design-topbar-copy"><p>{formatToday()}</p><div>Your fermentation station</div></div>
        <button aria-label="Calendar" className="design-date-chip" onClick={() => onNavigate("calendar")} type="button"><NavIcon destination="calendar" /><span>Today, {shortDate(localDate())}</span><svg aria-hidden="true" className="design-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg></button>
        <div className="design-topbar-actions"><button aria-label="View batch checks" className="icon-button" onClick={onChecks} type="button"><DesignIcon name="bell" /></button>
        <button
          aria-label="Start a batch"
          className="batch-fab primary-action"
          disabled={profiles.length === 0}
          onClick={() => onDialog({ kind: "start" })}
          type="button"
        >
          <DesignIcon name="plus" /><span>Start a batch</span>
        </button>
        </div>
      </header>

      <div className="design-dashboard" key={pane}>
      {pane === "profiles" ? profilePane : pane === "checks" ? <section aria-label="Batch checks" className="design-checks-view">
        <div className="design-view-heading"><h1>Your batch checks</h1><p>A small check-in for the cultures in your kitchen.</p></div>
        <div className="design-all-checks">{batches.filter(({ status }) => status === "active").flatMap((batch) => batch.checks.map((check) => {
          const completed = check.lastCompletedDate === today;
          return <article className={`queue-card${completed ? " done" : ""}`} key={`${batch.id}-${check.id}`}>
            <span className="queue-icon" aria-hidden="true"><DesignIcon name={check.name.toLowerCase().includes("brine") ? "drop" : "leaf"} /></span>
            <button aria-label={`Open ${batch.name} for ${check.name}`} className="design-check-copy" onClick={() => onOpen(batch.id)} type="button"><strong>{check.name}</strong><span>{batch.name} · {check.nextDueDate === today ? "Today" : `${completed || check.nextDueDate > today ? "Due" : "Overdue"} ${shortDate(check.nextDueDate)}`}</span></button>
            <button aria-label={`${completed ? "Completed" : "Complete"} ${check.name} for ${batch.name}`} className="design-check-complete" disabled={completed} onClick={() => onComplete(batch.id, check.id)} type="button"><DesignIcon name="check" /></button>
          </article>;
        }))}</div>
        {!batches.some((batch) => batch.status === "active" && batch.checks.length > 0) && <p className="design-empty-checks">No checks scheduled for your active batches.</p>}
        <PhotoCredits />
      </section> : <>
        <div className="design-search-box"><DesignIcon name="search" /><input aria-label="Search batches" autoComplete="off" onChange={(event) => setQuery(event.target.value)} placeholder="Search your batches" type="search" value={query} /><button aria-label="Sort batches by finish date" aria-pressed={sorted} onClick={() => setSorted(!sorted)} type="button"><DesignIcon name="sort" /></button></div>
        <section className="design-summary" aria-label="Kitchen summary">
          <div className="design-gauge"><svg aria-hidden="true" viewBox="0 0 154 126"><path className="design-gauge-track" d="M17 111a62 62 0 1 1 120 0" /><path className="design-gauge-value" d="M17 111a62 62 0 1 1 120 0" pathLength="100" strokeDasharray={`${batches.length ? 76 : 0} 100`} /></svg><div><strong>{batches.length}</strong><span>batches</span><small><DesignIcon name="sparkles" />{readyBatches.length} ready to enjoy</small></div></div>
          <div className="design-summary-label"><h2>Good things<br />are growing.</h2><p>A little check-in keeps your batches on track.</p></div>
          <div className="design-summary-stats">{batchStatuses.map((status, index) => {
            const count = batches.filter((batch) => batch.status === status).length;
            return <div className="design-stat-row" key={status}><div><span aria-hidden="true">{["🌱", "✨", "🧊"][index]}</span>{statusLabel(status)}<span className="design-stat-number">{count}<span>/{batches.length}</span></span></div><div className="design-stat-track"><i style={{ width: `${batches.length ? count / batches.length * 100 : 0}%` }} /></div></div>;
          })}</div>
        </section>
        <div className="design-section-head"><h1 id="batch-overview-heading" ref={overviewHeadingRef} tabIndex={-1}>Your batches <span>{visible.length}</span></h1><button className="design-quiet" onClick={() => { setFilter("all"); setQuery(""); if (mode === "today") onNavigate("batches"); }} type="button">See all</button></div>
        <div className="filter-row" role="group" aria-label="Filter batches by status">
          {(["all", ...batchStatuses] as BatchFilter[]).map((status) => <button aria-pressed={filter === status} key={status} onClick={() => setFilter(status)} type="button">{status === "all" ? "All" : statusLabel(status)}{status === "all" && <span> batches</span>}</button>)}
        </div>

      {profiles.length === 0 && <p className="notice">Restore or create a profile before starting a batch.</p>}

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
        {openBatch ? <><div className="design-detail-top"><button aria-label={`Back to ${mode}`} className="icon-button design-back" onClick={closeBatch} type="button"><DesignIcon name="back" /></button><h2>Batch details</h2><button aria-label="View batch dates" className="icon-button" onClick={() => onDialog({ kind: "dates", batch: openBatch })} type="button"><NavIcon destination="calendar" /></button></div><BatchCard batch={openBatch} key={openBatch.id} visible={workspaceVisible} onChange={onChange} onUpdate={onUpdate} onComplete={onComplete} onObservationAdded={onObservationAdded} onDialog={onDialog} onDelete={onDelete} units={units} /></> : <div className="design-detail-empty"><DesignIcon name="jar" /><h2>Your batch details</h2><p>Choose a batch to see its progress and record an observation.</p></div>}
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
    <button aria-label={`Open ${batch.name}`} aria-pressed={selected} className={`design-batch-card${selected ? " selected" : ""}`} onClick={() => onOpen(batch.id)} type="button">
      <div className="design-batch-copy"><h3>{batch.name}</h3><BatchMeta batch={batch} units={units} /><div className="design-batch-bottom"><strong>{batch.status === "to-fridge" ? "Chilled" : `Day ${day}`}</strong>{batch.status !== "to-fridge" && batch.finishDate && <span>/ {Math.max(1, Math.round((Date.parse(batch.finishDate) - Date.parse(batch.startDate)) / 86_400_000))}</span>}</div><span className="sr-only">{statusText}. {latestPh && `pH ${latestPh.value}.`} Next: {next}</span></div>
      <BatchPhoto batch={batch} />
    </button>
  );
}

interface BatchCardProps {
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

function BatchCard({ batch, visible, onChange, onUpdate, onComplete, onObservationAdded, onDialog, onDelete, units }: BatchCardProps) {
  const [editing, setEditing] = useState<EditableTimelineEntry | null>(null);
  const [loggerKind, setLoggerKind] = useState<LoggerKind>("status");
  const [checkDrafts, setCheckDrafts] = useState<Record<string, string>>({});
  const [checkError, setCheckError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [addingCheck, setAddingCheck] = useState(false);
  const [newCheckName, setNewCheckName] = useState("");
  const [newCheckInterval, setNewCheckInterval] = useState("7");
  const [loggerModal, setLoggerModal] = useState(false);
  const [observationMode, setObservationMode] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mounted = useRef(false);
  const modal = useRef(false);
  const revision = useRef(0);
  const operation = useRef(0);
  const dirty = useRef(false);
  const basicObservation = loggerModal && observationMode;

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
    const form = formRef.current;
    const version = revision.current;
    const request = ++operation.current;
    revealLogger();
    if (!isNativeCameraAvailable()) return;
    try {
      const photo = await captureNativePhoto();
      if (mounted.current && formRef.current === form && revision.current === version && operation.current === request) setCapturedPhoto(photo);
    } catch (error) {
      if (mounted.current && formRef.current === form && revision.current === version && operation.current === request) setCheckError(`Camera unavailable: ${(error as Error).message}`);
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
    const version = revision.current;
    const request = ++operation.current;
    const kind = originEditing?.kind ?? loggerKind;
    const common = {
      id: originEditing?.id ?? createClientId(),
      date: String(data.get("date") ?? ""),
    };
    const finish = () => {
      if (!mounted.current || formRef.current !== form || revision.current !== version || operation.current !== request) return;
      revision.current++;
      dirty.current = false;
      setEditing(null);
      setLoggerKind("status");
      setObservationMode(false);
      setCapturedPhoto(null);
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
      const selected = file && file.size > 0
        ? { name: file.name, mimeType: file.type, dataUrl: await fileToDataUrl(file) }
        : capturedPhoto;
      const photo: TimelineEntry = {
        ...common,
        kind,
        name: selected?.name ?? current!.name,
        mimeType: selected?.mimeType ?? current!.mimeType,
        dataUrl: selected?.dataUrl ?? current!.dataUrl,
        caption: String(data.get("caption") ?? "").trim(),
      };
      onUpdate(originId, (current) => originEditing ? updateTimelineEntry(current, photo) : addTimelineEntry(current, photo));
      finish();
      return;
    } else {
      entry = { ...common, kind, text: String(data.get("text") ?? "").trim() };
    }
    if (!entry.date || ("value" in entry && !Number.isFinite(entry.value)) || ("text" in entry && !entry.text)) return;
    if (kind === "ph") {
      const phEntry = entry as Extract<TimelineEntry, { kind: "ph" }>;
      onUpdate(originId, (current) => originEditing ? updatePhReading(current, phEntry) : addPhReading(current, phEntry));
      finish();
      return;
    }
    onUpdate(originId, (current) => originEditing ? updateTimelineEntry(current, entry, localDate()) : addTimelineEntry(current, entry));
    finish();
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

  function editEntry(entry: TimelineEntry) {
    if (entry.kind === "check" || entry.kind === "measurement") return;
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
    revision.current++;
    dirty.current = false;
    setEditing(null);
    setObservationMode(false);
    setCapturedPhoto(null);
    formRef.current?.reset();
    formRef.current?.querySelector("textarea")?.setCustomValidity("");
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
      <div className="design-detail-card">
        <div className="design-detail-heading"><span className="design-check-symbol"><DesignIcon name="jar" /></span><div><h3>{batch.name}</h3><p>{batch.profileSnapshot.name} batch</p></div><button aria-label="Add observation" className="icon-button" onClick={showLogger} type="button"><DesignIcon name="plus" /></button></div>
        <div className="design-detail-metrics"><BatchMeta batch={batch} units={units} guidance /><strong>{day}<small> / {batch.finishDate ? Math.max(1, Math.round((Date.parse(batch.finishDate) - Date.parse(batch.startDate)) / 86_400_000)) : "—"} days</small></strong></div>
        <BatchPhoto batch={batch} detail />
      </div>
      <section className="design-input-summary"><div className="design-section-head"><h3>Profile inputs</h3><button className="design-quiet" onClick={() => onDialog({ kind: "inputs", batch })} type="button">See all</button></div><div className="design-ingredients">{batch.profileSnapshot.inputs.map((input) => <span key={input.name}><span aria-hidden="true">{inputEmoji(input.name)}</span>{input.name}</span>)}{batch.profileSnapshot.inputs.length === 0 && <p>No profile inputs.</p>}</div></section>
      <div className="workbench">
        <div className="wb-rail">
      <section className="batch-management" hidden={!managementOpen} id="batch-management" aria-label="Batch management tools">
      <div className="batch-workspace-head">
        <div className="batch-head-actions">
          <button aria-label="Take photo" className="batch-head-camera" onClick={takePhoto} type="button"><svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 7h3l1.2-2h7.6L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></svg></button>
          <button
            aria-label={`Notifications for ${batch.name}`}
            aria-pressed={!batch.notificationsMuted}
            className="batch-head-notifications"
            onClick={() => onChange({ ...batch, notificationsMuted: !batch.notificationsMuted })}
            title={batch.notificationsMuted ? "Enable notifications for this batch" : "Mute notifications for this batch"}
            type="button"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />{batch.notificationsMuted && <path d="M4 4l16 16" />}</svg>
          </button>
          <button className="primary-action" onClick={showLogger} type="button">Record observation</button>
          <button onClick={revealLogger} type="button">Open advanced logger</button>
          <button onClick={() => revealManagementSection("batch-date-editor")} type="button">Edit batch dates</button>
          <button onClick={() => revealManagementSection("batch-input-editor")} type="button">Edit batch inputs and calculations</button>
          <button onClick={() => revealManagementSection("batch-check-editor")} type="button">Edit recurring checks</button>
          <button onClick={() => onDelete(batch.id)} type="button">Delete batch</button>
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
          <div className="batch-components-progress" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="batch-components-grid">
            <article className="batch-component-card" aria-labelledby="finish-heading" id="batch-date-editor">
              <header className="batch-component-header"><h2 id="finish-heading">Batch details</h2><span className="batch-component-step">01</span></header>
              <label className="component-field"><span>Finish date</span><input onChange={(event) => onChange(setFinishDate(batch, event.target.value, localDate()))} type="date" value={batch.finishDate ?? ""} /></label>
            </article>

            <article className="batch-component-card" aria-labelledby="inputs-heading" id="batch-input-editor">
              <header className="batch-component-header"><h2 id="inputs-heading">Profile inputs</h2><span className="batch-component-step">02</span></header>
              {batch.profileSnapshot.inputs.length > 0 ? <form className="component-inputs" onSubmit={saveInputs}>
                <div className="component-input-fields">
                  {batch.profileSnapshot.inputs.map((input) => (
                    <label className="component-field" key={input.name}><span>{input.name} ({input.unit})</span><input defaultValue={batch.inputValues[input.name]} min="0" name={input.name} step="any" type="number" /></label>
                  ))}
                </div>
                <button className="component-button component-button-primary" type="submit">Update inputs</button>
              </form> : <p className="component-empty">No profile inputs.</p>}
            </article>

            <article className="batch-component-card" aria-labelledby="calculations-heading">
              <header className="batch-component-header"><h2 id="calculations-heading">Profile calculations</h2><span className="batch-component-step">03</span></header>
              {batch.profileSnapshot.calculations.length > 0 ? batch.profileSnapshot.calculations.map((calculation) => {
                const value = batch.calculationValues[calculation.name];
                return (
                  <div className="component-calculation" key={calculation.name}>
                    <span className="component-pair-label">{calculation.name}:</span>
                    <div className="component-calculation-value"><strong>{formatCalculationValue(value?.override ?? value?.suggested)} {calculation.unit}</strong><span>{value?.override !== undefined ? " (overridden)" : " suggested"}</span></div>
                    <span className="sr-only">{formatCalculationValue(value?.override ?? value?.suggested)} {calculation.unit}{value?.override !== undefined ? " (overridden)" : " suggested"}</span>
                    <form className="component-override" onSubmit={(event) => {
                      event.preventDefault();
                      const raw = String(new FormData(event.currentTarget).get("override") ?? "");
                      if (raw !== "") onChange(overrideBatchCalculation(batch, calculation.name, Number(raw)));
                    }}>
                      <label className="component-field"><span>Override</span><input aria-label={`Override ${calculation.name}`} min="0" name="override" step="any" type="number" /></label>
                      <button className="component-button" type="submit">Override</button>
                    </form>
                  </div>
                );
              }) : <p className="component-empty">No calculations.</p>}
            </article>

            <article className="batch-component-card" aria-label={`${batch.name} checks`} id="batch-check-editor">
              <header className="batch-component-header"><h2>Recurring checks</h2><button className="component-button component-button-quiet" disabled={batch.status !== "active"} onClick={() => { setAddingCheck(true); setCheckError(""); }} type="button">Add check</button></header>
              {checkError && <p className="notice" role="alert">{checkError}</p>}
              {batch.checks.length === 0 && !addingCheck && <p className="component-empty">No recurring checks yet.</p>}
              {batch.checks.map((check) => {
                const due = dueBatchChecks(batch, localDate()).find(({ id }) => id === check.id);
                return (
                  <div className="component-check" key={check.id}>
                    <label className="component-field"><span>Check name</span><input aria-label={`Check name ${check.id}`} onChange={(event) => setCheckDrafts({ ...checkDrafts, [check.id]: event.target.value })} value={checkDrafts[check.id] ?? check.name} /></label>
                    <div className="component-check-meta">
                      <label className="component-field"><span>Next</span><input aria-label={`${check.name} next date`} readOnly type="date" value={check.nextDueDate} /></label>
                      <label className="component-field"><span>Every</span><input aria-label={`${check.name} interval days`} disabled={batch.status !== "active"} min="1" onChange={(event) => { try { onChange(adjustBatchCheck(batch, check.id, Number(event.target.value), localDate())); setCheckError(""); } catch (error) { setCheckError((error as Error).message); } }} type="number" value={check.intervalDays} /></label>
                    </div>
                    <p className="component-check-status">{batch.status === "active" ? `${due?.overdue ? "Overdue" : due ? "Due" : "Next"} ${check.nextDueDate}` : "Paused"}</p>
                    <div className="component-check-actions"><button className="component-button" onClick={() => saveCheckName(check.id, check.name)} type="button">Save name</button><button className="component-remove" aria-label={`Remove ${check.name}`} onClick={() => onChange(removeBatchCheck(batch, check.id))} type="button">Remove</button></div>
                  </div>
                );
              })}
              {addingCheck && <form className="component-check component-new-check" onSubmit={saveNewCheck}>
                <label className="component-field"><span>Check name</span><input autoFocus onChange={(event) => setNewCheckName(event.target.value)} placeholder="e.g. Taste and smell" required value={newCheckName} /></label>
                <label className="component-field"><span>Every</span><input min="1" onChange={(event) => setNewCheckInterval(event.target.value)} required type="number" value={newCheckInterval} /></label>
                <div className="component-check-actions"><button className="component-button" type="submit">Add recurring check</button><button className="component-remove" onClick={() => setAddingCheck(false)} type="button">Cancel</button></div>
              </form>}
            </article>
          </div>
        </section>
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
            <dialog aria-labelledby={loggerModal ? "observation-dialog-title" : undefined} className={`observation-logger${loggerModal ? " station-dialog" : " inline-logger"}`} onCancel={(event) => { event.preventDefault(); dismissLogger(); }} onClose={(event) => { if (!event.currentTarget.open && modal.current) dismissLogger(); }} ref={dialogRef} role={loggerModal ? "dialog" : "presentation"}>
            <div className="station-dialog-heading" hidden={!loggerModal}><h2 id="observation-dialog-title">Add observation</h2><button aria-label="Close dialog" className="station-dialog-close" onClick={() => dismissLogger()} ref={closeRef} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div>
            <form className={basicObservation ? "observation-form" : "timeline-form quick-log-form"} id="batch-activity-form" onChange={() => { revision.current++; dirty.current = true; }} onInput={() => { revision.current++; dirty.current = true; formRef.current?.querySelector("textarea")?.setCustomValidity(""); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") event.currentTarget.requestSubmit(); }} onSubmit={saveEntry} ref={formRef}>
              <p className="station-dialog-body" hidden={!loggerModal}>{batch.name}</p>
              <label className="sr-only" hidden={basicObservation}>Activity type<select disabled={!!editing || basicObservation} name="kind" onChange={(event) => changeKind(event.target.value as LoggerKind)} tabIndex={-1} value={loggerKind}>
                <option value="status">Status change</option><option value="ph">pH reading</option><option value="temperature">Temperature</option><option value="note">Note</option><option value="photo">Photo</option>
              </select></label>
              <div className="quick-log-types" aria-label="Activity choices" hidden={basicObservation} role="group">
                {(["status", "ph", "temperature", "note"] as LoggerKind[]).map((kind) => {
                  const label = kind === "ph" ? "pH reading" : kind === "status" ? "Status change" : kind[0].toUpperCase() + kind.slice(1);
                  return <button aria-pressed={loggerKind === kind} disabled={!!editing} key={kind} onClick={() => changeKind(kind)} type="button">{label}</button>;
                })}
              </div>
              <div className={basicObservation ? "observation-fields" : "quick-log-fields"}>
                <label className={basicObservation ? "station-field" : "quick-log-wide logger-context"}>{basicObservation ? "Observation" : <>Context <span>optional</span></>}<textarea aria-label={basicObservation ? "Observation" : "Activity context"} maxLength={basicObservation ? 500 : undefined} name="text" placeholder={basicObservation ? "What do you notice about this batch?" : "What should future-you know?"} required={!basicObservation && loggerKind === "note"} /></label>
                <label hidden={basicObservation || loggerKind !== "ph"}>pH value<input data-value="ph" disabled={basicObservation || loggerKind !== "ph"} name="value" required step="0.01" type="number" /></label>
                <label className={basicObservation ? "station-field" : undefined} hidden={!basicObservation && loggerKind !== "temperature"}>{basicObservation ? `Temperature reading (${temperatureUnit})` : `Temperature (${temperatureUnit})`}<div className={basicObservation ? "observation-temperature" : "quick-log-measure"}><input aria-label={basicObservation ? `Temperature reading (${temperatureUnit})` : `Temperature (${temperatureUnit})`} data-value="temperature" disabled={!basicObservation && loggerKind !== "temperature"} max={basicObservation ? units === "imperial" ? 212 : 100 : undefined} min={basicObservation ? units === "imperial" ? -4 : -20 : undefined} name="value" placeholder={basicObservation ? units === "imperial" ? "e.g. 70" : "e.g. 21" : undefined} required={!basicObservation} step={basicObservation ? "0.1" : "any"} type="number" /><span hidden={basicObservation}>{temperatureUnit}</span></div></label>
                <label hidden={basicObservation || loggerKind !== "status"}>New status<select aria-label="Activity status" defaultValue={batch.status} disabled={basicObservation || loggerKind !== "status"} name="status">{batchStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
                <label className="quick-log-wide" hidden={basicObservation || loggerKind !== "photo"}>Photo<input accept="image/*" capture="environment" disabled={basicObservation || loggerKind !== "photo"} name="photo" required={!editing && !capturedPhoto} type="file" /></label>
                <label hidden={basicObservation}>Activity date<input defaultValue={localDate()} name="date" required type="date" /></label>
                <label hidden={basicObservation || loggerKind !== "photo"}>Caption<input disabled={basicObservation || loggerKind !== "photo"} name="caption" /></label>
              </div>
              {loggerKind === "photo" && isNativeCameraAvailable() && <button className="quick-log-camera" onClick={takePhoto} type="button">Take photo</button>}
              {capturedPhoto && <p className="notice" role="status">Photo captured. Add a caption or save the activity.</p>}
              <p className="station-helper" hidden={!basicObservation}>Add a note, a reading, or both.</p>
              <div className={basicObservation ? "station-dialog-actions" : "quick-log-actions"}><span hidden={loggerModal}>Save with <kbd>Ctrl</kbd> <kbd>↵</kbd></span><div className={basicObservation ? "observation-actions" : undefined}><button className={basicObservation ? "station-secondary" : undefined} hidden={!loggerModal && !editing} onClick={cancelEntry} type="button">Cancel</button><button aria-label={basicObservation ? "Add observation" : editing ? "Save activity" : "Log activity"} className={basicObservation ? "station-primary" : "primary-action"} type="submit">{basicObservation ? "Add observation" : "Save activity"}</button></div></div>
            </form>
            </dialog>
          </section>

          <section className="wb-panel design-timeline-panel" aria-label={`${batch.name} timeline`}>
            <div className="timeline-panel-heading"><h3>Batch timeline <span className="sr-only">{batch.timeline.length} entries</span></h3><div className="timeline-panel-actions"><button aria-controls="batch-management" aria-expanded={managementOpen} aria-label="More batch tools" className="design-quiet" onClick={() => setManagementOpen((open) => !open)} type="button">Tools</button><button aria-label="Record timeline observation" className="design-quiet" onClick={showLogger} type="button">Add observation</button></div></div>
            <section className="timeline">
              {batch.timeline.length === 0 && <p>No activity recorded yet.</p>}
              {[...batch.timeline].reverse().map((entry) => (
                <div className={`timeline-entry timeline-${entry.kind}`} key={entry.id}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <span className="timeline-content"><strong>{entry.kind === "ph" ? "pH reading" : entry.kind === "check" ? "Check completed" : entry.kind === "status" ? "Status change" : entry.kind[0].toUpperCase() + entry.kind.slice(1)}</strong><span className="timeline-description">{timelineEntryText(entry, units)}{entry.kind === "ph" && phZoneLabel(batch, entry.value) && <span className="zone">{phZoneLabel(batch, entry.value)}</span>}{entry.kind === "ph" && phWarning(entry.value) && <span className="warning">{phWarning(entry.value)}</span>}{entry.kind === "photo" && <img alt={entry.caption || entry.name} src={entry.dataUrl} />}</span></span>
                  <time dateTime={entry.date}>{shortDate(entry.date)}</time>
                  <div className="timeline-entry-actions" hidden={!managementOpen}>
                    {entry.kind !== "check" && entry.kind !== "measurement" && <button aria-label={`Edit ${entry.kind === "ph" ? "pH" : entry.kind} from ${entry.date}`} onClick={() => editEntry(entry)} type="button">Edit</button>}
                    <button aria-label={`Delete ${entry.kind} from ${entry.date}`} onClick={() => onChange(deleteTimelineEntry(batch, entry.id, Date.now()))} type="button">Delete</button>
                  </div>
                </div>
              ))}
              {batch.timelineTrash.length > 0 && <div className="timeline-trash" hidden={!managementOpen}><strong>Recently deleted activity</strong>{batch.timelineTrash.map((entry) => <button key={entry.id} onClick={() => onChange(restoreTimelineEntry(batch, entry.id, Date.now()))} type="button">Restore {entry.kind} from {entry.date}</button>)}</div>}
            </section>
          </section>

        </div>

      </div>
      <div className="design-detail-footer"><DesignIcon name="leaf" />A little care, one batch at a time.</div>
    </article>
  );
}

interface ProfilesProps {
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

function Profiles({ formulaTerms, profiles, onDelete, onSave, onEditingChange, onView }: ProfilesProps) {
  const [editing, setEditing] = useState<FermentationProfile | null>(null);
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
    <section className="profiles">
      {editing && (() => {
        const presentation = presentationFor(editing);
        const duration = editing.expectedDurationDays ? `${editing.expectedDurationDays} days` : "—";
        const phRange = phRangeFor(editing);
        return (
          <div className="profile-editor-page">
            <header className="profile-mobile-bar">
              <span className="brand-mark" aria-hidden="true">F</span>
              <strong>FermentStation</strong>
              <button aria-label="Close profile editor menu" className="icon-button" onClick={closeEditor} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
            </header>
            <nav className="profile-editor-crumbs" aria-label="Breadcrumb"><button onClick={closeEditor} type="button">Profiles</button></nav>
            <header className="profile-editor-head">
              <div><p className="profile-editor-eyebrow">Fermentation profile</p><h1><input aria-label="Name" autoFocus className="profile-editor-title-input" defaultValue={editing.name} form="profile-editor-form" name="name" placeholder="Profile name" required /></h1></div>
              <span className="profile-editor-status"><i />Editable profile</span>
            </header>

            <div className="profile-editor-grid">
              <form className="profile-editor-form" id="profile-editor-form" key={editing.id} onSubmit={save}>
                <section className="profile-editor-section">
                  <div className="profile-editor-section-head profile-editor-basics-head"><div><p className="profile-editor-kicker">01 / The profile</p><h2>Give it a clear name</h2><p className="profile-editor-intro">A profile is a reusable practice. Keep its guidance grounded in what you will actually observe.</p></div></div>
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
                 <article className="profile-editor-card profile-editor-note"><h3>Practical note</h3><p>Keep the profile focused on observations that make the next check easier to act on.</p></article>
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
              <button aria-label={`View ${profile.name} guidance`} className="profile-card-main" onClick={() => onView(profile)} type="button">
                  <span className="design-profile-visual">{profileVisual(profile).photo ? <img alt={`${profile.name} stand-in photograph`} src={`${import.meta.env.BASE_URL}new-design/${profileVisual(profile).photo}.webp`} /> : <DesignIcon name="jar" />}</span>
                 <div className="design-profile-copy"><h3>{profile.name}</h3><span>{profile.expectedDurationDays ? `${profile.expectedDurationDays} days` : "Duration not set"} · {presentation.params[0][0]}</span><span className="sr-only">{presentation.description}</span></div>
                  <svg aria-hidden="true" className="design-profile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
              </button>
            </article>
          );
        })}
      </div>}

      {!editing && <PhotoCredits />}
      {!editing && <details className="design-profile-management"><summary>Manage profiles</summary>
        <button className="profile-add" onClick={() => edit({ id: createClientId(), name: "", guidance: [], inputs: [], calculations: [], checks: [], phZones: [] })} type="button">Add profile</button>
        {profiles.map((profile) => <div className="design-profile-management-row" key={profile.id}><span>{profile.name}</span><button aria-label={`Edit ${profile.name}`} onClick={() => edit(profile)} type="button">Edit</button><button aria-label={`Delete ${profile.name}`} onClick={() => onDelete(profile.id)} type="button">Delete</button></div>)}
      </details>}

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
