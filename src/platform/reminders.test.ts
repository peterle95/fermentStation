import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import type { Batch, BatchState } from "../domain/batches";

type DisplayPermission = { display: "granted" | "prompt" | "denied" };

const { isNativePlatform, localNotifications } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  localNotifications: {
    cancel: vi.fn(async () => undefined),
    checkPermissions: vi.fn(async (): Promise<DisplayPermission> => ({ display: "granted" })),
    createChannel: vi.fn(async () => undefined),
    getPending: vi.fn(async () => ({ notifications: [] as Array<{ id: number; extra?: { kind?: string } }> })),
    requestPermissions: vi.fn(async (): Promise<DisplayPermission> => ({ display: "granted" })),
    schedule: vi.fn(async ({ notifications }: { notifications: LocalNotificationSchema[] }) => ({ notifications })),
  },
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform } }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: localNotifications }));

import { reconcileReminders, requestReminderPermission } from "./reminders";

function batch(id: string, status: Batch["status"], nextDueDate: string): Batch {
  return {
    id,
    name: `${id} batch`,
    startDate: "2026-09-01",
    status,
    notificationsMuted: false,
    profileSnapshot: {
      id: "profile",
      name: "Profile",
      guidance: [],
      inputs: [],
      calculations: [],
      checks: [],
      phZones: [],
    },
    timeline: [],
    timelineTrash: [],
    inputValues: {},
    calculationValues: {},
    checks: [{ id: `${id}-check`, name: "Taste", intervalDays: 1, nextDueDate }],
  };
}

describe("Android reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 6, 6));
    isNativePlatform.mockReturnValue(true);
    localNotifications.checkPermissions.mockResolvedValue({ display: "granted" });
    localNotifications.getPending.mockResolvedValue({ notifications: [] });
  });

  afterEach(() => vi.useRealTimers());

  it("requests Android permission when reminders are enabled", async () => {
    localNotifications.checkPermissions.mockResolvedValueOnce({ display: "prompt" });
    localNotifications.requestPermissions.mockResolvedValueOnce({ display: "denied" });

    expect(await requestReminderPermission()).toBe(false);
    expect(localNotifications.requestPermissions).toHaveBeenCalledOnce();
  });

  it("replaces managed alarms with active checks scheduled for local 09:00", async () => {
    localNotifications.getPending.mockResolvedValue({
      notifications: [
        { id: 10, extra: { kind: "fermentstation-check" } },
        { id: 20, extra: { kind: "another-feature" } },
      ],
    });
    const state: BatchState = {
      batches: [batch("active", "active", "2026-09-06"), batch("ready", "ready", "2026-09-06")],
      trash: [],
    };

    await reconcileReminders(state, "checks");

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 10 }] });
    expect(localNotifications.schedule).toHaveBeenCalledOnce();
    expect(localNotifications.schedule.mock.calls[0][0].notifications).toEqual([
      expect.objectContaining({
        title: "active batch: Taste",
        body: "A fermentation check is due today.",
        schedule: { at: new Date(2026, 8, 6, 9) },
        channelId: "fermentation-checks",
      }),
    ]);
  });

  it("still schedules on Android versions without notification channels", async () => {
    localNotifications.createChannel.mockRejectedValueOnce(new Error("unavailable"));
    const state: BatchState = { batches: [batch("active", "active", "2026-09-05")], trash: [] };

    await reconcileReminders(state, "checks");

    const [notification] = localNotifications.schedule.mock.calls[0][0].notifications;
    expect(notification).not.toHaveProperty("channelId");
    expect(notification.schedule?.at).toEqual(new Date(2026, 8, 6, 6, 1));
  });

  it("schedules finish-date readiness reminders for local 09:00", async () => {
    const readyBatch = {
      ...batch("active", "active", "2026-09-07"),
      finishDate: "2026-09-08",
    };

    await reconcileReminders({ batches: [readyBatch], trash: [] }, "ready");

    const [notification] = localNotifications.schedule.mock.calls[0][0].notifications;
    expect(notification).toMatchObject({
      title: "active batch is ready",
      body: "The planned fermentation finish date has arrived.",
      schedule: { at: new Date(2026, 8, 8, 9) },
      extra: { kind: "fermentstation-ready", batchId: "active" },
    });
  });

  it("schedules both kinds with distinct IDs in all mode", async () => {
    const both = {
      ...batch("both", "active", "2026-09-07"),
      finishDate: "2026-09-08",
    };
    both.checks[0].id = "ready";

    await reconcileReminders({ batches: [both], trash: [] }, "all");

    const notifications = localNotifications.schedule.mock.calls[0][0].notifications;
    expect(notifications.map((notification) => notification.extra?.kind)).toEqual([
      "fermentstation-check",
      "fermentstation-ready",
    ]);
    expect(new Set(notifications.map(({ id }) => id)).size).toBe(2);
  });

  it("preserves a same-day alert when the batch became ready automatically", async () => {
    const automaticallyReady = {
      ...batch("automatic", "ready", "2026-09-07"),
      finishDate: "2026-09-06",
      checksPausedAt: "2026-09-06",
    };

    await reconcileReminders({ batches: [automaticallyReady], trash: [] }, "ready");

    const [notification] = localNotifications.schedule.mock.calls[0][0].notifications;
    expect(notification.schedule?.at).toEqual(new Date(2026, 8, 6, 9));
  });

  it("does not alert after the user manually marks a batch ready", async () => {
    const manuallyReady = {
      ...batch("manual", "ready", "2026-09-07"),
      finishDate: "2026-09-06",
      checksPausedAt: "2026-09-06",
      timeline: [{ id: "ready", date: "2026-09-06", kind: "status" as const, status: "ready" as const }],
    };

    await reconcileReminders({ batches: [manuallyReady], trash: [] }, "ready");

    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it("cancels managed alarms without rescheduling when notifications are off", async () => {
    localNotifications.getPending.mockResolvedValue({
      notifications: [
        { id: 10, extra: { kind: "fermentstation-check" } },
        { id: 20, extra: { kind: "fermentstation-ready" } },
        { id: 30, extra: { kind: "another-feature" } },
      ],
    });

    await reconcileReminders({ batches: [batch("active", "active", "2026-09-07")], trash: [] }, "off");

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 10 }, { id: 20 }] });
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it("does not schedule notifications for muted batches", async () => {
    const mutedBatch = {
      ...batch("muted", "active", "2026-09-07"),
      notificationsMuted: true,
      finishDate: "2026-09-08",
    };

    await reconcileReminders({ batches: [mutedBatch], trash: [] }, "all");

    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it("serializes overlapping reconciliations in request order", async () => {
    let releasePending!: (value: { notifications: [] }) => void;
    localNotifications.getPending.mockImplementationOnce(() => new Promise((resolve) => {
      releasePending = resolve;
    }));

    const first = reconcileReminders({ batches: [batch("first", "active", "2026-09-07")], trash: [] }, "checks");
    await Promise.resolve();
    const second = reconcileReminders({ batches: [batch("second", "active", "2026-09-07")], trash: [] }, "checks");
    await Promise.resolve();

    expect(localNotifications.getPending).toHaveBeenCalledOnce();
    releasePending({ notifications: [] });
    await Promise.all([first, second]);
    expect(localNotifications.getPending).toHaveBeenCalledTimes(2);
    expect(localNotifications.schedule.mock.calls[1][0].notifications[0].title).toBe("second batch: Taste");
  });
});
