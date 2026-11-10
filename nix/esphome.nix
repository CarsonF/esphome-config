# nixpkgs' ESPHome, at the version the types are for.
# While nixpkgs is behind, esphome-src.json (from scripts/bump-esphome.sh) moves its source there.
# ESPHome's own tests are skipped then, since they need its newest dev dependencies,
# and this repo's checks stand in for them.
{ lib, esphome }:
version:
let
  srcFile = ./esphome-src.json;
  override = if builtins.pathExists srcFile then lib.importJSON srcFile else null;
in
if esphome.version == version then
  esphome
else if override != null && override.version == version then
  esphome.overridePythonAttrs (old: {
    inherit version;
    src = old.src.override {
      tag = version;
      inherit (override) hash;
    };
    doCheck = false;
  })
else
  throw (
    "esphome-config: nixpkgs has ESPHome ${esphome.version}, but the types are for ${version}: "
    + "run scripts/bump-esphome.sh"
  )
