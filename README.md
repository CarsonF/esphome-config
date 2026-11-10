# esphome-config

Write [ESPHome](https://esphome.io) configs in TypeScript.
Types and doc comments come from ESPHome's own language schema,
so a wrong key or option value is a compile error instead of an `esphome config` failure.

```ts
// devices/demo-fan.ts
import { construct, esp, log, secret, type InternalPin } from 'esphome-config';

/** A fan on a PWM pin, with children `<id>_output` and `<id>_fan`. */
const pwmFan = construct('pwm_fan', (props: { id?: string; name: string; pin: InternalPin }) => {
  const output = esp.output.ledc({ id: 'output', pin: props.pin });
  return esp.fan.speed({ id: 'fan', name: props.name, output });
});

export default esp.device('demo-fan', () => {
  esp.esp32({ board: 'esp32dev', framework: { type: 'esp-idf' } });
  esp.wifi({ ssid: secret('wifi_ssid'), password: secret('wifi_password') });
  esp.api({});
  esp.logger({ level: 'INFO' });

  const tooHot = esp.global({ id: 'too_hot', initial_value: false });
  const cooler = pwmFan({ name: 'Cooler', pin: 'GPIO5' });

  const temp = esp.sensor.adc({ name: 'Temperature', pin: 'GPIO34', update_interval: '10s' });
  temp.on_value(
    tooHot.assign('x > 30.0'),
    cooler.turn_on(),
    log.info('fan', 'too hot: %d', tooHot),
  );
});
```

```sh
esphome-config build demo-fan > demo-fan.yaml
esphome-config build demo-fan --secrets > secrets.yaml  # dummy values, for `esphome config`
```

## Install

Needs Node 24 or newer.
Each release attaches a package tarball; depend on its URL:

```sh
pnpm add https://github.com/CarsonF/esphome-config/releases/download/v<version>/esphome-config-<version>.tgz
```

A version follows the ESPHome release its types are for: `2026.9.n` is for ESPHome 2026.9.x.
The exact ESPHome version is exported as `ESPHOME_VERSION`.
Breaking changes only come with a new ESPHome month.

Devices run on Node's built-in TypeScript support, so they use only erasable syntax.
A `tsconfig.json` for a project of devices:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "target": "ESNext",
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["devices", "generated"]
}
```

## Writing devices

A device is `devices/<name>.ts` or `devices/<name>/index.ts`, and its default export is
`esp.device(name, build)`.
`ESPHOME_DEVICES` sets another directory.

- `esp.<domain>.<platform>(props)` and `esp.<component>(props)` create entities:
  `esp.sensor.adc(...)`, `esp.wifi(...)`.
- An entity's actions and conditions are its methods: `cooler.turn_on()`, `sw.is_on()`.
  Other steps are under `esp.actions` and `esp.conditions`.
- Triggers are methods (`temp.on_value(...)`) or props (`on_value: [...]`);
  a trigger with options takes `{ then, ...options }`.
- `` esp.lambda`...` `` writes a `!lambda`, where an interpolated entity becomes `id(<its id>)`.
- A step can be a function returning steps, which runs when the YAML renders:
  use it to name an entity created further down.

### Ids

An entity's id is its `id` prop, else made from its `name`.
`construct(label, build)` makes a reusable group whose entities are named under it:
`pwmFan({ name: 'Cooler', ... })` creates `cooler_output` and `cooler_fan`.
Ids only reach the YAML when something refers to the entity.

## TypeScript lambdas

`esp.cpp(fn)` writes a `!lambda` from a TypeScript function:

```ts
import { esp } from 'esphome-config';
import { id, millis, type u8 } from 'esphome-config/cpp';

const HOLD_MS = 30_000;
const startedMs = esp.global({ id: 'started_ms', initial_value: 0, type: 'uint32_t' });
const tooHot = esp.global({ id: 'too_hot', initial_value: false });

// `x` is the trigger's argument, typed from the trigger
temp.on_value(esp.cpp((x) => { id(tooHot).value = x > 30.0; }));
// a condition returns a boolean
const holding = esp.cpp(() => millis() - id(startedMs).value < HOLD_MS);
const start = esp.cpp(() => {
  const level: u8 = 2;
  id(startedMs).value = millis() + level;
});
```

- `esphome-config/cpp` has what a body uses: `id`, ESPHome's functions and the C++ number types.
- Entities and constants from the surrounding code are captured by name.
- `id(entity)` has the entity's C++ members, e.g. `id(temp).state`,
  and `id(global).value` is a global's value.
- ESPHome's `millis()`, `micros()` and `ESP_LOGD` (and the other levels) can be called,
  and `Math.min`, `Math.round` and the like become their C++ functions.
- A local annotated `u8`, `i32`, `f32`, `boolean` or `string` gets that C++ type, else `auto`.
- A body is a subset of TypeScript, and anything else fails the build, quoting the code.
  It only works under `esphome-config build`, whose loader reads each function's source.

`typescript` is a dependency of esphome-config, loaded only for device files that mention `cpp`.
It stays on TypeScript 5, whose compiler API the transpiler uses.

## External components

Types for third-party components come from their own schema, dumped by ESPHome itself.
List each source once, here (or in Nix, below):

```sh
esphome-config generate-external github://<owner>/<repo>@<ref> ./my-components
```

Devices then add a source with `esp.external.<name>()`, and never repeat its string:

```ts
esp.external.repo(); // the `external_components` entry, with all the source's components
esp.sensor.my_sensor({ name: 'Level', channel: 3 });
```

- A source is `github://<owner>/<repo>@<ref>`, as in `external_components`, or a local directory.
  Components are read from its `components/` directory, if it has one.
