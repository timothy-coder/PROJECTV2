import { hasPerm } from "@/lib/permissions";

export function canViewTab(userPermissions, tab) {
  const tabPerms = tab.perms || [tab.perm];

  return tabPerms.some((perm) => hasPerm(userPermissions, perm));
}

export function canUseAction(userPermissions, tab, action) {
  const specificPerm = tab.actions?.[action];

  return hasPerm(userPermissions, specificPerm);
}
