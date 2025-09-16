/**
 * Client-side WebSocket hot reload script
 * Handles WebSocket connection and different reload strategies
 */

(function() {
    'use strict';

    // Only run in development mode
    if (typeof window === 'undefined') {
        return;
    }
    
    // Only run in development mode - check for development indicators
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
    }

    function HotReloadClient() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.isConnected = false;
        this.isReconnecting = false;
        this.statusEl = null;
        
        this.init();
    }

    HotReloadClient.prototype.init = function() {
        this.createStatusIndicator();
        this.connect();
        this.setupVisibilityHandler();
    };

    HotReloadClient.prototype.createStatusIndicator = function() {
        // Create a small status indicator
        this.statusEl = document.createElement('div');
        this.statusEl.id = 'hot-reload-status';
        this.statusEl.style.cssText = 
            'position: fixed;' +
            'top: 10px;' +
            'right: 10px;' +
            'width: 12px;' +
            'height: 12px;' +
            'border-radius: 50%;' +
            'background: #ff6b6b;' +
            'z-index: 10000;' +
            'transition: all 0.3s ease;' +
            'box-shadow: 0 2px 4px rgba(0,0,0,0.2);' +
            'opacity: 0.8;';
        this.statusEl.title = 'Hot Reload: Disconnected';
        document.body.appendChild(this.statusEl);
    };

    HotReloadClient.prototype.updateStatus = function(connected, message) {
        message = message || '';
        if (!this.statusEl) return;
        
        this.isConnected = connected;
        this.statusEl.style.background = connected ? '#51cf66' : '#ff6b6b';
        this.statusEl.title = 'Hot Reload: ' + (connected ? 'Connected' : 'Disconnected') + (message ? ' - ' + message : '');
    };

    HotReloadClient.prototype.connect = function() {
        var self = this;
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            var wsUrl = protocol + '//' + window.location.host + '/ws';
            
            console.log('[HotReload] Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = function() {
                console.log('[HotReload] WebSocket connected');
                self.updateStatus(true);
                self.reconnectAttempts = 0;
                self.reconnectDelay = 1000;
                self.isReconnecting = false;
            };

            this.ws.onmessage = function(event) {
                self.handleMessage(event);
            };

            this.ws.onclose = function(event) {
                console.log('[HotReload] WebSocket disconnected:', event.code, event.reason);
                self.updateStatus(false, 'Disconnected');
                self.scheduleReconnect();
            };

            this.ws.onerror = function(error) {
                console.error('[HotReload] WebSocket error:', error);
                self.updateStatus(false, 'Error');
            };

        } catch (error) {
            console.error('[HotReload] Failed to create WebSocket connection:', error);
            this.updateStatus(false, 'Failed to connect');
            this.scheduleReconnect();
        }
    };

    HotReloadClient.prototype.handleMessage = function(event) {
        try {
            var message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'connected':
                    console.log('[HotReload]', message.message);
                    break;
                    
                case 'reload':
                    this.handleReload(message);
                    break;
                    
                default:
                    console.log('[HotReload] Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('[HotReload] Error parsing WebSocket message:', error);
        }
    };

    HotReloadClient.prototype.handleReload = function(message) {
        var reloadType = message.reloadType;
        var data = message.data;
        
        console.log('[HotReload] Received ' + reloadType + ' reload request:', data);
        
        // Show reload notification
        this.showReloadNotification(reloadType, data);
        
        // Execute reload strategy
        switch (reloadType) {
            case 'style':
                this.reloadStyles();
                break;
                
            case 'asset':
                this.reloadAssets();
                break;
                
            case 'page':
                this.reloadPage();
                break;
                
            case 'full':
                this.fullReload();
                break;
                
            default:
                this.reloadPage();
        }
    };

    HotReloadClient.prototype.showReloadNotification = function(type, data) {
        // Create temporary notification
        var notification = document.createElement('div');
        notification.style.cssText = 
            'position: fixed;' +
            'top: 50px;' +
            'right: 10px;' +
            'background: #4c6ef5;' +
            'color: white;' +
            'padding: 8px 12px;' +
            'border-radius: 4px;' +
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;' +
            'font-size: 12px;' +
            'z-index: 10001;' +
            'box-shadow: 0 2px 8px rgba(0,0,0,0.2);' +
            'opacity: 0;' +
            'transition: opacity 0.3s ease;';
        
        var fileName = data.file ? data.file.split('/').pop() : 'file';
        notification.textContent = 'Reloading ' + type + ': ' + fileName;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(function() {
            notification.style.opacity = '1';
        }, 10);
        
        // Remove after delay
        setTimeout(function() {
            notification.style.opacity = '0';
            setTimeout(function() {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    };

    HotReloadClient.prototype.reloadStyles = function() {
        // Reload all CSS links
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = link.href;
            var url = new URL(href);
            url.searchParams.set('t', Date.now().toString());
            link.href = url.toString();
        }
        
        // Reload style tags (for CSS-in-JS)
        var styles = document.querySelectorAll('style[data-vite-dev-id]');
        for (var j = 0; j < styles.length; j++) {
            var style = styles[j];
            // Trigger re-evaluation by Vite
            var event = new CustomEvent('vite:invalidate', {
                detail: { path: style.getAttribute('data-vite-dev-id') }
            });
            window.dispatchEvent(event);
        }
    };

    HotReloadClient.prototype.reloadAssets = function() {
        // Reload images and other assets
        var images = document.querySelectorAll('img');
        for (var i = 0; i < images.length; i++) {
            var img = images[i];
            var src = img.src;
            if (src && !src.startsWith('data:')) {
                var url = new URL(src);
                url.searchParams.set('t', Date.now().toString());
                img.src = url.toString();
            }
        }
    };

    HotReloadClient.prototype.reloadPage = function() {
        console.log('[HotReload] Reloading page...');
        
        // Before reloading, try to preserve scroll position and form data
        var scrollPosition = {
            x: window.scrollX || window.pageXOffset,
            y: window.scrollY || window.pageYOffset
        };
        
        // Store scroll position in sessionStorage for restoration after reload
        try {
            sessionStorage.setItem('hotReloadScrollPosition', JSON.stringify(scrollPosition));
        } catch (e) {
            // Ignore storage errors
        }
        
        // Perform the reload
        window.location.reload();
    };

    HotReloadClient.prototype.fullReload = function() {
        console.log('[HotReload] Performing full reload...');
        // Clear cache and reload
        if ('caches' in window) {
            caches.keys().then(function(names) {
                for (var i = 0; i < names.length; i++) {
                    caches.delete(names[i]);
                }
                window.location.reload();
            });
        } else {
            window.location.reload();
        }
    };

    HotReloadClient.prototype.scheduleReconnect = function() {
        var self = this;
        
        if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.log('[HotReload] Max reconnection attempts reached');
                this.updateStatus(false, 'Max retries reached');
            }
            return;
        }

        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        console.log('[HotReload] Scheduling reconnection attempt ' + this.reconnectAttempts + ' in ' + this.reconnectDelay + 'ms');
        this.updateStatus(false, 'Reconnecting... (' + this.reconnectAttempts + '/' + this.maxReconnectAttempts + ')');
        
        setTimeout(function() {
            self.connect();
        }, this.reconnectDelay);
        
        // Exponential backoff with jitter
        this.reconnectDelay = Math.min(
            this.reconnectDelay * 1.5 + Math.random() * 1000,
            this.maxReconnectDelay
        );
    };

    HotReloadClient.prototype.setupVisibilityHandler = function() {
        var self = this;
        
        // Reconnect when page becomes visible (handles browser sleep/wake)
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden && !self.isConnected && !self.isReconnecting) {
                console.log('[HotReload] Page became visible, attempting to reconnect...');
                self.reconnectAttempts = 0;
                self.reconnectDelay = 1000;
                self.connect();
            }
        });
    };

    HotReloadClient.prototype.disconnect = function() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        if (this.statusEl && this.statusEl.parentNode) {
            this.statusEl.parentNode.removeChild(this.statusEl);
        }
    };

    // Restore scroll position after hot reload
    function restoreScrollPosition() {
        try {
            var stored = sessionStorage.getItem('hotReloadScrollPosition');
            if (stored) {
                var position = JSON.parse(stored);
                window.scrollTo(position.x, position.y);
                sessionStorage.removeItem('hotReloadScrollPosition');
            }
        } catch (e) {
            // Ignore restoration errors
        }
    }

    // Initialize hot reload client when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.hotReloadClient = new HotReloadClient();
            // Restore scroll position after a short delay to ensure page is fully loaded
            setTimeout(restoreScrollPosition, 100);
        });
    } else {
        window.hotReloadClient = new HotReloadClient();
        // Restore scroll position after a short delay to ensure page is fully loaded
        setTimeout(restoreScrollPosition, 100);
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
        if (window.hotReloadClient) {
            window.hotReloadClient.disconnect();
        }
    });

})();