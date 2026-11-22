# Design system

Puja Dekho follows Airbnb's public component proportions (pill chips, 12 px controls, bottom sheets, icon-tile rows). The brand is ours: red `#B31D24`, orange `#FC8105`, dark maroon `#4A0E14`, Inter. All tokens live at the top of `src/styles.css`; components are defined once, in the "Components" block at the bottom.

## Colour

| Token         | Light     | Dark      | Use                                                                                                  |
| ------------- | --------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `--ink`       | `#2B1214` | `#F2F2F2` | Text                                                                                                 |
| `--maroon`    | `#4A0E14` | `#F0D3D6` | Dark fills and borders: selected chip border, dark button, segmented selection, toasts, map clusters |
| `--on-maroon` | `#FFFFFF` | `#3A0B10` | Text and icons on `--maroon`                                                                         |
| `--primary`   | `#B31D24` | `#E0434B` | The one main action on map screens, logo, links                                                      |
| `--accent`    | `#FC8105` | `#FF9A33` | Small highlights (ratings, counts). Never a button fill                                              |
| `--line`      | `#DDDDDD` | `#333333` | Borders                                                                                              |
| `--surface-2` | `#F7F7F7` | `#262626` | Selected chip fill, pressed fills, tiles                                                             |

Never use `#222` or black for a fill or border. Use `--maroon`.

## Size and shape

| Token         | Value                | Use                                                        |
| ------------- | -------------------- | ---------------------------------------------------------- |
| `--h-control` | 48 px                | Chips in sheets, buttons, inputs                           |
| `--h-compact` | 40 px                | Chips and small buttons on the bar (44 px tap area added)  |
| `--hit`       | 44 px                | Minimum tap target (icon buttons, menu rows, text buttons) |
| `--r-control` | 12 px                | Buttons, inputs                                            |
| `--radius`    | 16 px                | Cards, menus                                               |
| `--r-sheet`   | 24 px                | Sheet top corners                                          |
| Chip          | 999 px               | Pill                                                       |
| Spacing       | 4, 8, 12, 16, 24, 32 | Padding and gaps                                           |

## Components

- **Chip** `.chip` (48 px) and `.chip.compact` (40 px). 12/16 padding, 8 gap, 1 px line border and soft shadow. Selected is `aria-pressed="true"`: 2 px maroon border, `--surface-2` fill, weight 600. Leading line icons go on chips that name a thing, such as Filters, Saved and the distance chip. Place names stay text only. `.chip-n` is the muted count.
- **Button** `.btn`, 48 px. `.btn.dark` for forms, sheets and footers. `.btn.primary` (red) for the one main map action. `.btn.small` is 40 px. `.btn.text` is link style. `aria-busy="true"` shows the loading state.
- **Icon button** `.icon-btn`, 44 px.
- **Input and select** 48 px, 12 px radius, maroon border on focus. The select has a custom chevron.
- **Switch** the map layer checkboxes inside `.pop`.
- **Filters sheet** `FilterSheet.jsx`. Bottom sheet on phones, centred dialog on desktop. Sections: distance, area (several can be picked, nearest first when location is known, search box when there are more than 12 areas), saved. Footer: `Clear all` text button and a dark `Show N pujas` button that updates live and reads `No pujas match` at zero.
- **Procession card** `ProcessionCard` in `events.jsx`, used in What's new (Highlights) and Plan my route. A `.jg-ev` card with a 64 px square route picture (4 px radius) at the left, then the title with the status tag flush right (same place as every other event card), the date, and one more line. No arrow. Tap opens the Procession guide. The status tag is the shared `.jg-tag`: Upcoming and Ended are plain, Live now and Today are tonal. Live now runs 6 PM Sun 22 Nov to 7 AM Mon 23 Nov.
- **Watch plan card** `WatchPlanCard` in `procession.jsx`, in Plan my route under "Or watch it from a spot". A `.jg-plan-card` with the anchored picker (Arrive), a three-way `.jg-seg` (1, 3, All) and a `.btn.primary.block`. The result is a `.jg-proc-list` of numbered red points; tapping one opens the guide on Route with that point picked.
- **Bar** `FilterBar.jsx`. Two compact chips (Distance, Filters with a count badge). Applied area and Saved filters appear underneath as removable chips.

## Rules

1. One definition per component. Do not restyle `.chip` or `.btn` further down the file.
2. New colours become tokens first, with a dark-mode value.
3. Every tappable thing is at least 44 px, either visibly or through its tap area.
4. A filter that is on must be visible without opening a sheet.

## Daily entry card (Welcome sheet)

`Welcome.jsx`, opened on every fresh open until the procession is over (7 AM Mon 23 Nov), then on the first visit of each day (India time), and always from About. A fresh open is an app start or a return from the background; if the person was in the app less than 10 minutes ago it does not show (`welcomeDue()`, `WELCOME_GAP_MS`). The last moment in the app is kept in `pd_jg_seen_at` when the app goes to the background or the card is closed. A bottom sheet (max 560 wide, 24 px top corners). The scrim closes it, as does the X, Escape and the phone's back button. Same card for everyone; new visitors also get three feature rows.

