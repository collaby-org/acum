# ACUM TV — Tizen TV Widget

A Tizen `.wgt` widget that wraps the ACUM TV web app for Samsung TV.

## Files

- `config.xml` — W3C widget config + Tizen extensions
- `icon.png` — Widget icon (placeholder, needs replacement)
- `icon-96.png` — Launcher icon (placeholder, needs replacement)

## Important: Update the web app URL

Before building, edit `config.xml` and change the `<content src="...">` URL to your actual Vercel deployment:

```xml
<content src="https://acum.vercel.app/tv"/>
```

Replace `https://acum.vercel.app/tv` with your real domain (e.g. `https://acum-yourname.vercel.app/tv`).

## Build

1. Zip the *contents* of this folder (not the folder itself):
   - `config.xml`
   - `icon.png`
   - `icon-96.png`
2. Rename the `.zip` to `.wgt` (e.g. `acumtv.wgt`).
3. Sign the `.wgt` with your Tizen certificate (Tizen Studio → Certificate Manager).

## Install

1. Connect your Samsung TV via SDB:
   ```
   sdb connect <TV_IP>
   ```
2. Install the widget:
   ```
   tizen install -n acumtv.wgt
   ```

## Store

- Register the app via the [Samsung TV Seller Office](https://seller.samsungapps.com/).
- Submit the signed `.wgt` package for review.

## Notes

- Remote-only: cursor is disabled (`pointing-device-support="disable"`).
- Internet privilege is declared (`http://tizen.org/privilege/internet`).
- Placeholder icons are 1x1 transparent PNGs; replace with real 96x96 assets before store submission.
