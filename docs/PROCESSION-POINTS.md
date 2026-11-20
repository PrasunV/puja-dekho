# Procession pointers: new list vs the app's current list

Compared on Sat 21 Nov 2026. Route unchanged (confirmed by the owner). Procession is on Sunday 22 Nov, evening.

- **New list:** 11 pins (A to K) from `chandannagar_procession_route_details.md`, a loop of about 9.6 km from Jyoti More.
- **Current list:** the 7 suggested watch points in `src/jagadhatri/procession.js` (`WATCH`), plus the traced route (`ROUTE`, 61 points, about 8.35 km).
- **Method:** each new pin was measured against the traced route and against each current watch point (straight-line metres), and against the nearest puja.

## 1. The new pins sit on the traced route

Every new pin is within 100 m of the line I traced from the police screenshots, so the trace is on the right roads.

| New pin                   | Metres from traced route | Nearest puja                                         |
| ------------------------- | ------------------------ | ---------------------------------------------------- |
| A Jyoti More (start)      | 38                       | Tematha (A11)                                        |
| B Bagbazar Choumatha      | 99                       | Bagbazar Choumatha (C43)                             |
| C Vidyalankar             | 6                        | Bidyalankar (C50)                                    |
| D Palpara Road            | 5                        | none within 150 m                                    |
| E Bibirhat Tematha        | 32                       | Bibirhat Charaktala Tematha (not in procession list) |
| F Boro Taldanga           | 28                       | Boro Taldanga (D58)                                  |
| G Rath Stand              | 77                       | Kaporepotti (D66), 93 m                              |
| H Ganj Choumatha          | 77                       | Laxmigunj Chowmatha (not in procession list)         |
| I Strand Road             | 7                        | Barabazar Sarbojonin (A1), 204 m                     |
| J Kabi Bharatchandra Road | 6                        | Hatkhola Nonatala (A2), 91 m                         |
| K Tematha (end)           | 29                       | Tematha (A11)                                        |

B, G and H are the three pins where my line is 77 to 99 m off. Those junctions are where the trace needs a small correction.

## 2. Direction: the app's arrows are probably backwards

The new list runs Jyoti More, then north along the **west line** (Bagbazar, Vidyalankar, Palpara, Bibirhat, Taldanga), then back **south along the river-side line** (Rath Stand, Ganj Choumatha, Strand Road, Kabi Bharatchandra Road, Jyoti More).

The app currently draws the opposite: river-side northbound, west line southbound.

The police serial numbers agree with the new list, not with the app. Walking order along the new direction gives these pujas in rising serial order, with no exceptions:

| Place                         | Serial     |
| ----------------------------- | ---------- |
| Barabazar (river-side, south) | A1         |
| Hatkhola                      | A2 to A6   |
| Tematha (start)               | A11        |
| Bagbazar Choumatha            | C43        |
| Bidyalankar                   | C50        |
| Uttaranchal                   | 55         |
| Boro Taldanga                 | D58        |
| Laxmiganj area                | D65 to D66 |

Caveat: the new file's link carries `entry=gemini`, so its sequence came from an AI tool, not the police. The serial-number match is the stronger evidence.

## 3. Old list vs new list

| Current watch point      | Closest new pin           | Distance | Verdict                                                         |
| ------------------------ | ------------------------- | -------- | --------------------------------------------------------------- |
| 3 Bagbazar               | B Bagbazar Choumatha      | 4 m      | Same place                                                      |
| 5 Boro Taldanga          | F Boro Taldanga           | 0 m      | Same place                                                      |
| 6 Laxmiganj Bazar        | H Ganj Choumatha          | 101 m    | Same area, use the new pin                                      |
| 7 North turn             | E Bibirhat Tematha        | 39 m     | Same area, Bibirhat Tematha is the named junction               |
| 4 Uttaranchal            | E Bibirhat Tematha        | 277 m    | Different. Uttaranchal (No. 55) is near Palpara Road (D), 303 m |
| 1 Rani Ghat, Strand Road | I Strand Road             | 261 m    | Different spot on the same road                                 |
| 2 Hatkhola               | J Kabi Bharatchandra Road | 210 m    | Different spot, same south stretch                              |

**New in the owner's list, nothing nearby in mine (over 250 m):**

- A / K Jyoti More and Tematha: start and end, about 980 m from my nearest point. Best place to see the procession form up.
- C Vidyalankar: 419 m from my nearest.
- D Palpara Road: 303 m from my nearest.
- G Rath Stand: about 100 m from Laxmiganj Bazar, so close to an existing point.

**Kept from mine, not in the new list:** Rani Ghat (the ghat itself, useful for visitors arriving by boat) and Hatkhola (Zone A pujas 2 to 6).

## 4. Coverage along the route

Distance along the traced route between neighbouring points, using both lists together:

| Longest stretch with no point                           | Metres |
| ------------------------------------------------------- | ------ |
| Laxmiganj Bazar to Boro Taldanga (river-side north end) | 1,404  |
| Tematha / Jyoti More to Hatkhola (south end)            | 982    |
| Palpara Road to Vidyalankar (west line)                 | 805    |
| Rani Ghat to Rath Stand                                 | 573    |

Neither list has a point on the west line between Bagbazar and Jyoti More, about 2.1 km of G.T. Road.

## 5. Length

The traced route is about 8.35 km as drawn. The new file says about 9.6 km and the police page says 8.7 km. My trace is straighter than the real road in places, which fits the 77 to 99 m offsets at B, G and H.

## 6. Proposed merged list (not applied yet)

Keep to 7 to 9 points for the sheet. Suggested set, in procession order:

1. A / K Jyoti More: start and end
2. J Kabi Bharatchandra Road, or Hatkhola (pick one)
3. I Strand Road at Rani Ghat
4. G / H Ganj Choumatha and Rath Stand (one point)
5. F Boro Taldanga
6. E Bibirhat Tematha (replaces "North turn")
7. D Palpara Road with Uttaranchal
8. C Vidyalankar
9. B Bagbazar Choumatha

## 7. To confirm

- Is the direction in section 2 right, with the west line going north first? If yes, the arrows on the map flip and the watch point order reverses.
- Should the merged list in section 6 replace the current 7, or be added to them?
- Do you want pin notes such as "best view from the north side of the junction"? I can't know these from here.
- Are the pin coordinates from Google Maps place pins? Place pins can sit on a shop, not the road centre. Check B, G and H on the ground.

## 8. Decision (21 Nov, owner)

The merged 9 are final, in the "as built" direction (river-side line north first, then the west line south). The Route tab and the map pins use this order:

1. Jyoti More (start and end)
2. Kabi Bharatchandra Road
3. Strand Road, near Rani Ghat
4. Ganj Choumatha and Rath Stand
5. Boro Taldanga
6. Bibirhat Tematha
7. Palpara Road
8. Vidyalankar
9. Bagbazar Choumatha

Open: the police serial numbers point the other way (section 2). The arrows were left as built on the owner's call.
