import { hasPerm } from "@/lib/permissions";

export function canViewPointOfSaleModule(user, moduleKey) {
  const permissions = user?.permissions || {};
  return Boolean(
    hasPerm(permissions, [moduleKey, "view"]) ||
      hasPerm(permissions, [moduleKey, "viewteam"]) ||
      hasPerm(permissions, [moduleKey, "viewall"]) ||
      hasPerm(permissions, ["puntoventa", "view"])
  );
}

export function buildPointOfSaleQuoteScope(user, {
  moduleKey = "puntoventa_cotizaciones",
  quoteAlias = "q",
  createdColumn = `${quoteAlias}.created_by`,
  includeMovements = true,
} = {}) {
  const permissions = user?.permissions || {};
  const userId = user?.id;
  const canViewAll = hasPerm(permissions, [moduleKey, "viewall"]) || hasPerm(permissions, ["puntoventa", "viewall"]);
  const canViewTeam = hasPerm(permissions, [moduleKey, "viewteam"]);

  if (canViewAll) return { where: "", params: [], canViewAll, canViewTeam };

  const clauses = [`${createdColumn} = ?`];
  const params = [userId];

  if (canViewTeam) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM configuracion_puntos_venta pv_scope
      LEFT JOIN administracion_usuario_talleres ut_scope
        ON ut_scope.taller_id = pv_scope.taller_id AND ut_scope.usuario_id = ?
      LEFT JOIN administracion_usuario_mostradores um_scope
        ON um_scope.mostrador_id = pv_scope.mostrador_id AND um_scope.usuario_id = ?
      WHERE pv_scope.id = ${quoteAlias}.punto_venta_id
        AND (
          (pv_scope.taller_id IS NOT NULL AND ut_scope.usuario_id IS NOT NULL)
          OR (pv_scope.mostrador_id IS NOT NULL AND um_scope.usuario_id IS NOT NULL)
        )
    )`);
    params.push(userId, userId);
  }

  if (includeMovements) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM posventa_punto_venta_movimientos mov_scope
      LEFT JOIN administracion_usuario_talleres ut_mov_scope
        ON ut_mov_scope.taller_id = mov_scope.destino_taller_id AND ut_mov_scope.usuario_id = ?
      LEFT JOIN administracion_usuario_mostradores um_mov_scope
        ON um_mov_scope.mostrador_id = mov_scope.destino_mostrador_id AND um_mov_scope.usuario_id = ?
      WHERE mov_scope.cotizacion_id = ${quoteAlias}.id
        AND (
          (mov_scope.destino_taller_id IS NOT NULL AND ut_mov_scope.usuario_id IS NOT NULL)
          OR (mov_scope.destino_mostrador_id IS NOT NULL AND um_mov_scope.usuario_id IS NOT NULL)
        )
    )`);
    params.push(userId, userId);
  }

  return {
    where: `(${clauses.join(" OR ")})`,
    params,
    canViewAll,
    canViewTeam,
  };
}
