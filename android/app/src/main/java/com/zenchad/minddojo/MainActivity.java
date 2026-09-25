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
        registerPlugin(RunningPlacePlugin.class);
        registerPlugin(RunningAudioPlugin.class);
        registerPlugin(RunningSpeechPlugin.class);
        registerPlugin(RunningBackgroundNavigationPlugin.class);
        registerPlugin(RunningStorySpeechPlugin.class);
        registerPlugin(RunningStoryDirectorPlugin.class);
        registerPlugin(RunningHealthPlugin.class);
        registerPlugin(RunningPhotosPlugin.class);
        registerPlugin(ZenChadSyncPlugin.class);
        registerPlugin(MeditationOverlayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
