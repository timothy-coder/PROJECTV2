"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LogOut } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";

// Asumo que ya tienes estos componentes (shadcn o similares)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const DEFAULT_BRAND = "#5e17eb";

export default function LoginCard() {
  const router = useRouter();
  const { user, booting, login, logout, isAuthenticated } = useAuth();

  const BRAND = user?.color || DEFAULT_BRAND;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true); // (placeholder; cookie ya es httpOnly)
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoToPortal = () => router.push("/portal");

  const handleLogout = async () => {
    setError("");
    await logout();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ username, password });
      // redirige donde quieras
      router.push("/home");
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-svh w-full flex items-center justify-center px-4 bg-slate-950 text-slate-200">
        Cargando...
      </div>
    );
  }

  // ✅ Sesión activa
  if (isAuthenticated) {
    return (
      <div className="min-h-svh w-full flex items-center justify-center px-4 bg-slate-950">
        <Card className="w-full max-w-3xl overflow-hidden shadow-sm border-white/10 bg-slate-950">
          <div className="flex flex-col md:flex-row">
            <aside className="w-full md:w-5/12 p-6 md:p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
              <div className="text-center">
                <img src="/Logopreview.png" alt="Logo" className="max-h-40 mx-auto" />
                <p className="text-lg font-semibold mt-2 text-white">¡Bienvenido de vuelta!</p>
                <p className="text-sm text-slate-400">Ya tienes sesión iniciada</p>
              </div>
            </aside>

            <div className="w-full md:w-7/12">
              <CardHeader>
                <CardTitle className="text-2xl font-bold" style={{ color: BRAND }}>
                  Sesión Iniciada
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                  <p className="text-sm text-slate-400 mb-2">Usuario autenticado:</p>
                  <p className="text-xl font-semibold text-white">{user.fullname}</p>
                  
                  <p className="text-sm text-slate-400 mt-1">{user.email}</p>
                </div>

                <div className="space-y-3 pt-4">
                  <Button
                    onClick={handleGoToPortal}
                    className="w-full text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    Ir al portal
                  </Button>

                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full text-black bg-white border-white/10 hover:bg-white/5 hover:text-white"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar sesión
                  </Button>
                </div>
              </CardContent>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ✅ Form login
  return (
    <div className="min-h-svh w-full flex items-center justify-center px-4 bg-slate-950">
      <Card className="w-full max-w-3xl overflow-hidden shadow-sm border-white/10 bg-slate-950">
        <div className="flex flex-col md:flex-row">
          <aside className="w-full md:w-5/12 p-6 md:p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
            <div className="text-center">
              <img src="/Logopreview.png" alt="Logo" className="max-h-40 mx-auto" />
              <p className="text-lg font-semibold mt-2 text-white">Bienvenido</p>
              <p className="text-sm text-slate-400">Ingresa con tu usuario y contraseña</p>
            </div>
          </aside>

          <div className="w-full md:w-7/12">
            <CardHeader>
              <CardTitle className="text-2xl font-bold" style={{ color: DEFAULT_BRAND }}>
                Iniciar sesión
              </CardTitle>
            </CardHeader>

            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="username" className="text-slate-200">
                    Usuario
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    autoComplete="username"
                    className="bg-slate-950/40 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password" className="text-slate-200">
                    Contraseña
                  </Label>

                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      autoComplete="current-password"
                      className="pr-10 bg-slate-950/40 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(Boolean(v))}
                  />
                  <Label htmlFor="remember" className="text-slate-200">
                    Recordarme
                  </Label>
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500 text-red-200 p-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white"
                  style={{ backgroundColor: DEFAULT_BRAND }}
                >
                  {loading ? "Ingresando..." : "Ingresar"}
                </Button>
              </CardContent>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}