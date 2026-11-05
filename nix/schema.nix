# The esphome-schema release for an ESPHome version, docs included.
# A version missing from schema-hashes.json fails: add it with the hash Nix prints.
{ lib, fetchzip }:
version:
let
  hashes = lib.importJSON ./schema-hashes.json;
in
fetchzip {
  name = "esphome-schema-${version}";
  url = "https://github.com/esphome/esphome-schema/releases/download/${version}/schema.zip";
  hash =
    hashes.${version}
      or (throw "esphome-config: no schema hash for ESPHome ${version} in nix/schema-hashes.json");
}
