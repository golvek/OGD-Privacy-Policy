# Privacy Policy for OGD Watcher

**Last updated: June 22, 2026**

## Data Collection

OGD Watcher is built with a privacy-first approach and does **not** collect, store, transmit, or share any personal data, browsing data, or any tracking information.

- **Task counts, timer settings, custom phrases, and daily history** are stored exclusively on your device using Chrome's local storage (`chrome.storage.local` and `localStorage`).
- **With the exception of Premium license validation** (see below), no data is ever sent to any external server, third party, or the developer.
- **No analytics**, crash reporting, or tracking of any kind.
- **No cookies**, no fingerprinting, no advertising.

## Premium License Validation

If you choose to use or subscribe to the Premium features, the extension will communicate with our secure licensing server solely to validate your license key. The only information transmitted during this process is the **license key itself** and a randomly generated, anonymous device ID to manage device limits. 

No personal data, email addresses, payment information, or browsing history are collected or transmitted by the extension. Payment processing is handled entirely and securely by Stripe.

## Page Access

The extension reads the current page's DOM structure to detect task submissions, extract text, and render a floating overlay. This information is processed entirely locally on your device and is never recorded, stored, or transmitted.

## Clipboard Usage (Auto-Copy)

The extension requests the `clipboardWrite` permission to enable the optional **Auto-Copy Title** feature. When manually enabled by the user, this feature simply copies the advertiser's name to your clipboard for your workflow convenience. The extension **never** reads your clipboard history or intercepts external copied data.

## Changes

If this policy changes, the updated version will be included with the extension update.

## Contact

For questions about this privacy policy, contact the developer through the email: [golvek@gmail.com](mailto:golvek@gmail.com)
