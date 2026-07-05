"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, PlugZap, ShieldCheck, TriangleAlert } from "lucide-react";

import { apiFetch } from "@/app/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ExternalApiPage() {
  const [loginState, setLoginState] = useState({ loading: false, result: null, error: "" });
  const [statusState, setStatusState] = useState({ loading: false, result: null, error: "" });
  const [credentials, setCredentials] = useState({ email: "", password: "" });

  async function testLogin() {
    setLoginState({ loading: true, result: null, error: "" });
    try {
      const result = await apiFetch("/api/external/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setLoginState({ loading: false, result, error: "" });
    } catch (error) {
      setLoginState({ loading: false, result: null, error: error.message || "No se pudo validar credenciales." });
    }
  }

  async function testStatus() {
    setStatusState({ loading: true, result: null, error: "" });
    try {
      const result = await apiFetch("/api/external/status");
      setStatusState({ loading: false, result, error: "" });
    } catch (error) {
      setStatusState({ loading: false, result: null, error: error.message || "No se pudo consultar la API externa." });
    }
  }

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-3 flex flex-col gap-3 border-b border-violet-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">API Externa</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Valida credenciales y conexión sin exponer tokens en el navegador</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <ShieldCheck className="size-4" />
          Servidor Node
        </div>
      </header>

      <section className="grid gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-3">
          <ActionCard
            icon={KeyRound}
            title="Probar credenciales"
            description="Envia email/password manuales o los configurados en .env.local y verifica si la API devuelve token."
            button="Validar login"
            loading={loginState.loading}
            onClick={testLogin}
          >
            <div className="mb-3 grid gap-2">
              <Input
                type="email"
                value={credentials.email}
                onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
                placeholder="Correo de la API"
                className="h-9 bg-white text-sm"
              />
              <Input
                type="password"
                value={credentials.password}
                onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                placeholder="Contraseña de la API"
                className="h-9 bg-white text-sm"
              />
              <p className="text-[11px] font-medium text-slate-500">Si lo dejas vacío, se usa lo configurado en .env.local.</p>
            </div>
          </ActionCard>
          <ActionCard
            icon={PlugZap}
            title="Probar endpoint"
            description="Usa el token generado y consulta EXTERNAL_API_STATUS_PATH."
            button="Consultar estado"
            loading={statusState.loading}
            onClick={testStatus}
          />
        </div>

        <div className="space-y-3">
          <ResultPanel title="Resultado credenciales" state={loginState} />
          <ResultPanel title="Resultado endpoint" state={statusState} />
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs font-medium text-slate-600 shadow-sm">
            <p className="mb-2 font-bold text-slate-900">Variables requeridas</p>
            <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">{`EXTERNAL_API_BASE_URL=https://uatopenapi.somosclear.com
EXTERNAL_API_LOGIN_URL=https://uatopenapi.somosclear.com/api/users/login
EXTERNAL_API_EMAIL=tu_correo
EXTERNAL_API_PASSWORD=tu_password
EXTERNAL_API_STATUS_PATH=/ruta/opcional`}</pre>
          </div>
        </div>
      </section>
    </main>
  );
}

function ActionCard({ icon: Icon, title, description, button, loading, onClick, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-violet-700 text-white">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      {children}
      <Button className="h-10 w-full bg-violet-700 text-white hover:bg-violet-800" onClick={onClick} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {button}
      </Button>
    </section>
  );
}

function ResultPanel({ title, state }) {
  const hasResult = Boolean(state.result);
  const hasError = Boolean(state.error);
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-violet-700">{title}</h2>
        {state.loading ? <Loader2 className="size-4 animate-spin text-violet-700" /> : null}
        {!state.loading && hasResult ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
        {!state.loading && hasError ? <TriangleAlert className="size-4 text-red-600" /> : null}
      </div>
      <div className="p-4">
        {state.loading ? <p className="text-sm font-semibold text-slate-500">Consultando...</p> : null}
        {hasError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{state.error}</p> : null}
        {hasResult ? (
          <pre className="max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
            {JSON.stringify(state.result, null, 2)}
          </pre>
        ) : null}
        {!state.loading && !hasError && !hasResult ? <p className="text-sm font-semibold text-slate-400">Sin consulta ejecutada.</p> : null}
      </div>
    </section>
  );
}
