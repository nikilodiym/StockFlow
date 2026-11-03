const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite у браузері працює через wa-sqlite.wasm
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer для expo-sqlite web потребує цих заголовків
config.server.enhanceMiddleware = middleware => (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
};

module.exports = config;
