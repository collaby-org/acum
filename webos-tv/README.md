# ACUM TV - webOS Widget

A webOS .ipk widget project for LG TV that wraps the ACUM TV web app.

## Required Files

- `appinfo.json` — webOS app manifest
- `icon.png` — 80x80 PNG placeholder
- `largeIcon.png` — 130x130 PNG placeholder

## Packaging

Package the app into an .ipk installer:

```
ares-package ./webos-tv
```

This produces `com.collaby.acumtv_1.0.0_all.ipk`.

## Install

Install to your LG TV (replace `myTV` with your device name):

```
ares-install -d myTV com.collaby.acumtv_1.0.0_all.ipk
```

## Launch

Launch the app on your TV:

```
ares-launch -d myTV com.collaby.acumtv
```

## Store Submission

Submit the `.ipk` package through the [LG Seller Lounge](https://seller.lgwebostv.com/) for distribution on LG TVs.

## Important

You **must** update the `main` URL in `appinfo.json` to your actual Vercel deployment URL before packaging:

```json
"main": "https://your-actual-vercel-deployment.vercel.app/tv"
```

The default value `https://acum.vercel.app/tv` is a placeholder and will not work unless it matches your deployed ACUM TV web app.

## Development Notes

- `type: "web"` — the app loads a remote URL, so no local web assets are bundled.
- The `id` (`com.collaby.acumtv`) is used for install and launch commands.
- Icon files (`icon.png` 80x80, `largeIcon.png` 130x130) are placeholders; replace them with branded assets before store submission.
