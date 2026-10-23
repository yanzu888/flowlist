package com.flowlist.mobile;

import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;

final class TaskData {
    final String id;
    final String title;
    final String notes;
    final String dueAt;
    final String reminderAt;
    final String notifiedReminderAt;
    final boolean completed;
    final boolean test;

    private TaskData(
            String id,
            String title,
            String notes,
            String dueAt,
            String reminderAt,
            String notifiedReminderAt,
            boolean completed,
            boolean test
    ) {
        this.id = id;
        this.title = title;
        this.notes = notes;
        this.dueAt = dueAt;
        this.reminderAt = reminderAt;
        this.notifiedReminderAt = notifiedReminderAt;
        this.completed = completed;
        this.test = test;
    }

    static TaskData fromJson(JSONObject object) {
        if (object == null) {
            return new TaskData("", "", "", null, null, null, true, false);
        }
        return new TaskData(
                object.optString("id", ""),
                object.optString("title", "任务提醒"),
                object.optString("notes", ""),
                nullableString(object, "dueAt"),
                nullableString(object, "reminderAt"),
                nullableString(object, "notifiedReminderAt"),
                object.optBoolean("completed", false),
                object.optBoolean("isTest", false)
        );
    }

    JSONObject toJson() {
        JSONObject object = new JSONObject();
        try {
            object.put("id", id);
            object.put("title", title);
            object.put("notes", notes);
            object.put("dueAt", dueAt == null ? JSONObject.NULL : dueAt);
            object.put("reminderAt", reminderAt == null ? JSONObject.NULL : reminderAt);
            object.put("notifiedReminderAt", notifiedReminderAt == null ? JSONObject.NULL : notifiedReminderAt);
            object.put("completed", completed);
            if (test) object.put("isTest", true);
        } catch (JSONException ignored) {
            // All values above are primitive strings or booleans.
        }
        return object;
    }

    String key() {
        return id + ":" + reminderAt;
    }

    long reminderTimestamp() {
        return parseTimestamp(reminderAt);
    }

    long dueTimestamp() {
        return parseTimestamp(dueAt);
    }

    private static String nullableString(JSONObject object, String name) {
        return object.isNull(name) ? null : object.optString(name, null);
    }

    private static long parseTimestamp(String value) {
        if (value == null || value.isEmpty()) return -1L;
        try {
            return Instant.parse(value).toEpochMilli();
        } catch (RuntimeException ignored) {
            return -1L;
        }
    }
}
