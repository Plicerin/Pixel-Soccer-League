# Bug Tracker

- [ ] **WR Naming Issue**: Dolphins Wide Receivers are all being named "Tyreek Hill" regardless of the roster list.
- [ ] **Kit Color Toggle Not Working**: Home/Away kit toggle buttons in the options panel call `setTeamColors` with correct hex values, but player voxels on the field don't visually update. Root cause: voxel meshes may not reference the shared `M.teamAShirt`/`M.teamBShirt` material instances. Even after reassigning materials in `setTeamColors`, the change doesn't render. Needs deeper investigation into the Three.js material/render pipeline.
