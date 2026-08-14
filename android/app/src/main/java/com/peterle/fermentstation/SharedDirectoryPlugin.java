package com.peterle.fermentstation;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@CapacitorPlugin(name = "SharedDirectory")
public class SharedDirectoryPlugin extends Plugin {
    private static final String PREFS = "fermentstation-shared-directory";
    private static final String TREE_URI = "tree-uri";
    private static final int MAX_SHARED_FILE_BYTES = 64 * 1024 * 1024;

    @PluginMethod
    public void getLocation(PluginCall call) {
        JSObject result = new JSObject();
        Uri tree = storedTree();
        if (tree != null && hasPermission(tree)) result.put("location", displayName(rootDocument(tree)));
        call.resolve(result);
    }

    @PluginMethod
    public void chooseLocation(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "directoryChosen");
    }

    @ActivityCallback
    private void directoryChosen(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        Intent data = activityResult.getData();
        if (activityResult.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.resolve(new JSObject());
            return;
        }
        Uri tree = data.getData();
        int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree, flags);
            preferences().edit().putString(TREE_URI, tree.toString()).apply();
            JSObject result = new JSObject();
            result.put("location", displayName(rootDocument(tree)));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not retain access to the selected folder", error);
        }
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        try {
            Uri tree = requiredTree();
            List<String> files = new ArrayList<>();
            recoverDirectory(tree, rootDocument(tree), 0);
            collectFiles(tree, rootDocument(tree), "", files);
            JSObject result = new JSObject();
            result.put("files", new JSArray(files));
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        try {
            Uri tree = requiredTree();
            Uri document = findDocument(tree, requirePath(call), false);
            JSObject result = new JSObject();
            if (document != null) result.put("data", Base64.encodeToString(readBytes(document), Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        Uri temporary = null;
        Uri backup = null;
        String originalName = null;
        try {
            Uri tree = requiredTree();
            String path = requirePath(call);
            String encoded = call.getString("data");
            if (encoded == null) throw new IllegalArgumentException("File data is required");
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            if (bytes.length > MAX_SHARED_FILE_BYTES) throw new IllegalStateException("Shared file exceeds the 64 MB limit");
            Uri current = findDocument(tree, path, false);
            if (current != null && java.util.Arrays.equals(readBytes(current), bytes)) {
                call.resolve();
                return;
            }

            String[] parts = path.split("/");
            String name = parts[parts.length - 1];
            originalName = name;
            Uri parent = ensureParent(tree, parts);
            String nonce = String.valueOf(System.currentTimeMillis());
            temporary = DocumentsContract.createDocument(
                getContext().getContentResolver(), parent, "application/octet-stream", "." + name + ".tmp-" + nonce);
            if (temporary == null) throw new IllegalStateException("Could not create temporary shared file");
            writeAndSync(temporary, bytes);

            if (current != null) {
                backup = DocumentsContract.renameDocument(
                    getContext().getContentResolver(), current, "." + name + ".bak-" + nonce);
                if (backup == null) throw new IllegalStateException("The selected folder provider cannot safely replace files");
            }
            Uri replacement = DocumentsContract.renameDocument(getContext().getContentResolver(), temporary, name);
            if (replacement == null) throw new IllegalStateException("Could not install the completed shared file");
            temporary = null;
            if (backup != null) {
                try { DocumentsContract.deleteDocument(getContext().getContentResolver(), backup); } catch (Exception ignored) {}
                backup = null;
            }
            call.resolve();
        } catch (Exception error) {
            if (backup != null && originalName != null) {
                try {
                    DocumentsContract.renameDocument(getContext().getContentResolver(), backup, originalName);
                } catch (Exception ignored) {}
            }
            if (temporary != null) {
                try { DocumentsContract.deleteDocument(getContext().getContentResolver(), temporary); } catch (Exception ignored) {}
            }
            call.reject(error.getMessage(), error);
        }
    }

    static boolean validRelativePath(String path) {
        if (path == null || path.isEmpty() || path.startsWith("/") || path.contains("\\")) return false;
        for (String part : path.split("/", -1)) {
            if (part.isEmpty() || part.equals(".") || part.equals("..")) return false;
        }
        return true;
    }

    private String requirePath(PluginCall call) {
        String path = call.getString("path");
        if (!validRelativePath(path)) throw new IllegalArgumentException("Shared file path must be relative");
        return path;
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
    }

    private Uri storedTree() {
        String value = preferences().getString(TREE_URI, null);
        return value == null ? null : Uri.parse(value);
    }

    private Uri requiredTree() {
        Uri tree = storedTree();
        if (tree == null || !hasPermission(tree)) throw new IllegalStateException("Shared folder access is not available");
        return tree;
    }

    private boolean hasPermission(Uri tree) {
        for (android.content.UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (permission.getUri().equals(tree) && permission.isReadPermission() && permission.isWritePermission()) return true;
        }
        return false;
    }

    private Uri rootDocument(Uri tree) {
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    private Uri ensureParent(Uri tree, String[] parts) throws Exception {
        Uri parent = rootDocument(tree);
        for (int index = 0; index < parts.length - 1; index++) {
            Uri child = findChild(tree, parent, parts[index]);
            if (child == null) child = DocumentsContract.createDocument(
                getContext().getContentResolver(), parent, DocumentsContract.Document.MIME_TYPE_DIR, parts[index]);
            if (child == null) throw new IllegalStateException("Could not create shared folder " + parts[index]);
            parent = child;
        }
        return parent;
    }

    private Uri findDocument(Uri tree, String path, boolean createParents) throws Exception {
        String[] parts = path.split("/");
        Uri parent = createParents ? ensureParent(tree, parts) : rootDocument(tree);
        if (!createParents) {
            for (int index = 0; index < parts.length - 1; index++) {
                parent = findChild(tree, parent, parts[index]);
                if (parent == null) return null;
            }
        }
        return findChild(tree, parent, parts[parts.length - 1]);
    }

    private Uri findChild(Uri tree, Uri parent, String name) throws Exception {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(parent));
        try (Cursor cursor = getContext().getContentResolver().query(children,
            new String[] { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME },
            null, null, null)) {
            while (cursor != null && cursor.moveToNext()) {
                if (name.equals(cursor.getString(1))) {
                    return DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0));
                }
            }
        }
        return null;
    }

    private void collectFiles(Uri tree, Uri directory, String prefix, List<String> output) throws Exception {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(directory));
        try (Cursor cursor = getContext().getContentResolver().query(children,
            new String[] {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
            }, null, null, null)) {
            while (cursor != null && cursor.moveToNext()) {
                Uri child = DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0));
                String path = prefix + cursor.getString(1);
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2))) {
                    collectFiles(tree, child, path + "/", output);
                } else {
                    output.add(path);
                }
            }
        }
    }

    private void recoverDirectory(Uri tree, Uri directory, int depth) throws Exception {
        if (depth > 64) throw new IllegalStateException("Shared folder nesting exceeds the supported limit");
        List<RecoveryEntry> directories = new ArrayList<>();
        List<RecoveryEntry> files = new ArrayList<>();
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(directory));
        try (Cursor cursor = getContext().getContentResolver().query(children,
            new String[] {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
            }, null, null, null)) {
            while (cursor != null && cursor.moveToNext()) {
                Uri child = DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0));
                RecoveryEntry entry = new RecoveryEntry(child, cursor.getString(1));
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2))) directories.add(entry);
                else files.add(entry);
            }
        }
        for (RecoveryEntry child : directories) {
            boolean allowed = depth > 0 || child.name.equals("records") || child.name.equals("photos") || child.name.equals("migration-backup");
            if (allowed) recoverDirectory(tree, child.uri, depth + 1);
        }
        files.sort(Comparator.comparing((RecoveryEntry entry) -> entry.name).reversed());
        for (String marker : new String[] { ".bak-", ".tmp-" }) {
            for (RecoveryEntry file : files) {
                String name = file.name;
                int index = name.lastIndexOf(marker);
                String nonce = index < 0 ? "" : name.substring(index + marker.length());
                if (!name.startsWith(".") || index <= 1 || nonce.isEmpty() || !nonce.chars().allMatch(Character::isDigit)) continue;
                String targetName = name.substring(1, index);
                if (depth == 0 && !targetName.equals("manifest.json")) continue;
                Uri target = findChild(tree, directory, targetName);
                if (target == null) {
                    if (DocumentsContract.renameDocument(getContext().getContentResolver(), file.uri, targetName) == null) {
                        throw new IllegalStateException("Could not recover interrupted shared file " + targetName);
                    }
                } else {
                    DocumentsContract.deleteDocument(getContext().getContentResolver(), file.uri);
                }
            }
        }
    }

    private static class RecoveryEntry {
        final Uri uri;
        final String name;

        RecoveryEntry(Uri uri, String name) {
            this.uri = uri;
            this.name = name;
        }
    }

    private byte[] readBytes(Uri document) throws Exception {
        try (InputStream input = getContext().getContentResolver().openInputStream(document);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("Could not read shared file");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_SHARED_FILE_BYTES) {
                    throw new IllegalStateException("Shared file exceeds the 64 MB limit");
                }
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private void writeAndSync(Uri document, byte[] bytes) throws Exception {
        try (ParcelFileDescriptor descriptor = getContext().getContentResolver().openFileDescriptor(document, "w");
             FileOutputStream output = descriptor == null ? null : new FileOutputStream(descriptor.getFileDescriptor())) {
            if (output == null) throw new IllegalStateException("Could not write shared file");
            output.write(bytes);
            output.flush();
            output.getFD().sync();
        }
    }

    private String displayName(Uri document) {
        try (Cursor cursor = getContext().getContentResolver().query(document,
            new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            return cursor != null && cursor.moveToFirst() ? cursor.getString(0) : document.toString();
        }
    }
}
