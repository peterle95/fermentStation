// Visual-verification seed data. Loaded in the browser by scripts/visual/screenshots.mjs
// through the Vite dev server; never imported by the app. It builds records only with the
// real domain functions and writes them with the app's real IndexedDB layer (saveWebState),
// so the app then loads them exactly as it would load a user's saved journal.
import {
  addPhReading,
  addTimelineEntry,
  completeBatchCheck,
  createBatch,
  createBatchState,
  deleteBatch,
  type Batch,
  type BatchState,
} from "../../src/domain/batches";
import { addProfile, createProfileState, updateProfile, type FermentationProfile, type ProfileState } from "../../src/domain/profiles";
import { createShellState } from "../../src/domain/shell";
import { saveWebState } from "../../src/platform/web-store";

export type Scenario = "seeded" | "empty";

const databaseName = "fermentstation";

/** Removes every trace of app data for this origin (IndexedDB and legacy localStorage). */
export async function clearAppData(): Promise<void> {
  localStorage.clear();
  sessionStorage.clear();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB delete blocked by an open connection"));
  });
}

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function day(today: string, offset: number): string {
  const value = new Date(`${today}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${source}`));
    image.src = source;
  });
}

/**
 * A deterministic "phone photo": a stand-in cut-out placed full-bleed on a lit counter,
 * encoded as JPEG like a camera capture, so it is visibly a user photo rather than a stand-in.
 */
