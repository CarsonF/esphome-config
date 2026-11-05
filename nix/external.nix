# The types of external components, as a project's `generated/external`.
# Each of `externalComponents` is `{ src, ... }`: a repo whose `components/` has one directory each.
{
  lib,
  runCommand,
  esphome,
  esphome-config,
}:
externalComponents:
runCommand "esphome-config-external-types"
  {
    nativeBuildInputs = [
      esphome
      esphome-config
    ];
    ESPHOME_SCHEMA = "${esphome-config.schema}";
    ESPHOME_SCHEMA_SCRIPT = "${esphome.src}/script/build_language_schema.py";
    # nixpkgs' `esphome` is a shell wrapper, but the build's python3 imports it
    ESPHOME_PYTHON = "python3";
  }
  ''
    export HOME=$TMPDIR
    esphome-config generate-external ${
      lib.escapeShellArgs (map (c: "${c.src}") externalComponents)
    } --out $out
  ''
