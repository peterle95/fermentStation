package com.peterle.fermentstation;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SharedDirectoryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