async function userPhoto(standIn: string, wall: string, counter: string): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 1280;
  const context = canvas.getContext("2d")!;
  const backdrop = context.createLinearGradient(0, 0, 0, canvas.height);
  backdrop.addColorStop(0, wall);
  backdrop.addColorStop(0.68, wall);
  backdrop.addColorStop(0.68, counter);
  backdrop.addColorStop(1, counter);
  context.fillStyle = backdrop;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const light = context.createRadialGradient(300, 260, 40, 300, 260, 900);
  light.addColorStop(0, "rgba(255,255,255,0.45)");
  light.addColorStop(1, "rgba(0,0,0,0.25)");
  context.fillStyle = light;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const image = await loadImage(`${import.meta.env.BASE_URL}new-design/${standIn}.webp`);
  const scale = Math.min(820 / image.width, 1080 / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.shadowColor = "rgba(0,0,0,0.35)";
  context.shadowBlur = 40;
  context.shadowOffsetY = 18;
  context.drawImage(image, (canvas.width - width) / 2, canvas.height * 0.86 - height, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function richProfiles(): ProfileState {
  let state = createProfileState();
  const byId = (id: string) => state.profiles.find((profile) => profile.id === id)!;
  const enrich = (id: string, details: Partial<FermentationProfile>) => {
    state = updateProfile(state, { ...byId(id), ...details });
  };
  enrich("starter-kimchi", {
    inputs: [{ name: "cabbage", unit: "g", defaultValue: 2000 }, { name: "water", unit: "ml", defaultValue: 1000 }],
    calculations: [{ name: "Salt", unit: "g", formula: "cabbage * 2%" }, { name: "Brine salt", unit: "g", formula: "water * 5%" }],
    checks: [{ name: "Burp the jar", intervalDays: 1 }, { name: "Check brine level", intervalDays: 2 }],
    phZones: [{ label: "optimal", min: 3.6, max: 4.29 }, { label: "safe", min: 4.3, max: 4.69 }, { label: "danger", min: 4.7, max: 14 }],
    temperatureMinC: 18,
    temperatureMaxC: 22,
    expectedDurationDays: 5,
  });
  enrich("starter-kombucha-f1", {
    inputs: [{ name: "water", unit: "ml", defaultValue: 2000 }],
    calculations: [{ name: "Sugar", unit: "g", formula: "water / 20" }, { name: "Tea", unit: "g", formula: "water / 250" }],
    checks: [{ name: "Taste test", intervalDays: 3 }],
    phZones: [{ label: "danger", min: 4.21, max: 14 }, { label: "optimal", min: 2.5, max: 3.5 }],
    temperatureMinC: 22,
    temperatureMaxC: 26,
    expectedDurationDays: 10,
  });
  enrich("starter-sauerkraut", {
    inputs: [{ name: "cabbage", unit: "g", defaultValue: 1500 }],
    calculations: [{ name: "Salt", unit: "g", formula: "cabbage * 2%" }],
    checks: [{ name: "Check brine level", intervalDays: 2 }, { name: "Skim the surface", intervalDays: 4 }],
    phZones: [{ label: "optimal", min: 3.1, max: 3.6 }, { label: "safe", min: 3.61, max: 4.6 }],
    temperatureMinC: 18,
    temperatureMaxC: 22,
    expectedDurationDays: 21,
  });
  enrich("starter-sourdough", {
    inputs: [{ name: "flour", unit: "g", defaultValue: 100 }, { name: "water", unit: "g", defaultValue: 100 }],
    checks: [{ name: "Feed the starter", intervalDays: 1 }],
  });
  state = addProfile(state, {
    id: "visual-ginger-bug",
    name: "Ginger bug",
    guidance: [
      "Grate unpeeled organic ginger and stir it into dechlorinated water with sugar.",
      "Feed one spoon each of ginger and sugar every day until it fizzes when stirred.",
      "Use the strained liquid to start sodas; keep feeding the rest.",
    ],
    inputs: [{ name: "water", unit: "ml", defaultValue: 500 }, { name: "ginger", unit: "g", defaultValue: 30 }],
    calculations: [{ name: "Sugar", unit: "g", formula: "ginger * 100%" }],
    checks: [{ name: "Feed ginger and sugar", intervalDays: 1 }],
    phZones: [],
    temperatureMinC: 20,
    temperatureMaxC: 26,
    expectedDurationDays: 7,
  });
  state = addProfile(state, {
    id: "visual-water-kefir",
    name: "Water kefir",
    guidance: ["Dissolve sugar in water, add grains and a dried fig.", "Strain after 48 hours and bottle with fruit for a second ferment."],
    inputs: [{ name: "water", unit: "ml", defaultValue: 1000 }],
    calculations: [{ name: "Sugar", unit: "g", formula: "water * 6%" }],
    checks: [{ name: "Strain the grains", intervalDays: 2 }],
    phZones: [],
    expectedDurationDays: 3,
  });
  return state;
}

function profile(state: ProfileState, id: string): FermentationProfile {
  return state.profiles.find((candidate) => candidate.id === id)!;
}

function checkId(batch: Batch, name: string): string {
  return batch.checks.find((check) => check.name === name)!.id;
}

async function richBatches(profiles: ProfileState, today: string): Promise<BatchState> {
  const d = (offset: number) => day(today, offset);
  let n = 0;
  const id = (prefix: string) => `${prefix}-${++n}`;
  const note = (batch: Batch, date: string, text: string) => addTimelineEntry(batch, { id: id("note"), date, kind: "note", text });
  const ph = (batch: Batch, date: string, value: number) => addPhReading(batch, { id: id("ph"), date, kind: "ph", value });
  const temperature = (batch: Batch, date: string, value: number) => addTimelineEntry(batch, { id: id("temperature"), date, kind: "temperature", value });
  const complete = (batch: Batch, name: string, date: string) => completeBatchCheck(batch, checkId(batch, name), date, id("check"));
  const photo = (batch: Batch, date: string, dataUrl: string, caption: string) => addTimelineEntry(batch, {
    id: id("photo"), date, kind: "photo", name: `IMG_${date.replaceAll("-", "")}.jpg`, mimeType: "image/jpeg", dataUrl, caption,
  });

  // Active, one overdue and one due-today check, long pH/temperature history and a user photo.
  let kimchi = createBatch(profile(profiles, "starter-kimchi"), { id: "visual-kimchi", name: "Napa cabbage kimchi", startDate: d(-4), inputValues: { cabbage: 2400 }, today });
  kimchi = note(kimchi, d(-4), "Packed into the 2 L jar with gochugaru paste, spring onion and daikon. Brine covers everything.");
  kimchi = ph(kimchi, d(-4), 5.6);
  kimchi = temperature(kimchi, d(-3), 21.5);
  kimchi = complete(kimchi, "Burp the jar", d(-3));
  kimchi = ph(kimchi, d(-3), 4.9);
  kimchi = complete(kimchi, "Burp the jar", d(-2));
  kimchi = complete(kimchi, "Check brine level", d(-2));
  kimchi = photo(kimchi, d(-2), await userPhoto("kimchi", "#d8c7b0", "#8a6a4f"), "Bubbling nicely after two days");
  kimchi = ph(kimchi, d(-2), 4.5);
  kimchi = temperature(kimchi, d(-1), 20.2);
  kimchi = ph(kimchi, d(-1), 4.31);
  kimchi = note(kimchi, d(-1), "Smells sour and garlicky, a little fizz when pressed down. Tasted a leaf: still crunchy, needs another day or two before it goes in the fridge.");

  // Active, nothing due; checks upcoming over the next days.
  let kraut = createBatch(profile(profiles, "starter-sauerkraut"), { id: "visual-kraut", name: "Garden sauerkraut", startDate: d(-9), inputValues: { cabbage: 1800 }, today });
  kraut = ph(kraut, d(-8), 5.8);
  for (const date of [d(-7), d(-5), d(-3), d(-1)]) kraut = complete(kraut, "Check brine level", date);
  kraut = complete(kraut, "Skim the surface", d(-5));
  kraut = ph(kraut, d(-6), 4.6);
  kraut = temperature(kraut, d(-4), 19.4);
  kraut = complete(kraut, "Skim the surface", d(-1));
  kraut = ph(kraut, d(-3), 3.9);
  kraut = note(kraut, d(-1), "Topped up with 2% brine.");

  // Ready today (finish date reached), checks paused, stand-in photo.
  let kombucha = createBatch(profile(profiles, "starter-kombucha-f1"), { id: "visual-kombucha", name: "Black tea kombucha", startDate: d(-10), today });
  kombucha = note(kombucha, d(-10), "New SCOBY from Anna, 300 ml starter liquid.");
  kombucha = ph(kombucha, d(-7), 3.8);
  kombucha = ph(kombucha, d(-2), 3.1);
  kombucha = temperature(kombucha, d(-2), 23.8);

  // In the fridge via a status change; recurring checks paused.
  let starter = createBatch(profile(profiles, "starter-sourdough"), { id: "visual-sourdough", name: "Rye sourdough starter", startDate: d(-30), today });
  starter = note(starter, d(-30), "Started with whole rye flour.");
  starter = addTimelineEntry(starter, { id: id("status"), date: d(-6), kind: "status", status: "to-fridge" });

  // No profile stand-in and no user photo: exercises the photo fallback and "No finish date".
  let kefir = createBatch(profile(profiles, "starter-milk-kefir"), { id: "visual-kefir", name: "Milk kefir", startDate: d(-1), today });
  kefir = note(kefir, d(-1), "Whole milk, 2 tbsp grains.");

  // Long name, custom profile, user photo, due today.
  let ginger = createBatch(profile(profiles, "visual-ginger-bug"), { id: "visual-ginger", name: "Ginger bug with turmeric and lemon peel — second attempt", startDate: d(-2), today });
  ginger = complete(ginger, "Feed ginger and sugar", d(-1));
  ginger = photo(ginger, d(-1), await userPhoto("kombucha", "#efe3c8", "#b88a4a"), "");
  ginger = temperature(ginger, d(-1), 24);

  // Started today, no activity yet.
  const waterKefir = createBatch(profile(profiles, "visual-water-kefir"), { id: "visual-water-kefir", name: "Water kefir with figs", startDate: today, today });

  // One recently deleted batch for Settings › Recently deleted.
  const discarded = createBatch(profile(profiles, "starter-kombucha-f1"), { id: "visual-discarded", name: "Jun tea (abandoned)", startDate: d(-20), today });

  const state = createBatchState([kimchi, kraut, kombucha, starter, kefir, ginger, waterKefir, discarded]);
  return deleteBatch(state, discarded.id, Date.now() - 2 * 86_400_000);
}

/** Replaces this origin's app data with the named scenario through the app's storage layer. */
export async function seed(scenario: Scenario): Promise<{ today: string; batches: number; profiles: number }> {
  await clearAppData();
  const today = localDate();
  if (scenario === "empty") return { today, batches: 0, profiles: 0 };
  const profileState = richProfiles();
  const batchState = await richBatches(profileState, today);
  await saveWebState({ shell: createShellState(), profileState, batchState });
  return { today, batches: batchState.batches.length, profiles: profileState.profiles.length };
}
