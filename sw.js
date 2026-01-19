// キャッシュの名前（バージョン管理用）
const CACHE_NAME = 'f3d-pro-scheduler-v1';

// オフラインで利用可能にするファイルのリスト
const ASSETS_TO_CACHE = [
  './',              // index.html
  './index.html',
  './manifest.json',
  './slide_en_water.png',
  './icon.png',      // アイコン画像
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js'
];

// 1. インストール：必要なファイルをキャッシュに保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching app assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. 有効化：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. フェッチ：ネットがない場合はキャッシュから返す
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// --- ここから通知機能の追加 ---

// 4. 通知クリック：通知がタップされた時にアプリを開く
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // 通知を閉じる

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // すでにアプリが開いている場合はそのタブにフォーカス
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      // 開いていない場合は新しくアプリを開く
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// 5. プッシュ通知の受信（将来的にサーバーから通知を送る場合に必要）
self.addEventListener('push', (event) => {
  let data = { title: '3F4D Pro', body: '新しい予定があります' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './icon.png',
    badge: './icon.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});