"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function PasswordInput({ id, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-10 pr-10 text-sm"
      />
      <button
        type="button"
        onClick={() => setShow((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
        aria-label={show ? "Ocultar contrasena" : "Mostrar contrasena"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function ProfilePage({ user }) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);

  const initials = (user?.fullname || user?.username || "Usuario")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      toast.error("Completa todos los campos.");
      return;
    }

    if (form.newPassword.length < 8) {
      toast.error("La nueva contrasena debe tener al menos 8 caracteres.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error("La confirmacion no coincide.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "No se pudo cambiar la contrasena.");
      }

      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Contrasena actualizada correctamente.");
    } catch (error) {
      toast.error(error?.message || "No se pudo cambiar la contrasena.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-950 md:p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <section className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">
            {initials || "U"}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
            <p className="text-sm text-slate-500">Actualiza solo tu contrasena de acceso.</p>
          </div>
        </section>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserRound className="h-5 w-5 text-indigo-600" />
              Usuario logueado
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Nombre</p>
              <p className="mt-1 text-sm font-semibold">{user?.fullname || "-"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Usuario</p>
              <p className="mt-1 text-sm font-semibold">{user?.username || "-"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Correo</p>
              <p className="mt-1 text-sm font-semibold">{user?.email || "-"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Rol</p>
              <p className="mt-1 text-sm font-semibold">{user?.role?.name || "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="h-5 w-5 text-indigo-600" />
              Cambiar contrasena
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Contrasena actual</Label>
                <PasswordInput
                  id="currentPassword"
                  value={form.currentPassword}
                  onChange={updateField("currentPassword")}
                  placeholder="Ingresa tu contrasena actual"
                  autoComplete="current-password"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva contrasena</Label>
                  <PasswordInput
                    id="newPassword"
                    value={form.newPassword}
                    onChange={updateField("newPassword")}
                    placeholder="Minimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={form.confirmPassword}
                    onChange={updateField("confirmPassword")}
                    placeholder="Repite la nueva contrasena"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button type="submit" disabled={saving} className="bg-indigo-600 text-white hover:bg-indigo-700">
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
