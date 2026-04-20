/**
 * Service Worker Yova
 * Gère les notifications push et le cache basique pour la PWA.
 */

const CACHE_NAME = 'yova-v3';

// Install : mettre en cache les assets essentiels
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/icon-192.png',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate : nettoyer les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch : network-first avec fallback cache
self.addEventListener('fetch', (event) => {
  // Ne pas intercepter les requêtes API
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Ne cacher que les réponses 200 (pas les erreurs)
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline : servir depuis le cache uniquement pour les pages HTML
        if (event.request.mode === 'navigate') {
          return caches.match(event.request) || caches.match('/');
        }
        return caches.match(event.request);
      })
  );
});

// Push notification reçue
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Yova';
  const options = {
    body: data.body || 'Tu as des tâches à vérifier',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'yova-notification',
    data: { url: data.url || '/tasks/recap' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification journal du soir (schedulée localement via postMessage)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_JOURNAL_REMINDER') {
    self.registration.showNotification('📝 Raconte ta journée à Yova !', {
      body: 'Prends 2 minutes pour noter ce que tu as fait aujourd\'hui.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'yova-journal-reminder',
      data: { url: '/journal' },
    });
  }
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Si une fenêtre est déjà ouverte, la focus
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      return self.clients.openWindow(url);
    })
  );
});
