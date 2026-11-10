# apps/mobile (geplant)

Hier entsteht die iOS-/Android-App. Sie wird erst angelegt, wenn die Regeln in der Simulation tragen.

Geplanter Stack:

- **Vite + React + TypeScript** als App-Hülle
- **Three.js über React Three Fiber** (+ drei) für das Low-Poly-Diorama
- **Capacitor** für die nativen iOS-/Android-Builds
- **@being-god/core** als Regel-Engine – unverändert dieselbe wie in Simulation und Tests
- 3D-Modelle zunächst aus CC0-Paketen (Kenney, Quaternius) als glTF, später eigene Modelle (Blender)
- Spielstände getrennt von der Engine (Speicher-Adapter), damit später Cloud-Sync möglich ist
