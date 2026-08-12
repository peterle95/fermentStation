import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import type { BatchState } from "../domain/batches";

const channelId = "fermentation-checks";
const reminderKind = "fermentstation-check";

export async function requestReminderPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

export async function reconcileReminders(state: BatchState, enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const old = pending.notifications
      .filter((notification) => notification.extra?.kind === reminderKind)
      .map(({ id }) => ({ id }));
    if (old.length > 0) await LocalNotifications.cancel({ notifications: old });
    if (!enabled || (await LocalNotifications.checkPermissions()).display !== "granted") return;

    await LocalNotifications.createChannel({
      id: channelId,
      name: "Fermentation checks",
      description: "Due reminders for active fermentation batches",
      importance: 3,
    });
    const today = localDate();
    const notifications: LocalNotificationSchema[] = state.batches
      .filter((batch) => batch.status === "active")
      .flatMap((batch) => batch.checks.map((check) => {
        const due = new Date(`${check.nextDueDate}T09:00:00`);
        if (check.nextDueDate <= today) due.setTime(Date.now() + 60_000);
        return {
          id: notificationId(batch.id, check.id),
          title: `${batch.name}: ${check.name}`,
          body: check.nextDueDate < today ? "This fermentation check is overdue." : "A fermentation check is due today.",
          schedule: { at: due },
          channelId,
          extra: { kind: reminderKind, batchId: batch.id, checkId: check.id },
        };
      }));
    if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
  } catch {
    // Today and Calendar remain the source of truth if Android notification APIs fail.
  }
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
