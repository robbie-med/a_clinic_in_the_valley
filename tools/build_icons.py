#!/usr/bin/env python3
"""Extract the game-icons.net silhouettes we use into assets/icons.json ({name: "<svg path d>"}).

    node tools/used-icons.mjs | python3 tools/build_icons.py <path-to>/game-icons-repo

Each game-icons SVG is a 512x512 viewBox with a black background square and one white path;
we keep only the white path's `d` and draw it at runtime with Path2D, tinted per material.
Source: https://github.com/game-icons/icons (CC BY 3.0, authors credited in CREDITS.md).
"""
import json, os, re, sys

PATH_RE = re.compile(r'<path[^>]*?fill="#fff"[^>]*?\sd="([^"]+)"|<path[^>]*?\sd="([^"]+)"[^>]*?fill="#fff"')


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    root = sys.argv[1]
    index = {}
    for author in os.listdir(root):
        d = os.path.join(root, author)
        if os.path.isdir(d):
            for f in os.listdir(d):
                if f.endswith('.svg'):
                    index.setdefault(f[:-4], (author, os.path.join(d, f)))
    wanted = sorted({w.strip() for w in sys.stdin if w.strip()})
    out, authors, missing = {}, {}, []
    for name in wanted:
        if name not in index:
            missing.append(name)
            continue
        author, path = index[name]
        svg = open(path).read()
        ds = [a or b for a, b in PATH_RE.findall(svg)]
        if not ds:
            missing.append(name + ' (no white path)')
            continue
        out[name] = ' '.join(ds)
        authors.setdefault(author, []).append(name)
    if missing:
        sys.exit('missing icons: ' + ', '.join(missing))
    here = os.path.dirname(os.path.abspath(__file__))
    dst = os.path.join(os.path.dirname(here), 'assets', 'icons.json')
    with open(dst, 'w') as fh:
        json.dump(out, fh, separators=(',', ':'))
    with open(os.path.join(os.path.dirname(here), 'assets', 'icons-authors.json'), 'w') as fh:
        json.dump({a: sorted(n) for a, n in sorted(authors.items())}, fh, indent=1)
    print(f'{len(out)} icons -> assets/icons.json ({os.path.getsize(dst) // 1024} KB); authors: {", ".join(sorted(authors))}')


if __name__ == '__main__':
    main()
