# Changelog

## [2026.10.1](https://github.com/CarsonF/esphome-config/compare/v2026.10.0...v2026.10.1) (2026-11-22)


### Bug Fixes

* merge core and external schema files of the same name ([54a629e](https://github.com/CarsonF/esphome-config/commit/54a629edabc77f366479084b3d391dcad5f6318a))
* type the generated actions index so declarations emit ([e268245](https://github.com/CarsonF/esphome-config/commit/e2682457454f2d0c6808595fe2c290eb8918c531))

## [2026.10.0](https://github.com/CarsonF/esphome-config/compare/v2026.9.4...v2026.10.0) (2026-11-22)


### Features

* types for ESPHome 2026.10.2 ([40aeeb5](https://github.com/CarsonF/esphome-config/commit/40aeeb5d8d88a1d275896408acfed2b3a4bb7f45))


### Bug Fixes

* **deps:** bump ([a442a4b](https://github.com/CarsonF/esphome-config/commit/a442a4b4ea54ffb269ee33d01c31d72ac4b1e209))
* fetch the modules esphome.io's schema script imports ([c04419d](https://github.com/CarsonF/esphome-config/commit/c04419d6ffede1b55f3c3d5ed5a8aa3a9b2b7dd5))

## [2026.9.4](https://github.com/CarsonF/esphome-config/compare/v2026.9.3...v2026.9.4) (2026-11-18)


### ⚠ BREAKING CHANGES

* an async build no longer runs on `await device(...)`. Call `await root.load()` before `toYaml()`.

### Features

* delay a device's build until it is rendered ([e0ad2b9](https://github.com/CarsonF/esphome-config/commit/e0ad2b952694cb5e87e4e5acc02d577a3e30689b))

## [2026.9.3](https://github.com/CarsonF/esphome-config/compare/v2026.9.2...v2026.9.3) (2026-11-18)


### ⚠ BREAKING CHANGES

* key Construct and Entity internals by symbol

### Features

* fail generation when an ESPHome name would shadow an entity member ([452de5b](https://github.com/CarsonF/esphome-config/commit/452de5b19217951c68a3c345913b7adab3a9c3d8))
* key Construct and Entity internals by symbol ([1da4095](https://github.com/CarsonF/esphome-config/commit/1da4095e5bc30540b6fefa3b2975538c60b19517))
* leave out the implicit id when there is only one instance ([b73c3e1](https://github.com/CarsonF/esphome-config/commit/b73c3e1ce9b64332964e0a71d229da3d395202a7))


### Bug Fixes

* print the id of a component configured once when it is referenced ([4f3cf62](https://github.com/CarsonF/esphome-config/commit/4f3cf62028f07df9ce32e4d931386ef3aceb1512))
* reject a referenced component whose id collides with another entity ([867282e](https://github.com/CarsonF/esphome-config/commit/867282e979eb0aea6c6fb949c64d1e2df589de23))

## [2026.9.2](https://github.com/CarsonF/esphome-config/compare/v2026.9.1...v2026.9.2) (2026-11-18)


### ⚠ BREAKING CHANGES

* `on_x(a, b)` takes a single argument, so write `on_x([a, b])`. `.then()` and `.with()` are removed; put options in `{ then, ...options }` instead. The `Step` type is renamed `AnyAction`. Components with a one-of rule no longer accept `{}`.

### Features

* build ESPHome's schema from pinned sources ([a46398f](https://github.com/CarsonF/esphome-config/commit/a46398fa7a90452411f4655b47133de6bfad5188))
* follow new ESPHome releases ahead of nixpkgs ([c8fc299](https://github.com/CarsonF/esphome-config/commit/c8fc299c681235ad843ca148c68658c92c833ad2))
* take a trigger's options in on_x(), and constrain one-of props ([#8](https://github.com/CarsonF/esphome-config/issues/8)) ([1caa6a9](https://github.com/CarsonF/esphome-config/commit/1caa6a9520bdda7573b1b3cd697dfa7ddeb1b41b))


### Bug Fixes

* fetch ESPHome's source before the bump reads its schema script ([551e91a](https://github.com/CarsonF/esphome-config/commit/551e91a76805acc3a62ac77542c823851dab1995))
* follow nixpkgs' ESPHome instead of overriding it ([c0b47d3](https://github.com/CarsonF/esphome-config/commit/c0b47d3f5343d00f30c9d8ef9d4b1470b7e875c6))
* treat options ESPHome fills in before validating as optional ([290aa86](https://github.com/CarsonF/esphome-config/commit/290aa8616929bd267e5c1cfb426a30e586419b2d))
* undo moving main to ESPHome 2026.10.1 ([27dd552](https://github.com/CarsonF/esphome-config/commit/27dd552d3544c152ee51b0ee595ba6a9b2006c45))

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
