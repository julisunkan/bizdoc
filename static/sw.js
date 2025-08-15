// Service Worker for Business Document Generator PWA

const CACHE_NAME = 'business-doc-generator-v1';
const urlsToCache = [
    '/',
    '/generate',
    '/clients',
    '/settings',
    '/static/css/custom.css',
    '/static/js/app.js',
    '/static/js/document_generator.js',
    '/static/js/currency_data.js',
    '/static/manifest.json',
    '/static/icons/icon-192x192.svg',
    '/static/icons/icon-512x512.svg',
    // External resources
    'https://cdn.replit.com/agent/bootstrap-agent-dark-theme.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(function(error) {
                console.log('Cache installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', function(event) {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip API calls that should always go to network
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then(function(response) {
                    // If successful, clone and cache the response for GET API calls
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(function() {
                    // If network fails, try to serve from cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Return cached version or fetch from network
                if (response) {
                    console.log('Serving from cache:', event.request.url);
                    return response;
                }

                return fetch(event.request)
                    .then(function(response) {
                        // Don't cache if not a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(function() {
                        // If both cache and network fail, return offline page for HTML requests
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return new Response(
                                `<!DOCTYPE html>
                                <html lang="en" data-bs-theme="dark">
                                <head>
                                    <meta charset="UTF-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                    <title>Offline - Business Document Generator</title>
                                    <link href="https://cdn.replit.com/agent/bootstrap-agent-dark-theme.min.css" rel="stylesheet">
                                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                                </head>
                                <body class="bg-dark text-light">
                                    <div class="container mt-5">
                                        <div class="row justify-content-center">
                                            <div class="col-md-6 text-center">
                                                <i class="fas fa-wifi fa-3x text-muted mb-4"></i>
                                                <h2>You're Offline</h2>
                                                <p class="text-muted mb-4">
                                                    It looks like you're not connected to the internet. 
                                                    Some features may be limited while offline.
                                                </p>
                                                <button onclick="window.location.reload()" class="btn btn-primary">
                                                    <i class="fas fa-sync-alt me-2"></i>Try Again
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </body>
                                </html>`,
                                {
                                    headers: {
                                        'Content-Type': 'text/html',
                                        'Cache-Control': 'no-cache'
                                    }
                                }
                            );
                        }
                    });
            })
    );
});

// Background sync for offline document creation
self.addEventListener('sync', function(event) {
    if (event.tag === 'background-sync-documents') {
        console.log('Background sync triggered for documents');
        event.waitUntil(syncDocuments());
    }
});

// Handle push notifications (future feature)
self.addEventListener('push', function(event) {
    console.log('Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New update available',
        icon: '/static/icons/icon-192x192.svg',
        badge: '/static/icons/icon-192x192.svg',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View App',
                icon: '/static/icons/icon-192x192.svg'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/static/icons/icon-192x192.svg'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Business Document Generator', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    console.log('Notification clicked');
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Sync documents when back online
async function syncDocuments() {
    try {
        // This would sync any offline-created documents
        // Implementation would depend on offline storage strategy
        console.log('Syncing documents...');
        
        // Get offline documents from IndexedDB (if implemented)
        // Send them to server
        // Clear offline storage
        
        return Promise.resolve();
    } catch (error) {
        console.error('Document sync failed:', error);
        return Promise.reject(error);
    }
}

// Handle skip waiting
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Show update available notification
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({version: CACHE_NAME});
    }
});

console.log('Service Worker loaded successfully');
