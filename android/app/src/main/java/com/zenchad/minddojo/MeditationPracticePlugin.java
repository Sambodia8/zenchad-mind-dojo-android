package com.zenchad.minddojo;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name="MeditationPractice")
public class MeditationPracticePlugin extends Plugin {
    private void state(PluginCall call,JSONObject s) { JSObject r=new JSObject();r.put("state",s == null ? JSONObject.NULL : s);call.resolve(r); }
    @PluginMethod public void getState(PluginCall call) { try { state(call,MeditationPracticeStore.read(getContext())); }catch(Exception e){call.reject(e.getMessage(),e);} }
    @PluginMethod public void start(PluginCall call) {
        String id=call.getString("id",""),preset=call.getString("preset","free"),mode=call.getString("mode","countdown");
        int target=call.getInt("targetSeconds",780);
        if(id.length()<1 || id.length()>100 || !(preset.equals("free") || preset.equals("focus-refocus")) || !(mode.equals("countdown") || mode.equals("stopwatch")) || target<60 || target>10800 || (preset.equals("focus-refocus") && (!mode.equals("countdown") || target!=780))) { call.reject("Invalid meditation settings");return; }
        try { state(call,MeditationPracticeStore.start(getContext(),id,preset,mode,target,call.getBoolean("endingBell",true))); }catch(Exception e){call.reject(e.getMessage(),e);}
    }
    private void action(PluginCall call,String action) { try { state(call,MeditationPracticeStore.action(getContext(),call.getString("id",""),action)); }catch(Exception e){call.reject(e.getMessage(),e);} }
    @PluginMethod public void pause(PluginCall call){action(call,"pause");}
    @PluginMethod public void resume(PluginCall call){action(call,"resume");}
    @PluginMethod public void finish(PluginCall call){action(call,"finish");}
    @PluginMethod public void cancel(PluginCall call){action(call,"cancel");}
    @PluginMethod public void acknowledgeCompletion(PluginCall call){action(call,"ack");}
    @PluginMethod public void permissionStatus(PluginCall call) {
        JSObject r=new JSObject();r.put("exact",MeditationPracticeStore.exact(getContext()));r.put("notifications",MeditationPracticeStore.notifications(getContext()));r.put("bellChannel",MeditationPracticeStore.bellChannel(getContext()));call.resolve(r);
    }
    @PluginMethod public void requestExactAlarmAccess(PluginCall call) {
        try { if(Build.VERSION.SDK_INT>=31 && !MeditationPracticeStore.exact(getContext())) getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getContext().getPackageName())));call.resolve(); }catch(Exception e){call.reject("Could not open alarm settings",e);}
    }
    @PluginMethod public void previewBell(PluginCall call) {
        String id=call.getString("id","");
        try {if(!id.isEmpty() && !MeditationPracticeStore.claimForegroundBell(getContext(),id)){call.resolve();return;}}
        catch(Exception e){call.reject("Could not save ending bell",e);return;}
        android.media.AudioManager audio=(android.media.AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        android.app.NotificationManager notifications=(android.app.NotificationManager)getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        if(audio.getRingerMode()!=android.media.AudioManager.RINGER_MODE_NORMAL || audio.getStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION)==0 || (Build.VERSION.SDK_INT>=23 && notifications.getCurrentInterruptionFilter()!=android.app.NotificationManager.INTERRUPTION_FILTER_ALL)) {call.resolve();return;}
        try {
            android.media.MediaPlayer player=new android.media.MediaPlayer();
            player.setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            player.setDataSource(getContext(),Uri.parse("android.resource://"+getContext().getPackageName()+"/raw/meditation_bowl"));
            player.setOnCompletionListener(p->p.release());player.setOnErrorListener((p,what,extra)->{p.release();return true;});player.prepare();player.start();call.resolve();
        }catch(Exception e){call.reject("Could not play the bowl",e);}
    }
    @Override protected void handleOnResume() { try { JSONObject s=MeditationPracticeStore.read(getContext());if(s!=null)MeditationPracticeStore.schedule(getContext(),s); }catch(Exception ignored){} }
}
