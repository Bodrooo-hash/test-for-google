import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { externalSupabase } from "@/lib/externalSupabase";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const Login = () => {
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Загрузка…</p>
      </div>);

  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await externalSupabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (authError) {
      setError("Неверный e-mail или пароль");
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-5 rounded-lg border bg-card p-8 shadow-sm">
        
        <p className="text-sm text-muted-foreground text-center">elllement.online.app</p>
        

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="example@elllement.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required />
          
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required />
          
        </div>

        {error &&
        <p className="text-sm text-destructive font-medium">{error}</p>
        }

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-blue1 hover:bg-blue1/90 text-white">
          
          {loading ? "Вход…" : "Войти"}
        </Button>
      </form>
    </div>);

};

export default Login;