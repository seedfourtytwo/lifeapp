#!/usr/bin/env python3
"""Cut the lock-screen widget's tracker icons out of the MaterialCommunityIcons font.

The widget draws a tracker's icon natively, where the app's icon font is not
loaded. This keeps only the curated picker icons (src/protocol/trackerIcons.ts)
and writes, in modules/life-core/android/src/main/res:

  font/life_core_tracker_icons.ttf   the cut font
  raw/life_core_tracker_icons.json   icon name -> code point

`__tests__/widgetTrackerIcons.test.ts` fails when either drifts from the
picker or the shipped font. Run again after changing the picker's icons:

  python3 scripts/build-widget-icons.py

Needs fontTools (`pip install fonttools`).
"""

import json
import re
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons"
RES = ROOT / "modules/life-core/android/src/main/res"


def picker_icons() -> list[str]:
    source = (ROOT / "src/protocol/trackerIcons.ts").read_text()
    custom = set(re.findall(r"'([a-z0-9-]+)'", re.search(r"CUSTOM_TRACKER_ICON_IDS = \[(.*?)\]", source, re.S).group(1)))
    names: list[str] = []
    for block in ("TRACKER_ICON_FEATURED_IDS", "TRACKER_ICON_MORE_IDS"):
        body = re.search(rf"{block} = \[(.*?)\] as const", source, re.S).group(1)
        names += [name for name in re.findall(r"'([a-z0-9-]+)'", body) if name not in custom]
    return names


def main() -> None:
    glyphs = json.loads((VENDOR / "glyphmaps/MaterialCommunityIcons.json").read_text())
    names = picker_icons()
    points = {name: glyphs[name] for name in names}

    options = subset.Options()
    options.layout_features = []
    options.name_IDs = ["*"]
    options.notdef_outline = True
    font = subset.load_font(str(VENDOR / "Fonts/MaterialCommunityIcons.ttf"), options)
    cutter = subset.Subsetter(options)
    cutter.populate(unicodes=sorted(set(points.values())))
    cutter.subset(font)
    (RES / "font").mkdir(exist_ok=True)
    subset.save_font(font, str(RES / "font/life_core_tracker_icons.ttf"), options)

    (RES / "raw").mkdir(exist_ok=True)
    (RES / "raw/life_core_tracker_icons.json").write_text(json.dumps(points, indent=2, sort_keys=True) + "\n")
    print(f"{len(points)} icons")


if __name__ == "__main__":
    main()
