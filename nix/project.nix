# A consumer's devices as YAML, with a check that runs `esphome config` on each.
# `src` has package.json and pnpm-lock.yaml, with esphome-config as a dependency, and devices.
# Each of `externalComponents` is `{ src, source }`: the repo, and the `external_components`
# source the devices name it by, which the check swaps for `src` since it has no network.
{
  lib,
  stdenv,
  nodejs_24,
  pnpm,
  pnpmConfigHook,
  fetchPnpmDeps,
  mkShell,
  esphome,
  mkExternalTypes,
}:
let
  # `<dir>/<name>.ts` or `<dir>/<name>/index.ts`
  listDevices =
    dir:
    lib.mapAttrsToList (name: type: if type == "directory" then name else lib.removeSuffix ".ts" name) (
      lib.filterAttrs (name: type: type == "directory" || lib.hasSuffix ".ts" name) (builtins.readDir dir)
    );
in
{
  src,
  pnpmDepsHash,
  devices ? listDevices (src + "/${devicesDir}"),
  devicesDir ? "devices",
  externalComponents ? [ ],
}:
let
  externalTypes = mkExternalTypes externalComponents;
  hasExternal = externalComponents != [ ];
  localExternals = builtins.toJSON (
    lib.listToAttrs (map (c: lib.nameValuePair c.source "${c.src}/components") externalComponents)
  );

  build =
    { pname, script }:
    stdenv.mkDerivation (finalAttrs: {
      inherit pname src;
      version = "0";
      pnpmDeps = fetchPnpmDeps {
        inherit (finalAttrs) pname version src;
        fetcherVersion = 5;
        hash = pnpmDepsHash;
      };
      nativeBuildInputs = [
        nodejs_24
        pnpm
        pnpmConfigHook
        esphome
      ];
      env.ESPHOME_DEVICES = devicesDir;
      buildPhase = ''
        runHook preBuild
        export HOME=$TMPDIR
        ${lib.optionalString hasExternal ''
          rm -rf generated/external
          mkdir -p generated
          cp -r ${externalTypes} generated/external
          chmod -R u+w generated
        ''}
        # the installed esphome-config's types must be for this ESPHome
        want=$(node -p "require('esphome-config/package.json').esphome.version")
        have=$(esphome version | sed 's/^Version: //')
        if [ "$want" != "$have" ]; then
          echo "esphome-config is for ESPHome $want, but the flake's ESPHome is $have:" \
            "use the esphome-config flake input of the same release as the package" >&2
          exit 1
        fi
        if [ -f tsconfig.json ] && [ -x node_modules/.bin/tsc ]; then
          node_modules/.bin/tsc -p tsconfig.json
        fi
        ${script}
        runHook postBuild
      '';
      dontInstall = true;
    });
in
{
  inherit externalTypes;

  # result/<device>/<device>.yaml, with a dummy secrets.yaml beside it
  configs = build {
    pname = "esphome-configs";
    script = ''
      for device in ${lib.escapeShellArgs devices}; do
        mkdir -p $out/$device
        node_modules/.bin/esphome-config build $device > $out/$device/$device.yaml
        node_modules/.bin/esphome-config build $device --secrets > $out/$device/secrets.yaml
      done
    '';
  };

  # every device passes `esphome config`
  check = build {
    pname = "esphome-config-check";
    script = ''
      export ESPHOME_LOCAL_EXTERNALS=${lib.escapeShellArg localExternals}
      mkdir -p $out
      for device in ${lib.escapeShellArgs devices}; do
        dir=$TMPDIR/check/$device
        mkdir -p $dir
        node_modules/.bin/esphome-config build $device > $dir/$device.yaml
        node_modules/.bin/esphome-config build $device --secrets > $dir/secrets.yaml
        (cd $dir && esphome config $device.yaml > validated.txt 2>&1) \
          || { cat $dir/validated.txt; exit 1; }
        echo "$device: valid" >> $out/devices
      done
    '';
  };

  # Node, pnpm and ESPHome, with generated/external put in place
  devShell = mkShell {
    packages = [
      nodejs_24
      pnpm
      esphome
    ];
    shellHook = lib.optionalString hasExternal ''
      if [ -f package.json ]; then
        rm -rf generated/external
        mkdir -p generated
        cp -r ${externalTypes} generated/external
        chmod -R u+w generated/external
      fi
    '';
  };
}
