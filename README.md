# Langit Nusantara

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/arrafi97/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/arrafi97/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Entry for the make.fun bounty [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057): an original 3D-feel flight game over an Indonesian archipelago, built with plain JavaScript and Canvas — no libraries, no network.

Fly the bush plane **Elang** from a coastal airfield: through golden rings over the lake and rice fields, down to a gentle landing on runway 09, or up from a standing start through the climb gates. Throttle and turn discipline matter — fly too hot or too steep and you will stall, run dry, or bend the aircraft.

## Play

Serve `game/` and open it in a desktop browser:

    node serve.ts

or open `game/index.html` from any static server. Keyboard: **W/S** throttle, **arrow keys** pitch and bank, **Space** airbrake, **P** pause, **R** restart, **M** mute. Missions are picked with keys **1–4** on the title screen.

## Screenshots

`?shot=cover|play|landing|takeoff&seed=<n>` stages one deterministic frame of the real game (see `shots.json`).

## Hand in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR` (default `/output`) and writes `dossier.json` with the vendored make.fun library:

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
