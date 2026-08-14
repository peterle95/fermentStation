package com.peterle.fermentstation;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class SharedDirectoryPluginTest {
    @Test
    public void validatesRelativeSharedPaths() {
        assertTrue(SharedDirectoryPlugin.validRelativePath("records/batches.json"));
        assertFalse(SharedDirectoryPlugin.validRelativePath("../private.json"));
        assertFalse(SharedDirectoryPlugin.validRelativePath("/private.json"));
        assertFalse(SharedDirectoryPlugin.validRelativePath("records\\private.json"));
    }
}
