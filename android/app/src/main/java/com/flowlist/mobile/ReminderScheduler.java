package com.flowlist.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.HashSet;
import java.util.Set;

final class ReminderScheduler {
    private static final String PREFS = "flowlist.android.store";
    private static final String SCHEDULED_KEY = "scheduled_alarm_keys";
    private static final String EXTRA_KEY = "reminder_key";
    private static final long GRACE_MS = 24L * 60L * 60L * 1000L;

    private ReminderScheduler() {
    }

    static synchronized void sync(Context context, String rawTasks) {
        JSONArray tasks;
        try {
            tasks = new JSONArray(rawTasks);
        } catch (JSONException ignored) {
            tasks = new JSONArray();
        }

        TaskStore.saveTasks(context, tasks);
        Set<String> previous = loadScheduledKeys(context);
        Set<String> current = new HashSet<>();
        for (String key : previous) cancel(context, key);

        long now = System.currentTimeMillis();
        for (int index = 0; index < tasks.length(); index++) {
            TaskData task = TaskData.fromJson(tasks.optJSONObject(index));
            if (task.id.isEmpty() || task.completed || task.reminderAt == null || task.reminderAt.isEmpty()) continue;
            String key = task.key();
            if (TaskStore.isFired(context, key)) continue;

            long reminderAt = task.reminderTimestamp();
            if (reminderAt < 0) continue;
            if (reminderAt <= now) {
                long dueAt = task.dueTimestamp() >= 0 ? task.dueTimestamp() : reminderAt;
                if (now <= dueAt + GRACE_MS) NotificationHelper.fire(context, task);
                else TaskStore.markFired(context, key);
                continue;
            }

            schedule(context, key, reminderAt);
            current.add(key);
        }
        saveScheduledKeys(context, current);
    }

    static synchronized void restore(Context context) {
        sync(context, TaskStore.loadTasks(context).toString());
    }

    static String keyExtra() {
        return EXTRA_KEY;
    }

    private static void schedule(Context context, String key, long timestamp) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        PendingIntent intent = pendingIntent(context, key);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarms.canScheduleExactAlarms()) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, intent);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, intent);
        } else {
            alarms.set(AlarmManager.RTC_WAKEUP, timestamp, intent);
        }
    }

    private static void cancel(Context context, String key) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(pendingIntent(context, key));
    }

    private static PendingIntent pendingIntent(Context context, String key) {
        Intent intent = new Intent(context, ReminderReceiver.class)
                .setAction("com.flowlist.mobile.REMINDER")
                .putExtra(EXTRA_KEY, key);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, requestCode(key), intent, flags);
    }

    private static int requestCode(String key) {
        int value = key.hashCode() & 0x7fffffff;
        return value == 0 ? 1 : value;
    }

    private static Set<String> loadScheduledKeys(Context context) {
        Set<String> result = new HashSet<>();
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(SCHEDULED_KEY, "[]");
        try {
            JSONArray values = new JSONArray(raw);
            for (int index = 0; index < values.length(); index++) {
                String key = values.optString(index, "");
                if (!key.isEmpty()) result.add(key);
            }
        } catch (JSONException ignored) {
            // Treat malformed scheduling metadata as empty.
        }
        return result;
    }

    private static void saveScheduledKeys(Context context, Set<String> keys) {
        JSONArray values = new JSONArray();
        for (String key : keys) values.put(key);
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(SCHEDULED_KEY, values.toString())
                .apply();
    }
}
