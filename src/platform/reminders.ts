import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import type { BatchState } from "../domain/batches";
import type { NotificationMode } from "../domain/shell";

const channelId = "fermentation-checks";
const checkReminderKind = "fermentstation-check";
const readyReminderKind = "fermentstation-ready";
let reconciliation = Promise.resolve();

export async function requestReminderPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === "granted";
  } catch {
    return false;
  }
}

export function reconcileReminders(state: BatchState, mode: NotificationMode): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  reconciliation = reconciliation.then(() => replaceReminders(state, mode));
  return reconciliation;
}

async function replaceReminders(state: BatchState, mode: NotificationMode): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    const old = pending.notifications
      .filter((notification) => [checkReminderKind, readyReminderKind].includes(notification.extra?.kind))
      .map(({ id }) => ({ id }));
    if (old.length > 0) await LocalNotifications.cancel({ notifications: old });
    if (mode === "off" || (await LocalNotifications.checkPermissions()).display !== "granted") return;

    let availableChannelId: string | undefined;
    try {
      await LocalNotifications.createChannel({
        id: channelId,
        name: "Fermentation reminders",
        description: "Due checks and ready fermentation batches",
        importance: 3,
      });
      availableChannelId = channelId;
    } catch {
      // Android versions before API 26 do not support notification channels.
    }
    const now = Date.now();
    const today = localDate();
    const checksEnabled = mode === "all" || mode === "checks";
    const readyEnabled = mode === "all" || mode === "ready";
    const notifications: LocalNotificationSchema[] = state.batches
      .filter((batch) => !batch.notificationsMuted)
      .flatMap((batch) => {
        const reminders: LocalNotificationSchema[] = [];
        if (checksEnabled && batch.status === "active") {
          reminders.push(...batch.checks.map((check) => ({
            id: notificationId(batch.id, `${checkReminderKind}:${check.id}`),
            title: `${batch.name}: ${check.name}`,
            body: check.nextDueDate < today ? "This fermentation check is overdue." : "A fermentation check is due today.",
            schedule: { at: reminderTime(check.nextDueDate, now) },
            ...(availableChannelId ? { channelId: availableChannelId } : {}),
            extra: { kind: checkReminderKind, batchId: batch.id, checkId: check.id },
          })));
        }
        const finishTime = batch.finishDate ? new Date(`${batch.finishDate}T09:00:00`).getTime() : undefined;
        const manuallyReadyOnFinishDate = batch.timeline.some((entry) =>
          entry.kind === "status" && entry.status === "ready" && entry.date === batch.finishDate,
        );
        const automaticallyReadyToday = batch.status === "ready" && batch.finishDate === today &&
          batch.checksPausedAt === batch.finishDate && !manuallyReadyOnFinishDate &&
          finishTime !== undefined && finishTime > now;
        if (readyEnabled && batch.finishDate && (batch.status === "active" || automaticallyReadyToday)) {
          reminders.push({
            id: notificationId(batch.id, readyReminderKind),
            title: `${batch.name} is ready`,
            body: "The planned fermentation finish date has arrived.",
            schedule: { at: reminderTime(batch.finishDate, now) },
            ...(availableChannelId ? { channelId: availableChannelId } : {}),
            extra: { kind: readyReminderKind, batchId: batch.id },
          });
        }
        return reminders;
      });
    if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
  } catch {
    // Today and Calendar remain the source of truth if Android notification APIs fail.
  }
}

function reminderTime(date: string, now: number): Date {
  const due = new Date(`${date}T09:00:00`);
  if (due.getTime() <= now) due.setTime(now + 60_000);
  return due;
}

function notificationId(batchId: string, checkId: string): number {
  let hash = 2166136261;
  for (const value of `${batchId}:${checkId}`) hash = Math.imul(hash ^ value.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2_000_000_000 + 1;
}

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
