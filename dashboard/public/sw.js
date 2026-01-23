const CACHE_NAME = 'gurbuz-sync-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/script.js',
    'https://cdn.tailwindcss.com?plugins=forms,container-queries',
    'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
