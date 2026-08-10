# FermentStation

The domain covers planning and observing household fermentation batches across different fermentation products.

## Language

**Batch**:
A single preparation of a fermenting product, tracked from its actual start through completion. It is created from a fermentation profile and has a required start date.
_Avoid_: Project, process

**Fermentation profile**:
The reusable method, recipe inputs, quantities, and conditions used to start a batch, such as kombucha F1, kombucha F2, sauerkraut, anaerobic fermentation, or sourdough. Profiles are user-managed and may be created, modified, or deleted.
_Avoid_: Typology, technique

**Expected fermentation duration**:
The whole-number count of days a fermentation profile uses to suggest a batch's finish date.

**Finish date**:
The date a batch is expected to finish. A batch becomes `ready` automatically on this date; changing the finish date to a future date makes the batch `active` again.

**Profile input**:
A value the user supplies for a batch, such as water volume, cabbage weight, or flour weight.

**Profile guidance**:
A fixed condition or recommendation supplied by a fermentation profile, such as temperature or salt percentage.

**Profile temperature range**:
The optional lower and upper Celsius bounds for the conditions a fermentation profile recommends. Both bounds are supplied together, must be between 0 and 100°C, and the lower bound cannot exceed the upper bound.

**Profile card**:
The summary of a fermentation profile on the profiles main page. It contains only profile-owned values that can be authored in the profile editor; batch-derived facts and hardcoded examples do not belong on it.

**Profile check**:
An optional named recurring check supplied by a fermentation profile, such as tasting or burping a jar. A profile may have no checks. When a batch is created, its profile checks are copied into that batch; later profile edits do not change existing batches. Profile checks use positive whole-day intervals and unique normalized names.

**Batch check**:
A recurring check attached to one batch. It may have been copied from the batch's profile or added later as a batch-local check. Batch-local checks use positive whole-day intervals, start their first schedule from the day they are added, and never change the profile.

**Check schedule**:
The next date on which a batch check should be noticed. A copied check first falls due after its interval from the batch start date. A newly added check first falls due after its interval from the day it is added. Changing an uncompleted check's interval anchors the next date from today; changing a completed check's interval anchors it from its latest completion. Completing a check, including an early completion, starts its next interval from the completion date.

**Check completion**:
A dated timeline event recording that a batch check was completed. Completion is immediate and does not require a note, measurement, or photo; those observations may be recorded separately.

**Profile calculation**:
A user-defined formula in a fermentation profile that derives a value from one or more batch inputs. Fermentation quantities use metric units.

**Suggested value**:
A profile-provided or calculated recommendation for a batch. It can be overridden without changing the profile and is distinct from what the user actually used or observed.

**Starter profile**:
An initial fermentation profile supplied to help a user begin tracking common fermentation methods. It is otherwise an ordinary user-managed profile and may be modified or deleted.

**Timeline entry**:
A dated observation attached to a batch, such as a photo, note, measurement, temperature reading, check completion, or status change.
_Avoid_: Update, log item

**Temperature reading**:
A dated numeric observation of a batch's temperature. It is historical evidence distinct from the batch's current profile input and is stored in Celsius even when the user works in imperial units.

**Observation logger**:
The single interaction surface for creating or editing a batch's dated observations, including readings, notes, photos, status changes, and check completions.

**Batch status**:
The current stage of a batch: `active` before its finish date, `ready` automatically on its finish date or earlier when the user chooses, and `to-fridge` when the user moves it to cold storage to slow further fermentation. A manually chosen status remains until changed; moving the finish date into the future returns the batch to `active`. A profile may suggest when to move a batch to the fridge, but does not do so automatically.

Checks are scheduled only while a batch is `active`; they pause in `ready` and `to-fridge` and resume when the batch becomes active again.

**Trash**:
A temporary holding state for deleted batches and timeline entries. Deleted records can be restored for seven days before permanent deletion. Deleted profiles are removed immediately.
