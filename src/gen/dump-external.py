"""Dump the schema of external components with ESPHome's own script."""

import sys
from pathlib import Path

import esphome.loader as loader

script, components_dir, out = sys.argv[1:4]
core = Path(loader.CORE_COMPONENTS_PATH)
external = sorted(p.name for p in Path(components_dir).iterdir() if (p / "__init__.py").is_file())
# the script assumes the core components are loaded (esp32, logger, lvgl, ...), so they all are
core_names = sorted(p.name for p in core.iterdir() if p.is_dir() and not p.name.startswith("__"))
names = sorted({*external, *core_names})
loader.install_meta_finder(Path(components_dir).resolve())
source = Path(script).read_text()
start = source.index("    return sorted(\n        [\n            d.name")
end = source.index("def load_components")
source = source[:start] + f"    return {names!r}\n\n\n" + source[end:]
sys.argv = [script, "--output-path", out]
exec(compile(source, script, "exec"), {"__name__": "__main__", "__file__": script})
