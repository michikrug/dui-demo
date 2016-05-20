(function(scope) {
  'use strict';

  if (typeof scope.xhrq === 'object') return;

  var xhrq = {

    whiteList: [window.location.host, 'api.apixu.com', 'access.alchemyapi.com', 'vsr-demo.informatik.tu-chemnitz.de/chroomaplus/proxy/Proxy.ashx'],

    proxyUrl: 'http://vsr-demo.informatik.tu-chemnitz.de/chroomaplus/proxy/Proxy.ashx?url=',

    cache: JSON.parse(localStorage.getItem('_xhrq_cache')) || [],

    cacheValidity: 2 * 60 * 60 * 1000,

    resetCache: function() {
      this.cache = [];
      localStorage.removeItem('_xhrq_cache');
    },

    addCacheEntry: function(urlHash, data) {
      this.cache.forEach(function(entry) {
        if (entry.urlHash === urlHash) this.cache.splice(this.cache.indexOf(entry), 1);
      }, this);
      this.cache.push({urlHash: urlHash, timestamp: (new Date()).getTime(), data: data});
    },

    getCacheEntry: function(urlHash) {
      var hit = null, now = (new Date()).getTime();
      this.cache.some(function(entry) {
        if (entry.urlHash === urlHash && now - entry.timestamp < this.cacheValidity) {
          hit = entry;
          return true;
        }
      }, this);
      return hit;
    },

    hash: function(s) {
      for (var i = 0, hash = 0, len = s.length; i < len; i++) {
        hash = hash * 31 + s.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    },

    serialize: function(o) {
      var s = [];
      for (var p in o) if (o.hasOwnProperty(p)) s.push(encodeURIComponent(p) + '=' + encodeURIComponent(o[p]));
      return s.join('&');
    },

    execute: function(method, url, callback, data, dataType, skipCache) {

      function callCallback(data) {
        if (typeof callback !== 'function') return;
        if (dataType === 'json') {
          try {
            callback.call(this, JSON.parse(data));
          } catch (e) {
            if (~e.message.indexOf('Unexpected token')) callback.call(this, data);
          }
        } else if (dataType === 'xml') {
          callback.call(this, (new DOMParser()).parseFromString(data, 'text/xml'));
        } else {
          callback.call(this, data);
        }
      }

      if (typeof method === 'object') {
        url = method.url;
        data = method.data;
        callback = method.callback;
        dataType = method.dataType;
        skipCache = method.skipCache;
        method = method.method;
      } else if (typeof url === 'object') {
        data = url.data;
        callback = url.callback;
        dataType = url.dataType;
        skipCache = url.skipCache;
        url = url.url;
      } else if (typeof callback === 'object') {
        data = callback.data;
        dataType = callback.dataType;
        skipCache = callback.skipCache;
        callback = callback.callback;
      } else if (typeof data === 'string') {
        skipCache = dataType;
        dataType = data;
        data = undefined;
      } else if (typeof data === 'boolean') {
        skipCache = data;
        data = dataType = undefined;
      }

      if (typeof method !== 'string' || !method.match(/get|post|options|head/i) || typeof url !== 'string' || url.length < 1) return;

      var serializedData;
      if (typeof data === 'object') {
        serializedData = this.serialize(data);
        if (method === 'GET') {
          url += (~url.indexOf('?') ? '&' : '?') + serializedData;
          serializedData = null;
        }
      }

      var urlHash = this.hash(url + serializedData);

      var cacheHit = !skipCache && this.getCacheEntry(urlHash);

      if (cacheHit) {
        callCallback(cacheHit.data);
        return null;
      }

      // No cache hit -> do actual web request

      if ((url.indexOf('http://') === 0 || url.indexOf('https://') === 0) &&
          !this.whiteList.some(function(entry) { return ~url.indexOf(entry); })) {
        url = this.proxyUrl + encodeURIComponent(url);
      }

      var request = new XMLHttpRequest();
      request.open(method, url);

      request.onreadystatechange = function() {
        if (this.readyState === this.DONE && this.status === 200) {
          xhrq.addCacheEntry(urlHash, this.responseText);
          callCallback(this.responseText);
        }
      };

      if (dataType === 'json') {
        request.setRequestHeader('Accept', 'application/json');
      } else if (dataType === 'xml') {
        request.setRequestHeader('Accept', 'text/xml');
      }

      if (method === 'POST') {
        request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        request.send(serializedData);
      } else {
        request.send();
      }

      return request;
    }
  };

  xhrq.get = xhrq.execute.bind(xhrq, 'GET');
  xhrq.post = xhrq.execute.bind(xhrq, 'POST');

  scope.xhrq = xhrq;

  scope.addEventListener('unload', function() {
    var c = scope.xhrq.cache, now = (new Date()).getTime();
    if (typeof c !== 'object' || c.length < 1) return;
    c.forEach(function(entry) {
      if (now - entry.timestamp > scope.xhrq.cacheValidity) c.splice(c.indexOf(entry), 1);
    });
    localStorage.setItem('_xhrq_cache', JSON.stringify(c));
  });

})(window);
