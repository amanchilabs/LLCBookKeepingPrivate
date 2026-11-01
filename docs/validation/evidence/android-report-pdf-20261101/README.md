# Android PDF report export evidence

- Platform: Android 16 / API 36 arm64 emulator (`sdk_gphone64_arm64`), not a physical phone.
- App: LLCBookKeepingPrivate 0.1.0 (version code 1), release variant signed with the local Android debug key. It is an emulator validation build, not a distribution build.
- APK SHA-256: `da07092eddf071540844b3fc8e463a2ce9d9ac56a7862408a41356cc56c4e254`.
- Data: synthetic `Northstar Demo LLC` records already stored in the emulator. Reinstalling the APK preserved the business and report totals.
- UI workflow: opened Reports, exported the cash-basis P&L PDF, and observed the Android system share sheet. `reports-screen.png` and `share-sheet.png` are screenshots captured from that app session.
- Report period and values: 2026-01-01 through 2026-11-01; income $500.00, operating expenses $212.19, net income $287.81.
- PDF verification: retrieved the generated PDF directly from the app's `cache/Print` directory on the emulator, then checked it with `pdfinfo` and `pdftotext`. It is one landscape US Letter page (792 × 612 points), and the extracted amounts match the persisted P&L screen. Retrieved PDF SHA-256: `05c299386ec37b3ed470a731af55c06bf4642399a6f3162d601f8e3543e36ec6`. `exported-pdf-render.png` is a local rasterization of that exact cache PDF for visual review; it is not a device screenshot.
- The Android Print service's optional “Save as PDF” target re-renders documents using its own portrait default. That reprint was not used as evidence for the app-generated PDF dimensions.
- No PDF or database was added to Git. The cache PDF and APK remain local emulator/build artifacts. The emulator was temporarily run as root only to read the app-cache PDF for this synthetic-data check.

This checkpoint verifies Android emulator PDF generation and sharing. It does not establish physical-device acceptance, iOS PDF behavior, or production release readiness.
