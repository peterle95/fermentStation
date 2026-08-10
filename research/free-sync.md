# Zero-cost offline-first sync research

Research for [issue #6](https://github.com/peterle95/fermentstation/issues/6), 2026-08-07. Sources are first-party project documentation or source repositories.

## Decision

Use Syncthing for v1 transport, but do **not** sync the live SQLite database. Keep a private SQLite database on each device and sync a small, file-oriented exchange format plus photos:

```text
fermentstation-sync/
  records/batches/<batch-id>.json
  records/timeline/<entry-id>.json
  photos/<photo-id>.<extension>
```

The app imports complete record files into its local SQLite database. New records get stable IDs and are written as new files. Treat timeline entries and photos as immutable in v1; corrections create a new version or tombstone. If two devices modify the same record, preserve both files and require an explicit import decision. This avoids pretending that a file synchronizer is a domain-level merge engine.

## Evidence

### Syncthing

- Syncthing is peer-to-peer: it exchanges files between devices when both are online, rather than uploading them to a cloud service. Its protocol is open source, traffic is TLS-protected, and no subscription is required by the software. [FAQ](https://docs.syncthing.net/users/faq.html#what-is-syncthing), [security principles](https://docs.syncthing.net/users/security.html)
- Direct local-network sync needs only the Android and desktop clients, paired device IDs, a shared folder, and network/firewall access. Public discovery and relays are enabled by default and are optional infrastructure; relays only relay end-to-end encrypted traffic. Disabling them makes a LAN-only setup predictable, but removes discovery/connectivity across separate networks. [security principles](https://docs.syncthing.net/users/security.html), [relaying](https://docs.syncthing.net/users/relaying.html)
- The official downloads provide desktop/server binaries, not an official Android client. The practical Android client is the community-maintained Syncthing-Fork wrapper, so Android support is an external maintenance dependency and should be rechecked before release. [official downloads](https://syncthing.net/downloads/), [Syncthing-Fork source](https://github.com/researchxxl/syncthing-android)
- Syncthing detects simultaneous divergent edits but does not merge file contents. It renames one side to a `*.sync-conflict-*` file; the older modification time normally loses, and conflict copies propagate as normal files. [conflict handling](https://docs.syncthing.net/users/syncing.html#conflicting-changes)
- Syncthing's versioning is useful damage control, not a complete backup. It is disabled by default, stores old remote-replaced/deleted files, and does not archive a user's own local edits. Syncthing explicitly says it is not an ideal backup because deletions and mistakes propagate. [file versioning](https://docs.syncthing.net/users/versioning.html), [backup FAQ](https://docs.syncthing.net/users/faq.html#is-syncthing-my-ideal-backup-application)
- Android operational friction is real: Syncthing requires a folder marker, and the official FAQ specifically notes that Android cleaning software can remove it. Keep the marker and shared folder in a user-managed location and test battery/background behavior on the target Android versions. [folder marker FAQ](https://docs.syncthing.net/users/faq.html#i-am-seeing-the-error-message-folder-marker-missing-what-do-i-do)

### SQLite live-file hazard

- SQLite warns that copying a database during an active transaction can produce a mixed old/new copy. A safe copy requires SQLite's Online Backup API, `VACUUM INTO`, or a copy made while no transaction is active; if a journal or WAL exists, it must travel with the database. [SQLite corruption guide](https://sqlite.org/howtocorrupt.html#_backup_or_restore_while_a_transaction_is_active)
- In WAL mode, the database has additional `-wal` and `-shm` files. The WAL is part of the persistent database state; separating it from the database can lose committed transactions or corrupt the database. WAL also requires all accessing processes to be on the same host and does not work over a network filesystem. [SQLite WAL](https://sqlite.org/wal.html)
- Syncthing writes incoming changes to a temporary file and then moves it over the destination. That is appropriate for ordinary files, but it cannot coordinate SQLite's locks, transactions, journal, WAL, or shared-memory state across two independent devices. Combining the Syncthing behavior with SQLite's rules makes a live `.db` sync unsafe, even if the app usually appears closed. [Syncthing syncing](https://docs.syncthing.net/users/syncing.html#temporary-files), [SQLite corruption guide](https://sqlite.org/howtocorrupt.html), [SQLite WAL](https://sqlite.org/wal.html)
- Ignoring `-wal`, `-shm`, and `-journal` while syncing only the main `.db` is not a fix: SQLite explicitly requires associated journal state when it exists. [SQLite corruption guide](https://sqlite.org/howtocorrupt.html#_mispairing_database_files_and_hot_journals_)

### Photos

- Store photos as ordinary files, not SQLite BLOBs in the shared database. Use an immutable ID-based path and keep relative path, MIME type, byte size, and a content hash in the local record. A photo write should finish before the final filename becomes visible to Syncthing; do not edit photo files in place.
- This makes Syncthing's file-level transfer and conflict/version behavior useful, avoids database-wide conflicts for every photo, and allows desktop users to browse or back up the originals. These are design consequences of the cited Syncthing file semantics, not a Syncthing guarantee about application records.
- Keep the shared folder outside the app's private runtime database directory and explicitly grant the Android sync client access to it. The Android client and folder-marker behavior must be tested on real devices; Android background restrictions and vendor cleanup policies can otherwise make sync intermittent. [Syncthing-Fork source](https://github.com/researchxxl/syncthing-android), [folder marker FAQ](https://docs.syncthing.net/users/faq.html#i-am-seeing-the-error-message-folder-marker-missing-what-do-i-do)

### Alternatives

| Approach | Fit | Cost and operations | Main limitation |
| --- | --- | --- | --- |
| Local-first only | Good first storage model, not sync | No service and almost no operations | Each device remains separate; requires export/restore to move data |
| Syncthing + exchange files | Best v1 fit | Free software; install/pair two clients and maintain a shared folder | No semantic merge; community Android wrapper and background behavior need validation |
| Self-hosted Nextcloud | Viable if an always-on existing desktop/server is available | Server, web/PHP/database/storage maintenance plus Android and desktop clients | More moving parts; Nextcloud's own manual says Android bidirectional sync is not fully implemented. [system requirements](https://docs.nextcloud.com/server/latest/admin_manual/installation/system_requirements.html), [sync manual](https://docs.nextcloud.com/server/latest/user_manual/en/files/desktop_mobile_sync.html) |
| Manual export/import | Safest fallback | No daemon, account, or recurring fee; user initiates transfer | Not automatic and merge UX must be implemented |

Nextcloud can sync ordinary files with desktop clients and has Android/mobile apps, but it is a server product, not just a folder peer. Its documentation requires retaining the config, data, theme, and database for a complete backup; that is additional operational responsibility. [desktop/mobile sync](https://docs.nextcloud.com/server/latest/user_manual/en/files/desktop_mobile_sync.html), [backup](https://docs.nextcloud.com/server/latest/admin_manual/maintenance/backup.html), [desktop client source](https://github.com/nextcloud/desktop), [Android client source](https://github.com/nextcloud/android)

For manual export, use an application-defined ZIP containing JSON or CSV records and photo files. SQLite's official CLI supports SQL dump, CSV export, and reconstruction; SQLite also documents the Online Backup API and `VACUUM INTO` for consistent database snapshots. [SQLite CLI](https://sqlite.org/cli.html#converting_an_entire_database_to_a_text_file), [SQLite Backup API](https://sqlite.org/backup.html), [`VACUUM INTO`](https://sqlite.org/lang_vacuum.html#vacuuminto)

## Minimum v1 setup

1. Install the official desktop Syncthing binary and a maintained Android Syncthing wrapper.
2. Put `fermentstation-sync` in a user-visible, durable folder on both devices; pair the two device IDs and share only that folder.
3. Start with direct LAN connectivity. Leave public relay/discovery enabled only if cross-network operation is needed and acceptable; otherwise use local discovery or a deliberately configured direct address.
4. Have the app write complete, uniquely named record/photo files, then import them into each device's private SQLite database.
5. Enable Syncthing staggered or simple versioning on the desktop copy, and separately copy the exchange folder and app database exports to another disk on a regular schedule. Versioning alone is not backup.
6. Add an in-app export/import command before relying on sync. Export a ZIP of records and photos; use a consistent stable-ID policy when importing conflict copies.

## Recommendation and fallback

**Recommend:** local SQLite for fast offline app behavior, Syncthing for zero-recurring-cost transport of immutable record files and photo originals, and explicit ID-based import/conflict review. This uses existing Android and desktop hardware without a continuously running server and avoids the SQLite live-file trap.

**Fallback:** manual ZIP export/import with photos, transferred over USB, local network, or any existing file-transfer method. If reliable two-way file sync proves too operationally fragile on Android, ship this fallback rather than syncing `.db` files or adding a cloud dependency.

## Source URLs

- https://github.com/peterle95/fermentstation/issues/6
- https://syncthing.net/downloads/
- https://docs.syncthing.net/users/faq.html
- https://docs.syncthing.net/users/security.html
- https://docs.syncthing.net/users/relaying.html
- https://docs.syncthing.net/users/syncing.html
- https://docs.syncthing.net/users/versioning.html
- https://github.com/researchxxl/syncthing-android
- https://sqlite.org/howtocorrupt.html
- https://sqlite.org/wal.html
- https://sqlite.org/backup.html
- https://sqlite.org/lang_vacuum.html#vacuuminto
- https://sqlite.org/cli.html
- https://docs.nextcloud.com/server/latest/admin_manual/installation/system_requirements.html
- https://docs.nextcloud.com/server/latest/user_manual/en/files/desktop_mobile_sync.html
- https://docs.nextcloud.com/server/latest/admin_manual/maintenance/backup.html
- https://github.com/nextcloud/android
- https://github.com/nextcloud/desktop
