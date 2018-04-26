/**
 * Bernard.js
 *
 * A few utility functions to communicate with Bernard. This file works
 * unmodified as an ES5 UMD module and has no dependencies.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.bernard = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var meWaitList = [];
    var meIsInstalled = false;

    /**
     * Calls a callback asynchronously
     */
    function callBack(cb) {
        var args = [];
        var i;

        for (i = 1; i < arguments.length; i += 1) {
            args.push(arguments[i]);
        }

        setTimeout(function () {
            cb.apply(undefined, args);
        }, 0);
    }

    /**
     * Gets from the query string the first value for this key
     */
    function getQsParam(key) {
        var search = window.location.search;
        var re = RegExp('[?&]' + encodeURIComponent(key) + '=([^&]*)');
        var m = search.match(re);

        if (m) {
            return decodeURIComponent(m[1]);
        }
    }

    /**
     * Authenticate by URL token. The `tokenName` parameter is optional,
     * default value is _b.
     */
    function urlTokenAuth(tokenName) {
        return function (cb) {
            setTimeout(function () {
                var name = tokenName || '_b';
                var token = getQsParam(name);

                if (!token) {
                    return cb(
                        new Error('No "' + name + '" QS parameter found')
                    );
                }

                cb(undefined, token);
            }, 0);
        };
    }

    /**
     * Authenticates using the hash fragment. It is more secure than the
     * url token because it will automatically be removed from the URL once
     * consumed.
     */
    function hashTokenAuth() {
        return function (cb) {
            var token = window.location.hash;

            if (!token) {
                return cb(new Error('No hash token found'));
            }

            window.location.hash = '';
            callBack(cb, undefined, token.substr(1));
        }
    }

    /**
     * Install the Messenger Extensions JS
     */
    function installMessengerExtensions() {
        (function (d, s, id) {
            const fjs = d.getElementsByTagName(s)[0];

            if (d.getElementById(id)) {
                return;
            }

            const js = d.createElement(s);
            js.id = id;
            js.src = 'https://connect.facebook.com/en_US/' +
                'messenger.Extensions.js';
            fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'Messenger'));
    }

    /**
     * Install the messenger extensions, wait for them to load and calls the
     * callback with the extensions as parameter.
     */
    function messengerExtensionsReady(cb) {
        var i;

        if (window.MessengerExtensions) {
            return callBack(cb, window.MessengerExtensions);
        }

        installMessengerExtensions();

        if (!meIsInstalled && typeof window.extAsyncInit === 'function') {
            meWaitList.push(window.extAsyncInit);
        }

        meWaitList.push(cb);
        meIsInstalled = true;

        window.extAsyncInit = function () {
            for (i = 0; i < meWaitList.length; i += 1) {
                callBack(meWaitList[i], window.MessengerExtensions);
            }

            meWaitList.length = 0;
        }
    }

    /**
     * Authenticate the user using Messenger Extensions
     * @param appId {String} Facebook app ID
     */
    function messengerExtensionsAuth(appId) {
        return function (cb) {
            messengerExtensionsReady(function (me) {
                function success(ctx) {
                    cb(undefined, ctx.signed_request);
                }

                function failure(err) {
                    cb(err);
                }

                me.getContext(appId, success, failure);
            });
        };
    }

    /**
     * Authenticate and get the user.
     *
     * @param methods {Function[]} Authentication functions to be called
     * @param cb {Function} Node-style callback (cb(err, user)) that will be
     *                      called when there's a user.
     * @param endpoint {String} Optional parameter. Address of the endpoint to
     *                          use for authentication
     */
    function getUser(methods, cb, endpoint) {
        var failed = 0;
        var done = false;
        var _endpoint = endpoint || '/postback/me';

        /**
         * Fetches all tokens at once
         */
        function getTokens() {
            var i;

            for (i = 0; i < methods.length; i += 1) {
                methods[i](function (err, token) {
                    if (err) {
                        return fail();
                    }

                    tryToken(token);
                });
            }
        }

        /**
         * Fail one method. When all methods failed, automatically call back
         * with an error.
         */
        function fail() {
            failed += 1;

            if (failed === methods.length) {
                allFailed();
            }
        }

        /**
         * When all hope is gone.
         */
        function allFailed() {
            callBack(cb, new Error('All auth backend failed'));
        }

        /**
         * Tries to authenticate with a given token.
         */
        function tryToken(token) {
            var xhr;
            var url = _endpoint;

            if (done) {
                return;
            }

            if (!token) {
                return fail();
            }

            xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('X-Bernard-Auth', token);

            xhr.onreadystatechange = function () {
                var xhrDone = xhr.readyState === XMLHttpRequest.DONE;

                if (!xhrDone || done) {
                    return;
                }

                if (xhr.status !== 200) {
                    return fail();
                }

                try {
                    callBack(
                        cb, undefined, JSON.parse(xhr.responseText), token
                    );
                    done = true;
                } catch (e) {
                    return fail();
                }
            };

            xhr.send();
        }

        getTokens();
    }

    /**
     * Performs a HTTP POST. For internal use only.
     */
    function httpPost(body, options, success, failure) {
        var xhr;
        var url = options.endpoint;

        xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-Bernard-Auth', options.token);

        xhr.onreadystatechange = function () {
            var xhrDone = xhr.readyState === XMLHttpRequest.DONE;

            if (!xhrDone) {
                return;
            }

            if (xhr.status !== 200) {
                callBack(failure, new Error('HTTP error'));
            }

            try {
                callBack(success, JSON.parse(xhr.responseText));
            } catch (e) {
                callBack(failure, new Error('Decoding error'));
            }
        };

        xhr.send(JSON.stringify(body));
    }

    /**
     * Sends a postback message to the user
     *
     * @param token {String} Token returned by `getUser()`
     * @param payload {Object} Payload to be sent
     * @param cb {Function} Callable that will receive the result. First
     *                      argument will be the error if any, undefined
     *                      otherwise.
     * @param endpoint {String} Optional endpoint URL
     */
    function sendPostback(token, payload, cb, endpoint) {
        var _endpoint = endpoint || '/postback/send';

        httpPost(
            payload,
            {
                endpoint: _endpoint,
                token: token
            },
            function () {
                cb && callBack(cb);
            },
            function (err) {
                cb && callBack(cb, err);
            }
        );
    }

    /**
     * Track a page view in the analytics provider(s)
     *
     * @param token {String} Token returned by `getUser()`
     * @param path {String} URL path. By default, uses the current path.
     * @param title {String} Page title. By default, uses the current title.
     * @param cb {String} Optional callback called when the tracking is done.
     * @param endpoint {String} Optional custom endpoint URL
     */
    function pageView(token, path, title, cb, endpoint) {
        var _endpoint = endpoint || '/postback/analytics';

        httpPost(
            {
                event: 'page_view',
                path: path || document.location.pathname,
                title: title || document.title
            },
            {
                endpoint: _endpoint,
                token: token
            },
            function () {
                cb && callBack(cb);
            },
            function (err) {
                cb && callBack(cb, err);
            }
        )
    }

    return {
        getQsParam: getQsParam,
        urlTokenAuth: urlTokenAuth,
        hashTokenAuth: hashTokenAuth,
        messengerExtensionsReady: messengerExtensionsReady,
        messengerExtensionsAuth: messengerExtensionsAuth,
        getUser: getUser,
        sendPostback: sendPostback,
        pageView: pageView
    };
}));
