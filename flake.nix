{
  description = "Write ESPHome configs in TypeScript, with types from ESPHome's own schema";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      esphomeVersion = (nixpkgs.lib.importJSON ./package.json).esphome.version;

      # nixpkgs' ESPHome, which must be the version the types are for
      esphomeFor =
        pkgs:
        if pkgs.esphome.version == esphomeVersion then
          pkgs.esphome
        else
          throw (
            "esphome-config: nixpkgs has ESPHome ${pkgs.esphome.version}, "
            + "but the types are for ${esphomeVersion}"
          );
      schemaFor = pkgs: pkgs.callPackage ./nix/schema.nix { } esphomeVersion;
      mkExternalTypesFor =
        pkgs:
        pkgs.callPackage ./nix/external.nix {
          esphome = esphomeFor pkgs;
          esphome-config = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
        };
      mkProjectFor =
        pkgs:
        pkgs.callPackage ./nix/project.nix {
          esphome = esphomeFor pkgs;
          mkExternalTypes = mkExternalTypesFor pkgs;
        };
    in
    {
      packages = forAllSystems (pkgs: rec {
        esphome-config = pkgs.callPackage ./nix/package.nix { schema = schemaFor pkgs; };
        schema = schemaFor pkgs;
        default = esphome-config;
      });

      apps = forAllSystems (pkgs: rec {
        esphome-config = {
          type = "app";
          program = pkgs.lib.getExe self.packages.${pkgs.stdenv.hostPlatform.system}.default;
        };
        default = esphome-config;
      });

      checks = forAllSystems (
        pkgs:
        let
          package = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
          mkExternalTypes = mkExternalTypesFor pkgs;
          fixture = {
            src = ./test/external-fixture;
            source = "github://example/fixture@main";
          };
          roode = rec {
            rev = "b975cec4e5570c393d35ce7a9778c8d599865961";
            src = pkgs.fetchFromGitHub {
              owner = "Lyr3x";
              repo = "Roode";
              inherit rev;
              hash = "sha256-ngVfSBPxqN2iiWUB9rAbXTpa4SvrYEgTwQ+87SweEHY=";
            };
            source = "github://Lyr3x/Roode@${rev}";
          };
          # `esphome config` on a test project's device, with its external source swapped for `src`
          validate = dir: device: external: ''
            (
              cd ${dir}
              export ESPHOME_LOCAL_EXTERNALS=${
                pkgs.lib.escapeShellArg (builtins.toJSON { ${external.source} = "${external.src}/components"; })
              }
              mkdir -p $TMPDIR/config/${device}
              node --conditions=esphome-config-source ../../src/cli.ts build ${device} \
                > $TMPDIR/config/${device}/${device}.yaml
              node --conditions=esphome-config-source ../../src/cli.ts build ${device} --secrets \
                > $TMPDIR/config/${device}/secrets.yaml
              cd $TMPDIR/config/${device}
              esphome config ${device}.yaml > validated.txt 2>&1 || { cat validated.txt; exit 1; }
              echo "${device}: valid" >> $out
            )
          '';
        in
        {
          inherit package;
          # each test device with a golden YAML passes `esphome config`
          devices = package.overrideAttrs (old: {
            pname = "esphome-config-devices";
            nativeBuildInputs = old.nativeBuildInputs ++ [ (esphomeFor pkgs) ];
            buildPhase = "pnpm generate";
            doCheck = false;
            installPhase = ''
              export HOME=$TMPDIR ESPHOME_DEVICES=test/devices
              mkdir config
              for yaml in test/devices/*.yaml; do
                device=$(basename "$yaml" .yaml)
                node src/cli.ts build "$device" > "config/$device.yaml"
                node src/cli.ts build "$device" --secrets > config/secrets.yaml
                (cd config && esphome config "$device.yaml" > validated.txt 2>&1) \
                  || { cat config/validated.txt; exit 1; }
                echo "$device: valid" >> $out
              done
            '';
          });
          # external component types from ESPHome's own dump, used by test projects
          external = package.overrideAttrs (old: {
            pname = "esphome-config-external";
            nativeBuildInputs = old.nativeBuildInputs ++ [ (esphomeFor pkgs) ];
            buildPhase = ''
              export HOME=$TMPDIR
              pnpm generate
              rm -rf test/consumer/generated/external
              cp -r ${mkExternalTypes [ fixture ]} test/consumer/generated/external
              mkdir -p test/roode/generated
              cp -r ${mkExternalTypes [ roode ]} test/roode/generated/external
              chmod -R u+w test/consumer/generated test/roode/generated
            '';
            # the types tests are `@ts-expect-error` lines, and the fixture has a golden YAML
            checkPhase = ''
              pnpm typecheck
              node_modules/.bin/tsc -p test/roode
              node --conditions=esphome-config-source --test test/external.test.ts
              (cd test/roode && node --conditions=esphome-config-source ../../src/cli.ts build roode32) \
                | diff - test/roode/devices/roode32.yaml
            '';
            installPhase = ''
              ${validate "test/consumer" "external-fixture" fixture}
              ${validate "test/roode" "roode32" roode}
            '';
          });
        }
      );

      # for consumers; see the README
      lib = {
        mkExternalTypes =
          { system, externalComponents }:
          mkExternalTypesFor nixpkgs.legacyPackages.${system} externalComponents;
        mkProject =
          { system, ... }@args: mkProjectFor nixpkgs.legacyPackages.${system} (removeAttrs args [ "system" ]);
      };

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_24
            pkgs.pnpm
            (esphomeFor pkgs)
          ];
          # `pnpm generate` reads the pinned schema from here instead of downloading it
          env.ESPHOME_SCHEMA = "${schemaFor pkgs}";
          shellHook = ''
            git rev-parse --git-dir >/dev/null 2>&1 && git config core.hooksPath .githooks
          '';
        };
      });
    };
}
