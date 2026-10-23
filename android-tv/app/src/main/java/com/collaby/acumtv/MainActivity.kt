package com.collaby.acumtv

import android.os.Bundle
import android.view.KeyEvent
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * Android TV activity that wraps the ACUM TV web app in a WebView.
 *
 * NOTE: Update [webViewUrl] to your actual Vercel deployment URL before building.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    // TODO: Replace with your real Vercel deployment URL, e.g.
    // "https://acum-yourname.vercel.app/tv"
    private val webViewUrl = "https://acum-weld.vercel.app/tv"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.loadWithOverviewMode = true
        webView.settings.useWideViewPort = true

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
            }

            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                // Keep all navigation inside the WebView.
                return false
            }
        }

        setContentView(webView)
        webView.loadUrl(webViewUrl)
    }

    /**
     * Forward D-pad / remote key events to the WebView so the running web app
     * can handle them via its own JavaScript keyboard handlers.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (isTvRemoteKey(keyCode)) {
            webView.dispatchKeyEvent(event)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        if (isTvRemoteKey(keyCode)) {
            webView.dispatchKeyEvent(event)
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    private fun isTvRemoteKey(keyCode: Int): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_BUTTON_A,
            KeyEvent.KEYCODE_BUTTON_B,
            KeyEvent.KEYCODE_BUTTON_X,
            KeyEvent.KEYCODE_BUTTON_Y,
            KeyEvent.KEYCODE_BUTTON_L1,
            KeyEvent.KEYCODE_BUTTON_R1,
            KeyEvent.KEYCODE_MENU,
            KeyEvent.KEYCODE_BACK -> true
            else -> false
        }
    }

    /**
     * Handle BACK key: go back in WebView history when possible, otherwise
     * finish the activity (return to the TV home screen).
     */
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
