package com.zenchad.minddojo;

import android.content.Context;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(WhisperJournalPlugin.class);
        registerPlugin(QwenJournalPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
