"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const labels = {
  motivo: "motivo",
  submotivo: "submotivo",
};

export function DeleteAppointmentReasonDialog({ open, type, item, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <DeleteAppointmentReasonDialogContent
      key={`${type}-${item?.id || "delete"}`}
      type={type}
      item={item}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function DeleteAppointmentReasonDialogContent({ type, item, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const label = labels[type] || "registro";

  async function handleDelete() {
    setDeleting(true);
    setError("");

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo eliminar el registro.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <AlertTriangle className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-950">Eliminar {label}</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Esta accion eliminara {item?.nombre ? `"${item.nombre}"` : "el registro seleccionado"}.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}
