package com.zenchad.minddojo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(WhisperJournalPlugin.class);
        registerPlugin(QwenJournalPlugin.class);
        registerPlugin(AppearancePlugin.class);
        registerPlugin(RunningTrackerPlugin.class);
        registerPlugin(RunningAudioPlugin.class);
        registerPlugin(RunningSpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
