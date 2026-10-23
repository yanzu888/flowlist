package com.flowlist.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String key = intent.getStringExtra(ReminderScheduler.keyExtra());
        if (key == null || key.isEmpty()) return;
        TaskData task = TaskStore.findTask(context, key);
        if (task == null || task.completed || task.reminderAt == null) return;
        long reminderAt = task.reminderTimestamp();
        long dueAt = task.dueTimestamp() >= 0 ? task.dueTimestamp() : reminderAt;
        long now = System.currentTimeMillis();
        if (reminderAt < 0 || now < reminderAt || now > dueAt + 24L * 60L * 60L * 1000L) return;
        NotificationHelper.fire(context, task);
    }
}
