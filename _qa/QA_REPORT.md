# QA Report: Readline

**Final status: PASS.** `_qa/test/report.json` shows `"ok": true` with 0 JS errors and no scenario error. `./gradlew.bat assembleRelease` succeeded and produced `app/build/outputs/apk/release/app-release.apk`.

## How it was run
`node _qa/webtest-local.js app/src/main/assets/www _qa/test _qa/scenario.js`

The pipeline's `webtest.js` could not run here. It looks for `chromium_headless_shell-1255`, which isn't installed on this machine. `_qa/webtest-local.js` is the same harness (390×844 mobile viewport, records console and page errors) pointed at the installed `chromium-1248`.

## What was tested (`_qa/scenario.js`, 24 screenshots)
Every item in `test_scenarios`, checked with assertions:
1. **300 pages, due in 10 days:** the preview shows 30 pages/day and "p. 30". After logging p. 50 the book shows "Ahead by 20 pages" and "Tomorrow ≈ 28 pages".
2. **Weekdays only with a 2-day buffer** (set in Settings): the target equals 140 ÷ the number of weekdays before deadline − 2. Every future Sat/Sun row on the plan calendar shows 0.
3. **Due tomorrow with 400 pages:** shows "Impossible at your pace", the at-risk banner appears, and triage offers Renew. Renew +14 moves the deadline by exactly 14 days, logs a renewal entry, and the target drops (400 → 27).
4. **Three overlapping books:** the "pages today" total equals the sum of the card targets and the expected ⌈200/7⌉+⌈150/9⌉+⌈320/12⌉. "Can I take this on?" with 500 pages due in 5 days says "Won't fit" and names the conflicting book.
5. **Book-club checkpoint at p. 120 in 4 days:** the target is 30/day ("aiming at p. 120 first"), and the card shows "toward p. 120".
6. **Session timer:** start, stop, then log 20 pages in 25 min. Pace shows 0.80 pages/min and the cards show "≈ N min".
7. **Finish before the deadline:** the book lands on the Shelf with an "On time" badge. "Returned unread" appears on the Shelf, and the finished count stays the same.
8. **Reload persistence** for books, sessions, renewals and settings (loan length). Export JSON, reset, import, and everything is restored.
9. **Validation:** an empty or whitespace title, current page past the last page, and a deadline in the past each show inline errors. A book added with 0 pages left automatically asks whether to mark it finished.

Extra edge cases:
- Very long title (360 chars, including one unbroken 60-char word): checked for horizontal overflow on Today, Plan and Detail.
- Rapid taps: triple-tapping the FAB, Save and Log save.
- Android back chain: sheet → detail → Plan tab → Today → exit (returns `false`).
- Importing invalid JSON or an empty box.
- Dark mode on Today and Detail.

## Bugs found and fixed
1. **A long title broke the layout.** An unbroken word in the at-risk banner pushed `#screen` 131 px wider than the phone. Long titles also filled the whole banner and squeezed the Detail hero into a narrow column.
   *Fix:* `overflow-wrap`/`min-width:0` on the text containers. Titles in the banner, triage verdict, suggestions and take-on text are cut to 48 characters. Titles are capped at 3 lines on cards, 5 in Detail and 2 on the Shelf. The title input has `maxlength=160`.
2. **Double-taps stacked screens and could create duplicates.** Tapping the FAB 3 times opened 3 Add forms. Save, Log save and dialog buttons stayed clickable while their layer was animating closed, so a fast double-tap could add a book twice or run a dialog action twice.
   *Fix:* actions that open a layer are ignored for 350 ms after another layer opens. Save, Log save and each dialog only run once. Clicks inside a closing layer (`.layer.out`, also `pointer-events:none`) are ignored.
3. **Small text fixes.** Adding an already-finished book showed the toast "Added · 0 pages/day"; it now says "Added". The Settings hint said reading days apply to "new books", but they apply to every book without its own schedule; the hint now says so.

## Known limitations (not fixed)
- The "Can I take this on?" estimate in the Add form spreads the whole book over its deadline (e.g. "about 15 pages/day"). For a club book with an earlier checkpoint, the daily target above it is higher (30/day), so the two numbers can look inconsistent.
- If you change the default reading days or buffer in Settings, every book that doesn't have its own schedule follows the new setting. That matches the data model (`readingDays: null` means "use the default").
- Vibration and native share can't be checked in a headless browser. The code calls `Android.vibrate` / `Android.share` and falls back to `navigator.vibrate`, `navigator.share` or the clipboard.
- On Windows/OneDrive, Gradle sometimes can't delete `app/build/intermediates/incremental/packageRelease/tmp`. Deleting that folder and building again fixes it.
