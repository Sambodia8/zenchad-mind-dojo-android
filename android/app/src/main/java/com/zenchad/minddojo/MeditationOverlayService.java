package com.zenchad.minddojo;

import android.app.*;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import androidx.core.app.NotificationCompat;
import java.util.Locale;

/** A clock-only overlay: YouTube owns playback; no media is embedded or downloaded. */
public class MeditationOverlayService extends Service {
    private static final String CHANNEL = "meditation_floating_timer";
    private static final int NOTIFICATION = 7310;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windows;
    private LinearLayout panel;
    private TextView clock;
    private long deadline;
    private boolean finished;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!Settings.canDrawOverlays(MeditationOverlayService.this)) { stopSelf(); return; }
            long seconds = Math.max(0, (deadline - System.currentTimeMillis() + 999) / 1000);
            clock.setText(seconds == 0 ? "Complete ✓" : String.format(Locale.US, "%d:%02d", seconds / 60, seconds % 60));
            if (seconds == 0 && !finished) {
                finished = true;
                getSystemService(NotificationManager.class).notify(NOTIFICATION, notification(true));
                handler.postDelayed(() -> stopSelf(), 60000);
            }
            if (!finished) handler.postDelayed(this, 250);
        }
    };

    private Intent returnIntent() {
        return new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }

    private Notification notification(boolean complete) {
        PendingIntent back = PendingIntent.getActivity(this, 7310, returnIntent(), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(complete ? "Meditation complete" : "ZenChad meditation timer")
            .setContentText(complete ? "Return to ZenChad to save your session." : "Tap to return. YouTube controls the music.")
            .setContentIntent(back).setOngoing(!complete).setOnlyAlertOnce(true);
        if (!complete) builder.setWhen(deadline).setUsesChronometer(true).setChronometerCountDown(true);
        return builder.build();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        ResultReceiver receiver = intent.getParcelableExtra("receiver");
        try {
            deadline = intent.getLongExtra("deadline", 0);
            if (deadline <= System.currentTimeMillis() || !Settings.canDrawOverlays(this)) throw new IllegalStateException("Invalid timer");
            if (Build.VERSION.SDK_INT >= 26) {
                getSystemService(NotificationManager.class).createNotificationChannel(
                    new NotificationChannel(CHANNEL, "Floating meditation timer", NotificationManager.IMPORTANCE_LOW));
            }
            startForeground(NOTIFICATION, notification(false));
            handler.removeCallbacksAndMessages(null);
            finished = false;
            if (panel == null) createOverlay();
            handler.post(tick);
            if (receiver != null) receiver.send(1, Bundle.EMPTY);
        } catch (Exception e) {
            if (receiver != null) receiver.send(0, Bundle.EMPTY);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void createOverlay() {
        windows = getSystemService(WindowManager.class);
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(12), dp(8), dp(12), dp(8));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.rgb(25, 28, 40));
        background.setCornerRadius(dp(20));
        background.setStroke(dp(1), Color.rgb(126, 175, 227));
        panel.setBackground(background);
        TextView title = new TextView(this);
        title.setText("ZenChad · drag to move");
        title.setTextSize(11);
        title.setTextColor(Color.LTGRAY);
        panel.addView(title);
        clock = new TextView(this);
        clock.setTextSize(28);
        clock.setTextColor(Color.WHITE);
        clock.setGravity(Gravity.CENTER);
        panel.addView(clock);
        Button back = new Button(this);
        back.setText("Return");
        back.setContentDescription("Return to ZenChad timer");
        back.setOnClickListener(view -> { startActivity(returnIntent()); stopSelf(); });
        panel.addView(back, new LinearLayout.LayoutParams(-1, dp(48)));
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams layout = new WindowManager.LayoutParams(dp(180), -2, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        layout.gravity = Gravity.TOP | Gravity.LEFT;
        layout.x = dp(12);
        layout.y = dp(120);
        View.OnTouchListener drag = new View.OnTouchListener() {
            float x, y;
            int startX, startY;
            @Override public boolean onTouch(View view, android.view.MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    x = event.getRawX(); y = event.getRawY(); startX = layout.x; startY = layout.y;
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    android.util.DisplayMetrics metrics = getResources().getDisplayMetrics();
                    layout.x = Math.max(0, Math.min(metrics.widthPixels - panel.getWidth(), startX + Math.round(event.getRawX() - x)));
                    layout.y = Math.max(0, Math.min(metrics.heightPixels - panel.getHeight(), startY + Math.round(event.getRawY() - y)));
                    windows.updateViewLayout(panel, layout);
                    return true;
                }
                return true;
            }
        };
        title.setOnTouchListener(drag);
        clock.setOnTouchListener(drag);
        windows.addView(panel, layout);
    }

    @Override public void onTaskRemoved(Intent rootIntent) { stopSelf(); }

    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (panel != null && panel.isAttachedToWindow()) windows.removeView(panel);
        panel = null;
        stopForeground(true);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
