package com.zenchad.minddojo;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.*;

final class MeditationPracticeStore {
    private static final String KEY = "state";
    private static final int ALARM_ID = 7301;
    private static final String BELL = "meditation-bowl-v1", SILENT = "meditation-silent-v1";
    static String iso(long millis) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC")); return f.format(new Date(millis));
    }
    private static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("meditation-practice-v1", Context.MODE_PRIVATE); }
    static void write(Context c, JSONObject s) {
        if (!prefs(c).edit().putString(KEY, s.toString()).commit()) throw new IllegalStateException("Could not save meditation timer");
    }
    static int boot(Context c) { return Build.VERSION.SDK_INT >= 24 ? Settings.Global.getInt(c.getContentResolver(), Settings.Global.BOOT_COUNT, -1) : -1; }
    static boolean exact(Context c) { return Build.VERSION.SDK_INT < 31 || ((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms(); }
    static boolean notifications(Context c) {
        return NotificationManagerCompat.from(c).areNotificationsEnabled() && (Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
    }
    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel bell = new NotificationChannel(BELL,"Meditation ending bell", NotificationManager.IMPORTANCE_HIGH);
        bell.setDescription("A gentle bowl when your meditation ends"); bell.enableVibration(false);
        bell.setSound(Uri.parse("android.resource://"+c.getPackageName()+"/raw/meditation_bowl"), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        nm.createNotificationChannel(bell);
        NotificationChannel silent = new NotificationChannel(SILENT,"Silent meditation completion",NotificationManager.IMPORTANCE_LOW);
        silent.setSound(null,null); silent.enableVibration(false); nm.createNotificationChannel(silent);
    }
    static boolean bellChannel(Context c) {
        channels(c);
        if (Build.VERSION.SDK_INT < 26) return notifications(c);
        NotificationChannel channel = ((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).getNotificationChannel(BELL);
        return notifications(c) && channel != null && channel.getImportance() != NotificationManager.IMPORTANCE_NONE && channel.getSound() != null;
    }
    private static PendingIntent alarmIntent(Context c, JSONObject s) {
        Intent i = new Intent(c,MeditationPracticeReceiver.class).putExtra("id",s.optString("id")).putExtra("generation",s.optLong("generation"));
        return PendingIntent.getBroadcast(c, ALARM_ID, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void cancelAlarm(Context c) {
        PendingIntent p = PendingIntent.getBroadcast(c,ALARM_ID,new Intent(c,MeditationPracticeReceiver.class),PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if(p != null) { ((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).cancel(p); p.cancel(); }
    }
    static void schedule(Context c, JSONObject s) {
        cancelAlarm(c);
        if (!s.optString("status").equals("running") || !s.optString("mode").equals("countdown") || !exact(c)) return;
        long target = s.optLong("targetSeconds") * 1000;
        long trigger = s.optLong("anchor") + target - s.optLong("accumulated");
        AlarmManager am = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        try { am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, alarmIntent(c,s)); }
        catch (SecurityException ignored) { /* Permission may be revoked between the check and scheduling. */ }
    }
    static synchronized JSONObject read(Context c) throws Exception {
        String raw = prefs(c).getString(KEY,null);
        if (raw == null) return null;
        JSONObject s = new JSONObject(raw);
        long now = SystemClock.elapsedRealtime();
        boolean running = s.optString("status").equals("running");
        boolean reboot = s.optInt("boot",-1) != boot(c) || now < s.optLong("checkpointAt") ||
            (Build.VERSION.SDK_INT < 24 && Math.abs((System.currentTimeMillis()-now)-s.optLong("bootEpoch")) > 120000);
        if(reboot && !s.optString("status").equals("completed")) {
            s.put("accumulated",s.optLong("checkpoint")); s.put("anchor",now); s.put("checkpointAt",now);
            s.put("boot",boot(c)); s.put("bootEpoch",System.currentTimeMillis()-now); s.put("status","interrupted"); running=false; cancelAlarm(c); write(c,s);
        }
        long target = s.optString("mode").equals("countdown") ? s.optLong("targetSeconds")*1000 : 0;
        long elapsed = MeditationPracticeClock.elapsed(s.optLong("accumulated"),s.optLong("anchor"),now,running,target);
        s.put("elapsedSeconds",elapsed/1000.0);
        if(running && target > 0 && elapsed >= target) {
            long deadline = s.optLong("anchor") + target - s.optLong("accumulated");
            complete(c,s,System.currentTimeMillis()-Math.max(0,now-deadline),elapsed);
        } else if(!reboot && now-s.optLong("checkpointAt") >= 10000 && !s.optString("status").equals("completed")) {
            s.put("checkpoint",elapsed); s.put("checkpointAt",now); write(c,s);
        }
        // Retry a pending completion notification after an interrupted process write.
        if(s.optString("status").equals("completed") && !s.optBoolean("notificationPosted")) notifyCompletion(c,s);
        return s;
    }
    private static void complete(Context c, JSONObject s, long at, long elapsed) throws Exception {
        s.put("status","completed"); s.put("accumulated",elapsed); s.put("elapsedSeconds",elapsed/1000.0);
        s.put("completedAt",iso(at)); s.put("checkpoint",elapsed); cancelAlarm(c); write(c,s); notifyCompletion(c,s);
    }
    private static void notifyCompletion(Context c, JSONObject s) throws Exception {
        if(!notifications(c)) return;
        channels(c);
        Intent launch = new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(c,ALARM_ID,launch,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        boolean sound = s.optBoolean("endingBell") && !s.optBoolean("bellDelivered");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c,sound ? BELL : SILENT)
            .setSmallIcon(c.getApplicationInfo().icon).setContentTitle("Meditation complete")
            .setContentText("Take your time returning. Open ZenChad to see your practice.")
            .setContentIntent(content).setAutoCancel(true).setOnlyAlertOnce(true).setPriority(sound ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_LOW);
        if(Build.VERSION.SDK_INT < 26 && sound) b.setSound(Uri.parse("android.resource://"+c.getPackageName()+"/raw/meditation_bowl"));
        NotificationManagerCompat.from(c).notify(ALARM_ID,b.build());
        s.put("notificationPosted",true); s.put("bellDelivered",s.optBoolean("bellDelivered") || sound); write(c,s);
    }
    static synchronized boolean claimForegroundBell(Context c,String id) throws Exception {
        JSONObject s=read(c);
        if(s==null || !s.optString("id").equals(id) || !s.optString("status").equals("completed") || !s.optBoolean("endingBell") || s.optBoolean("bellDelivered")) return false;
        s.put("bellDelivered",true);write(c,s);return true;
    }
    static synchronized JSONObject start(Context c, String id, String preset, String mode, int target, boolean ending) throws Exception {
        if(read(c) != null) throw new IllegalStateException("Resume or finish your existing meditation first");
        NotificationManagerCompat.from(c).cancel(ALARM_ID);
        long now=SystemClock.elapsedRealtime(); JSONObject s=new JSONObject();
        s.put("id",id);s.put("preset",preset);s.put("mode",mode);s.put("targetSeconds",target);s.put("endingBell",ending);
        s.put("status","running");s.put("startedAt",iso(System.currentTimeMillis()));s.put("accumulated",0);s.put("anchor",now);
        s.put("elapsedSeconds",0);s.put("checkpoint",0);s.put("checkpointAt",now);s.put("boot",boot(c));s.put("bootEpoch",System.currentTimeMillis()-now);s.put("generation",1);
        write(c,s);schedule(c,s);return s;
    }
    static synchronized JSONObject action(Context c,String id,String action) throws Exception {
        JSONObject s=read(c); if(s == null || !s.optString("id").equals(id)) throw new IllegalStateException("Meditation session changed; reopen the timer");
        if(action.equals("ack") || action.equals("cancel")) {
            if(action.equals("ack") && !s.optString("status").equals("completed")) throw new IllegalStateException("Session has not finished");
            cancelAlarm(c); if(!prefs(c).edit().remove(KEY).commit()) throw new IllegalStateException("Could not clear timer"); return null;
        }
        if(s.optString("status").equals("completed")) return s;
        long elapsed=Math.round(s.optDouble("elapsedSeconds")*1000),now=SystemClock.elapsedRealtime();
        s.put("accumulated",elapsed);s.put("anchor",now);s.put("checkpoint",elapsed);s.put("checkpointAt",now);s.put("generation",s.optLong("generation")+1);
        if(action.equals("finish")) complete(c,s,System.currentTimeMillis(),elapsed);
        else { s.put("status",action.equals("resume") ? "running" : "paused");write(c,s);schedule(c,s); }
        return s;
    }
    static synchronized void expired(Context c,String id,long generation) throws Exception {
        String raw=prefs(c).getString(KEY,null); if(raw == null) return;
        JSONObject s=new JSONObject(raw);
        if(!s.optString("id").equals(id) || s.optLong("generation") != generation) return;
        read(c);
    }
}
