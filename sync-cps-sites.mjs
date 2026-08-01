// Sync CPS-unified projects (public.projects) into hr.sites — the attendance
// site pick-list + geofence source. CPS is the source of the site INVENTORY
// (name/code/address). Coordinates are ground-truth (admin pin / auto-calibrate),
// so this NEVER touches latitude/longitude/geocode_* on existing rows.
// Run: node sync-cps-sites.mjs         -> dry run (prints plan)
//      node sync-cps-sites.mjs --write -> apply
import pg from "pg";
import { readFileSync } from "fs";
const WRITE = process.argv.includes("--write");
const conns = JSON.parse(readFileSync(new URL("./db-connections.json", import.meta.url)));
const c = new pg.Client({ ...conns.company, ssl: { rejectUnauthorized: false } });
await c.connect();

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Physical sites employees attend: active CPS projects + office regions.
const projs = (await c.query(
  `select code, name, category, is_cps, site_address
   from public.projects
   where is_active and code <> 'OTHER' and category in ('project','office_region')
   order by name`
)).rows;

const sites = (await c.query(`select id, name, code, latitude, longitude from hr.sites`)).rows;
const byName = new Map(sites.map((s) => [norm(s.name), s]));
const byCode = new Map(sites.filter((s) => s.code).map((s) => [norm(s.code), s]));

function matchSite(p) {
  if (p.code && byCode.has(norm(p.code))) return byCode.get(norm(p.code));
  if (byName.has(norm(p.name))) return byName.get(norm(p.name));
  // CPS name is a more-generic form of an existing site (e.g. "Koko Town" is a
  // prefix of "KOKO Town, Chandigarh"): link, don't duplicate the pick-list.
  const pn = norm(p.name);
  for (const s of sites) { if (norm(s.name).startsWith(pn + " ")) return s; }
  return null; // otherwise a genuinely new site
}

const toUpdate = [], toInsert = [];
for (const p of projs) {
  const s = matchSite(p);
  const source = p.category === "office_region" ? "office" : "cps";
  if (s) toUpdate.push({ id: s.id, name: s.name, project_code: p.code, address: p.site_address, source });
  else if (p.site_address) toInsert.push({ name: p.name, code: p.code, address: p.site_address, source });
}

console.log(`CPS projects: ${projs.length} | hr.sites: ${sites.length}`);
console.log(`\n== LINK (update existing ${toUpdate.length}) ==`);
toUpdate.forEach((u) => console.log(`  ${u.name}  <-  ${u.project_code}`));
console.log(`\n== ADD (new site ${toInsert.length}) ==`);
toInsert.forEach((u) => console.log(`  + ${u.name} [${u.code}] ${u.address ? "(addr)" : "(no addr)"}`));

if (WRITE) {
  for (const u of toUpdate) {
    await c.query(
      `update hr.sites set project_code=$1, address=coalesce($2,address), source=coalesce(source,$3) where id=$4`,
      [u.project_code, u.address, u.source, u.id]
    );
  }
  for (const u of toInsert) {
    await c.query(
      `insert into hr.sites (name, code, address, source, radius_meters, active)
       values ($1,$2,$3,$4,200,true)`,
      [u.name, u.code, u.address, u.source]
    );
  }
  console.log(`\nAPPLIED: ${toUpdate.length} linked, ${toInsert.length} added.`);
}
await c.end();
