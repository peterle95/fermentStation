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

**Profile check**:
An optional named check supplied by a fermentation profile, such as tasting or burping a jar. A batch may use its copied checks on its own whole-day schedule; checks pause while the batch is not `active`.

**Profile calculation**:
A user-defined formula in a fermentation profile that derives a value from one or more batch inputs. Fermentation quantities use metric units.

**Suggested value**:
A profile-provided or calculated recommendation for a batch. It can be overridden without changing the profile and is distinct from what the user actually used or observed.

**Starter profile**:
An initial fermentation profile supplied to help a user begin tracking common fermentation methods. It is otherwise an ordinary user-managed profile and may be modified or deleted.

**Timeline entry**:
A dated observation attached to a batch, such as a photo, note, measurement, or status change.
_Avoid_: Update, log item

**Batch status**:
The current stage of a batch: `active` before its finish date, `ready` automatically on its finish date or earlier when the user chooses, and `to-fridge` when the user moves it to cold storage to slow further fermentation. A manually chosen status remains until changed; moving the finish date into the future returns the batch to `active`. A profile may suggest when to move a batch to the fridge, but does not do so automatically.

**Trash**:
A temporary holding state for deleted batches and fermentation profiles. Deleted records can be restored for seven days before permanent deletion.
