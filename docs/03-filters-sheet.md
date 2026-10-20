# Doc 03: Filters sheet

Describes the Filters sheet as built on 20 Oct 2026, with the states the earlier docs left out. Written from the code in `src/features/explore/FilterPanel.jsx`. Items marked **proposed** are not built.

## Purpose
Narrow the list and the map without leaving the page. Changes apply live. The footer button always says how many pujas match, so nobody has to guess what a tap did.

## Entry and exit
- Opens from the Filters chip in the filter row. It is a full-height dialog (`role="dialog"`, `aria-modal`) over a scrim.
- Closes with the X (44 px, "Close filters"), with Escape, or with the footer button. Focus starts on the X and Tab stays inside the panel.
- Closing keeps every choice. The chip row shows how many filters are on.

## Sections, top to bottom
| Section | What it does | Notes |
| --- | --- | --- |
| Radius | One of 500 m, 1 km, 5 km, 10 km, 20 km from the person. Default 500 m | Needs a location. Disabled while a station is chosen |
| Metro station | Search box and a chip per station, A to Z. Choosing one lists pujas within 1 km of it, or within 5 km if there are none. Tapping it again clears it | Replaces the radius. Dots show Blue and Green only |
| Nearby area | The 10 areas nearest the person, closest first (A to Z without a location). Search finds any other. One area at a time. The number on each chip is its puja count | A picked area stays visible even if it is not among the nearest |
| Crowd | "Less crowded" switch. Hides pujas whose typical crowd for this hour is above Low | Pujas with no crowd value are kept, not hidden. A note says this is typical, not live |

Filters combine with AND across sections. Zone chips in the filter row (South, North, Central, East, Other) combine with OR inside themselves and AND with these.

## States
| State | What the person sees |
| --- | --- |
| Location on | Radius chips are live. Areas sort nearest first |
| Finding you | "Turn on location" button shows "Finding you…" and is busy |
| Location off | Radius explains why and offers "Turn on location". Stations and areas are A to Z |
| Location blocked | "Location is blocked for this site. Allow it in your browser settings to use the radius." No button |
| Visitor (more than 25 km away) | "You're outside Kolkata, so the radius is off. Pick a station or an area below." No button. The radius chip is also hidden from the filter row |
| Station chosen | Radius chips are disabled with "Not used while <station> is chosen." |
| Search finds nothing | "No station called “x”. Try fewer letters." (same for areas) |
| Filters leave no puja | The list shows "No pujas match" with a Clear all button |

## Footer
- Primary button: "Show N pujas", where N is the count that passes every filter.
- "Clear all" sits beside it and is disabled until something differs from the defaults (any filter on, or a radius other than 500 m).

## Rules
- Changes never wait for a confirm tap. The button only closes the sheet.
- The sheet never changes the map's framing by itself.
- Radius and station are mutually exclusive: choosing a station switches the radius off, clearing it brings the radius back.
- Counts in the footer and in the list header must always agree. This is covered by the test that checks a station replaces the radius.

## Proposed
- Add a sort control here once the sort menu (backlog item 9) exists, or keep it only on the list. Decision needed.
- Show the Yellow and Orange line stations with their own dots once their timings are confirmed.
- Show "Search this area" scope as a removable tag in the sheet when an area is searched.
- Localise every string above to Bengali (backlog item 12).
