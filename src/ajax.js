Kimbo.define('ajax', function () {

  'use strict';

  var NO_CONTENT_RE = /^(?:GET|HEAD)$/;
  var JSONP_RE = /(\=)\?(?=&|$)|\?\?/i;

  var MIME_TYPES = {
    html: 'text/html',
    json: 'application/json',
    script: 'text/javascript, application/javascript',
    text: 'text/plain',
    xml: 'application/xml, text/xml'
  };

  var dataParse = {
    json: Kimbo.parseJSON,
    xml: Kimbo.parseXML
  };

  var xhrCallbacks = {};

  // Success and error callbacks
  Kimbo.forEach(['success', 'error'], function (type) {
    xhrCallbacks[type] = function (res, msg, xhr, settings) {
      settings = settings || xhr;
      if (Kimbo.isFunction(settings[type])) {
        settings[type].apply(settings.context, arguments);
      }
    };
  });

  function _getResponse(response, type) {
    return (dataParse[type] ? dataParse[type](response) : response);
  }

  function _handleResponse(xhr, settings) {
    var response, contentType;

    // Set dataType if missing
    if (!settings.dataType) {
      contentType = xhr.getResponseHeader('Content-Type');

      Kimbo.forEach(MIME_TYPES, function (name, type) {
        if (type.match(contentType)) {
          settings.dataType = name;
          return false;
        }
      });

      // Fix settings headers
      _setHeaders(settings);
    }

    try {
      response = _getResponse(xhr.responseText, settings.dataType);
    } catch (e) {
      response = false;
      xhrCallbacks.error('parseerror', e, xhr, settings);
    }

    return response;
  }

  function _setHeaders(settings) {
    if (!settings.crossDomain && !settings.headers['X-Requested-With']) {
      settings.headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    if (settings.contentType) {
      settings.headers['Content-Type'] = settings.contentType;
    }

    settings.headers.Accept = MIME_TYPES[settings.dataType] || '*/*';
  }

  function _timeout(xhr, settings) {
    xhr.onreadystatechange = null;
    xhr.abort();
    xhrCallbacks.error('error', 'timeout', xhr, settings);
  }

  function _createAbortTimeout(xhr, settings) {
    return window.setTimeout(function () {
      _timeout(xhr, settings);
    }, settings.timeout);
  }

  /*\
   * $.ajaxSettings
   [ property ]
   * Default ajax settings object.
   > Usage
   * If you want to change the global and default ajax settings, change this object properties:
   | $.ajaxSettings.error = function () {
   |   // Handle any failed ajax request in your app
   | };
   | $.ajaxSettings.timeout = 1000; // 1 second
  \*/
  Kimbo.ajaxSettings = {
    type: 'GET',
    async: true,
    success: null,
    error: null,
    context: null,
    headers: {},
    data: null,
    crossDomain: false,
    timeout: 0,
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    xhr: function () {
      return new window.XMLHttpRequest();
    }
  };

  /*\
   * $.ajax
   [ method ]
   * Perform an asynchronous HTTP (Ajax) request.
   > Parameters
   - options (object) #optional An object with options
   o {
   o   url (string) Url to make the request.
   o   type (string) #optional Type of request. Could be `'GET'` or `'POST'`. Default value is `'GET'`.
   o   async (boolean) #optional Default value is `true` if you want synchronous requests set option to `false`.
   o   success (function) #optional A function that will be called if the request succeeds. Recieving (response, responseMessage, xhr, settings).
   o   error (function) #optional A function that will be called if the request fails. Recieving (response, responseMessage, xhr, settings).
   o   context (object) #optional The context in which all ajax request are made. By default the context are the settings object. Could be any DOM element.
   o   headers (object) #optional An object with additional header key/value pairs to send along with the request.
   o   data (string|object) #optional Additional data to send with the request, if it is an object is converted to a query string.
   o   xhr (function) #optional A function that returns a `new XMLHttpRequest()` object by default.
   o   crossDomain (boolean) #optional Indicate wether you want to force crossDomain requests. `false` by defualt.
   o   timeout (number) #optional Set a default timeout in milliseconds for the request.
   o   contentType (string) #optional The default and finest contentType for most cases is `'application/x-www-form-urlencoded; charset=UTF-8'`.
   o }
   = (object) The native xhr object.
   > Usage
   * Get a username passing an id to the /users url
   | $.ajax({
   |   url '/users',
   |   data: {
   |     id: 3
   |   },
   |   success: function (response, responseMessage, xhr, settings) {
   |     // Success...
   |   },
   |   error: function (response, responseMessage, xhr, settings) {
   |     // Error...
   |   }
   | });
  \*/
  Kimbo.ajax = function (options) {
    var settings = Kimbo.extend({}, Kimbo.ajaxSettings, options);
    var xhr, abortTimeout, callback;

    var hasContent = !NO_CONTENT_RE.test(settings.type);

    // Add data to url
    if (settings.data && typeof settings.data !== 'string') {
      settings.data = Kimbo.param(settings.data);
    }

    if (settings.data && !hasContent) {
      settings.url += (/\?/.test(settings.url) ? '&' : '?') + settings.data;
      delete settings.data;
    }

    // Set default context
    if (!settings.context) {
      settings.context = settings;
    }

    // Check if its jsonp
    if (JSONP_RE.test(settings.url)) {
      return _getJSONP(settings);
    }

    // Create new instance
    xhr = settings.xhr();

    // User specified timeout
    if (settings.timeout > 0) {
      abortTimeout = _createAbortTimeout(xhr, settings);
    }

    settings.type = settings.type.toUpperCase();

    // On complete callback
    callback = function () {
      var status = xhr.status;
      var response;

      // Clear timeout
      window.clearTimeout(abortTimeout);

      // Scuccess
      if ((status >= 200 && status < 300) || status === 304) {
        response = _handleResponse(xhr, settings);
        if (response !== false) {
          xhrCallbacks.success(response, xhr, settings);
        }

      // Fail
      } else {
        xhrCallbacks.error('error', xhr.statusText, xhr, settings);
      }
    };

    // Listen for response
    xhr.onload = callback;

    // Init request
    xhr.open(settings.type, settings.url, settings.async);

    // Set settings headers
    _setHeaders(settings);

    // Set xhr headers
    Kimbo.forEach(settings.headers, function (header, value) {
      xhr.setRequestHeader(header, value);
    });

    // Try to send request
    xhr.send(settings.data);

    return xhr;
  };

  /*\
   * $.get
   [ method ]
   * Load data from the server using HTTP GET request.
   > Parameters
   - url (string) A string containing the URL to which the request is sent.
   - data (string|object) #optional An option string or object with data params to send to the server.
   - callback (function) A callback function to execute if the request succeeds.
   - type (string) #optional String with the type of the data to send (intelligent guess by default).
   > Usage
   | $.get('url/users.php', { id: '123' }, function (data) {
   |   // Success
   |   console.log('response:', data);
   | });
   * This method is a shorthand for the $.ajax
   | $.ajax({
   |   url: url,
   |   data: data,
   |   success: success,
   |   dataType: dataType
   | });
  \*/

  /*\
   * $.post
   [ method ]
   * Load data from the server using HTTP POST request.
   > Parameters
   - url (string) A string containing the URL to which the request is sent.
   - data (string|object) #optional An option string or object with data params to send to the server.
   - callback (function) A callback function to execute if the request succeeds.
   - type (string) #optional String with the type of the data to send (intelligent guess by default).
   > Usage
   | $.post('url/users.php', { user: 'denis', pass: '123' }, function (data) {
   |   // Success
   |   console.log('response:', data);
   | });
   * This method is a shorthand for the $.ajax
   | $.ajax({
   |   type: 'POST',
   |   url: url,
   |   data: data,
   |   success: success,
   |   dataType: dataType
   | });
  \*/
  Kimbo.forEach(['get', 'post'], function (method) {
    Kimbo[method] = function (url, data, callback, type) {

      // Prepare arguments
      if (Kimbo.isFunction(data)) {
        type = type || callback;
        callback = data;
        data = null;
      }

      // Call ajax
      return Kimbo.ajax({
        type: method.toUpperCase(),
        url: url,
        data: data,
        success: callback,
        dataType: type
      });
    };
  });

  Kimbo.extend({
   /*\
    * $.getScript
    [ method ]
    * Load a JavaScript file from the server using a GET HTTP request, then execute it.
    > Parameters
    - url (string) A string containing the URL to which the request is sent.
    - callback (function) A callback function to execute if the request succeeds.
    > Usage
    | $.getScript('url/script.js', function (data) {
    |   // Success
    |   console.log('response:', data);
    | });
    * This method is a shorthand for the $.ajax
    | $.ajax({
    |   url: url,
    |   dataType: 'script',
    |   success: success
    | });
   \*/
    getScript: function (url, callback) {
      return Kimbo.get(url, callback, 'script');
    },

   /*\
    * $.getJSON
    [ method ]
    * Load data from the server using HTTP POST request.
    > Parameters
    - url (string) A string containing the URL to which the request is sent.
    - data (string|object) #optional An option string or object with data params to send to the server.
    - callback (function) A callback function to execute if the request succeeds.
    - type (string) #optional String with the type of the data to send (intelligent guess by default).
    > Usage
    | $.getJSON('url/test.json', { id: '2' }, function (data) {
    |   // Success
    |   console.log('response:', data);
    | });
    * This method is a shorthand for the $.ajax
    | $.ajax({
    |   url: url,
    |   dataType: 'json',
    |   success: success
    | });
    * To get json data with jsonp:
    | $.getJSON('http://search.twitter.com/search.json?callback=?', 'q=#javascript', function (data) {
    |   console.log(data);
    | });
   \*/
    getJSON: function (url, data, callback) {
      return Kimbo.get(url, data, callback, 'json');
    }
  });

  // getJSONP internal use
  function _getJSONP(settings) {
    var jsonpCallback = Kimbo.ref + '_' + Date.now();
    var script = document.createElement('script');
    var head = document.head;
    var xhr = {
      abort: function () {
        window.clearTimeout(abortTimeout);
        head.removeChild(script);
        delete window[jsonpCallback];
      }
    };
    var abortTimeout;

    // User specified timeout
    if (settings.timeout > 0) {
      abortTimeout = _createAbortTimeout(xhr, settings);
    }

    // Set url
    script.src = settings.url.replace(JSONP_RE, '$1' + jsonpCallback);

    // Jsonp callback
    window[jsonpCallback] = function (response) {

      // Remove script
      xhr.abort();

      // Fake xhr
      Kimbo.extend(xhr, {
        statusText: 'OK',
        status: 200,
        response: response,
        headers: settings.headers
      });

      // Success
      xhrCallbacks.success(response, xhr, settings);
    };

    // Set settings headers
    _setHeaders(settings);

    // Apend script to head to make the request
    head.appendChild(script);

    // Return fake xhr object to abort manually
    return xhr;
  }

  /*\
   * $.param
   [ method ]
   * Create a serialized representation of an object, suitable for use in a URL query string or Ajax request.
   > Parameters
   - data (string|object) A string or object to serialize.
   > Usage
   | var obj = { name: 'Denis', last: 'Ciccale' };
   | var serialized = $.param(obj); // 'name=Denis&last=Ciccale'
  \*/
  Kimbo.param = function (data) {
    var params = '';

    if (Kimbo.isObject(data)) {
      Kimbo.forEach(data, function (name, value) {
        params += name + '=' + value + '&';
      });
    } else {
      params = data;
    }

    return window.encodeURIComponent(params)
      .replace(/%20/g, '+')
      .replace(/%\d[D6F]/g, window.unescape)
      .replace(/^\?|&$/g, '');
  };
});
