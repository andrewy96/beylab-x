/**
 * ETL for the Beyblade X parts catalog.
 *
 * Pulls the community-maintained public Google Sheet behind
 * https://stan-yao.github.io/beyblade_x_tier/ (credits: @RENLIgames / @anguzyao_),
 * downloads every part image locally, and writes src/data/generated.json.
 *
 * Usage: npm run fetch-data
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as OpenCC from "opencc-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHEET_ID = "1TBHOpcsv25bBfWERq14CBIy4P1G7j-qpPhmclx_nTWI";
const BLADES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const PARTS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("零件圖鑑")}`;

const toHans = OpenCC.Converter({ from: "tw", to: "cn" });

/** Minimal RFC-4180 CSV parser. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const clean = (v) => (v ?? "").trim();
const isEmpty = (v) => clean(v) === "" || clean(v) === "-";
const hash8 = (s) => createHash("md5").update(s).digest("hex").slice(0, 8);

/** Find column index whose header contains the given token, e.g. "(ID)". */
function col(headers, token) {
  const i = headers.findIndex((h) => h.includes(token));
  if (i === -1) throw new Error(`Column not found: ${token} in [${headers.join(" | ")}]`);
  return i;
}

function slugifyAscii(id) {
  return id
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return parseCsv(await res.text());
}

const exists = (p) => access(p).then(() => true, () => false);

async function downloadImage(url, destNoExt) {
  const extMatch = /\.(png|jpe?g|webp|gif)(\?|$)/i.exec(url);
  const ext = extMatch ? extMatch[1].toLowerCase().replace("jpeg", "jpg") : "png";
  const dest = `${destNoExt}.${ext}`;
  const rel = "/" + path.relative(path.join(ROOT, "public"), dest).split(path.sep).join("/");
  if (await exists(dest)) return { rel, skipped: true };
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image ${res.status}: ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return { rel, skipped: false };
}

async function downloadAll(items) {
  // items: [{ url, destNoExt, assign(relPath) }]
  const failures = [];
  let done = 0;
  const queue = [...items];
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      try {
        const { rel } = await downloadImage(item.url, item.destNoExt);
        item.assign(rel);
      } catch (err) {
        failures.push({ url: item.url, error: String(err) });
        item.assign(null);
      }
      done++;
      if (done % 25 === 0) console.log(`  images: ${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return failures;
}

async function main() {
  console.log("Fetching sheets...");
  const [bladeRows, partRows] = await Promise.all([fetchCsv(BLADES_URL), fetchCsv(PARTS_URL)]);

  // ---- Blades tab ----
  const bh = bladeRows[0];
  const B = {
    id: col(bh, "(ID)"),
    name: col(bh, "(Name)"),
    category: col(bh, "(Category)"),
    type: col(bh, "(Type)"),
    tier: col(bh, "(Tier)"),
    buy: col(bh, "(Buy)"),
    ratchet: col(bh, "(Ratchet)"),
    ratchetTier: col(bh, "(Ratchet Tier)"),
    bit: col(bh, "(Bit)"),
    bitTier: col(bh, "(Bit Tier)"),
    assist: col(bh, "(Assist Blade"),
    source: col(bh, "(Source)"),
    img: col(bh, "(Img)"),
    combo: col(bh, "(Combo)"),
  };

  const blades = [];
  for (const r of bladeRows.slice(1)) {
    if (clean(r[B.category]) !== "blade") continue;
    const zhHant = clean(r[B.name]) || clean(r[B.id]);
    if (!zhHant) continue;
    blades.push({
      sheetId: clean(r[B.id]) || zhHant,
      zhHant,
      zhHans: toHans(zhHant),
      type: clean(r[B.type]).toLowerCase() || "unknown",
      tier: isEmpty(r[B.tier]) ? null : clean(r[B.tier]),
      buy: isEmpty(r[B.buy]) ? null : clean(r[B.buy]),
      stockRatchet: isEmpty(r[B.ratchet]) ? null : clean(r[B.ratchet]),
      ratchetTier: isEmpty(r[B.ratchetTier]) ? null : clean(r[B.ratchetTier]),
      stockBit: isEmpty(r[B.bit]) ? null : clean(r[B.bit]),
      bitTier: isEmpty(r[B.bitTier]) ? null : clean(r[B.bitTier]),
      stockAssist: isEmpty(r[B.assist]) ? null : clean(r[B.assist]),
      source: isEmpty(r[B.source]) ? null : clean(r[B.source]),
      sourceHans: isEmpty(r[B.source]) ? null : toHans(clean(r[B.source])),
      combos: isEmpty(r[B.combo]) ? null : clean(r[B.combo]),
      imageUrl: clean(r[B.img]) || null,
      image: null,
    });
  }

  // ---- Parts tab (ratchets / bits / assists) ----
  const ph = partRows[0];
  const P = { id: 0, category: col(ph, "(Category)"), img: col(ph, "(Img)") };
  const ratchets = [];
  const bits = [];
  const assists = [];
  for (const r of partRows.slice(1)) {
    const id = clean(r[P.id]);
    const cat = clean(r[P.category]);
    if (!id || !cat) continue;
    const entry = { id, imageUrl: clean(r[P.img]) || null, image: null };
    if (cat === "ratchet") ratchets.push(entry);
    else if (cat === "bit") bits.push(entry);
    else if (cat === "assist") assists.push({ ...entry, zhHant: id, zhHans: toHans(id) });
  }

  console.log(
    `Parsed: ${blades.length} blades, ${ratchets.length} ratchets, ${bits.length} bits, ${assists.length} assists`
  );

  // ---- Download images ----
  for (const cat of ["blade", "ratchet", "bit", "assist"]) {
    await mkdir(path.join(ROOT, "public", "parts", cat), { recursive: true });
  }
  const jobs = [];
  const usedSlugs = new Set();
  const uniqueSlug = (base) => {
    let s = base || "part";
    let n = 2;
    while (usedSlugs.has(s)) s = `${base}-${n++}`;
    usedSlugs.add(s);
    return s;
  };
  for (const b of blades) {
    if (!b.imageUrl) continue;
    jobs.push({
      url: b.imageUrl,
      destNoExt: path.join(ROOT, "public", "parts", "blade", hash8(b.sheetId + b.imageUrl)),
      assign: (rel) => (b.image = rel),
    });
  }
  for (const [cat, list] of [["ratchet", ratchets], ["bit", bits], ["assist", assists]]) {
    for (const p of list) {
      if (!p.imageUrl) continue;
      const base = slugifyAscii(p.id) || hash8(p.id);
      const slug = uniqueSlug(`${cat}-${base}`);
      jobs.push({
        url: p.imageUrl,
        destNoExt: path.join(ROOT, "public", "parts", cat, slug),
        assign: (rel) => (p.image = rel),
      });
    }
  }
  console.log(`Downloading ${jobs.length} images...`);
  const failures = await downloadAll(jobs);
  if (failures.length) {
    console.warn(`FAILED downloads (${failures.length}):`);
    for (const f of failures) console.warn(`  ${f.url} -> ${f.error}`);
  }

  // Drop temp fields
  for (const b of blades) delete b.imageUrl;
  for (const list of [ratchets, bits, assists]) for (const p of list) delete p.imageUrl;

  const out = {
    fetchedAt: new Date().toISOString(),
    source: `https://docs.google.com/spreadsheets/d/${SHEET_ID}`,
    blades,
    ratchets,
    bits,
    assists,
  };
  const dest = path.join(ROOT, "src", "data", "generated.json");
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
