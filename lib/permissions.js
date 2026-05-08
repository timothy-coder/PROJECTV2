export function hasPerm(userPermissions, permTuple) {
  // permTuple ejemplo: ["usuarios","view"]
  if (!permTuple?.length) return true;
  const [module, action] = permTuple;

  const mod = userPermissions?.[module];
  if (!mod) return false;

  return Boolean(mod?.[action]);
}