# Credits

Solstice House is an original design. The house plan, the rooms, the camera route, the drawing effect
and all code were written for this project.

Photographic assets come from [Poly Haven](https://polyhaven.com) and are released under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/): no attribution is required, and we give it anyway.

- **Skies (HDRI):** `kiara_2_sunrise`, `kiara_3_morning`, `kiara_5_noon`, `kiara_6_afternoon`, `kiara_7_late-afternoon`, `kiara_8_sunset`
- **Materials:** `wood_floor`, `dark_wooden_planks`, `terrazzo_tiles`, `large_floor_tiles_02`, `wood_planks_grey`, `gravel_floor_02`, `white_plaster_02`, `long_white_tiles`, `rough_linen`, `leafy_grass`
- **Models:** `sofa_02`, `mid_century_lounge_chair`, `modern_coffee_table_01`, `modern_wooden_cabinet`, `wooden_display_shelves_01`, `side_table_tall_01`, `drawer_cabinet`, `ornate_mirror_01`, `dining_chair_02`, `bar_chair_round_01`, `painted_wooden_nightstand`, `modern_arm_chair_01`, `Ottoman_01`, `planter_box_01`, `potted_plant_02`, `fern_02`, `calathea_orbifolia_01`, `shrub_02`, `searsia_lucida`, `throw_pillows_01`, `ceramic_vase_01`

Textures were converted to WebP, and models were optimised with glTF-Transform (Meshopt compression,
1024 px textures, and a lower triangle count for `searsia_lucida`).
`throw_pillows_01` was optimised the same way (glTF-Transform 4.1.0: Meshopt, WebP, 1024 px). `ceramic_vase_01` is
Poly Haven's original 1k glTF, unmodified.

Garden trees, the olive, the bed and the kitchen joinery are drawn in code; leaf and bark textures are
painted on a canvas at load time.

Libraries: [three.js](https://threejs.org), [React](https://react.dev), [Lenis](https://lenis.darkroom.engineering), [Vite](https://vite.dev).
Fonts: Fraunces and Instrument Sans, via Google Fonts.
