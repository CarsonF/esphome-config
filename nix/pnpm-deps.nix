# This repo's pnpm dependencies, shared by the package and the schema build.
{ lib, fetchPnpmDeps }:
let
  manifest = lib.importJSON ../package.json;
in
fetchPnpmDeps {
  pname = "esphome-config";
  inherit (manifest) version;
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
    ];
  };
  fetcherVersion = 5;
  hash = lib.removeSuffix "\n" (builtins.readFile ./pnpm-deps.hash);
}
