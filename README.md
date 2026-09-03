# Stride Studio

Turn a run (or any workout) into an Instagram-ready photo, sticker or animated video in about three taps.
Pick a photo or clip, pick a style, save or share. Stats come from Strava or are typed in.

Everything runs in the browser. Nothing is uploaded anywhere; your photos and Strava token never leave the device.

## What it does

- 27 styles across six groups: Stats, Map, Health, Editorial, Fun, Video
- Three formats: Story/Reel 9:16, feed post 4:5, square 1:1 (carousel-friendly)
- Photo or video input. Video templates (Live HUD, Chase) follow the clip's timeline so numbers count up and the route draws itself
- Animated export from a still photo: 7.5 second MP4/WebM with count-up stats, route draw-on and a slow zoom
- Heart rate: HR trace coloured by zone, time-in-zones bar, effort rings. Works for gym workouts with no distance
- 16 accent colours plus a custom picker, 9 photo filters, vignette, darken, film grain, text light/dark, position, size and nudge
- Make it yours: drag the design anywhere on the preview, six typefaces for big numbers and labels set separately, any text colour, your own line of text (top, middle or bottom, three sizes), show or hide the stat row, name and date, uppercase toggle, eight gradient backgrounds when you have no photo
- My looks: save a style + colours + fonts + filter as a named preset and apply it to the next run in one tap (stored on the device)
- Save image, save transparent sticker (drop it on any Story), save video
- Share button uses the phone's native share sheet (Instagram, WhatsApp, Messages...). Copy caption with stats and hashtags
- Strava: sign in (with your own free API app) or paste a token. Pulls distance, time, elevation, HR, route, per-km splits, altitude and HR streams for the last 40 activities of any sport

## Run it (testers)

You need the single file `dist/index.html`. No install, no build.

**Phone (recommended, this is where sharing works best)**
1. Get `index.html` onto the phone (AirDrop, email it to yourself, Files app, Google Drive).
2. Open it. On iPhone: open in Safari (Files > tap file > share > Safari, or long-press > Open in Safari). On Android: open with Chrome.
3. Tap "Add a photo or video", pick a style, "Save image". Tap "Share" to send it to Instagram, or press and hold the preview to save to Photos.

**Laptop**
1. Double-click `dist/index.html`. It opens in your browser and works from the file directly.
2. Sharing to Instagram from a laptop is not a thing; use Download and post from your phone, or AirDrop the file.

**Hosted (best for a group of testers)**
Upload `dist/index.html` to any static host: Netlify Drop (drag the file onto app.netlify.com/drop), Vercel, GitHub Pages, or an S3 bucket. Share the URL. Everyone gets the same app, and "Add to Home Screen" makes it feel like an app. Hosting over https is also what makes the Strava sign-in flow work for everyone (see below).

## Connect Strava

Two ways.

**Option A: paste a token (2 minutes, no hosting needed)**
1. Go to https://www.strava.com/settings/api while logged in. If you have never made an app, fill the form: any name, category "Visualizer", website `http://localhost`, Authorization Callback Domain `localhost`. Upload any image as the icon.
2. The page shows "Your Access Token". Copy it.
3. In Stride Studio: Connect Strava > paste into Option B > Load. Your last 40 activities appear. Tap one.

Caveats: that token expires after 6 hours, and it only has `read` scope, so private activities will not appear and some fields (splits, streams) may be missing. Good enough for a first test.

**Option B: proper sign-in (per tester, full data)**
1. Same API page as above. Note the Client ID and Client Secret.
2. Set "Authorization Callback Domain" to the domain where the app is served. `localhost` if you run it locally, or `yourapp.netlify.app` if hosted.
3. Serve the app over http (file:// cannot receive the redirect). Locally:
   ```
   cd dist && python3 -m http.server 8080
   ```
   then open http://localhost:8080/index.html
4. Connect Strava > enter Client ID and Client Secret > Sign in with Strava. Approve on Strava. You land back in the app with activities loaded, including private ones, splits, elevation and heart rate streams.

Note for a real launch: the client secret is held in the browser here, which is fine for you and your own testers using their own API apps, but a public app needs a small server to do the token exchange so the secret stays private. That is a two-hour job (one endpoint) and is the main thing separating this prototype from a shippable product.

## Development

```
npm install
node build.mjs          # bundles src/ into dist/index.html (one self-contained file)
python3 test/e2e.py     # headless Chromium end-to-end test (14 checks): renders all templates, design controls, drag, presets, exports image, sticker and video
```

Source layout:
- `src/render.js` – the whole design engine: templates, formats, HR zones, caption. Framework-free, one function `renderFrame(ctx, media, act, template, opts, progress, t, mode)`
- `src/App.jsx` – UI, Strava, export, share
- `src/styles.css`
- `test/e2e.py` – Playwright test, writes screenshots to `test/shots/`

## Known limits

- Video export records in real time (a 30 second clip takes 30 seconds). Keep the tab in the foreground. Old phones: use the "faster" export size.
- Output codec depends on the browser: MP4 on Safari and most Chrome builds, WebM on Firefox. Instagram accepts both when shared from the phone.
- HEIC photos need converting to JPG first (iPhone: Settings > Camera > Formats > Most Compatible, or share the photo to Files as JPG).
- Fonts are system fonts, so the condensed "Poster" face varies slightly by device.
- Route is drawn from GPS only (no map tiles). That is deliberate: it is the trend, it needs no map API key, and it works offline.
