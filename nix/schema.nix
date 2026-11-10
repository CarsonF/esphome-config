# ESPHome's language schema for one version, docs included, built from pinned sources:
# the structure from ESPHome's own script, run with nixpkgs' ESPHome of that version,
# and the docs from esphome.io's script at the release's tag, as esphome-schema builds it.
# A version missing from docs-hashes.json fails: scripts/bump-esphome.sh adds it.
{
  lib,
  stdenvNoCC,
  fetchFromGitHub,
  nodejs_24,
  pnpm,
  pnpmConfigHook,
  esphome,
  pnpmDeps,
}:
let
  inherit (esphome) version;
  hashes = lib.importJSON ./docs-hashes.json;
  docs = fetchFromGitHub {
    owner = "esphome";
    repo = "esphome.io";
    tag = version;
    hash =
      hashes.${version}
        or (throw "esphome-config: no esphome.io hash for ESPHome ${version} in docs-hashes.json");
    # the docs script and the pages it reads, without the site's images
    sparseCheckout = [
      "/script/"
      "/src/content/docs/**/*.md"
      "/src/content/docs/**/*.mdx"
    ];
    nonConeMode = true;
  };
in
stdenvNoCC.mkDerivation {
  pname = "esphome-schema";
  inherit version;

  # the remark packages esphome.io's Node docs script imports, from this repo's lockfile
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
    ];
  };
  inherit pnpmDeps;

  nativeBuildInputs = [
    nodejs_24
    pnpm
    pnpmConfigHook
    esphome
  ];

  buildPhase = ''
    runHook preBuild
    export HOME=$TMPDIR PYTHONDONTWRITEBYTECODE=1
    # ESPHome's script lists enum values from sets, whose order otherwise changes per run
    export PYTHONHASHSEED=0
    python3 ${esphome.src}/script/build_language_schema.py --output-path $TMPDIR/schema
    cp -r ${docs} $TMPDIR/docs
    chmod -R u+w $TMPDIR/docs
    ln -s $PWD/node_modules $TMPDIR/docs/node_modules
    cd $TMPDIR/docs
    # esphome.io moved its docs script from Python to Node in 2026.10
    if [ -f script/schema_doc.mjs ]; then
      node script/schema_doc.mjs --schema-dir ../schema --emit ../schema \
        --deploy-url https://esphome.io
    else
      python3 script/schema_doc.py ../schema --deploy-url https://esphome.io
    fi
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    cp -r $TMPDIR/schema $out
    runHook postInstall
  '';

  passthru = { inherit docs; };
}
