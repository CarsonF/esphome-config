# Changelog

## [2026.9.2](https://github.com/CarsonF/esphome-config/compare/v2026.9.1...v2026.9.2) (2026-11-10)


### Features

* the package ships ESPHome's language schema, the one its types were generated from, so `generate-external` no longer downloads it ([a46398f](https://github.com/CarsonF/esphome-config/commit/a46398fa7a90452411f4655b47133de6bfad5188))


### Bug Fixes

* options ESPHome fills in before validating, like `esphome.build_path`, are optional ([290aa86](https://github.com/CarsonF/esphome-config/commit/290aa8616929bd267e5c1cfb426a30e586419b2d))

## [2026.9.1](https://github.com/CarsonF/esphome-config/compare/v2026.9.0...v2026.9.1) (2026-11-08)


### Features

* `esp.external.<name>()` for each listed external component source ([f6dba90](https://github.com/CarsonF/esphome-config/commit/f6dba909a500cc56b65eacedfbaf47d86760b055))

## 2026.9.0 (2026-11-07)


### Features

* core type generation from the ESPHome schema ([74b01ba](https://github.com/CarsonF/esphome-config/commit/74b01ba996b1f651786601338e08479ac1e6a788))
* DSL core ([6e53bd1](https://github.com/CarsonF/esphome-config/commit/6e53bd106fe5ad2d87a5206b6d575d4c4425bf3a))
* external component types ([2b5a212](https://github.com/CarsonF/esphome-config/commit/2b5a212651c3c0a3dde3046338409a662851c05c))
* optional Nix layer ([182ce1f](https://github.com/CarsonF/esphome-config/commit/182ce1fd4a0a3df6f72fc702f2e0324824fd0c0e))
* TypeScript lambdas (cpp()) ([d4b3c08](https://github.com/CarsonF/esphome-config/commit/d4b3c087a562cad269550205b98ad13d4a6c21ff))
* version releases after the ESPHome release they follow ([0ffece5](https://github.com/CarsonF/esphome-config/commit/0ffece5bc9ca15d0e7b951339b6cd5510935f7ee))


### Bug Fixes

* accept ESPHome's shorthand for single-key options ([0352a43](https://github.com/CarsonF/esphome-config/commit/0352a439cc53ac37478901a3d53296fc2d80fa4d))