- `esp.external.<name>()` is named after the repo or directory, or `--name <name>` after the source.
  It takes some of the source's components, like `esp.external.repo('my_sensor')`, or all of them.
  Calling it again, from any device or construct, adds to the same entry.
- `--path <dir>` after a source reads its files from `<dir>`, instead of fetching them.
- It writes `generated/external` (or `--out <dir>`), which `esphome-config build` loads,
  so `esp` has the new components; commit it or regenerate it, as you like.
- It needs ESPHome from the month the package's types are for, and fails if it finds another.
  It runs the Python of the `esphome` command, or `ESPHOME_PYTHON`.
- `esp.external_component({ source, ... })` still adds a source that isn't listed.
- The core schema ships with the package, the one its types were generated from;
  ESPHome's schema script is downloaded once, and cached under `~/.cache/esphome-config`.

## Your own npm dependencies

A device file is a Node program, so it can import any package you add:
a YAML or CSV of your pins, a helper to compute filter coefficients.
They run when the YAML is built, not on the chip:
a lambda is C++ on the device, so it can only use what ESPHome and its libraries provide.

## Nix

Nix is optional; the flake wraps the same CLI with pinned inputs.
`lib.mkProject` builds a project's devices, with external component types made in the sandbox:

```nix
{
  inputs.esphome-config.url = "github:CarsonF/esphome-config/v<version>";

  outputs =
    { esphome-config, nixpkgs, ... }:
    let
      system = "x86_64-linux";
      project = esphome-config.lib.mkProject {
        inherit system;
        src = ./.;
        # pnpm-lock.yaml's dependencies, pinned: see "Updating pnpmDepsHash" below
        pnpmDepsHash = "sha256-...";
        externalComponents = [
          rec {
            rev = "<ref>";
            src = nixpkgs.legacyPackages.${system}.fetchFromGitHub {
              owner = "<owner>";
              repo = "<repo>";
              inherit rev;
              hash = "sha256-...";
            };
            # the YAML's source, which the check swaps for `src`, offline
            source = "github://<owner>/<repo>@${rev}";
            # devices call `esp.external.<name>()`; the repo's name if omitted
            name = "my_components";
          }
        ];
      };
    in
    {
      packages.${system}.default = project.configs; # result/<device>/<device>.yaml
      checks.${system}.devices = project.check; # `esphome config` on each device
      devShells.${system}.default = project.devShell; # with generated/external in place
    };
}
```

- Use the flake input of the same release as the package in package.json:
  the build fails if their ESPHome versions differ.
- Each source is listed only here: devices add it with `esp.external.<name>()`.
- `lib.mkExternalTypes { system; externalComponents; }` is just the `generated/external` directory.
- Don't `nix run` the flake's CLI on your devices.
  It would load its own copy of the library beside the one your devices import,
  and entities would not find their device; `mkProject` runs the CLI from your `node_modules`.

### Updating pnpmDepsHash

After a change to pnpm-lock.yaml, the old `pnpmDepsHash` still names the old dependencies,
which Nix reuses instead of fetching the new ones.
The build then fails with `ERR_PNPM_NO_OFFLINE_TARBALL` and never prints the new hash.
Set a fake hash first, `sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`,
build, and copy the hash after `got:`.
This script does that for a `pnpmDepsHash = "..."` line in flake.nix (GNU grep and sed):

```sh
#!/usr/bin/env bash
# Sets pnpmDepsHash in flake.nix to the hash of pnpm-lock.yaml's dependencies.
set -euo pipefail
fake=sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
old=$(grep -oP 'pnpmDepsHash = "\K[^"]+' flake.nix)
set_hash() { sed -i "s|pnpmDepsHash = \"[^\"]*\"|pnpmDepsHash = \"$1\"|" flake.nix; }

set_hash "$fake"
new=$(nix build .#default --no-link 2>&1 | grep -oP 'got:\s+\Ksha256-\S+' | head -n1 || true)
if [ -z "$new" ]; then
  set_hash "$old"
  echo "the build printed no hash, so it failed for another reason: run nix build" >&2
  exit 1
fi
set_hash "$new"
echo "pnpmDepsHash = $new"
```
