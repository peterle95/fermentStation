# Free offline-first sync and photo storage

Research for [issue #6](https://github.com/peterle95/fermentstation/issues/6), 2026-08-07. Sources are official project or platform documentation.

## Decision

Make v1 local-first: each installation owns a private SQLite database and durable local photo files. Ship explicit ZIP export/import as the supported cross-device path. Define an optional Syncthing transport for an application exchange folder only after validating the chosen Android wrapper on target devices.

Never synchronize a live SQLite database, its WAL, journal, or app-private directory. Sync or export immutable, ID-addressed record and photo files instead:

```text
fermentstation-exchange/
  records/<stable-record-id>.json
  photos/<sha256>.<extension>
```

The receiving app validates and imports a complete file into its local database. New timeline entries and photos are immutable in v1; correcting an entry creates a new record or an explicit tombstone. This lets a generic file transport move bytes without being asked to merge domain data.

## Comparison

| Approach | Fit for v1 | Conflict and backup behavior | Minimum operation |
| --- | --- | --- | --- |
| Local-first only | Required base model | No cross-device conflict; each device must be backed up/exported independently | None beyond app storage and an in-app export |
| Manual ZIP export/import | **Recommended supported path** | Import can validate schema, IDs, hashes, and surface duplicate/conflicting records before changing SQLite; the exported ZIP is also a portable backup artifact | User exports, transfers by USB/local network/any existing file method, then imports |
| Syncthing exchange folder | Useful optional automatic transport between existing devices | Syncthing preserves a simultaneous divergent file as a `sync-conflict` copy; it does not merge record contents. Versioning is disabled by default and is not a backup because changes and deletions propagate. [1][2][3] | Desktop Syncthing, a maintained Android wrapper, paired devices, a dedicated shared folder, and a separate backup copy |
| Self-hosted Nextcloud/WebDAV | Viable only when an always-on existing server is already wanted | The application still needs per-record conflict policy. Nextcloud documents that Android bidirectional sync is not fully implemented; its server backup includes config, data, theme, custom apps, and database. [8][9] | Maintain a server, HTTPS/authentication, storage, upgrades, and server backups |

## Evidence

### Local SQLite and file-sync hazards

- SQLite warns that a raw backup taken during a transaction can contain mixed old and new content. Use the Online Backup API or `VACUUM INTO` for a live-database snapshot, or copy only while no transaction is active. If a rollback journal or WAL exists, it must remain paired with the database. [4][5][6]
- WAL mode adds persistent `-wal` and `-shm` state. SQLite says that separating a database from its WAL can lose committed transactions or corrupt the database; WAL also requires every accessing process to be on the same host, not a network filesystem. [5]
- Syncthing writes an incoming file to a temporary copy and moves it over the destination. That is sound for complete exchange files, but it cannot coordinate SQLite transactions, locks, journals, or WAL state across independently running devices. [1][4][5]
- Therefore, sync the exchange files, not a `.db` file or its auxiliary files. A consistent database export is appropriate for backup or manual recovery, but is not a multi-writer synchronization protocol. [4][6]

### Syncthing transport

- Syncthing exchanges files directly between configured devices when they are online concurrently; device-to-device traffic uses TLS and peers accept only configured device certificates. [3][7]
- It detects simultaneous different edits to one file and renames one to `*.sync-conflict-*`; the older modification time normally becomes the conflict copy, which then synchronizes as an ordinary file. Its result is file preservation, not an application-level merge. [1]
- Syncthing scans regularly even with filesystem watching enabled, so exchange visibility is asynchronous rather than transactional. [1]
- Its base downloads are desktop/server binaries; the official downloads page links community integrations rather than an Android base build. Android support therefore depends on a separately maintained wrapper and must be acceptance-tested for background behavior, storage access, upgrade path, and recovery. [10]
- Global discovery and relays are enabled by default. Both can be disabled for a LAN-only deployment; relays cannot inspect synchronized data, but discovery/relay operators can learn device IDs and address relationships. [7]
- Syncthing versioning archives remote replacements/deletions only. It does not archive a user's local edit and Syncthing explicitly says it is not an ideal backup because mistakes propagate. [2][3]

### Android constraints

- Android scoped storage limits broad shared-storage access. Use the system file picker and Storage Access Framework for a user-chosen import/export directory rather than assuming the app can freely manage arbitrary shared folders. [11]
- App-specific storage is appropriate for the private local database and captured-photo working copy, but its lifecycle is tied to the app. Exported copies must live outside that private store if they are intended for another app, user transfer, or recovery. [12]
- Android background-execution limits restrict background services on Android 8.0 and later. FermentStation should not promise that its own process will continuously watch or synchronize a folder; an external sync client has to be separately validated. [13]
- The Syncthing folder marker is operationally significant. Its official FAQ notes that Android cleaning software commonly removes the empty `.stfolder`, which stops sync until restored. [3]

### Photo handling

- Keep originals as ordinary files under a content hash and store relative path, MIME type, byte size, and hash in the local record. Do not place photo BLOBs in the transport database or edit a shared photo in place.
- Write a photo to a private temporary path, verify its hash, then publish the final immutable filename in the exchange folder. Syncthing's temporary-file behavior then transfers a completed file, and the receiving import can reject a mismatched hash. [1]
- Refer to photos by hash, not a device-specific path. This deduplicates identical originals and makes a photo independently portable in a ZIP or file synchronizer. This is an application design consequence, not a Syncthing feature.

## Minimum v1 setup

1. Store batches, fermentation profiles, timeline entries, and photo metadata locally; keep the SQLite database private to the installation.
2. Add export/import of a ZIP containing schema-versioned record JSON and hash-addressed photo originals. Validate archive shape, schema version, stable IDs, and each photo hash before import.
3. Preserve both sides of an import collision and ask the user to choose; do not silently last-write-wins a timeline entry, status, note, or measurement.
4. Copy the ZIP exports and local SQLite snapshots to a separate disk on a routine the user can perform. Generate snapshots with SQLite's backup API or `VACUUM INTO`, not filesystem copying of an open database. [4][6]
5. Optionally add Syncthing: share only `fermentstation-exchange`, pair the devices, retain `.stfolder`, enable desktop-side versioning, and keep a separate backup. Start LAN-only; enable discovery/relays only when off-LAN sync is required. [2][3][7]

## Recommendation and fallback

**Recommend:** local SQLite plus immutable records/photos, with manual ZIP export/import as the v1 guarantee. Syncthing may automate delivery of that same exchange folder without adding recurring fees or a server, but it must remain optional because Android support is wrapper-dependent and file conflicts need an explicit FermentStation import decision.

**Fallback:** retain ZIP transfer indefinitely. It uses existing hardware, has no daemon or account, and avoids the false safety of synchronizing SQLite files. Adopt self-hosted Nextcloud/WebDAV only when an operator accepts ongoing server, TLS, upgrade, and backup work; it does not remove the need for record-level conflict handling.

## Sources

1. Syncthing, synchronization and conflicts: https://docs.syncthing.net/users/syncing.html
2. Syncthing, file versioning: https://docs.syncthing.net/users/versioning.html
3. Syncthing, FAQ: https://docs.syncthing.net/users/faq.html
4. SQLite, database corruption and safe backup: https://www.sqlite.org/howtocorrupt.html
5. SQLite, write-ahead logging: https://www.sqlite.org/wal.html
6. SQLite, Backup API and `VACUUM INTO`: https://www.sqlite.org/backup.html and https://www.sqlite.org/lang_vacuum.html#vacuuminto
7. Syncthing, security principles: https://docs.syncthing.net/users/security.html
8. Nextcloud, desktop and mobile synchronization: https://docs.nextcloud.com/server/latest/user_manual/en/files/desktop_mobile_sync.html
9. Nextcloud, backup: https://docs.nextcloud.com/server/latest/admin_manual/maintenance/backup.html
10. Syncthing, official downloads: https://syncthing.net/downloads/
11. Android Developers, shared documents and files: https://developer.android.com/training/data-storage/shared/documents-files
12. Android Developers, app-specific storage: https://developer.android.com/training/data-storage/app-specific
13. Android Developers, Android 8.0 background execution limits: https://developer.android.com/about/versions/oreo/background
