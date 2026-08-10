package com.zenchad.minddojo;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class RunningStoryEventLog {
    private static final String PREFS_NAME = "zenchad_running_story_events_v1";
    private static final String KEY_SESSION_ID = "sessionId";
    private static final String KEY_EVENTS = "events";

    private RunningStoryEventLog() {}

    public static void reset(Context context, String sessionId) {
        store(context).edit()
            .clear()
            .putString(KEY_SESSION_ID, sessionId == null ? "" : sessionId)
            .putString(KEY_EVENTS, "[]")
            .apply();
    }

    public static void append(Context context, String sessionId, String type, long at, double distanceMeters, String detail) {
        SharedPreferences prefs = store(context);
        String safeSessionId = sessionId == null ? "" : sessionId;
        if (!safeSessionId.equals(prefs.getString(KEY_SESSION_ID, ""))) reset(context, safeSessionId);

        JSONArray events;
        try {
            events = new JSONArray(prefs.getString(KEY_EVENTS, "[]"));
        } catch (JSONException error) {
            events = new JSONArray();
        }

        JSONObject event = new JSONObject();
        try {
            event.put("type", type == null ? "story" : type);
            event.put("at", at);
            event.put("distanceMeters", Math.max(0d, distanceMeters));
            event.put("detail", detail == null ? "" : detail);
            events.put(event);
        } catch (JSONException ignored) {
            return;
        }

        // Story runs only create a handful of events. Keep a defensive cap anyway.
        while (events.length() > 40) {
            JSONArray trimmed = new JSONArray();
            for (int index = Math.max(0, events.length() - 40); index < events.length(); index += 1) {
                trimmed.put(events.opt(index));
            }
            events = trimmed;
        }
        prefs.edit().putString(KEY_EVENTS, events.toString()).apply();
    }

    public static String json(Context context, String sessionId) {
        SharedPreferences prefs = store(context);
        String safeSessionId = sessionId == null ? "" : sessionId;
        if (!safeSessionId.equals(prefs.getString(KEY_SESSION_ID, ""))) return "[]";
        return prefs.getString(KEY_EVENTS, "[]");
    }

    private static SharedPreferences store(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
