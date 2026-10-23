package com.flowlist.mobile;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;

final class NotificationHelper {
    static final String CHANNEL_ID = "flowlist_reminders";
    private static final int GREEN = Color.rgb(20, 108, 93);

    private NotificationHelper() {
    }

    static void fire(Context context, TaskData task) {
        if (task == null || task.id.isEmpty()) return;
        if (!task.test) {
            String key = task.key();
            if (TaskStore.isFired(context, key)) return;
            TaskStore.markFired(context, key);
        }
        show(context, task);
    }

    private static void show(Context context, TaskData task) {
        ensureChannel(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            MainActivity.emitReminderToWeb(task);
            return;
        }

        Intent openIntent = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(MainActivity.EXTRA_FOCUS_TASK_ID, task.test ? "" : task.id);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent contentIntent = PendingIntent.getActivity(context, notificationId(task), openIntent, flags);

        String body = task.notes == null || task.notes.isEmpty() ? "任务时间到了" : task.notes;
        if (body.length() > 120) body = body.substring(0, 120);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(context, CHANNEL_ID)
                : new Notification.Builder(context);
        Notification notification = builder
                .setSmallIcon(R.drawable.ic_stat_flowlist)
                .setColor(GREEN)
                .setContentTitle(task.title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis())
                .setPriority(Notification.PRIORITY_DEFAULT)
                .build();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(notificationId(task), notification);
        MainActivity.emitReminderToWeb(task);
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(context.getString(R.string.notification_channel_description));
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    private static int notificationId(TaskData task) {
        int value = (task.key() + task.title).hashCode() & 0x7fffffff;
        return value == 0 ? 1 : value;
    }
}
