function requestNotifications() {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }