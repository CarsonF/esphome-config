{
  lib,
  stdenv,
  nodejs_24,
  pnpm,
  pnpmConfigHook,
  makeWrapper,
  pnpmDeps,
  schema,
}:
let
  manifest = lib.importJSON ../package.json;
in
stdenv.mkDerivation (finalAttrs: {
  pname = "esphome-config";
  inherit (manifest) version;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
      ../tsconfig.json
      ../tsconfig.build.json
      ../src
      ../test
    ];
  };

  inherit pnpmDeps;

  nativeBuildInputs = [
    nodejs_24
    pnpm
    pnpmConfigHook
    makeWrapper
  ];

  env.ESPHOME_SCHEMA = "${schema}";

  buildPhase = ''
    runHook preBuild
    pnpm generate
    pnpm build
    runHook postBuild
  '';

  doCheck = true;
  checkPhase = ''
    runHook preCheck
    pnpm typecheck
    pnpm test
    runHook postCheck
  '';

  installPhase = ''
    runHook preInstall
    dir=$out/lib/node_modules/esphome-config
    mkdir -p $dir
    cp -r dist package.json node_modules $dir
    makeWrapper ${lib.getExe nodejs_24} $out/bin/esphome-config --add-flags $dir/dist/cli.js
    runHook postInstall
  '';

  passthru = { inherit schema; };

  meta = {
    description = manifest.description;
    homepage = "https://github.com/CarsonF/esphome-config";
    license = lib.licenses.mit;
    mainProgram = "esphome-config";
  };
})
