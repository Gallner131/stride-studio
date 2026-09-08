// The legacy formatters call toLocaleDateString/toLocaleTimeString with an `undefined`
// locale (src/render.js:24-26), so their output depends on the host timezone and ICU
// default locale. Pin the timezone here and in the npm script so these tests mean the same
// thing on a laptop and on a CI runner.
process.env.TZ = "UTC";
