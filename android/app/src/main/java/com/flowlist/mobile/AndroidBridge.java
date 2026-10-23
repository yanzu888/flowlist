package com.flowlist.mobile;

import android.content.Context;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class AndroidBridge {
    private final Context context;

    AndroidBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public void syncTasks(String rawTasks) {
        ReminderScheduler.sync(context, rawTasks);
    }

    @JavascriptInterface
    public String showNotification(String rawTask) {
        try {
            TaskData task = TaskData.fromJson(new JSONObject(rawTask));
            task = new TaskDataForTest(task).asTask();
            NotificationHelper.fire(context, task);
        } catch (JSONException ignored) {
            // Ignore malformed test notifications from the web layer.
        }
        return "{\"nativeSupported\":true}";
    }

    @JavascriptInterface
    public String getReminderStatus() {
        JSONArray tasks = TaskStore.loadTasks(context);
        int scheduled = 0;
        for (int index = 0; index < tasks.length(); index++) {
            JSONObject task = tasks.optJSONObject(index);
            if (task == null || task.optBoolean("completed", false)) continue;
            String reminderAt = task.optString("reminderAt", "");
            if (!reminderAt.isEmpty() && !TaskStore.isFired(context, taskKey(task))) scheduled++;
        }
        return "{\"nativeSupported\":true,\"scheduledCount\":" + scheduled + "}";
    }

    @JavascriptInterface
    public String getTasks() {
        return TaskStore.loadTasksWithFiredState(context).toString();
    }

    private static String taskKey(JSONObject task) {
        return task.optString("id", "") + ":" + task.optString("reminderAt", "");
    }

    private static final class TaskDataForTest {
        private final TaskData source;

        private TaskDataForTest(TaskData source) {
            this.source = source;
        }

        private TaskData asTask() {
            if (source.test) return source;
            try {
                JSONObject object = source.toJson();
                object.put("isTest", true);
                return TaskData.fromJson(object);
            } catch (JSONException ignored) {
                return source;
            }
        }
    }
}
