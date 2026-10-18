# API

Base path `/api`. JSON in and out. Identity is an HttpOnly cookie (`pid`) that the server sets on the first write. Errors always look like:

```json
{ "error": "rate_limited", "message": "You have rated a lot of pujas today. Try again tomorrow." }
```

`message` is plain language and safe to show. `error` is a stable code to branch on.

| Status | `error`        | Meaning                                            |
| ------ | -------------- | -------------------------------------------------- |
| 400    | `bad_request`  | Input failed validation                            |
| 400    | `bad_nickname` | Nickname has the wrong shape or is blocked         |
| 400    | `own_report`   | You cannot vote on your own road report            |
| 404    | `not_found`    | Unknown path or report                             |
| 413    | `too_large`    | Body over 20 KB                                    |
| 429    | `rate_limited` | Daily cap or too many new devices from one network |
| 429    | `cooldown`     | You reported this too recently                     |
| 429    | `slow_down`    | More than 90 writes a minute from one network      |
| 500    | `server_error` | Unexpected. Details are in the server log only     |

## `GET /api/health`

```json
{
  "ok": true,
  "rules": { "nearRadiusM": 500 },
  "levels": [{ "n": 0, "label": "No queue" }],
  "closureTypes": ["closed", "oneway", "barricade", "diverted"]
}
```

## `GET /api/state`

Everything the map needs, plus what this device has done. Never cached (`Cache-Control: no-store`). The aggregate part is cached 10 seconds per server instance.

```json
{
  "ts": 1760000000000,
  "pujas": {
    "<pujaId>": {
      "r": { "avg": 4.1, "raw": 4.6, "n": 12 },
      "q": { "level": 2, "wait": 20, "n": 3, "ageMin": 4, "conf": "ok", "by": "Rina" }
    }
  },
  "closures": [{ "id": 7, "type": "closed", "lat": 22.5, "lng": 88.3, "note": "", "ageMin": 12, "still": 3, "cleared": 0 }],
  "mine": { "ratings": { "<pujaId>": 4 }, "votes": { "7": "still" } }
}
```

`r` is absent until a puja has a rating. `q` is absent when there are no reports in the last hour. `q.by` is the latest reporter's nickname, or `null`.

## `POST /api/rate`

```json
{ "pujaId": "...", "stars": 4, "nickname": "Rina" }
```

`stars` is an integer 1 to 5. `nickname` is optional. One rating per device per puja; sending again edits it.
Response: `{ "ok": true, "updated": false, "r": { "avg": 4.1, "raw": 4, "n": 1 }, "mine": { "ratings": {}, "votes": {} } }`

## `POST /api/report/queue`

```json
{ "pujaId": "...", "level": 2, "waitMin": 20, "lat": 22.5186, "lng": 88.3467, "nickname": "Rina" }
```

`level` 0 to 3. `waitMin` 0 to 240, optional. `lat`/`lng` optional; within 500 m of the pin the report counts fully. The server does not store anything about location except these two numbers on the report.
Response: `{ "ok": true, "near": true, "q": { ... } }`

## `POST /api/report/closure`

```json
{ "type": "closed", "lat": 22.5185, "lng": 88.3437, "note": "Barricade at Badamtala" }
```

`type` is one of `closed`, `oneway`, `barricade`, `diverted`. The point must be in greater Kolkata. `note` is optional, trimmed to 80 characters.
Response: `{ "ok": true, "id": 7, "merged": false }`. `merged: true` means a report of the same kind within 40 m already existed and yours counted as a "still there" vote.

## `POST /api/closure/:id/vote`

```json
{ "vote": "still" }
```

`vote` is `still` or `cleared`. Response: `{ "ok": true }`.
