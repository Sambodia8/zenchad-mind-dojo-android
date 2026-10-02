package com.zenchad.minddojo;
import android.content.*;
import android.util.Log;
public class MeditationPracticeReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent) {
        try { MeditationPracticeStore.expired(context,intent.getStringExtra("id"),intent.getLongExtra("generation",-1)); }
        catch(Exception e) { Log.e("MeditationPractice","Could not complete timer",e); }
    }
}
