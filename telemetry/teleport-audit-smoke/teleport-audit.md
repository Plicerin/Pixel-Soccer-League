# Teleport Audit

Generated: 2026-05-02T01:17:17.628Z
Match: #490 Atlanta United 3-1 Orlando City
Session: ft-1777684549500

## Verdict

- Ball teleport issue: YES
- Player teleport issue: YES

## Ball

- Detected: 11
- Reverted/unexpected: 11
- Restart/dead-ball repositions: 26
- Log rows: 37

Top ball jumps:
- t=53.35s jump=34.03 held=none fly=false roll=false reverted=false
- t=488.95s jump=34 held=none fly=false roll=false reverted=false
- t=328.22s jump=33.91 held=none fly=false roll=false reverted=false
- t=299.54s jump=33.9 held=none fly=false roll=false reverted=false
- t=364.7s jump=28.27 held=none fly=false roll=false reverted=false
- t=481.52s jump=26.04 held=none fly=false roll=false reverted=false
- t=624.43s jump=22.4 held=none fly=false roll=false reverted=false
- t=273.68s jump=22.2 held=none fly=false roll=false reverted=false
- t=268.82s jump=20.78 held=none fly=false roll=false reverted=false
- t=415.05s jump=20.59 held=none fly=false roll=false reverted=false

## Players

- Samples checked: 11303
- Players tracked: 20
- Spike count: 390
- Thresholds: speed>14 units/s or jump>8 units

Top player speed spikes:
- A LM Aleksey Miranchuk: 429.76u/s over 38.68u in 0.09s, half 2, 38.13->38.22
- A RM Saba Lobjanidze: 252.05u/s over 32.77u in 0.13s, half 2, 161.11->161.24
- B CB Robin Jansson: 203.31u/s over 32.53u in 0.16s, half 1, 9.34->9.5
- B CB David Brekalo: 190.86u/s over 30.54u in 0.16s, half 1, 9.34->9.5
- B CM Eduard Atuesta: 151.39u/s over 21.19u in 0.14s, half 2, 207.5->207.64
- B LM Iván Angulo: 148.93u/s over 44.68u in 0.3s, half 2, 229.39->229.69
- B RM Marco Pašalić: 147.81u/s over 44.34u in 0.3s, half 2, 229.39->229.69
- B CM Martín Ojeda: 145.85u/s over 23.34u in 0.16s, half 2, 207.48->207.64
- A ST Emmanuel Latte Lath: 145.72u/s over 23.31u in 0.16s, half 1, 9.34->9.5
- B LM Iván Angulo: 134.59u/s over 21.53u in 0.16s, half 1, 9.34->9.5
- B CM Eduard Atuesta: 126.11u/s over 37.83u in 0.3s, half 2, 229.39->229.69
- B LM Luis Muriel: 125.57u/s over 37.67u in 0.3s, half 2, 229.39->229.69
- B CM Martín Ojeda: 122.72u/s over 36.82u in 0.3s, half 2, 229.39->229.69
- A CB Stian Gregersen: 116.63u/s over 36.15u in 0.31s, half 2, 160.93->161.24
- A RM Saba Lobjanidze: 106.83u/s over 43.8u in 0.41s, half 2, 37.81->38.22

Fastest sampled player movements:
- A LM Aleksey Miranchuk: 429.76u/s over 38.68u in 0.09s, half 2, 38.13->38.22
- A RM Saba Lobjanidze: 252.05u/s over 32.77u in 0.13s, half 2, 161.11->161.24
- B CB Robin Jansson: 203.31u/s over 32.53u in 0.16s, half 1, 9.34->9.5
- B CB David Brekalo: 190.86u/s over 30.54u in 0.16s, half 1, 9.34->9.5
- B CM Eduard Atuesta: 151.39u/s over 21.19u in 0.14s, half 2, 207.5->207.64
- B LM Iván Angulo: 148.93u/s over 44.68u in 0.3s, half 2, 229.39->229.69
- B RM Marco Pašalić: 147.81u/s over 44.34u in 0.3s, half 2, 229.39->229.69
- B CM Martín Ojeda: 145.85u/s over 23.34u in 0.16s, half 2, 207.48->207.64
- A ST Emmanuel Latte Lath: 145.72u/s over 23.31u in 0.16s, half 1, 9.34->9.5
- B LM Iván Angulo: 134.59u/s over 21.53u in 0.16s, half 1, 9.34->9.5

