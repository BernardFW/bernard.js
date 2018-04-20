bernard.js
==========

Utility functions to communicate with
[BERNARD](https://github.com/BernardFW/bernard).

## Install

For simplicity reasons, the source file can be loaded as-is in a browser
or in webpack.

### NPM/Webpack

```
yarn add bernard-js
```

And then

```
import bernard from 'bernard-js';
```

### Browser

Add `index.js` to your project and load it as a script.

## Usage

Two authentication mecanisms are provided out of the box, namely:

- `urlTokenAuth` looks at a `_b` parameter in the query string
- `messengerExtensionsAuth` uses messenger extensions

You can provide as many authentication methods as you want.

```javascript
bernard.getUser(
    [
        bernard.urlTokenAuth(),
        bernard.messengerExtensionsAuth(FB_APP_ID)
    ],
    (err, user, token) => {
        if (err) {
            return console.log('Could not authenticate!');
        }

        // Sends a message with a Postback layer to the bot
        bernard.sendPostback(token, {action: 'foo'});

        // Tracks the current page into the analytics providers
        bernard.pageView(token);
    }
);
```

Of course, don't forget to replace `FB_APP_ID` with your own Facebook
app ID.

Let's break it down.

1. You create a list of authentication mecanisms you want to try

```javascript
    [
        bernard.urlTokenAuth(),
        bernard.messengerExtensionsAuth(FB_APP_ID)
    ],
```

2. You call `getUser()`

```javascript
bernard.getUser(
    [
        bernard.urlTokenAuth(),
        bernard.messengerExtensionsAuth(FB_APP_ID)
    ],
    (err, user, token) => {
        // ...
    }
);
```

3. You save the `token` and maybe `user` info. You will need the `token`
   for any other communication with the server.

```javascript
        // Sends a message with a Postback layer to the bot
        bernard.sendPostback(token, {action: 'foo'});

        // Tracks the current page into the analytics providers
        bernard.pageView(token);
```

### Enabling HTTP requests

**This is a very important point**

`bernard.js` will make HTTP requests to your BERNARD instance. Since
BERNARD doesn't serve your front-end, it means that BERNARD and your
front-end will run on different domains. Let's say:

- `bot.foobar.com` is your BERNARD instance
- `front.foobar.com` is your front-end instance

You have several options here, but by far the most simple is to create
a proxy that maps `front.foobar.com/postback` to
`bot.foobar.com/postback`. Otherwise you'd have to deal with CORS and
other security-related problems.

Example nginx configuration for this:

```
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    /* All sorts of things go here, like SSL configuration */

    index index.html;
    server_name front.foobar.com;

    location / {
        try_files $uri $uri/ =404;
        gzip_static on;
    }

    location /postback {
        proxy_pass https://bot.foobar.com;
    }
}
```

Simply doing so will allow your front-end to seamlessly communicate
with your bot.

### Bot-side

You might have noticed that there is two authentication methods.

#### Messenger Extensions-based

If your bot runs in Messenger, you *should* use the Messenger Extensions
as they are way more secure than using a token in the URL (since the
user could just copy/paste the URL to a friend by trying to share the
page).

In order for the messenger extensions, you must:

1. Add the domain of your front-end to the page's whitelist. By example,
   set add to the bot's environment variables
   `FRONT_BASE_URL=https://front.foobar.com` and then put in your
   bot's `settings.py` (provided that you use the default template):

```python
def make_whitelist():
    out = []
    extract_domain('BERNARD_BASE_URL', out)
    extract_domain('FRONT_BASE_URL', out)
    return out

# ...

PLATFORMS = [
    {
        'class': 'bernard.platforms.facebook.platform.Facebook',
        'settings': [
            {
                # ...
                'whitelist': make_whitelist()
            },
        ],
    }
]
```

2. When you make a URL Button, always set `messenger_extensions` to
   `True`. Example state from a hypothetical `states.py` file:

```python
class TestState(MyBaseState):
    async def handle(self) -> None:
        url = 'https://front.foobar.com/'

        self.send(
            fbl.ButtonTemplate(
                text='Foo',
                buttons=[
                    fbh.UrlButton(
                        title='Bar',
                        url=url,
                        messenger_extensions=True,
                    ),
                ]
            )
        )
```

#### URL token-based

In the case where you're using the URL token, all you need to do is to
sign the URL with the `self.request.sign_url()` function. By example:

```python
class TestState(MyBaseState):
    async def handle(self) -> None:
        url = await self.request.sign_url('https://front.foobar.com/')

        self.send(
            fbl.ButtonTemplate(
                text='Foo',
                buttons=[
                    fbh.UrlButton(
                        title='Bar',
                        url=url,
                    ),
                ]
            )
        )
```

## Reference

### Authentication methods

#### `urlTokenAuth(tokenName)`

```javascript
    /**
     * Authenticate by URL token. The `tokenName` parameter is optional,
     * default value is _b.
     */
    function urlTokenAuth(tokenName) {
        // ...
    }
```

#### `messengerExtensionsAuth(appId)`

```javascript
    /**
     * Authenticate the user using Messenger Extensions
     * @param appId {String} Facebook app ID
     */
    function messengerExtensionsAuth(appId) {
        // ...
    }
```

### Messenger-related

#### `messengerExtensionsReady(cb)`

```javascript
    /**
     * Install the messenger extensions, wait for them to load and calls the
     * callback with the extensions as parameter.
     */
    function messengerExtensionsReady(cb) {
        // ...
    }
```

### Bernard communication

#### `getUser(methods, cb, endpoint, tokenKey)`

```javascript
    /**
     * Authenticate and get the user.
     *
     * @param methods {Function[]} Authentication functions to be called
     * @param cb {Function} Node-style callback (cb(err, user)) that will be
     *                      called when there's a user.
     * @param endpoint {String} Optional parameter. Address of the endpoint to
     *                          use for authentication
     * @param tokenKey {String} Key of the token to use
     */
    function getUser(methods, cb, endpoint, tokenKey) {
        // ...
    }
```

#### `sendPostback(token, payload, cb, endpoint, tokenKey)`

```javascript
    /**
     * Sends a postback message to the user
     *
     * @param token {String} Token returned by `getUser()`
     * @param payload {Object} Payload to be sent
     * @param cb {Function} Callable that will receive the result. First
     *                      argument will be the error if any, undefined
     *                      otherwise.
     * @param endpoint {String} Optional endpoint URL
     * @param tokenKey {String} Optional custom name for custom token key
     */
    function sendPostback(token, payload, cb, endpoint, tokenKey) {
        // ...
    }
```

#### `pageView(token, path, title, cb, endpoint, tokenKey)`

```javascript
    /**
     * Track a page view in the analytics provider(s)
     *
     * @param token {String} Token returned by `getUser()`
     * @param path {String} URL path. By default, uses the current path.
     * @param title {String} Page title. By default, uses the current title.
     * @param cb {String} Optional callback called when the tracking is done.
     * @param endpoint {String} Optional custom endpoint URL
     * @param tokenKey {String} Optional custom token key
     */
    function pageView(token, path, title, cb, endpoint, tokenKey) {
        // ...
    }
```
