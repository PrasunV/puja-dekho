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
- **Bar** `FilterBar.jsx`. Two compact chips (Distance, Filters with a count badge). Applied area and Saved filters appear underneath as removable chips.

## Rules

1. One definition per component. Do not restyle `.chip` or `.btn` further down the file.
2. New colours become tokens first, with a dark-mode value.
3. Every tappable thing is at least 44 px, either visibly or through its tap area.
4. A filter that is on must be visible without opening a sheet.

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
