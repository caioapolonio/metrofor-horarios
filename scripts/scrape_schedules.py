# /// script
# requires-python = ">=3.12"
# dependencies = ["pdfplumber>=0.11"]
# ///
"""Fetch the official timetables from info.metrofor.ce.gov.br.

For every line, it downloads the "Tabela de Horários" PDF for each of the next
days, parses the grid and keeps each distinct timetable once. Every weekday
points to its usual timetable; dates that differ are listed as exceptions.

Usage: uv run scripts/scrape_schedules.py [--from-dir DIR] [--weeks 3]
Writes: src/data/schedules.json
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import html
import io
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from http.cookiejar import CookieJar
from pathlib import Path

import pdfplumber

BASE = "https://info.metrofor.ce.gov.br"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
LINE_IDS = [1, 2, 3, 4, 5, 6, 7]
FORTALEZA = timezone(timedelta(hours=-3))
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "schedules.json"
TIME_RE = re.compile(r"^\d{2}:\d{2}$")
WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()


class Session:
    def __init__(self) -> None:
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(CookieJar())
        )

    def request(self, path: str, data: dict | None = None, referer: str = BASE + "/") -> bytes:
        body = urllib.parse.urlencode(data).encode() if data is not None else None
        req = urllib.request.Request(
            BASE + path, data=body, headers={"User-Agent": UA, "Referer": referer}
        )
        with self.opener.open(req, timeout=180) as res:
            return res.read()

    def line_page(self, line_id: int) -> str:
        home = self.request("/").decode()
        token = csrf(home)
        return self.request(
            "/horarios",
            {
                "csrfmiddlewaretoken": token,
                "pk": line_id,
                "estacao_origem": 0,
                "estacao_destino": 0,
                "dt_viagem": "",
                "latitude": "",
                "longitude": "",
            },
        ).decode()

    def timetable_pdf(self, line_id: int, day: datetime) -> bytes:
        page = self.line_page(line_id)
        return self.request(
            "/grade_horarios_to_pdf",
            {
                "csrfmiddlewaretoken": csrf(page),
                "pk": line_id,
                "rota": "",
                "latitude": "",
                "longitude": "",
                "to_pdf": 1,
                "estacao_origem": 0,
                "estacao_destino": 0,
                "dt_viagem": day.strftime("%Y-%m-%dT04:00"),
            },
            referer=BASE + "/horarios",
        )


def csrf(page: str) -> str:
    m = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', page)
    if not m:
        raise RuntimeError("csrf token not found")
    return m.group(1)


def parse_line_page(page: str) -> dict:
    """Line name, stations (official order and ids), fares and integrations."""
    page = re.sub(r"<svg.*?</svg>", "", page, flags=re.S)
    name = re.search(r'<p class="text-center fs-4 fw-bold lh-1">([^<]+)</p>', page).group(1)
    route = re.search(r'<p class="text-center fs-6 fw-bold lh-1">\(([^<]+)\)</p>', page).group(1)

    origin = re.search(r'<select id="estacao_origem".*?</select>', page, flags=re.S).group(0)
    stations = [
        {"id": int(v), "name": html.unescape(n).strip()}
        for v, n in re.findall(r'<option value="(\d+)">([^<]+)</option>', origin)
        if v != "0"
    ]

    dest = re.search(r'<select id="estacao_destino".*?</select>', page, flags=re.S).group(0)
    groups: list[dict] = []
    for label in re.finditer(r'<optgroup class="btn-primary"\s+label="([^"]+)"></optgroup>', dest):
        rest = dest[label.end():]
        fare = re.search(r'<optgroup class="btn-primary small"\s*label="\s*([^"]*?)\s*">', rest)
        ids = re.search(r"<optgroup>(.*?)</optgroup>", rest, flags=re.S)
        groups.append(
            {
                "line": html.unescape(label.group(1)).strip(),
                "fare": re.sub(r"\s+", " ", html.unescape(fare.group(1))).strip() if fare else None,
                "stationIds": [int(v) for v in re.findall(r'<option value="(\d+)">', ids.group(1))]
                if ids
                else [],
            }
        )

    about = re.search(r'href="(https://www\.ce\.gov\.br/metrofor/[^"]+)" target="_blank" title="Mais Informa', page)
    no_schedule = "Escalas não cadastradas" in page
    return {
        "name": html.unescape(name).strip(),
        "route": html.unescape(route).strip(),
        "stations": stations,
        "fare": groups[0]["fare"] if groups else None,
        "integrations": [
            {"line": g["line"], "fare": g["fare"], "stationIds": g["stationIds"]} for g in groups[1:]
        ],
        "aboutUrl": about.group(1) if about else None,
        "hasScheduleToday": not no_schedule,
    }


def parse_pdf(data: bytes, stations: list[dict]) -> list[dict]:
    """Return one entry per direction with the station order and the trips."""
    by_name = {norm(s["name"]): s["id"] for s in stations}
    directions: dict[str, dict] = {}
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except Exception:
        return []
    with pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            m = re.search(r"SENTIDO (.+?) ATÉ (.+)", text)
            if not m:
                continue
            key = f"{m.group(1).strip()}|{m.group(2).strip()}"
            words = page.extract_words(keep_blank_chars=True, x_tolerance=2, y_tolerance=2)
            rows: dict[int, list[dict]] = {}
            for w in words:
                rows.setdefault(round(w["top"] / 3), []).append(w)
            header = None
            columns: list[tuple[float, int]] = []
            for top in sorted(rows):
                line = sorted(rows[top], key=lambda w: w["x0"])
                if line and line[0]["text"].strip() == "Viagem":
                    header = line
                    columns = []
                    for w in line[1:]:
                        sid = by_name.get(norm(w["text"]))
                        if sid is None:
                            raise RuntimeError(f"unknown station in header: {w['text']!r}")
                        columns.append(((w["x0"] + w["x1"]) / 2, sid))
                    continue
                if header is None or not line or not re.fullmatch(r"\d{1,3}", line[0]["text"].strip()):
                    continue
                times = [w for w in line[1:] if TIME_RE.match(w["text"].strip())]
                if not times:
                    continue
                trip: dict[int, str] = {}
                for w in times:
                    cx = (w["x0"] + w["x1"]) / 2
                    sid = min(columns, key=lambda c: abs(c[0] - cx))[1]
                    trip[sid] = w["text"].strip()
                d = directions.setdefault(
                    key,
                    {"from": m.group(1).strip(), "to": m.group(2).strip(), "stationIds": [c[1] for c in columns], "trips": []},
                )
                d["trips"].append([trip.get(sid) for sid in d["stationIds"]])
    return list(directions.values())


def upcoming_days(count: int) -> list[datetime]:
    today = datetime.now(FORTALEZA).replace(hour=0, minute=0, second=0, microsecond=0)
    return [today + timedelta(days=i) for i in range(1, count + 1)]


def scrape(from_dir: Path | None, weeks: int) -> dict:
    session = Session()
    days = upcoming_days(weeks * 7)
    lines = []
    for line_id in LINE_IDS:
        info = parse_line_page(session.line_page(line_id))
        print(f"[{line_id}] {info['name']}: {len(info['stations'])} stations", file=sys.stderr)

        def fetch(day: datetime, line_id=line_id) -> bytes:
            if from_dir:
                path = from_dir / f"{line_id}_{day:%Y-%m-%d}.pdf"
                if path.exists():
                    return path.read_bytes()
            data = Session().timetable_pdf(line_id, day)
            if from_dir:
                from_dir.mkdir(parents=True, exist_ok=True)
                (from_dir / f"{line_id}_{day:%Y-%m-%d}.pdf").write_bytes(data)
            return data

        with cf.ThreadPoolExecutor(max_workers=4) as pool:
            pdfs = list(pool.map(fetch, days))

        # One entry per distinct timetable; None means no service that day
        variants: list[list[dict]] = []
        by_date: dict[str, int | None] = {}
        for day, data in zip(days, pdfs):
            directions = parse_pdf(data, info["stations"])
            if not directions:
                by_date[day.strftime("%Y-%m-%d")] = None
                continue
            digest = hashlib.sha1(json.dumps(directions, sort_keys=True).encode()).hexdigest()
            keys = [hashlib.sha1(json.dumps(v, sort_keys=True).encode()).hexdigest() for v in variants]
            if digest not in keys:
                variants.append(directions)
                keys.append(digest)
            by_date[day.strftime("%Y-%m-%d")] = keys.index(digest)

        # The regular timetable of a weekday is the one most days share;
        # the dates that disagree (holidays, elections...) become exceptions
        weekly: dict[str, int | None] = {}
        for i, wd in enumerate(WEEKDAYS):
            seen = [v for d, v in by_date.items() if datetime.fromisoformat(d).weekday() == i]
            weekly[wd] = Counter(seen).most_common(1)[0][0] if seen else None
        exceptions = [
            {"date": d, "variant": v}
            for d, v in by_date.items()
            if v != weekly[WEEKDAYS[datetime.fromisoformat(d).weekday()]]
        ]
        summary = " ".join(f"{wd}={'-' if v is None else v}" for wd, v in weekly.items())
        print(f"    {len(variants)} timetables, weekly {summary}, exceptions {exceptions}", file=sys.stderr)

        lines.append(
            {
                "id": line_id,
                **info,
                "timetables": [{"directions": v} for v in variants],
                "weekly": weekly,
                "exceptions": exceptions,
            }
        )
    return {
        "source": BASE,
        "fetchedAt": datetime.now(FORTALEZA).isoformat(timespec="minutes"),
        "validFrom": days[0].strftime("%Y-%m-%d"),
        "validUntil": days[-1].strftime("%Y-%m-%d"),
        "lines": lines,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-dir", type=Path, help="cache PDFs in this folder")
    parser.add_argument("--weeks", type=int, default=3, help="how many weeks ahead to read")
    args = parser.parse_args()
    data = scrape(args.from_dir, args.weeks)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
