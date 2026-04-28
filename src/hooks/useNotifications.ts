
import { useEffect, useState } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (typeof Notification !== 'undefined' && permission === 'default') {
      Notification.requestPermission().then(setPermission);
    }
  }, [permission]);

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (typeof Notification !== 'undefined' && permission === 'granted') {
      if (document.visibilityState === 'hidden') {
        new Notification(title, {
          icon: '/maya_avatar.png', // We'll generate this or use a placeholder
          ...options,
        });
      }
    }
  };

  return { permission, showNotification };
}
