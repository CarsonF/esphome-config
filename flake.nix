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
        }
      );

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
