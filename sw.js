// キャッシュの名前（バージョン管理用）
// 注意: index.html を更新して配布するときは、このバージョン番号も上げること
const CACHE_NAME = 'f3d-pro-scheduler-v11';

// オフラインで利用可能にするファイルのリスト
const ASSETS_TO_CACHE = [
  './',              // index.html
  './index.html',
  './manifest.json',
  './slide_en_water.png',
  './icon.png',      // アイコン画像
  './manual/manual.html', // マニュアル
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

// 3. フェッチ：
//    - ページ本体（HTMLナビゲーション）はネットワーク優先。
//      これにより、公開した更新が既存ユーザーの端末に確実に届く。
//      オフライン時のみキャッシュにフォールバックする。
//    - その他のアセット（画像・CSS・JS）はキャッシュ優先（従来通り）。
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 以外（Firestore の POST 等）と http(s) 以外は SW で扱わない
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          // 取得成功: キャッシュを最新版に更新してから返す
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(() =>
          // オフライン: キャッシュ済みのページを返す
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((response) => {
      return response || fetch(req);
    })
  );
});

// --- ここから通知機能の追加 ---

// 4. 通知クリック：通知がタップされた時にアプリを開く
//    「✅ Done」アクション付きの通知（当日タスクが1件のときだけ付与）がタップされた
//    場合は、アプリを開かずにそのタスクを完了扱いにできるようにする（摩擦の除去）。
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const quickDone = event.notification.data && event.notification.data.quickDone;
  event.notification.close(); // 通知を閉じる

  if (action === 'quickdone' && quickDone) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // アプリがすでに開いていれば、そのタブに直接メッセージを送って記録させる
        for (const client of clientList) {
          client.postMessage({ type: 'quickdone', payload: quickDone });
          if ('focus' in client) return client.focus();
        }
        // 開いていなければ、記録すべきタスクをURLに載せて新規に開く
        if (clients.openWindow) {
          return clients.openWindow('./?quickdone=' + encodeURIComponent(JSON.stringify(quickDone)));
        }
      })
    );
    return;
  }

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