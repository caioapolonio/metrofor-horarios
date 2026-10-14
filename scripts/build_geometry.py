# /// script
# requires-python = ">=3.12"
# ///
"""Build line paths and station coordinates from OpenStreetMap.

Each Metrofor line has a route relation in OSM. This chains the relation's
ways into one polyline, trims it to the first and last stations, and pairs
the OSM stop nodes with the stations listed in src/data/schedules.json
(both lists follow the line order).

Usage: uv run scripts/build_geometry.py [--cache DIR]
Writes: src/data/geometry.json
"""

from __future__ import annotations

import argparse
import difflib
import json
import math
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEDULES = ROOT / "src" / "data" / "schedules.json"
OUT = ROOT / "src" / "data" / "geometry.json"
UA = "metrofor-horarios-script/0.1"
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Metrofor line id -> OSM route relation (one direction is enough for the path)
RELATIONS = {
    1: 6113027,  # Linha Sul: Chico da Silva => Carlito Benevides
    2: 4511795,  # Linha Oeste: Moura Brasil => Caucaia
    3: 4511811,  # Linha Nordeste (Parangaba-Mucuripe): Parangaba => Iate
    4: 3809395,  # VLT Sobral Linha Norte: Novo Recanto => Cohab III
    5: 7615994,  # VLT Sobral Linha Sul: Cohab II => Sumaré
    6: 8251567,  # VLT Cariri: Fátima => Crato
    7: 20187272,  # Ramal Aeroporto: Expedicionários => Castelão (service ends at Aeroporto)
}


def http_get(url: str, data: dict | None = None) -> bytes:
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as res:
        return res.read()


def cached(cache: Path | None, name: str, fetch) -> dict:
    if cache and (cache / name).exists():
        return json.loads((cache / name).read_text())
    data = fetch()
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
        (cache / name).write_text(json.dumps(data))
    return data


def overpass(query: str) -> dict:
    last = None
    for url in OVERPASS:
        try:
            return json.loads(http_get(url, {"data": query}))
        except Exception as e:  # busy servers answer with HTML
            last = e
            print(f"  overpass failed at {url}: {e}", file=sys.stderr)
    raise RuntimeError(f"all overpass servers failed: {last}")


def dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Approximate distance in meters."""
    lat = math.radians((a[0] + b[0]) / 2)
    dx = (b[1] - a[1]) * 111_320 * math.cos(lat)
    dy = (b[0] - a[0]) * 110_540
    return math.hypot(dx, dy)


def chain(ways: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    """Join ordered ways into a single line, flipping each one as needed."""
    path = list(ways[0])
    if len(ways) > 1:
        nxt = ways[1]
        if min(dist(path[0], nxt[0]), dist(path[0], nxt[-1])) < min(dist(path[-1], nxt[0]), dist(path[-1], nxt[-1])):
            path.reverse()
    for way in ways[1:]:
        if dist(path[-1], way[-1]) < dist(path[-1], way[0]):
            way = way[::-1]
        path.extend(way[1:] if dist(path[-1], way[0]) < 1 else way)
    return path


def nearest_index(path: list[tuple[float, float]], p: tuple[float, float]) -> int:
    return min(range(len(path)), key=lambda i: dist(path[i], p))


def simplify(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Douglas-Peucker with the tolerance in meters."""
    if len(points) < 3:
        return points
    ref = points[0]
    kx = 111_320 * math.cos(math.radians(ref[0]))
    xy = [((p[1] - ref[1]) * kx, (p[0] - ref[0]) * 110_540) for p in points]

    def seg_dist(p, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        if dx == dy == 0:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = 0.0, -1
        for k in range(i + 1, j):
            d = seg_dist(xy[k], xy[i], xy[j])
            if d > best:
                best, idx = d, k
        if best > tolerance:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(points, keep) if k]


def similarity(a: list[str], b: list[str]) -> float:
    return sum(difflib.SequenceMatcher(None, norm(x), norm(y)).ratio() for x, y in zip(a, b))


def norm(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, help="reuse OSM responses saved in this folder")
    args = parser.parse_args()

    schedules = json.loads(SCHEDULES.read_text())
    ids = ",".join(str(r) for r in RELATIONS.values())
    rels = cached(args.cache, "relations.json", lambda: overpass(f"[out:json][timeout:150];relation(id:{ids});out geom;"))
    rel_by_id = {e["id"]: e for e in rels["elements"]}
    node_ids = ",".join(
        str(m["ref"]) for e in rels["elements"] for m in e["members"] if m["type"] == "node"
    )
    nodes = cached(
        args.cache,
        "stops.json",
        lambda: json.loads(http_get(f"https://api.openstreetmap.org/api/0.6/nodes.json?nodes={node_ids}")),
    )
    names = {e["id"]: e.get("tags", {}).get("name", "") for e in nodes["elements"]}

    out = {"source": "OpenStreetMap contributors (ODbL)", "lines": {}}
    for line in schedules["lines"]:
        rel = rel_by_id[RELATIONS[line["id"]]]
        ways = [
            [(g["lat"], g["lon"]) for g in m["geometry"]]
            for m in rel["members"]
            if m["type"] == "way" and m["role"] == "" and m.get("geometry")
        ]
        stops = [
            {"osm": m["ref"], "name": names.get(m["ref"], ""), "pos": (m["lat"], m["lon"])}
            for m in rel["members"]
            if m["type"] == "node" and m["role"].startswith("stop")
        ]
        stations = line["stations"]
        if len(stops) < len(stations):
            raise RuntimeError(f"{line['name']}: {len(stops)} OSM stops for {len(stations)} stations")
        stops = stops[: len(stations)]  # the airport branch continues past the last served stop

        # Metrofor lists stations in its own order; flip the OSM stops when needed
        official = [s["name"] for s in stations]
        if similarity(official, [s["name"] for s in stops[::-1]]) > similarity(official, [s["name"] for s in stops]):
            stops.reverse()

        path = chain(ways)
        a = nearest_index(path, stops[0]["pos"])
        b = nearest_index(path, stops[-1]["pos"])
        path = path[min(a, b) : max(a, b) + 1]
        if a > b:
            path.reverse()
        path = simplify(path, 4)

        pairs = []
        for st, stop in zip(stations, stops):
            pairs.append(
                {
                    "id": st["id"],
                    "name": st["name"],
                    "osmName": stop["name"],
                    "lat": round(stop["pos"][0], 6),
                    "lng": round(stop["pos"][1], 6),
                }
            )
            print(f"  {st['name']:<24} <- {stop['name']}", file=sys.stderr)
        length = sum(dist(path[i], path[i + 1]) for i in range(len(path) - 1))
        print(f"[{line['id']}] {line['name']}: {len(path)} points, {length / 1000:.1f} km", file=sys.stderr)
        out["lines"][str(line["id"])] = {
            "osmRelation": rel["id"],
            "lengthKm": round(length / 1000, 1),
            "path": [[round(p[0], 6), round(p[1], 6)] for p in path],
            "stations": pairs,
        }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
