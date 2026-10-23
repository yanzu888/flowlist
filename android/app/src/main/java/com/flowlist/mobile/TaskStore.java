package com.flowlist.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

final class TaskStore {
    private static final String PREFS = "flowlist.android.store";
    private static final String TASKS_KEY = "tasks";
    private static final String FIRED_KEY = "fired";

    private TaskStore() {
    }

    static synchronized JSONArray loadTasks(Context context) {
        String raw = prefs(context).getString(TASKS_KEY, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }

    static synchronized JSONArray loadTasksWithFiredState(Context context) {
        JSONArray tasks = loadTasks(context);
        Set<String> fired = loadFired(context);
        JSONArray result = new JSONArray();
        for (int index = 0; index < tasks.length(); index++) {
            JSONObject task = tasks.optJSONObject(index);
            if (task == null) continue;
            JSONObject copy;
            try {
                copy = new JSONObject(task.toString());
            } catch (JSONException ignored) {
                continue;
            }
            String key = reminderKey(copy);
            if (!key.isEmpty() && fired.contains(key) && !copy.isNull("reminderAt")) {
                try {
                    copy.put("notifiedReminderAt", copy.optString("reminderAt"));
                } catch (JSONException ignored) {
                    // Keep the stored task unchanged if a malformed object is encountered.
                }
            }
            result.put(copy);
        }
        return result;
    }

    static synchronized void saveTasks(Context context, JSONArray tasks) {
        Set<String> activeKeys = new HashSet<>();
        Set<String> fired = loadFired(context);
        for (int index = 0; index < tasks.length(); index++) {
            JSONObject task = tasks.optJSONObject(index);
            if (task == null) continue;
            String key = reminderKey(task);
            if (!key.isEmpty()) {
                activeKeys.add(key);
                String reminderAt = task.optString("reminderAt", "");
                if (reminderAt.equals(task.optString("notifiedReminderAt", ""))) fired.add(key);
            }
        }
        fired.retainAll(activeKeys);
        prefs(context).edit()
                .putString(TASKS_KEY, tasks.toString())
                .putString(FIRED_KEY, setToJson(fired))
                .apply();
    }

    static synchronized TaskData findTask(Context context, String key) {
        JSONArray tasks = loadTasks(context);
        for (int index = 0; index < tasks.length(); index++) {
            JSONObject object = tasks.optJSONObject(index);
            if (object != null && key.equals(reminderKey(object))) return TaskData.fromJson(object);
        }
        return null;
    }

    static synchronized void markFired(Context context, String key) {
        Set<String> fired = loadFired(context);
        fired.add(key);
        prefs(context).edit().putString(FIRED_KEY, setToJson(fired)).apply();
    }

    static synchronized boolean isFired(Context context, String key) {
        return loadFired(context).contains(key);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static Set<String> loadFired(Context context) {
        Set<String> result = new HashSet<>();
        JSONArray values;
        try {
            values = new JSONArray(prefs(context).getString(FIRED_KEY, "[]"));
        } catch (JSONException ignored) {
            return result;
        }
        for (int index = 0; index < values.length(); index++) {
            String value = values.optString(index, "");
            if (!value.isEmpty()) result.add(value);
        }
        return result;
    }

    private static String setToJson(Set<String> values) {
        JSONArray result = new JSONArray();
        for (String value : values) result.put(value);
        return result.toString();
    }

    private static String reminderKey(JSONObject task) {
        String id = task.optString("id", "");
        String reminderAt = task.optString("reminderAt", "");
        return id.isEmpty() || reminderAt.isEmpty() || "null".equals(reminderAt) ? "" : id + ":" + reminderAt;
    }
}
