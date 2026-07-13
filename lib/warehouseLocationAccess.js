import { pool } from "@/lib/db";

export async function userCanAccessShelf(userId, shelfId) {
  if (!userId || !shelfId) return false;
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM almacen_anaqueles a
     LEFT JOIN administracion_usuario_talleres ut
       ON ut.taller_id = a.taller_id AND ut.usuario_id = ?
     LEFT JOIN administracion_usuario_mostradores um
       ON um.mostrador_id = a.mostrador_id AND um.usuario_id = ?
     WHERE a.id = ?
       AND (
         (a.taller_id IS NOT NULL AND ut.usuario_id IS NOT NULL)
         OR (a.mostrador_id IS NOT NULL AND um.usuario_id IS NOT NULL)
         OR (a.taller_id IS NULL AND a.mostrador_id IS NULL)
       )
     LIMIT 1`,
    [userId, userId, shelfId]
  );
  return Boolean(row?.ok);
}

export async function userCanAccessLevel(userId, levelId) {
  if (!userId || !levelId) return false;
  const [[row]] = await pool.query(
    `SELECT anaquel_id
     FROM almacen_anaquel_niveles
     WHERE id = ?
     LIMIT 1`,
    [levelId]
  );
  return userCanAccessShelf(userId, row?.anaquel_id);
}
