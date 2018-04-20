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
import bernard from 'bernard';
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
            return console.log('Could not authentify!');
        }

        bernard.sendPostback(token, {foo: 'bar'});
        bernard.pageView(token);
    }
);
```

Of course, don't forget to replace `FB_APP_ID` with your own Facebook
app ID.
