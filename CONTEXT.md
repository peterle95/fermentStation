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
The whole-number count of days a fermentation profile uses to suggest when a batch should be ready.

**Profile input**:
A value the user supplies for a batch, such as water volume, cabbage weight, or flour weight.

**Profile guidance**:
A fixed condition or recommendation supplied by a fermentation profile, such as temperature or salt percentage.

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
The current stage of a batch: `active` while fermenting, `ready` when fermentation should be finished and the batch needs tasting, and `to-fridge` when the batch is moved to cold storage to slow further fermentation.

**Trash**:
A temporary holding state for deleted batches and fermentation profiles. Deleted records can be restored for seven days before permanent deletion.