| Part         | Spec                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top area     | Deep red gradient, the same in light and dark so a white X always reads. Padding 56 / 16 / 16: the top 56 is the X row, so the animation never sits under the X                    |
| Close X      | `.jg-welcome-x`: 48 x 48 tap target, 8 px from the top and right, with a 36 px black 40% disc behind the icon so it reads on any animation. Always above the animation             |
| Animation    | `LedArt.jsx`: a 16:9 frame (12 px radius, black 28% fill, max 400 wide, centred). The file (`public/anim/led-loop.json`) is a square; fit cover crops its empty top and bottom     |
| Headline     | "Experience the glory of Jagadhatri Puja '26 Procession": 24/28, 700, same for everyone, no name                                                                                   |
| Grey line    | 15/20, muted. `entryLine()`: before 6 PM Sun 22 Nov "Starting 22nd Nov, 6 PM onwards"; 6 PM to 7 AM "Happening now"; after that nothing                                            |
| Feature rows | New visitors only. Icon tile (32 px, 12 px radius), 15/20 bold title, 14/20 muted line. Follow the route, Find the best place to watch, View procession idols in order             |
| Buttons      | Exactly two, 52 px high, 8 px apart. Primary `.btn.dark` "View procession" (flag icon) opens the guide. Secondary `.btn.jg-btn-outline` "View traffic and parking" (no-entry icon) |

Rules the card follows:

1. **One job, two actions.** The main action is filled, the second is an outline. No third button and no text link. Closing is the X.
2. **The decoration never takes a tap.** The animation frame has `pointer-events: none`; the X and buttons keep their full tap targets (48 and 52 px) and nothing overlaps them.
3. **Nothing moves when the animation arrives.** The 16:9 frame holds its space from the first paint. The logo shows inside it until the animation is ready, then cross-fades (0.3 s). If the file does not load in 8 s the logo stays.
4. **Reduced motion.** With "reduce motion" on, the animation never plays: it shows one still lit frame (`STILL_FRAME` = 245) and the fades are off.
5. **Battery.** The loop pauses when the page is hidden and is destroyed when the card closes. The player and the file load only when the card opens (the player is the one already used for the festival greeting).
6. **Short phones keep both buttons on screen.** Up to 700 px tall: the frame shrinks (still 16:9, 224 wide) and rows show titles only. Up to 600 px tall (iPhone SE size): the rows go and the frame is 200 wide. Taller phones scroll inside the sheet if they must, never behind the home bar.
7. **Safe areas.** The bottom padding adds `env(safe-area-inset-bottom)`.

Replacing the animation: keep the file square (512 x 512) with the artwork inside y 112 to 400, so the 16:9 crop shows all of it; `test/client/jagadhatri.test.js` checks this. Then update `STILL_FRAME` in `led-art.js` to a sharp lit frame.

## No entry and Parking filter

One filter with three ways to read it: Parking, No entry, or both. It is the Procession day traffic sheet (`ImmersionSheet`): the sheet's tab is the filter (Overview = both, Parking, No entry), so every way in lands on the same state. Offered while the police notice is in force (`immersionState` is not `ended`).

| Where it is picked                      | What it does                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Map bar chips                           | `Parking` and `No entry` chips after Procession. One tap turns one on; a second chip adds the other |
| More filters sheet                      | A "Traffic" section, two choice rows. The button reads "Show on map" when one is picked             |
| Traffic sheet tabs                      | Overview, Parking, No entry. Picking a tab changes the filter                                       |
| Entry card, "View traffic and parking"  | Opens the sheet on Overview (both on)                                                               |
| What's new, Procession day traffic card | Same, with Back returning to What's new                                                             |

While the filter is on:

1. **Only the chosen spots are on the map.** Pandals, the procession route, watch points, zone badges and the station and ghat pins are hidden. The person's own location dot stays.
2. **The bottom sheet is the list** of the chosen spots (tap one to fly to it and see its details).
3. **The filter is always visible.** `Parking` and `No entry` are ordinary chips in the bar, after Procession, 16 px icon. They keep their place and turn selected when on (2 px maroon border, bold text, `aria-pressed`), like Near me and Must visit (design 7.3). Nothing is pinned and the bar does not jump. Only one chip in the bar may be sticky (Puja type), because two sticky chips stack on top of each other.
4. **Turning it off.** Tap a selected chip to turn that kind off; turning off the last one returns the map to the pujas. Closing the sheet (X, Back, the phone's back button) also turns it off. Opening anything else (a puja, Plan my route, Procession) ends it too, so a puja is never opened while pandals are hidden.
5. **Back goes where you came from:** the map list when opened from a chip, the Filters sheet or the entry card ("Back to the map"), What's new when opened from its card.
6. **Spots with no coordinates** (KMDA Under-Pass, Shivtala Morh, Kestopatty Morh and others) stay in the list marked "Not on the map yet".

## Map location and "Search this area"

Location button (round, bottom right, crosshair icon like Google Maps and Airbnb):

| State              | Look                  | Tap does                                                           |
| ------------------ | --------------------- | ------------------------------------------------------------------ |
| Idle               | White, dark icon      | Asks for location, then flies to you                               |
| Asking             | Spinner               | Nothing                                                            |
| On, map moved away | White, grey icon      | Flies back to you, zoomed to street level, clear of the list sheet |
| Centred            | Blue icon             | Starts following you                                               |
| Following          | Blue fill, white icon | Stops following (dragging the map also stops it)                   |
| Denied             | Slashed icon          | Explains how to allow location                                     |

- Far from Kolkata (more than 40 km): the dot is still drawn and the button still flies to you, but the map stays on South Kolkata, distances are off, and the distance chip is hidden.
- "Search this area" appears after the person moves the map. Tapping it narrows the list to pujas inside the visible map, shows a removable "Map area" chip, and sorts by distance to the map centre.
- Dots have a 14 px tap area, so a slightly off tap still opens the puja.
