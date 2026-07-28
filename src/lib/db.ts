import pg from "pg";

const PAGE_SIZE = 24;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT ?? "6543", 10),
      database: process.env.POSTGRES_DATABASE,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

async function query(text: string, params?: unknown[]) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function queryOnClient(client: pg.PoolClient, text: string, params?: unknown[]) {
  return client.query(text, params);
}

async function fetchAllOnClient(client: pg.PoolClient, text: string, params?: unknown[]) {
  const { rows } = await queryOnClient(client, text, params);
  return rows ?? [];
}

async function fetchOneOnClient(client: pg.PoolClient, text: string, params?: unknown[]) {
  const rows = await fetchAllOnClient(client, text, params);
  return rows[0] ?? null;
}

async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await queryOnClient(client, "BEGIN");
    const result = await fn(client);
    await queryOnClient(client, "COMMIT");
    return result;
  } catch (e) {
    await queryOnClient(client, "ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function fetchAll(text: string, params?: unknown[]) {
  const { rows } = await query(text, params);
  return rows ?? [];
}

export async function fetchOne(text: string, params?: unknown[]) {
  const rows = await fetchAll(text, params);
  return rows[0] ?? null;
}

// ── Ships ──────────────────────────────────────────────────────────

export interface ShipRow {
  id: number;
  name: string;
  data: string;
  submitted_by: string;
  description: string;
  ship_name: string;
  author: string;
  price: number;
  brand: string;
  crew: number;
  tags: string[];
  downloads: number;
  fav: number;
  date: string;
}

export async function getImageData(shipId: number): Promise<ShipRow | null> {
  return fetchOne("SELECT * FROM shipdb WHERE id = $1", [shipId]);
}

export async function getMyShips(user: string) {
  const data = await fetchAll("SELECT * FROM shipdb WHERE submitted_by = $1", [user]);
  return { data, page: 1, max_page: 1 };
}

export async function updateDownloads(shipId: number) {
  await query("UPDATE shipdb SET downloads = downloads + 1 WHERE id = $1", [shipId]);
}

export async function deleteShip(shipId: number, user: string) {
  return transaction(async (client) => {
    const row = await fetchOneOnClient(client, "SELECT submitted_by, data FROM shipdb WHERE id = $1", [shipId]);
    if (!row || user !== row.submitted_by) return { error: "not the owner" };

    await queryOnClient(client, "UPDATE collections SET ships = array_remove(ships, $1) WHERE $1 = ANY(ships)", [shipId]);
    await queryOnClient(client, "UPDATE favoritedb SET favorite = array_remove(favorite, $1) WHERE $1 = ANY(favorite)", [shipId]);
    await queryOnClient(client, "DELETE FROM favoritedb WHERE array_length(favorite, 1) IS NULL", []);
    await queryOnClient(client, "DELETE FROM ship_signatures WHERE ship_id = $1", [shipId]);
    await queryOnClient(client, "DELETE FROM shipdb WHERE id = $1 AND submitted_by = $2", [shipId, user]);
    return { success: `ship ${shipId} deleted`, data: row.data };
  });
}

export async function insertShip({
  name,
  data,
  submittedBy,
  description,
  shipName,
  author,
  price,
  brand,
  crew,
  tags,
  signature,
}: {
  name: string;
  data: string;
  submittedBy: string;
  description: string;
  shipName: string;
  author: string;
  price: number;
  brand: string;
  crew: number;
  tags: string[];
  signature?: string;
}) {
  return transaction(async (client) => {
    const { rows } = await queryOnClient(
      client,
      `INSERT INTO shipdb (name, data, submitted_by, description, ship_name, author, price, brand, crew, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text[]) RETURNING id`,
      [name, data, submittedBy, description, shipName, author, price, brand, crew, tags],
    );
    const shipId = rows[0]?.id;
    if (shipId && signature) {
      await queryOnClient(
        client,
        "INSERT INTO ship_signatures (ship_id, signature) VALUES ($1, $2)",
        [shipId, signature],
      );
    }
    return { success: `${shipId}` };
  });
}

export async function updateShip({
  id,
  name,
  data,
  submittedBy,
  description,
  shipName,
  author,
  price,
  brand,
  crew,
  tags,
  signature,
}: {
  id: number;
  name: string;
  data: string;
  submittedBy: string;
  description: string;
  shipName: string;
  author: string;
  price: number;
  brand: string;
  crew: number;
  tags: string[];
  signature?: string;
}) {
  return transaction(async (client) => {
    await queryOnClient(
      client,
      `UPDATE shipdb SET name=$1, data=$2, submitted_by=$3, description=$4, ship_name=$5,
       author=$6, price=$7, brand=$8, crew=$9, tags=$10::text[] WHERE id=$11`,
      [name, data, submittedBy, description, shipName, author, price, brand, crew, tags, id],
    );
    if (signature) {
      await queryOnClient(client, "DELETE FROM ship_signatures WHERE ship_id = $1", [id]);
      await queryOnClient(
        client,
        "INSERT INTO ship_signatures (ship_id, signature) VALUES ($1, $2)",
        [id, signature],
      );
    }
    return { success: "ship updated" };
  });
}

// ── Favorites ──────────────────────────────────────────────────────

export async function getMyFavorites(user: string) {
  const data = await fetchAll(
    "SELECT * FROM shipdb WHERE id = ANY (SELECT UNNEST(favorite) FROM favoritedb WHERE name = $1)",
    [user],
  );
  return { data, page: 1, max_page: 1 };
}

export async function addToFavorites(user: string, shipId: number) {
  return transaction(async (client) => {
    const row = await fetchOneOnClient(client, "SELECT favorite FROM favoritedb WHERE name = $1 FOR UPDATE", [user]);
    if (!row) {
      await queryOnClient(client, "INSERT INTO favoritedb (name, favorite) VALUES ($1, $2::int[])", [user, [shipId]]);
    } else if (row.favorite.includes(shipId)) {
      return { warning: "already in favorites" };
    } else {
      await queryOnClient(client, "UPDATE favoritedb SET favorite = favorite || $1::int[] WHERE name = $2", [[shipId], user]);
    }
    await queryOnClient(client, "UPDATE shipdb SET fav = fav + 1 WHERE id = $1", [shipId]);
    return { success: "favorited" };
  });
}

export async function deleteFromFavorites(user: string, shipId: number) {
  return transaction(async (client) => {
    const row = await fetchOneOnClient(client, "SELECT favorite FROM favoritedb WHERE name = $1 FOR UPDATE", [user]);
    if (!row) return { warning: "not in favorites" };
    const favorites: number[] = row.favorite;
    const idx = favorites.indexOf(shipId);
    if (idx === -1) return { warning: "not in favorites" };
    favorites.splice(idx, 1);
    if (favorites.length === 0) {
      await queryOnClient(client, "DELETE FROM favoritedb WHERE name = $1", [user]);
    } else {
      await queryOnClient(client, "UPDATE favoritedb SET favorite = $1::int[] WHERE name = $2", [favorites, user]);
    }
    await queryOnClient(client, "UPDATE shipdb SET fav = fav - 1 WHERE id = $1", [shipId]);
    return { success: "unfavorited" };
  });
}

// ── Collections ───────────────────────────────────────────────────

export interface CollectionRow {
  id: number;
  owner: string;
  title: string;
  description: string;
  ships: number[];
  created_at: string;
}

export async function createCollection(owner: string, title: string, description: string) {
  const { rows } = await query(
    "INSERT INTO collections (owner, title, description) VALUES ($1, $2, $3) RETURNING id",
    [owner, title, description],
  );
  return { id: rows[0].id };
}

export async function getCollection(id: number) {
  const col = await fetchOne("SELECT * FROM collections WHERE id = $1", [id]);
  if (!col) return null;
  const ships =
    col.ships?.length > 0
      ? await fetchAll(
          `SELECT * FROM shipdb WHERE id = ANY ($1::int[])`,
          [col.ships],
        )
      : [];
  return { ...col, ships };
}

export async function getUserCollections(owner: string) {
  const rows = await fetchAll(
    "SELECT id, owner, title, description, array_length(ships, 1) AS ship_count, created_at FROM collections WHERE owner = $1 ORDER BY created_at DESC",
    [owner],
  );
  return rows;
}

export async function getAllCollections(page = 1) {
  const PAGE = 24;
  const countRow = await fetchOne("SELECT COUNT(*) FROM collections");
  const total = parseInt(countRow?.count ?? "0", 10);
  const maxPage = Math.ceil(total / PAGE);
  const data = await fetchAll(
    "SELECT id, owner, title, description, array_length(ships, 1) AS ship_count, created_at FROM collections ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [PAGE, (page - 1) * PAGE],
  );
  return { data, page, max_page: maxPage, total_count: total };
}

export async function updateCollection(
  id: number,
  owner: string,
  fields: { title?: string; description?: string },
) {
  const col = await fetchOne("SELECT owner FROM collections WHERE id = $1", [id]);
  if (!col) return { error: "not found" };
  if (col.owner !== owner) return { error: "not the owner" };
  const sets: string[] = [];
  const args: unknown[] = [];
  let idx = 1;
  if (fields.title !== undefined) {
    sets.push(`title = $${idx++}`);
    args.push(fields.title);
  }
  if (fields.description !== undefined) {
    sets.push(`description = $${idx++}`);
    args.push(fields.description);
  }
  if (sets.length === 0) return { error: "nothing to update" };
  args.push(id);
  await query(`UPDATE collections SET ${sets.join(", ")} WHERE id = $${idx}`, args);
  return { success: "collection updated" };
}

export async function deleteCollection(id: number, owner: string) {
  const col = await fetchOne("SELECT owner FROM collections WHERE id = $1", [id]);
  if (!col) return { error: "not found" };
  if (col.owner !== owner) return { error: "not the owner" };
  await query("DELETE FROM collections WHERE id = $1", [id]);
  return { success: "collection deleted" };
}

export async function addShipToCollection(collectionId: number, shipId: number, owner: string) {
  const col = await fetchOne("SELECT owner, ships FROM collections WHERE id = $1", [collectionId]);
  if (!col) return { error: "collection not found" };
  if (col.owner !== owner) return { error: "not the owner" };
  if (col.ships?.includes(shipId)) return { warning: "ship already in collection" };
  await query("UPDATE collections SET ships = COALESCE(ships, '{}') || $1::int[] WHERE id = $2", [[shipId], collectionId]);
  return { success: "ship added" };
}

export async function removeShipFromCollection(
  collectionId: number,
  shipId: number,
  owner: string,
) {
  const col = await fetchOne("SELECT owner, ships FROM collections WHERE id = $1", [collectionId]);
  if (!col) return { error: "collection not found" };
  if (col.owner !== owner) return { error: "not the owner" };
  if (!col.ships?.includes(shipId)) return { warning: "ship not in collection" };
  await query("UPDATE collections SET ships = array_remove(ships, $1) WHERE id = $2", [
    shipId,
    collectionId,
  ]);
  return { success: "ship removed" };
}

export async function getCollectionsForShip(shipId: number) {
  return fetchAll(
    "SELECT id, owner, title, description FROM collections WHERE $1 = ANY(ships)",
    [shipId],
  );
}

// ── Search ─────────────────────────────────────────────────────────

export interface SearchFilters {
  page?: number;
  author?: string;
  desc?: string;
  minprice?: string;
  maxprice?: string;
  "max-crew"?: string;
  order?: string;
  fulltext?: string;
  brand?: string;
  tagsOn?: string[];
  tagsOff?: string[];
}

export async function getSearchPlus(filters: SearchFilters) {
  const conditions: string[] = [];
  const args: unknown[] = [];
  const tagsOn = filters.tagsOn ?? [];
  const tagsOff = filters.tagsOff ?? [];
  const page = filters.page ?? 1;

  const addCond = (val: string) => {
    args.push(val);
    return `$${args.length}`;
  };

  if (tagsOn.length) conditions.push(`tags @> ARRAY[${tagsOn.map(addCond)}]`);
  if (tagsOff.length) conditions.push(`NOT tags @> ARRAY[${tagsOff.map(addCond)}]`);
  if (filters.minprice) conditions.push(`price >= ${addCond(filters.minprice)}`);
  if (filters.maxprice) conditions.push(`price <= ${addCond(filters.maxprice)}`);
  if (filters.author) conditions.push(`author ILIKE ${addCond(`%${filters.author}%`)}`);
  if (filters["max-crew"]) conditions.push(`crew <= ${addCond(filters["max-crew"])}`);
  if (filters.brand === "exl") conditions.push(`brand = ${addCond("exl")}`);
  if (filters.brand === "gen") conditions.push(`brand = ${addCond("gen")}`);

  if (filters.desc) {
    const p1 = addCond(`%${filters.desc}%`);
    const p2 = addCond(`%${filters.desc}%`);
    conditions.push(`(description ILIKE ${p1} OR ship_name ILIKE ${p2})`);
  }
  if (filters.fulltext) {
    conditions.push(`EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE tag LIKE ${addCond(`${filters.fulltext}%`)})`);
  }

  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const countRow = await fetchOne(`SELECT COUNT(*) FROM shipdb${where}`, args);
  const maxPage = Math.ceil(parseInt(countRow?.count ?? "0", 10) / PAGE_SIZE);

  const order =
    filters.order === "fav" ? "fav DESC" :
    filters.order === "pop" ? "downloads DESC" :
    "date DESC";

  const limit = page === -1 ? 999999 : PAGE_SIZE;
  const offset = page === -1 ? null : (page - 1) * PAGE_SIZE;

  let sql = `SELECT * FROM shipdb${where} ORDER BY ${order} LIMIT ${limit}`;
  if (offset != null) sql += ` OFFSET ${offset}`;

  const data = await fetchAll(sql, args);
  const total_count = parseInt(countRow?.count ?? "0", 10);
  return { data, page, max_page: page === -1 ? 1 : maxPage, total_count };
}

// Also parse from query string — supports both old and new URL formats
export async function searchFromQueryString(queryString: string) {
  const filters: SearchFilters = {};
  let page = 1;
  const tagsOn: string[] = [];
  const tagsOff: string[] = [];

  for (const part of (queryString ?? "").split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const val = decodeURIComponent(part.slice(eq + 1)).replace(/\+/g, " ");

    if (key === "page") { page = parseInt(val, 10) || 1; continue; }
    if (key === "order") { filters.order = val; continue; }
    if (key === "q") { filters.desc = val; continue; }
    if (key === "tag") { tagsOn.push(val); continue; }
    if (key === "notag") { tagsOff.push(val); continue; }
    if (["author", "desc", "minprice", "maxprice", "max-crew", "order", "fulltext", "brand"].includes(key)) {
      (filters as Record<string, string>)[key] = val;
    } else if (val === "1") {
      tagsOn.push(key);
    } else if (val === "0") {
      tagsOff.push(key);
    }
  }

  if (tagsOn.length) filters.tagsOn = tagsOn;
  if (tagsOff.length) filters.tagsOff = tagsOff;
  filters.page = page;
  return getSearchPlus(filters);
}

// ── Metadata ───────────────────────────────────────────────────────

export async function getAuthorsWithCounts() {
  return fetchAll(
    "SELECT author, COUNT(*)::int AS count FROM shipdb GROUP BY author ORDER BY count DESC, author"
  );
}

export async function getTagsWithCounts() {
  return fetchAll(
    "SELECT tag, COUNT(*)::int AS count FROM (SELECT unnest(tags) AS tag FROM shipdb) sub GROUP BY tag ORDER BY count DESC, tag"
  );
}

// ── Signatures ────────────────────────────────────────────────────

export async function findDuplicateBySignature(signature: string) {
  return fetchAll(
    `SELECT ss.ship_id AS id, s.ship_name, s.author
     FROM ship_signatures ss
     JOIN shipdb s ON s.id = ss.ship_id
     WHERE ss.signature = $1
     LIMIT 5`,
    [signature],
  );
}
