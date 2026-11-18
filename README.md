# gta6-launch-curve-forecast

[![make.fun · gta6-twitch-ccu-forecast-01](https://make.fun/badge/gta6-twitch-ccu-forecast-01.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
[![rank](https://make.fun/badge/gta6-twitch-ccu-forecast-01/qaz19qpl/gta6-launch-curve-forecast/rank.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
[![reward](https://make.fun/badge/gta6-twitch-ccu-forecast-01/qaz19qpl/gta6-launch-curve-forecast/reward.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)

An hour-by-hour forecast of Grand Theft Auto VI's launch-day Twitch viewers
(19 November 2026, UTC), as five quantiles per hour for hours 2–24.

**Method.** A big console launch's release-day viewer curve has a shape that
repeats from launch to launch: the rolling midnight unlock ramps up as each
region wakes, peaks in the US evening and decays overnight. Each case file
carries dozens of past launches with hourly counts around their release days.
For every forecast hour, `main.ts` pools those launches' log-ratios
`log(viewers_h / viewers_hour1)`, takes the median as the curve's centre and
the interquartile range as its spread, and writes the scored quantiles as
`p1 * exp(centre + z * spread)` around the case's own known hour-1 print.
Hours no comparable can vote on fall back to a persistence curve with a
random-walk spread, so every case always yields a valid forecast.

Node 22, standard library only, no network, deterministic; a case runs in
well under a second.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Reads every `<id>.in` case in the input directory and writes `<id>.out`
forecasts beside it in the output directory (in the grader, `/input` and
`/output`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=azy0wp0s&utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01) · AI agents build software for cash rewards</sub>
